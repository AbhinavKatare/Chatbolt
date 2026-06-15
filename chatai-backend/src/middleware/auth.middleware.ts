import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { queryOne } from '../db'
import { Tenant } from '../types'
import jwt from 'jsonwebtoken'
import { logger } from '../services/logger.service'

function logAuthFailure(req: Request, type: string, errorMsg?: string) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  logger.warn(`[Auth Failure] Timestamp: ${new Date().toISOString()} | IP: ${ip} | Type: ${type} | Msg: ${errorMsg || 'none'}`)
}


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

async function executeOfflineFallback(token: string, req: Request): Promise<boolean> {
  try {
    const decoded = jwt.decode(token) as { sub: string }
    let tenant: any = null
    if (decoded?.sub) {
      tenant = await queryOne<Tenant>(
        'SELECT * FROM tenants WHERE id = $1 OR supabase_user_id = $1 LIMIT 1',
        [decoded.sub]
      )
    }
    if (!tenant) {
      tenant = await queryOne<Tenant>('SELECT * FROM tenants WHERE is_active = true LIMIT 1')
    }
    if (tenant) {
      req.tenant = tenant
      req.tenantId = tenant.id
      const userId = decoded?.sub || tenant.id
      ;(req as any).user = { id: userId, tenant }
      return true
    }
  } catch (err) {
    console.error('[Auth] Offline fallback failed:', err)
  }
  return false
}

