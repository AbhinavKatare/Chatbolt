import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { supabase } from '../lib/supabase'
import { Tenant } from '../types'

const router = Router()

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
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
       VALUES ($1, $2, $3, 'hobby', 500, 500)
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
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /auth/login - Deprecated, but keep for backward compat or metadata fetching
router.post('/login', async (req: Request, res: Response) => {
  res.status(410).json({ error: 'Please login via frontend Supabase client' })
})

// GET /auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  res.json({ tenant: req.tenant })
})

export default router
