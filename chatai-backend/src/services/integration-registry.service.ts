import { query, queryOne } from '../db'
import crypto from 'crypto'
import { logger } from './logger.service'
import axios from 'axios'

export type IntegrationService = 
  | 'gmail' 
  | 'google_calendar' 
  | 'google_drive' 
  | 'slack' 
  | 'notion' 
  | 'outlook_email' 
  | 'outlook_calendar'
  | 'microsoft-teams'
  | 'airtable'
  | 'jira'
  | 'browser'
  | 'github'
  | 'linear'
  | 'hubspot'
  | 'stripe'
  | 'outlook'
  | 'teams'

export interface OAuthTokens {
  access_token: string
  refresh_token?: string
  expires_at?: string | number | Date
  scopes?: string
}

const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.VAULT_ENCRYPTION_KEY || 'chatbolt_integration_encryption_key_2026_super_secret!'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getSecretKey() {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
}

export function encryptGCM(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = getSecretKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return iv.toString('hex') + ':' + authTag + ':' + encrypted
}

export function decryptGCM(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid GCM ciphertext format')
  
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encryptedText = Buffer.from(parts[2], 'hex')
  const key = getSecretKey()
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString('utf8')
}

function normalizeService(service: string): string {
  if (service === 'google_calendar') return 'google-calendar'
  if (service === 'google_drive') return 'google-drive'
  if (service === 'google-calendar') return 'google-calendar'
  if (service === 'google-drive') return 'google-drive'
  if (service === 'outlook-email') return 'outlook_email'
  if (service === 'outlook-calendar') return 'outlook_calendar'
  if (service === 'outlook_email') return 'outlook_email'
  if (service === 'outlook_calendar') return 'outlook_calendar'
  return service
}

const integrationThrottles = new Map<string, number[]>()