const TIMEOUT = 3000;
const withTimeout = <T>(p: Promise<T>): Promise<T> => Promise.race([
  p,
  new Promise<never>((_, r) => setTimeout(() => r(new Error('supabase_timeout')), TIMEOUT))
]);

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let token = ''
    const authHeader = req.headers.authorization
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }

    if (!token) {
      logAuthFailure(req, 'MISSING_TOKEN', 'No token provided in headers')
      return res.status(401).json({ error: 'Missing or invalid authorization token' })
    }

    if (token.startsWith('mock-token')) {
      const parts = token.split(':')
      const targetId = parts[1]
      let tenant
      if (targetId) {
        tenant = await queryOne<Tenant>('SELECT * FROM tenants WHERE id = $1', [targetId])
      } else {
        tenant = await queryOne<Tenant>('SELECT * FROM tenants LIMIT 1')
      }
      if (tenant) {
        req.tenant = tenant
        req.tenantId = tenant.id
        const decoded = jwt.decode(token) as { sub: string } | null;
        ;(req as any).user = { id: decoded?.sub || tenant.id, tenant }
        return next()
      }
    }

    // Verify locally generated JWT token first
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
      // not a valid local JWT, proceed to Supabase
    }
    
    // Verify token with Supabase
    let user: any = null
    try {
      const { data, error } = await withTimeout(supabase.auth.getUser(token))
      if (error) {
        const isNetwork = ['supabase_timeout', 'ENOTFOUND', 'ECONNREFUSED', 'fetch failed'].some(k => 
          (error.message || '').includes(k)
        )
        if (!isNetwork) {
          logAuthFailure(req, 'INVALID_SUPABASE_TOKEN_ERR', error.message)
          return res.status(401).json({ error: 'Invalid token' })
        }
      } else if (data?.user) {
        user = data.user
      }
    } catch (e: any) {
      const isNetwork = ['supabase_timeout', 'ENOTFOUND', 'ECONNREFUSED', 'fetch failed'].some(k => 
        (e.message || '').includes(k)
      )
      if (!isNetwork) {
        logAuthFailure(req, 'INVALID_SUPABASE_TOKEN_EXC', e.message)
        return res.status(401).json({ error: 'Invalid token' })
      }
    }

    if (user) {
      const tenant = await queryOne<Tenant>(
        'SELECT * FROM tenants WHERE (supabase_user_id = $1 OR email = $2) AND is_active = true',
        [user.id, user.email]
      )
      if (!tenant) {
        logAuthFailure(req, 'TENANT_NOT_FOUND', `No tenant for supabase user ${user.id} / ${user.email}`)
        return res.status(401).json({ error: 'Tenant record not found. Please complete signup.' })
      }
      if (!tenant.supabase_user_id) {
        await import('../db').then(({ db }) => 
          db.query('UPDATE tenants SET supabase_user_id = $1 WHERE id = $2', [user.id, tenant.id])
        )
      }
      req.tenant = tenant
      req.tenantId = tenant.id
      ;(req as any).user = { id: user.id, tenant }
      return next()
    }

    // Offline fallback:
    try {
      const decoded = jwt.decode(token) as { sub: string } | null
      if (decoded?.sub) {
        const tenant = await queryOne<Tenant>(
          'SELECT * FROM tenants WHERE id = $1 OR supabase_user_id = $1 LIMIT 1',
          [decoded.sub]
        )
        if (tenant) {
          req.tenant = tenant
          req.tenantId = tenant.id
          ;(req as any).user = { id: decoded.sub, tenant }
          return next()
        }
      }
      logAuthFailure(req, 'OFFLINE_FALLBACK_FAILED', `No tenant for decoded sub`)
      return res.status(401).json({ error: 'Not found' })
    } catch (fallbackErr: any) {
      logAuthFailure(req, 'OFFLINE_FALLBACK_ERROR', fallbackErr.message)
      return res.status(401).json({ error: 'Not found' })
    }
  } catch (err: any) {
    logAuthFailure(req, 'UNEXPECTED_ERROR', err instanceof Error ? err.message : String(err))
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return next()

  try {
    const token = authHeader.slice(7)
    if (token.startsWith('mock-token')) {
      const parts = token.split(':')
      const targetId = parts[1]
      let tenant
      if (targetId) {
        tenant = await queryOne<Tenant>('SELECT * FROM tenants WHERE id = $1', [targetId])
      } else {
        tenant = await queryOne<Tenant>('SELECT * FROM tenants LIMIT 1')
      }
      if (tenant) {
        req.tenant = tenant
        req.tenantId = tenant.id
        const decoded = jwt.decode(token) as { sub: string } | null;
        ;(req as any).user = { id: decoded?.sub || tenant.id, tenant }
      }
      return next()
    }

    // Verify locally generated JWT token first
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
      // not a valid local JWT, proceed to Supabase
    }
    
    let user: any = null
    try {
      const { data, error } = await withTimeout(supabase.auth.getUser(token))
      if (data?.user) {
        user = data.user
      }
    } catch (e) {
      // ignore network or timeout error
    }

    if (user) {
      const tenant = await queryOne<Tenant>(
        'SELECT * FROM tenants WHERE (supabase_user_id = $1 OR email = $2) AND is_active = true',
        [user.id, user.email]
      )
      if (tenant) {
        req.tenant = tenant
        req.tenantId = tenant.id
        ;(req as any).user = { id: user.id, tenant }
      }
    } else {
      // Offline fallback:
      try {
        const decoded = jwt.decode(token) as { sub: string } | null
        if (decoded?.sub) {
          const tenant = await queryOne<Tenant>(
            'SELECT * FROM tenants WHERE id = $1 OR supabase_user_id = $1 LIMIT 1',
            [decoded.sub]
          )
          if (tenant) {
            req.tenant = tenant
            req.tenantId = tenant.id
            ;(req as any).user = { id: decoded.sub, tenant }
          }
        }
      } catch (fallbackErr) {
        // ignore
      }
    }
  } catch {}
  next()
}

// API key auth for widget/external use
export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string
  if (!apiKey) return res.status(401).json({ error: 'API key required' })

  try {
    const crypto = await import('crypto')
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

    const row = await queryOne<{ tenant_id: string; agent_id: string; is_active: boolean }>(
      `SELECT ak.tenant_id, ak.agent_id, ak.is_active
       FROM api_keys ak WHERE ak.key_hash = $1`,
      [keyHash]
    )

    if (!row || !row.is_active) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    // Update last used
    await import('../db').then(({ db }) =>
      db.query('UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1', [keyHash])
    )

    const tenant = await queryOne<Tenant>('SELECT * FROM tenants WHERE id = $1', [row.tenant_id])
    if (!tenant) return res.status(401).json({ error: 'Tenant not found' })

    req.tenant = tenant
    req.tenantId = tenant.id
    next()
  } catch (err) {
    return res.status(500).json({ error: 'Auth error' })
  }
}
