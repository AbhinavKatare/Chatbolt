import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { Agent } from '../types'

const router = Router()

const PLAN_AGENT_LIMITS: Record<string, number> = {
  hobby: 1, standard: 3, pro: 10, enterprise: 999
}

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  system_prompt: z.string().min(10).max(4000),
  persona: z.object({
    tone: z.enum(['professional','friendly','casual','formal']).default('professional'),
    language: z.string().default('en'),
    name: z.string().optional(),
  }).optional(),
  escalation_rules: z.object({
    keywords: z.array(z.string()).default([]),
    low_confidence_threshold: z.number().min(0).max(1).default(0.4),
  }).optional(),
  config: z.object({
    model: z.string().default('gpt-4o'),
    temperature: z.number().min(0).max(1).default(0.3),
    max_tokens: z.number().min(100).max(4000).default(800),
  }).optional(),
  widget_config: z.object({
    primaryColor: z.string().default('#B8FF00'),
    position: z.enum(['bottom-right','bottom-left']).default('bottom-right'),
    welcomeMessage: z.string().default('Hi! How can I help you today?'),
    placeholder: z.string().optional(),
  }).optional(),
})

// GET /agents
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const agents = await query<Agent & { document_count: number; conversation_count: number }>(
    `SELECT a.*, 
      COUNT(DISTINCT d.id) AS document_count,
      COUNT(DISTINCT c.id) AS conversation_count
     FROM agents a
     LEFT JOIN documents d ON d.agent_id = a.id AND d.status = 'ready'
     LEFT JOIN conversations c ON c.agent_id = a.id
     WHERE a.tenant_id = $1
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
    [req.tenantId]
  )
  res.json({ agents })
})

// POST /agents
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const body = createAgentSchema.parse(req.body)
    const tenant = req.tenant!

    // Check plan limits
    const [{ count }] = await query<{ count: string }>(
      'SELECT COUNT(*) FROM agents WHERE tenant_id = $1 AND is_active = true',
      [req.tenantId]
    )
    const limit = PLAN_AGENT_LIMITS[tenant.plan] ?? 1
    if (parseInt(count) >= limit) {
      return res.status(403).json({
        error: `Your ${tenant.plan} plan allows ${limit} agent(s). Upgrade to add more.`,
        code: 'AGENT_LIMIT_REACHED',
      })
    }

    const [agent] = await query<Agent>(
      `INSERT INTO agents (tenant_id, name, description, system_prompt, persona, escalation_rules, config, widget_config)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        req.tenantId, body.name, body.description ?? null, body.system_prompt,
        JSON.stringify(body.persona ?? {}),
        JSON.stringify(body.escalation_rules ?? {}),
        JSON.stringify(body.config ?? {}),
        JSON.stringify(body.widget_config ?? {}),
      ]
    )

    res.status(201).json({ agent })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /agents/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const agent = await queryOne<Agent>(
    'SELECT * FROM agents WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.tenantId]
  )
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  res.json({ agent })
})

// PATCH /agents/:id
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const agent = await queryOne<Agent>(
      'SELECT * FROM agents WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    const body = createAgentSchema.partial().parse(req.body)

    const fields: string[] = []
    const values: any[] = []
    let idx = 1

    if (body.name !== undefined) { fields.push(`name = $${idx++}`); values.push(body.name) }
    if (body.description !== undefined) { fields.push(`description = $${idx++}`); values.push(body.description) }
    if (body.system_prompt !== undefined) { fields.push(`system_prompt = $${idx++}`); values.push(body.system_prompt) }
    if (body.persona !== undefined) { fields.push(`persona = $${idx++}`); values.push(JSON.stringify(body.persona)) }
    if (body.escalation_rules !== undefined) { fields.push(`escalation_rules = $${idx++}`); values.push(JSON.stringify(body.escalation_rules)) }
    if (body.config !== undefined) { fields.push(`config = $${idx++}`); values.push(JSON.stringify(body.config)) }
    if (body.widget_config !== undefined) { fields.push(`widget_config = $${idx++}`); values.push(JSON.stringify(body.widget_config)) }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' })

    values.push(req.params.id)
    const [updated] = await query<Agent>(
      `UPDATE agents SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )

    res.json({ agent: updated })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /agents/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const agent = await queryOne(
    'SELECT id FROM agents WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.tenantId]
  )
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  await query('UPDATE agents SET is_active = false WHERE id = $1', [req.params.id])
  res.json({ success: true })
})

// GET /agents/:id/embed-code
router.get('/:id/embed-code', authMiddleware, async (req: Request, res: Response) => {
  const agent = await queryOne<Agent>(
    'SELECT * FROM agents WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.tenantId]
  )
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  const baseUrl = process.env.WIDGET_BASE_URL || 'https://your-api.com'
  const embedCode = `<!-- ChatAI Widget -->
<script
  src="${baseUrl}/widget.js"
  data-agent-id="${agent.id}"
  data-color="${(agent.widget_config as any).primaryColor || '#B8FF00'}"
  defer
></script>`

  res.json({ embed_code: embedCode, agent_id: agent.id })
})

// POST /agents/:id/broadcast — WhatsApp outreach
router.post('/:id/broadcast', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { contacts, message_template } = z.object({
      contacts: z.array(z.object({
        phone: z.string().min(8),
        name: z.string(),
      })),
      message_template: z.string().min(5),
    }).parse(req.body)

    const agent = await queryOne<Agent>(
      'SELECT * FROM agents WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    const persona = agent.persona as any
    if (persona?.agent_type !== 'outreach_agent') {
      return res.status(400).json({ error: 'This agent is not configured for outreach' })
    }

    // Trigger background broadcast
    const { sendOutreachBatch } = await import('../services/whatsapp.service')
    sendOutreachBatch(contacts, message_template)
      .catch((err: any) => console.error('[WhatsApp] Batch outreach failed:', err))

    res.json({ success: true, message: `Started broadcast to ${contacts.length} contacts` })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

export default router
