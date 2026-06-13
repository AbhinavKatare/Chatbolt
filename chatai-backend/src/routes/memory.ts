import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { logger } from '../services/logger.service'

const router = Router()

router.use(authMiddleware)

// ── GET /memory/facts ────────────────────────────────────────────────────────
// Returns all memory facts grouped by category for the authenticated tenant.
router.get('/facts', async (req: Request, res: Response) => {
  try {
    const rows = await query<any>(
      `SELECT id, key, value, category, importance,
              COALESCE(confidence, 0.8) AS confidence,
              source,
              last_accessed,
              COALESCE(updated_at, created_at) AS updated_at,
              created_at
       FROM agent_memory
       WHERE tenant_id = $1
       ORDER BY importance DESC, created_at DESC
       LIMIT 500`,
      [req.tenantId]
    )

    // Group by category
    const grouped: Record<string, any[]> = {}
    for (const row of rows) {
      const cat = row.category || 'fact'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(row)
    }

    res.json({
      facts: rows,
      grouped,
      total: rows.length,
      categories: Object.keys(grouped),
    })
  } catch (err: any) {
    logger.error('[Memory] Failed to fetch facts: ' + err.message)
    res.status(500).json({ error: 'Failed to fetch memory facts' })
  }
})

// ── GET /memory/profile ──────────────────────────────────────────────────────
// Returns only user profile facts (category = 'preference').
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const rows = await query<any>(
      `SELECT id, key, value, COALESCE(confidence, 0.8) AS confidence, source, created_at
       FROM agent_memory
       WHERE tenant_id = $1 AND category = 'preference'
       ORDER BY importance DESC LIMIT 30`,
      [req.tenantId]
    )

    // Build a clean profile object from known keys
    const profileMap: Record<string, string> = {}
    for (const row of rows) {
      profileMap[row.key] = row.value
    }

    res.json({
      profile: profileMap,
      facts: rows,
    })
  } catch (err: any) {
    logger.error('[Memory] Failed to fetch profile: ' + err.message)
    res.status(500).json({ error: 'Failed to fetch user profile' })
  }
})

// ── GET /memory/skills ───────────────────────────────────────────────────────
// Returns harvested task skills (category = 'skill').
router.get('/skills', async (req: Request, res: Response) => {
  try {
    const rows = await query<any>(
      `SELECT id, key, value, COALESCE(confidence, 0.7) AS confidence, source, created_at,
              COALESCE(updated_at, created_at) AS updated_at
       FROM agent_memory
       WHERE tenant_id = $1 AND category = 'skill'
       ORDER BY confidence DESC, created_at DESC
       LIMIT 100`,
      [req.tenantId]
    )

    const skills = rows.map((row: any) => {
      let parsed: any = {}
      try { parsed = JSON.parse(row.value) } catch {}
      return {
        id: row.id,
        key: row.key,
        task: parsed.task || row.key.replace(/^skill_/, '').replace(/_/g, ' '),
        quality: parsed.quality || 'good',
        learned_at: parsed.learned_at || row.created_at,
        confidence: row.confidence,
        reinforced_at: row.updated_at,
      }
    })

    res.json({ skills, total: skills.length })
  } catch (err: any) {
    logger.error('[Memory] Failed to fetch skills: ' + err.message)
    res.status(500).json({ error: 'Failed to fetch skills' })
  }
})

// ── GET /memory/project-context?keyword=X ───────────────────────────────────
// Returns memory facts relevant to a given project keyword.
router.get('/project-context', async (req: Request, res: Response) => {
  const keyword = String(req.query.keyword || '').trim()
  if (!keyword) return res.status(400).json({ error: 'keyword query parameter is required' })

  try {
    const rows = await query<any>(
      `SELECT value FROM agent_memory
       WHERE tenant_id = $1
       AND (key ILIKE $2 OR value ILIKE $2)
       ORDER BY importance DESC LIMIT 10`,
      [req.tenantId, `%${keyword}%`]
    )
    res.json({ facts: rows.map((r: any) => r.value), keyword })
  } catch (err: any) {
    logger.error('[Memory] Failed to get project context: ' + err.message)
    res.status(500).json({ error: 'Failed to get project context' })
  }
})

// ── POST /memory/preferences ─────────────────────────────────────────────────
// Manually set or update a preference fact.
router.post('/preferences', async (req: Request, res: Response) => {
  const { key, value } = req.body
  if (!key || !value) return res.status(400).json({ error: 'key and value are required' })
  if (typeof key !== 'string' || key.length > 100) return res.status(400).json({ error: 'Invalid key' })
  if (typeof value !== 'string' || value.length > 1000) return res.status(400).json({ error: 'Value too long' })

  try {
    const existing = await queryOne<any>(
      `SELECT id FROM agent_memory WHERE tenant_id = $1 AND key = $2`,
      [req.tenantId, key]
    )

    let fact: any
    if (existing) {
      const updated = await query<any>(
        `UPDATE agent_memory
         SET value = $1, category = 'preference', source = 'manual', confidence = 1.0, updated_at = NOW()
         WHERE tenant_id = $2 AND key = $3
         RETURNING id, key, value, category, confidence, source, updated_at, created_at`,
        [value, req.tenantId, key]
      )
      fact = updated[0]
    } else {
      const inserted = await query<any>(
        `INSERT INTO agent_memory (tenant_id, key, value, category, source, confidence, importance)
         VALUES ($1, $2, $3, 'preference', 'manual', 1.0, 8)
         RETURNING id, key, value, category, confidence, source, created_at`,
        [req.tenantId, key, value]
      )
      fact = inserted[0]
    }

    logger.info(`[Memory] Manual preference set: ${key} = ${value} for tenant ${req.tenantId}`)
    res.json({ fact, success: true })
  } catch (err: any) {
    logger.error('[Memory] Failed to set preference: ' + err.message)
    res.status(500).json({ error: 'Failed to save preference' })
  }
})

// ── DELETE /memory/facts/:id ─────────────────────────────────────────────────
// Delete a single memory fact by ID.
router.delete('/facts/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const result = await query<any>(
      `DELETE FROM agent_memory WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, req.tenantId]
    )
    if (result.length === 0) {
      return res.status(404).json({ error: 'Memory fact not found' })
    }
    logger.info(`[Memory] Deleted fact ${id} for tenant ${req.tenantId}`)
    res.json({ success: true, deleted_id: id })
  } catch (err: any) {
    logger.error('[Memory] Failed to delete fact: ' + err.message)
    res.status(500).json({ error: 'Failed to delete fact' })
  }
})

// ── DELETE /memory/facts ─────────────────────────────────────────────────────
// Wipe all memory facts for this tenant. Requires ?confirm=true.
router.delete('/facts', async (req: Request, res: Response) => {
  if (req.query.confirm !== 'true') {
    return res.status(400).json({ error: 'Pass ?confirm=true to wipe all memory' })
  }

  try {
    const result = await query<any>(
      `DELETE FROM agent_memory WHERE tenant_id = $1 RETURNING id`,
      [req.tenantId]
    )
    logger.info(`[Memory] Wiped ${result.length} facts for tenant ${req.tenantId}`)
    res.json({ success: true, deleted_count: result.length })
  } catch (err: any) {
    logger.error('[Memory] Failed to wipe all facts: ' + err.message)
    res.status(500).json({ error: 'Failed to wipe memory' })
  }
})

export default router