export const integrationRegistryService = {
  checkIntegrationThrottle(userId: string, service: string): boolean {
    const normService = service.toLowerCase().replace('_', '-')
    if (normService !== 'gmail' && normService !== 'slack') {
      return true
    }

    const key = `${userId}:${normService}`
    const now = Date.now()
    let timestamps = integrationThrottles.get(key) || []
    
    // Filter out timestamps older than 60 seconds
    timestamps = timestamps.filter(t => now - t < 60000)
    
    const limit = normService === 'gmail' ? 30 : 20
    
    if (timestamps.length >= limit) {
      logger.warn(`[Integration Registry] Rate limit exceeded for service ${normService} on user ${userId}`)
      return false
    }
    
    timestamps.push(now)
    integrationThrottles.set(key, timestamps)
    return true
  },

  // Legacy / existing compatibility mapping:
  encryptToken(token: string): string {
    return encryptGCM(token)
  },

  decryptToken(encrypted: string): string {
    return decryptGCM(encrypted)
  },

  async hasIntegration(userId: string, service: string): Promise<boolean> {
    try {
      const normService = normalizeService(service)
      const row = await queryOne(
        'SELECT id FROM user_integrations WHERE tenant_id = $1 AND service = $2',
        [userId, normService]
      )
      return !!row
    } catch (err: any) {
      logger.error(`[Integration Registry] Error in hasIntegration for ${service}:`, err.message)
      return false
    }
  },

  async getToken(userId: string, service: string): Promise<string | null> {
    try {
      const normService = normalizeService(service)
      
      // Rate limit check
      if (!this.checkIntegrationThrottle(userId, normService)) {
        throw new Error(`Rate limit exceeded for ${normService}. Please try again later.`)
      }

      let row = await queryOne(
        `SELECT id, access_token_encrypted, refresh_token_encrypted, expires_at 
         FROM user_integrations 
         WHERE tenant_id = $1 AND service = $2`,
        [userId, normService]
      )

      let isWorkspace = false

      if (!row || !row.access_token_encrypted) {
        // Query team_members to find workspaces the user belongs to and check workspace_integrations
        row = await queryOne(
          `SELECT wi.id, wi.access_token_encrypted, wi.refresh_token_encrypted, wi.expires_at
           FROM workspace_integrations wi
           JOIN workspaces w ON wi.workspace_id = w.id
           JOIN teams t ON w.tenant_id = t.owner_tenant_id
           JOIN team_members tm ON t.id = tm.team_id
           WHERE tm.tenant_id = $1 AND wi.service = $2
           LIMIT 1`,
          [userId, normService]
        )
        if (row) {
          isWorkspace = true
        }
      }

      if (!row || !row.access_token_encrypted) {
        return null // Return null — never throw
      }

      // Check if token has expired or is close to expiring (within 5 minutes)
      const expiresAt = row.expires_at ? new Date(row.expires_at) : null
      const isExpired = expiresAt && (expiresAt.getTime() - Date.now() < 5 * 60 * 1000)

      if (isExpired) {
        if (!row.refresh_token_encrypted) {
          logger.warn(`[Integration Registry] Token for ${service} has expired but no refresh token is present.`)
          await this.emitReconnectEvent(userId, service)
          return null
        }

        logger.info(`[Integration Registry] Token for ${service} has expired or is expiring soon. Attempting auto-refresh...`)
        try {
          const refreshToken = decryptGCM(row.refresh_token_encrypted)
          let newAccessToken = ''
          let newExpiresAt: Date | null = null

          if (normService.startsWith('google') || normService === 'gmail') {
            const refreshRes = await axios.post('https://oauth2.googleapis.com/token', {
              client_id: process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.GOOGLE_CLIENT_SECRET,
              refresh_token: refreshToken,
              grant_type: 'refresh_token'
            })
            newAccessToken = refreshRes.data.access_token
            const newExpiresIn = refreshRes.data.expires_in
            newExpiresAt = new Date(Date.now() + newExpiresIn * 1000)
          } else if (normService === 'slack') {
            const refreshRes = await axios.post('https://slack.com/api/oauth.v2.access', {
              client_id: process.env.SLACK_CLIENT_ID,
              client_secret: process.env.SLACK_CLIENT_SECRET,
              refresh_token: refreshToken,
              grant_type: 'refresh_token'
            })
            newAccessToken = refreshRes.data.access_token
            const newExpiresIn = refreshRes.data.expires_in
            newExpiresAt = new Date(Date.now() + newExpiresIn * 1000)
          } else {
            // Other services fallback to current token if not auto-refreshable
            return decryptGCM(row.access_token_encrypted)
          }

          const accessTokenEncrypted = encryptGCM(newAccessToken)

          // Update the DB record with new access_token and expires_at
          if (isWorkspace) {
            await query(
              `UPDATE workspace_integrations 
               SET access_token_encrypted = $1, expires_at = $2 
               WHERE id = $3`,
              [accessTokenEncrypted, newExpiresAt, row.id]
            )
          } else {
            await query(
              `UPDATE user_integrations 
               SET access_token_encrypted = $1, expires_at = $2 
               WHERE id = $3`,
              [accessTokenEncrypted, newExpiresAt, row.id]
            )
          }

          return newAccessToken
        } catch (refreshErr: any) {
          logger.error(`[Integration Registry] Auto-refresh failed for ${service}:`, refreshErr.message)
          await this.emitReconnectEvent(userId, service)
          return null // Return null — never throw
        }
      }

      return decryptGCM(row.access_token_encrypted)
    } catch (err: any) {
      if (err.message && err.message.includes('Rate limit exceeded')) {
        throw err
      }
      logger.error(`[Integration Registry] Error retrieving token for ${service}:`, err.message)
      return null // Return null — never throw
    }
  },

  async emitReconnectEvent(userId: string, service: string): Promise<void> {
    const serviceName = service.charAt(0).toUpperCase() + service.slice(1).replace('_', ' ').replace('-', ' ')
    const payload = {
      service,
      message: `Your ${serviceName} connection needs to be renewed`,
      actionUrl: '/dashboard/integrations'
    }

    try {
      const { runEmitter } = await import('./sse.service')
      // Emit to global runEmitter
      runEmitter.emit('integration_reconnect_required', { userId, ...payload })

      // Find all active runs for the tenant/user and emit to their run-specific channels
      const activeRuns = await query<{ id: string }>(
        `SELECT id FROM workflow_runs WHERE tenant_id = $1 AND status = 'running'`,
        [userId]
      )
      for (const run of activeRuns) {
        runEmitter.emitEvent(run.id, 'integration_reconnect_required' as any, payload)
      }
    } catch (emitErr: any) {
      logger.warn(`[Integration Registry] Failed to emit reconnect alert:`, emitErr.message)
    }
  },

  async saveToken(
    tenantId: string, 
    serviceName: string, 
    token: string, 
    displayName: string,
    refreshToken?: string,
    expiresAt?: Date,
    scopes?: string
  ): Promise<void> {
    const normService = normalizeService(serviceName)
    await this.saveIntegration(tenantId, normService as IntegrationService, {
      access_token: token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scopes: scopes
    })
  },

  async deleteToken(tenantId: string, serviceName: string): Promise<void> {
    const normService = normalizeService(serviceName)
    await this.revokeIntegration(tenantId, normService as IntegrationService)
  },

  // New clean methods:
  async saveIntegration(userId: string, service: IntegrationService, tokens: OAuthTokens): Promise<void> {
    try {
      const normService = normalizeService(service)
      const accessTokenEncrypted = encryptGCM(tokens.access_token)
      const refreshTokenEncrypted = tokens.refresh_token ? encryptGCM(tokens.refresh_token) : null
      
      let expiresAtDate: Date | null = null
      if (tokens.expires_at) {
        expiresAtDate = new Date(tokens.expires_at)
      }

      const existing = await queryOne(
        'SELECT id FROM user_integrations WHERE tenant_id = $1 AND service = $2',
        [userId, normService]
      )

      if (existing) {
        await query(
          `UPDATE user_integrations 
           SET access_token_encrypted = $1, refresh_token_encrypted = $2, expires_at = $3, scopes = $4
           WHERE id = $5`,
          [accessTokenEncrypted, refreshTokenEncrypted, expiresAtDate, tokens.scopes || null, existing.id]
        )
      } else {
        await query(
          `INSERT INTO user_integrations (user_id, tenant_id, service, access_token_encrypted, refresh_token_encrypted, expires_at, scopes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, userId, normService, accessTokenEncrypted, refreshTokenEncrypted, expiresAtDate, tokens.scopes || null]
        )
      }
      logger.info(`[Integration Registry] Saved credential integration for ${normService} under user ${userId}`)
    } catch (err: any) {
      logger.error(`[Integration Registry] Error saving integration for ${service}:`, err.message)
      throw err
    }
  },

  async revokeIntegration(userId: string, service: IntegrationService): Promise<void> {
    try {
      const normService = normalizeService(service)
      await query(
        'DELETE FROM user_integrations WHERE tenant_id = $1 AND service = $2',
        [userId, normService]
      )
      logger.info(`[Integration Registry] Revoked integration ${normService} under user ${userId}`)
    } catch (err: any) {
      logger.error(`[Integration Registry] Error revoking integration for ${service}:`, err.message)
      throw err
    }
  },

  async refreshExpiringTokens(): Promise<void> {
    try {
      logger.info('[Integration Registry] Checking for expiring OAuth tokens...')
      const rows = await query(
        `SELECT tenant_id, service, refresh_token_encrypted 
         FROM user_integrations 
         WHERE expires_at < NOW() + INTERVAL '24 hours' 
         AND refresh_token_encrypted IS NOT NULL`
      )

      logger.info(`[Integration Registry] Found ${rows.length} tokens expiring in next 24 hours.`)

      for (const row of rows) {
        const tenantId = row.tenant_id
        const service = row.service
        try {
          const refreshToken = decryptGCM(row.refresh_token_encrypted)
          if (service.startsWith('google') || service === 'gmail') {
            const refreshRes = await axios.post('https://oauth2.googleapis.com/token', {
              client_id: process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.GOOGLE_CLIENT_SECRET,
              refresh_token: refreshToken,
              grant_type: 'refresh_token'
            })
            const newAccessToken = refreshRes.data.access_token
            const newExpiresIn = refreshRes.data.expires_in
            const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000)

            await this.saveIntegration(tenantId, service as IntegrationService, {
              access_token: newAccessToken,
              refresh_token: refreshToken,
              expires_at: newExpiresAt
            })
            logger.info(`[Integration Registry] Proactively refreshed token for ${service} (tenant: ${tenantId}).`)
          }
        } catch (refreshErr: any) {
          logger.error(`[Integration Registry] Proactive refresh failed for ${service} (tenant: ${tenantId}):`, refreshErr.message)
        }
      }
    } catch (err: any) {
      logger.error('[Integration Registry] Error during proactive token refresh:', err.message)
    }
  }
}
