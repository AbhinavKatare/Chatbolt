import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { queryOne } from '../db'
import { Tenant } from '../types'
import jwt from 'jsonwebtoken'
import { logger } from '../services/logger.service'

function logAuthFailure(req: Request, type: string, errorMsg?: string) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  logger.warn(`[Auth Failure] Timestamp: ${new Date().toISOString()} | IP: ${ip} | Type: ${type} | Msg: ${errorMsg || 'none'}`)
}

const TIMEOUT = 3000
const withTimeout = <T>(p: Promise<T>): Promise<T> => Promise.race([
  p,
  new Promise<never>((_, r) => setTimeout(() => r(new Error('supabase_timeout')), TIMEOUT))
])

function isSupabaseNetworkError(err: any): boolean {
  if (!err) return false
  const errMsg = (err.message || '').toLowerCase()
  const errCode = (err.code || err.status || '').toString().toLowerCase()
  const causeCode = (err.cause?.code || '').toString().toLowerCase()
  const causeMsg = (err.cause?.message || '').toLowerCase()
  
  return (
    errMsg.includes('timeout') ||
    errMsg.includes('fetch failed') ||
    errMsg.includes('enotfound') ||
    errMsg.includes('econnrefused') ||
    errMsg.includes('network') ||
    errMsg.includes('getaddrinfo') ||
    errCode.includes('enotfound') ||
    errCode.includes('econnrefused') ||
    causeCode.includes('enotfound') ||
    causeCode.includes('econnrefused') ||
    causeMsg.includes('enotfound') ||
    causeMsg.includes('econnrefused')
  )
}

