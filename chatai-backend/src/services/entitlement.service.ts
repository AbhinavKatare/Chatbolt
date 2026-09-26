import { Request, Response, NextFunction } from 'express'
import { queryOne } from '../db'
import { enterpriseLicenseService } from '../enterprise/enterprise-license.service'
import { logger } from './logger.service'

export type PlanTier = 'free' | 'pro' | 'team' | 'enterprise'

export type FeatureKey =
  | 'company_orchestration'
  | 'sla_post_mortem'
  | 'custom_models'
  | 'soc2_audit_export'
  | 'team_workforce'
  | 'team_shared_memory'
  | 'high_concurrency_pool'
  | 'pro_agents'
  | 'unlimited_concurrency'

export interface EntitlementCheckResult {
  allowed: boolean
  plan: PlanTier
  feature: FeatureKey
  source: 'stripe_subscription' | 'digital_key' | 'tenant_record' | 'default_free'
  reason?: string
  requiredTiers: PlanTier[]
  upgradeUrl?: string
}

// Map each feature to the minimum plan tiers permitted to access it
export const FEATURE_TIER_MATRIX: Record<FeatureKey, PlanTier[]> = {
  company_orchestration: ['enterprise'],
  sla_post_mortem: ['enterprise'],
  custom_models: ['enterprise'],
  soc2_audit_export: ['enterprise'],
  unlimited_concurrency: ['enterprise'],
  team_workforce: ['team', 'enterprise'],
  team_shared_memory: ['team', 'enterprise'],
  high_concurrency_pool: ['team', 'enterprise'],
  pro_agents: ['pro', 'team', 'enterprise']
}

interface EntitlementCacheEntry {
  plan: PlanTier
  isEnterpriseLicensed: boolean
  expiresAt: number
}

export class EntitlementService {
  private cache: Map<string, EntitlementCacheEntry> = new Map()
  private CACHE_TTL_MS = 3 * 60 * 1000 // 3 minutes cache

  /**
   * Invalidates cached entitlement for a given tenant (called on Stripe webhook or license activation)
   */
  invalidateTenantCache(tenantId: string): void {
    if (tenantId) {
      this.cache.delete(tenantId)
      try {
        const { billingService } = require('./billing.service')
        billingService?.clearPlanCache?.(tenantId)
      } catch {}
      logger.info(`[EntitlementService] Flushed cache for tenant '${tenantId}'`)
    }
  }

