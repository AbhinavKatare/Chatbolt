import crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { db } from '../db'
import { logger } from '../services/logger.service'

export interface EnterpriseEntitlements {
  tenantId: string
  plan: 'enterprise' | 'custom'
  licensedTo?: string
  expiresAt: string
  maxConcurrentAgents: number
  features: string[]
  verifiedAt: string
  source: 'digital_key' | 'stripe_subscription'
}

export interface LicenseValidationResult {
  valid: boolean
  error?: string
  entitlements?: EnterpriseEntitlements
  isCachedGracePeriod?: boolean
}

export class EnterpriseLicenseService {
  private licenseSecret: string
  private cache: Map<string, { entitlements: EnterpriseEntitlements; cachedAt: number }> = new Map()
  private GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days offline grace period

  constructor() {
    this.licenseSecret = process.env.ENTERPRISE_LICENSE_SECRET || process.env.VAULT_ENCRYPTION_KEY || 'chatbolt_ent_signing_master_key_2026'
  }

  /**
   * Generates a cryptographically signed enterprise license key
   * Format: CB-ENT-V1.<payload_base64>.<hmac_signature_hex>
   */
  generateLicenseKey(params: {
    tenantId: string
    licensedTo?: string
    plan?: 'enterprise' | 'custom'
    expiresAt: string
    maxConcurrentAgents?: number
    features?: string[]
  }): string {
    const payload = {
      tenantId: params.tenantId,
      licensedTo: params.licensedTo || 'Enterprise Customer',
      plan: params.plan || 'enterprise',
      expiresAt: params.expiresAt,
      maxConcurrentAgents: params.maxConcurrentAgents || 50,
      features: params.features || ['company_orchestrator', 'sla_post_mortem', 'unlimited_concurrency', 'custom_models'],
      issuedAt: new Date().toISOString()
    }

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = crypto
      .createHmac('sha256', this.licenseSecret)
      .update(payloadBase64)
      .digest('hex')

    return `CB-ENT-V1.${payloadBase64}.${signature}`
  }

  /**
   * Validates a signed enterprise license key against cryptographic HMAC and expiration
   */
  validateLicenseKey(licenseKey: string, targetTenantId?: string): LicenseValidationResult {
    if (!licenseKey || typeof licenseKey !== 'string') {
      return { valid: false, error: 'License key is missing or invalid format' }
    }

    const parts = licenseKey.trim().split('.')
    if (parts.length !== 3 || parts[0] !== 'CB-ENT-V1') {
      return { valid: false, error: 'Malformed license key header (must start with CB-ENT-V1)' }
    }

    const [, payloadBase64, providedSig] = parts

    // 1. Verify HMAC Signature
    const expectedSig = crypto
      .createHmac('sha256', this.licenseSecret)
      .update(payloadBase64)
      .digest('hex')

    const sigBufferA = Buffer.from(providedSig, 'hex')
    const sigBufferB = Buffer.from(expectedSig, 'hex')

    if (sigBufferA.length !== sigBufferB.length || !crypto.timingSafeEqual(sigBufferA, sigBufferB)) {
      return { valid: false, error: 'Cryptographic signature verification failed (tampered key)' }
    }

    // 2. Parse payload
    try {
      const decodedJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8')
      const payload = JSON.parse(decodedJson)

      // 3. Verify tenant match if provided
      if (targetTenantId && payload.tenantId !== targetTenantId && payload.tenantId !== '00000000-0000-0000-0000-000000000000') {
        return { valid: false, error: `License key belongs to tenant '${payload.tenantId}', not '${targetTenantId}'` }
      }

      // 4. Check expiration
      const expirationDate = new Date(payload.expiresAt)
      if (isNaN(expirationDate.getTime()) || expirationDate.getTime() < Date.now()) {
        return { valid: false, error: `Enterprise license expired on ${payload.expiresAt}` }
      }

      const entitlements: EnterpriseEntitlements = {
        tenantId: payload.tenantId,
        plan: payload.plan || 'enterprise',
        licensedTo: payload.licensedTo,
        expiresAt: payload.expiresAt,
        maxConcurrentAgents: payload.maxConcurrentAgents || 50,
        features: payload.features || [],
        verifiedAt: new Date().toISOString(),
        source: 'digital_key'
      }

      // Store in memory cache
      this.cache.set(payload.tenantId, { entitlements, cachedAt: Date.now() })

      return { valid: true, entitlements }
    } catch (err: any) {
      return { valid: false, error: `Failed to decode license payload: ${err.message}` }
    }
  }