/**
 * Enforces mandatory authentication. Fails closed (401 or 503 on network outage),
 * never assigning default/fallback tenants under any circumstances.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let token = ''
    const authHeader = req.headers.authorization
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim()
    }

    if (!token) {
      logAuthFailure(req, 'MISSING_TOKEN', 'No token provided in headers')
      return res.status(401).json({ error: 'Missing or invalid authorization token' })
    }

    // 1. Verify locally signed JWT token (dev or self-hosted mode)
    const jwtSecret = process.env.JWT_SECRET || 'chatbolt-local-dev-secret'
    try {
      const decodedLocal = jwt.verify(token, jwtSecret) as { sub: string; email: string; mode?: string }
      if (decodedLocal?.sub) {
        const tenant = await queryOne<Tenant>(
          'SELECT * FROM tenants WHERE id = $1 AND is_active = true',
          [decodedLocal.sub]
        )
        if (tenant) {
          req.tenant = tenant
          req.tenantId = tenant.id
          ;(req as any).user = { id: decodedLocal.sub, tenant }
          return next()
        }
      }
    } catch (jwtErr) {
      // Not a valid local signature; proceed to verify via Supabase
    }

    // 2. Verify token via Supabase Auth
    let user: any = null
    try {
      const { data, error } = await withTimeout(supabase.auth.getUser(token))
      if (error) {
        if (isSupabaseNetworkError(error)) {
          logAuthFailure(req, 'SUPABASE_UNAVAILABLE', error.message)
          return res.status(503).json({ error: 'Authentication service temporarily unavailable. Please try again.' })
        }
        logAuthFailure(req, 'INVALID_SUPABASE_TOKEN', error.message)
        return res.status(401).json({ error: 'Invalid or expired authorization token' })
      }
      user = data?.user
    } catch (e: any) {
      if (isSupabaseNetworkError(e)) {
        logAuthFailure(req, 'SUPABASE_UNAVAILABLE_EXC', e.message)
        return res.status(503).json({ error: 'Authentication service temporarily unavailable. Please try again.' })
      }
      logAuthFailure(req, 'INVALID_SUPABASE_TOKEN_EXC', e.message)
      return res.status(401).json({ error: 'Invalid or expired authorization token' })
    }

    if (!user) {
      logAuthFailure(req, 'NO_USER_FOUND', 'Supabase getUser returned no user')
      return res.status(401).json({ error: 'Invalid or expired authorization token' })
    }

    // 3. Resolve tenant for Supabase user
    const tenant = await queryOne<Tenant>(
      'SELECT * FROM tenants WHERE (supabase_user_id = $1 OR email = $2) AND is_active = true',
      [user.id, user.email]
    )

    if (!tenant) {
      logAuthFailure(req, 'TENANT_NOT_FOUND', `No tenant found for supabase user ${user.id} / ${user.email}`)
      return res.status(401).json({ error: 'Tenant record not found. Please complete signup.' })
    }

    if (!tenant.supabase_user_id) {
      await import('../db').then(({ db }) => 
        db.query('UPDATE tenants SET supabase_user_id = $1 WHERE id = $2', [user.id, tenant.id])
      ).catch(() => {})
    }

    req.tenant = tenant
    req.tenantId = tenant.id
    ;(req as any).user = { id: user.id, tenant }
    return next()

  } catch (err: any) {
    logAuthFailure(req, 'UNEXPECTED_ERROR', err instanceof Error ? err.message : String(err))
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

/**
 * Optional authentication: Populates req.tenant ONLY if a valid token is provided.
 * Fails gracefully without throwing or setting unauthorized default tenants.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return next()

  try {
    const token = authHeader.slice(7).trim()
    if (!token) return next()

    // 1. Check local JWT
    const jwtSecret = process.env.JWT_SECRET || 'chatbolt-local-dev-secret'
    try {
      const decodedLocal = jwt.verify(token, jwtSecret) as { sub: string; email: string }
      if (decodedLocal?.sub) {
        const tenant = await queryOne<Tenant>(
          'SELECT * FROM tenants WHERE id = $1 AND is_active = true',
          [decodedLocal.sub]
        )
        if (tenant) {
          req.tenant = tenant
          req.tenantId = tenant.id
          ;(req as any).user = { id: decodedLocal.sub, tenant }
          return next()
        }
      }
    } catch {
      // Proceed to Supabase check
    }

    // 2. Check Supabase
    try {
      const { data } = await withTimeout(supabase.auth.getUser(token))
      if (data?.user) {
        const tenant = await queryOne<Tenant>(
          'SELECT * FROM tenants WHERE (supabase_user_id = $1 OR email = $2) AND is_active = true',
          [data.user.id, data.user.email]
        )
        if (tenant) {
          req.tenant = tenant
          req.tenantId = tenant.id
          ;(req as any).user = { id: data.user.id, tenant }
        }
      }
    } catch {
      // Ignore network errors in optionalAuth
    }
  } catch {
    // Fail silently in optional auth
  }
  next()
}

/**
 * API key middleware for public widgets / external webhooks
 */
export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string
  if (!apiKey) return res.status(401).json({ error: 'API key required' })

  try {
    const crypto = await import('crypto')
    const keyHash = crypto.createHash('sha256').update(apiKey.trim()).digest('hex')

    const row = await queryOne<{ tenant_id: string; agent_id: string; is_active: boolean }>(
      `SELECT ak.tenant_id, ak.agent_id, ak.is_active
       FROM api_keys ak WHERE ak.key_hash = $1`,
      [keyHash]
    )

    if (!row || !row.is_active) {
      return res.status(401).json({ error: 'Invalid or inactive API key' })
    }

    // Update last used timestamp
    await import('../db').then(({ db }) =>
      db.query('UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1', [keyHash])
    ).catch(() => {})

    const tenant = await queryOne<Tenant>('SELECT * FROM tenants WHERE id = $1', [row.tenant_id])
    if (!tenant || !tenant.is_active) return res.status(401).json({ error: 'Tenant not found or inactive' })

    req.tenant = tenant
    req.tenantId = tenant.id
    next()
  } catch (err) {
    return res.status(500).json({ error: 'Authentication service error' })
  }
}