  /**
   * Resolves the authoritative active plan and enterprise license status for a tenant
   */
  async resolveTenantTier(tenantId: string): Promise<{ plan: PlanTier; isEnterpriseLicensed: boolean; source: EntitlementCheckResult['source'] }> {
    if (!tenantId) {
      return { plan: 'free', isEnterpriseLicensed: false, source: 'default_free' }
    }

    const cached = this.cache.get(tenantId)
    if (cached && cached.expiresAt > Date.now()) {
      return {
        plan: cached.plan,
        isEnterpriseLicensed: cached.isEnterpriseLicensed,
        source: cached.isEnterpriseLicensed ? 'digital_key' : 'stripe_subscription'
      }
    }

    // 1. Check digital enterprise license key first (can grant enterprise regardless of Stripe)
    const entKeyCheck = await enterpriseLicenseService.verifyTenantEnterpriseStatus(tenantId)
    if (entKeyCheck.valid && entKeyCheck.entitlements) {
      const plan = entKeyCheck.entitlements.plan === 'enterprise' ? 'enterprise' : 'enterprise'
      this.cache.set(tenantId, {
        plan,
        isEnterpriseLicensed: true,
        expiresAt: Date.now() + this.CACHE_TTL_MS
      })
      return { plan, isEnterpriseLicensed: true, source: entKeyCheck.entitlements.source }
    }

    // 2. Query Postgres for active Stripe subscription
    try {
      const activeSub = await queryOne<{ plan: string; status: string; current_period_end: Date }>(
        `SELECT plan, status, current_period_end FROM subscriptions 
         WHERE user_id = $1 AND status = 'active' AND current_period_end > NOW() 
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId]
      )

      if (activeSub && activeSub.plan) {
        const normalized = this.normalizeTier(activeSub.plan)
        this.cache.set(tenantId, {
          plan: normalized,
          isEnterpriseLicensed: normalized === 'enterprise',
          expiresAt: Date.now() + this.CACHE_TTL_MS
        })
        return { plan: normalized, isEnterpriseLicensed: normalized === 'enterprise', source: 'stripe_subscription' }
      }

      // 3. Fallback to tenants table plan column
      const tenant = await queryOne<{ plan: string; is_active: boolean }>(
        `SELECT plan, is_active FROM tenants WHERE id = $1`,
        [tenantId]
      )

      if (tenant && tenant.is_active && tenant.plan) {
        const normalized = this.normalizeTier(tenant.plan)
        this.cache.set(tenantId, {
          plan: normalized,
          isEnterpriseLicensed: normalized === 'enterprise',
          expiresAt: Date.now() + this.CACHE_TTL_MS
        })
        return { plan: normalized, isEnterpriseLicensed: normalized === 'enterprise', source: 'tenant_record' }
      }
    } catch (err: any) {
      logger.warn(`[EntitlementService] DB lookup failed for tenant '${tenantId}': ${err.message}`)
    }

    // Default fallback: free
    this.cache.set(tenantId, {
      plan: 'free',
      isEnterpriseLicensed: false,
      expiresAt: Date.now() + 60 * 1000 // 1 minute for unauthenticated / errored
    })
    return { plan: 'free', isEnterpriseLicensed: false, source: 'default_free' }
  }

  /**
   * Evaluates if a tenant is entitled to execute a given feature
   */
  async checkEntitlement(tenantId: string, feature: FeatureKey): Promise<EntitlementCheckResult> {
    const requiredTiers = FEATURE_TIER_MATRIX[feature] || ['enterprise']
    const { plan, isEnterpriseLicensed, source } = await this.resolveTenantTier(tenantId)

    // Enterprise digital license grants all features
    if (isEnterpriseLicensed || plan === 'enterprise') {
      return {
        allowed: true,
        plan: 'enterprise',
        feature,
        source: isEnterpriseLicensed ? 'digital_key' : 'stripe_subscription',
        requiredTiers
      }
    }

    const isAllowed = requiredTiers.includes(plan)

    if (!isAllowed) {
      const minRequired = requiredTiers[0].toUpperCase()
      return {
        allowed: false,
        plan,
        feature,
        source,
        requiredTiers,
        reason: `Feature '${feature}' requires an active ${minRequired} subscription. Current tier is ${plan.toUpperCase()}.`,
        upgradeUrl: `/dashboard/settings/billing?upgrade=${requiredTiers[0]}&feature=${feature}`
      }
    }

    return {
      allowed: true,
      plan,
      feature,
      source,
      requiredTiers
    }
  }

  /**
   * Express middleware to strictly enforce server-side feature entitlements
   */
  requireEntitlement(feature: FeatureKey) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const tenantId = (req as any).tenantId || (req as any).tenant?.id || (req.headers['x-tenant-id'] as string)

      if (!tenantId) {
        return res.status(401).json({
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Valid authentication required to access this resource.',
          statusCode: 401
        })
      }

      // Check header license key override if provided
      const headerKey = req.headers['x-enterprise-license-key'] as string
      if (headerKey) {
        const headerValidation = enterpriseLicenseService.validateLicenseKey(headerKey, tenantId)
        if (headerValidation.valid) {
          ;(req as any).entitlement = {
            allowed: true,
            plan: 'enterprise',
            feature,
            source: 'digital_key'
          }
          return next()
        }
      }

      const check = await this.checkEntitlement(tenantId, feature)
      if (check.allowed) {
        ;(req as any).entitlement = check
        return next()
      }

      logger.warn(`[Entitlement Gate] Tenant '${tenantId}' (Plan: ${check.plan}) blocked from feature '${feature}'. Required: ${check.requiredTiers.join(', ')}`)

      return res.status(402).json({
        error: 'PAYMENT_REQUIRED',
        code: 'FEATURE_NOT_ENTITLED',
        message: check.reason,
        feature,
        currentTier: check.plan,
        requiredTiers: check.requiredTiers,
        upgradeUrl: check.upgradeUrl || '/dashboard/settings/billing',
        statusCode: 402
      })
    }
  }

  /**
   * Express middleware to enforce minimum plan tier
   */
  requirePlanTier(minTier: PlanTier) {
    const tierWeights: Record<PlanTier, number> = {
      free: 0,
      pro: 1,
      team: 2,
      enterprise: 3
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      const tenantId = (req as any).tenantId || (req as any).tenant?.id || (req.headers['x-tenant-id'] as string)

      if (!tenantId) {
        return res.status(401).json({
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Valid authentication required to access this resource.'
        })
      }

      const { plan } = await this.resolveTenantTier(tenantId)
      const currentWeight = tierWeights[plan] || 0
      const requiredWeight = tierWeights[minTier] || 0

      if (currentWeight >= requiredWeight) {
        return next()
      }

      return res.status(402).json({
        error: 'TIER_UPGRADE_REQUIRED',
        message: `This action requires a ${minTier.toUpperCase()} plan or higher. Your current plan is ${plan.toUpperCase()}.`,
        currentTier: plan,
        requiredTier: minTier,
        upgradeUrl: `/dashboard/settings/billing?upgrade=${minTier}`,
        statusCode: 402
      })
    }
  }

  private normalizeTier(rawTier: string): PlanTier {
    const p = (rawTier || 'free').toLowerCase()
    if (p === 'enterprise' || p === 'custom') return 'enterprise'
    if (p === 'team') return 'team'
    if (p === 'pro' || p === 'premium') return 'pro'
    return 'free'
  }
}

export const entitlementService = new EntitlementService()
