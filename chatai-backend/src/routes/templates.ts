import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { query } from '../db'
import { z } from 'zod'
import { logger } from '../services/logger.service'

const router = Router()

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().default(''),
  prompt: z.string().min(1),
  task_type: z.string().optional().default('other'),
})

// GET /api/templates
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const templates = await query(
      `SELECT * FROM user_templates WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [req.tenantId]
    )
    res.json({ templates: templates || [] })
  } catch (err: any) {
    logger.error('[Templates] Failed to fetch templates:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/templates
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = CreateTemplateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const { name, description, prompt, task_type } = parsed.data

    const [template] = await query(
      `INSERT INTO user_templates (tenant_id, name, description, prompt, task_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.tenantId, name, description, prompt, task_type]
    )

    logger.info(`[Templates] Personal template created: "${name}" for tenant ${req.tenantId}`)
    res.status(201).json({ template })
  } catch (err: any) {
    logger.error('[Templates] Failed to create template:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/templates/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await query(
      'DELETE FROM user_templates WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, req.tenantId]
    )

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Template not found' })
    }

    logger.info(`[Templates] Personal template deleted: ${id} for tenant ${req.tenantId}`)
    res.json({ success: true })
  } catch (err: any) {
    logger.error('[Templates] Failed to delete template:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
