import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { supabase } from '../lib/supabase'
import { Tenant } from '../types'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const router = Router()

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
})

const localLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// POST /auth/signup
// This is called AFTER the frontend has signed up with Supabase
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Auth required' })
    }
    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid Supabase session' })
    }

    const body = signupSchema.parse(req.body)

    const existing = await queryOne('SELECT id FROM tenants WHERE email = $1 OR supabase_user_id = $2', [body.email, user.id])
    if (existing) {
      return res.status(409).json({ error: 'Account already exists' })
    }

    const [tenant] = await query<Tenant>(
      `INSERT INTO tenants (name, email, supabase_user_id, plan, credits_remaining, credits_monthly)
       VALUES ($1, $2, $3, 'none', 0, 0)
       RETURNING id, name, email, plan, credits_remaining, credits_monthly, created_at`,
      [body.name, body.email, user.id]
    )

    // Create default agent
    await query(
      `INSERT INTO agents (tenant_id, name, description, system_prompt)
       VALUES ($1, $2, $3, $4)`,
      [
        tenant.id,
        `${body.name}'s Support Agent`,
        'Initial support agent',
        `You are a helpful assistant for ${body.name}.`
      ]
    )

    res.status(201).json({ tenant })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /auth/login
// Local fallback login — used when Supabase is unreachable.
// Verifies password against password_hash in the local tenants table,
// then issues a short-lived local JWT signed with JWT_SECRET.
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = localLoginSchema.parse(req.body)

    const tenant = await queryOne<Tenant & { password_hash: string }>(
      `SELECT id, name, email, plan, credits_remaining, credits_monthly, password_hash
       FROM tenants WHERE email = $1 AND is_active = TRUE`,
      [email]
    )

    if (!tenant) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    if (!tenant.password_hash) {
      // Account exists but was created through Supabase OAuth — no local password set
      return res.status(401).json({
        error: 'This account uses Supabase login. Supabase is currently unreachable. Please check your network connection.',
      })
    }

    const valid = await bcrypt.compare(password, tenant.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const jwtSecret = process.env.JWT_SECRET || 'chatbolt-local-dev-secret'
    const localToken = jwt.sign(
      { sub: tenant.id, email: tenant.email, mode: 'local' },
      jwtSecret,
      { expiresIn: '7d' }
    )

    const { password_hash: _omit, ...safeTenant } = tenant
    res.json({ token: localToken, tenant: safeTenant, mode: 'local' })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  res.json({ tenant: req.tenant })
})

const profileSchema = z.object({
  name: z.string().min(2).max(100),
  user_details: z.string().max(2000).optional().nullable(),
  user_purpose: z.string().max(2000).optional().nullable(),
  notification_preferences: z.string().max(100).optional().nullable(),
})

// PUT /auth/profile
router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const body = profileSchema.parse(req.body)
    const [updated] = await query<Tenant>(
      `UPDATE tenants 
       SET name = $1, user_details = $2, user_purpose = $3, notification_preferences = COALESCE($4, notification_preferences), updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, email, plan, credits_remaining, credits_monthly, user_details, user_purpose, notification_preferences, created_at`,
      [body.name, body.user_details || null, body.user_purpose || null, body.notification_preferences || null, req.tenantId]
    )

    if (!updated) {
      return res.status(404).json({ error: 'Workspace profile not found' })
    }

    res.json({ tenant: updated })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