  /**
   * Validates whether a tenant is entitled to enterprise features
   * (Checks active digital key, local cache grace period, or Stripe enterprise subscription)
   */
  async verifyTenantEnterpriseStatus(tenantId: string): Promise<LicenseValidationResult> {
    if (!tenantId) {
      return { valid: false, error: 'Tenant ID required for enterprise verification' }
    }

    // 1. Check in-memory valid cache
    const cached = this.cache.get(tenantId)
    if (cached) {
      const isWithinGrace = (Date.now() - cached.cachedAt) < this.GRACE_PERIOD_MS
      const isNotExpired = new Date(cached.entitlements.expiresAt).getTime() > Date.now()
      if (isWithinGrace && isNotExpired) {
        return { valid: true, entitlements: cached.entitlements, isCachedGracePeriod: true }
      }
    }

    // 2. Check Database tenant plan and metadata for digital key or active stripe subscription
    try {
      const { rows } = await db.query(
        `SELECT id, plan, stripe_subscription_id, is_active, metadata FROM tenants WHERE id = $1`,
        [tenantId]
      )

      if (rows && rows.length > 0) {
        const tenant = rows[0]
        const meta = typeof tenant.metadata === 'string' ? JSON.parse(tenant.metadata) : (tenant.metadata || {})

        // Check stored digital license key
        if (meta.enterprise_license_key) {
          const keyValidation = this.validateLicenseKey(meta.enterprise_license_key, tenantId)
          if (keyValidation.valid) {
            return keyValidation
          }
        }

        // Check Stripe enterprise plan
        if (tenant.is_active && (tenant.plan === 'enterprise' || tenant.plan === 'custom')) {
          const entitlements: EnterpriseEntitlements = {
            tenantId,
            plan: tenant.plan,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            maxConcurrentAgents: 50,
            features: ['company_orchestrator', 'sla_post_mortem', 'unlimited_concurrency', 'custom_models'],
            verifiedAt: new Date().toISOString(),
            source: 'stripe_subscription'
          }
          this.cache.set(tenantId, { entitlements, cachedAt: Date.now() })
          return { valid: true, entitlements }
        }
      }
    } catch (err: any) {
      logger.warn('[EnterpriseLicense] DB lookup failed, checking offline grace cache: ' + err.message)
      if (cached && (Date.now() - cached.cachedAt) < this.GRACE_PERIOD_MS) {
        return { valid: true, entitlements: cached.entitlements, isCachedGracePeriod: true }
      }
    }

    return {
      valid: false,
      error: 'Tenant does not have an active Enterprise Commercial License or active Enterprise subscription.'
    }
  }

  /**
   * Express middleware to protect enterprise-only endpoints
   */
  requireEnterpriseLicense = async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenant?.id || req.headers['x-tenant-id'] as string || req.body?.tenantId

    if (!tenantId) {
      return res.status(401).json({
        error: 'TENANT_AUTH_REQUIRED',
        message: 'Authentication required to access enterprise capabilities.'
      })
    }

    // Check optional header license override
    const headerKey = req.headers['x-enterprise-license-key'] as string
    if (headerKey) {
      const headerCheck = this.validateLicenseKey(headerKey, tenantId)
      if (headerCheck.valid) {
        ;(req as any).enterpriseEntitlements = headerCheck.entitlements
        return next()
      }
    }

    const check = await this.verifyTenantEnterpriseStatus(tenantId)
    if (check.valid && check.entitlements) {
      ;(req as any).enterpriseEntitlements = check.entitlements
      return next()
    }

    return res.status(402).json({
      error: 'ENTERPRISE_LICENSE_REQUIRED',
      message: check.error || 'This feature requires an active Chatbolt Enterprise License.',
      upgradeUrl: 'https://chatbolt.ai/enterprise',
      status: 'payment_required'
    })
  }
}

export const enterpriseLicenseService = new EnterpriseLicenseService()
