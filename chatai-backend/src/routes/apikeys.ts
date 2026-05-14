import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router()

// GET /api-keys
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const keys = await query(
    `SELECT id, name, key_prefix, agent_id, last_used_at, is_active, created_at
     FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [req.tenantId]
  )
  res.json({ keys })
})

// POST /api-keys
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const { name, agent_id } = req.body
  if (!name) return res.status(400).json({ error: 'Name is required' })

  const rawKey = `chatai_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 16) + '...'

  const [key] = await query(
    `INSERT INTO api_keys (tenant_id, agent_id, name, key_hash, key_prefix)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, key_prefix, agent_id, created_at`,
    [req.tenantId, agent_id || null, name, keyHash, keyPrefix]
  )

  // Return full key ONCE — never stored again
  res.status(201).json({ ...key, key: rawKey, warning: 'Copy this key now. It will not be shown again.' })
})

// DELETE /api-keys/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  await query(
    'UPDATE api_keys SET is_active = false WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.tenantId]
  )
  res.json({ success: true })
})

export default router
