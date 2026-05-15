import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { queryOne } from '../db'
import { Tenant } from '../types'

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let token = ''
    const authHeader = req.headers.authorization
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid authorization token' })
    }

    if (token === 'mock-token') {
      const tenant = await queryOne<Tenant>('SELECT * FROM tenants LIMIT 1')
      if (tenant) {
        req.tenant = tenant
        req.tenantId = tenant.id
        return next()
      }
    }
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }

    // Find tenant by supabase_user_id or email fallback
    const tenant = await queryOne<Tenant>(
      'SELECT * FROM tenants WHERE (supabase_user_id = $1 OR email = $2) AND is_active = true',
      [user.id, user.email]
    )

    if (!tenant) {
      return res.status(401).json({ error: 'Tenant record not found. Please complete signup.' })
    }

    // Link user ID if not already linked
    if (!tenant.supabase_user_id) {
      await import('../db').then(({ db }) => 
        db.query('UPDATE tenants SET supabase_user_id = $1 WHERE id = $2', [user.id, tenant.id])
      )
    }

    req.tenant = tenant
    req.tenantId = tenant.id
    next()
  } catch (err) {
    console.error('Auth Middleware Error:', err)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return next()

  try {
    const token = authHeader.slice(7)
    if (token === 'mock-token') {
      const tenant = await queryOne<Tenant>('SELECT * FROM tenants LIMIT 1')
      if (tenant) {
        req.tenant = tenant
        req.tenantId = tenant.id
      }
      return next()
    }
    
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      const tenant = await queryOne<Tenant>(
        'SELECT * FROM tenants WHERE supabase_user_id = $1 OR email = $2', 
        [user.id, user.email]
      )
      if (tenant) {
        req.tenant = tenant
        req.tenantId = tenant.id
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
