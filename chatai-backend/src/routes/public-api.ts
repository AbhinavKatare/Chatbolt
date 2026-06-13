import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { apiKeyMiddleware } from '../middleware/auth.middleware'
import { query, queryOne } from '../db'
import { logger } from '../services/logger.service'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'

const router = Router()

// Rate limit: 60 requests per minute for public API
const publicApiLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Rate limit exceeded. Please slow down.' }
})

router.use(publicApiLimit)
router.use(apiKeyMiddleware)

// ── POST /api/v1/tasks — Submit a task ────────────────────────────────────────

const SubmitTaskSchema = z.object({
  prompt: z.string().min(1).max(2000),
  workflow_id: z.string().uuid().optional(),
})

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const parsed = SubmitTaskSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const { prompt, workflow_id } = parsed.data
    const tenantId = req.tenantId!

    // If workflow_id provided, use it; otherwise find or create a default workflow
    let wfId = workflow_id
    if (!wfId) {
      // Find a default workflow for this tenant
      const defaultWf = await queryOne(
        'SELECT id FROM workflows WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1',
        [tenantId]
      )
      if (!defaultWf) {
        return res.status(400).json({ error: 'No workflow available. Create a workflow first, or specify workflow_id.' })
      }
      wfId = defaultWf.id
    } else {
      const wf = await queryOne('SELECT id FROM workflows WHERE id = $1 AND tenant_id = $2', [wfId, tenantId])
      if (!wf) return res.status(404).json({ error: 'Workflow not found' })
    }

    // Check credits
    const tenant = await queryOne<{ credits_remaining: number }>('SELECT credits_remaining FROM tenants WHERE id = $1', [tenantId])
    if (!tenant || tenant.credits_remaining < 1) {
      return res.status(402).json({ error: 'Insufficient credits. Please upgrade your plan.' })
    }

    // Create a workflow run
    const [run] = await query(
      `INSERT INTO workflow_runs (workflow_id, tenant_id, status, trigger, input_data)
       VALUES ($1, $2, 'queued', 'api', $3)
       RETURNING id, status, created_at`,
      [wfId, tenantId, JSON.stringify({ prompt })]
    )

    // Deduct 1 credit
    await query('UPDATE tenants SET credits_remaining = credits_remaining - 1 WHERE id = $1', [tenantId])

    logger.info(`[Public API] Task submitted: run ${run.id} for tenant ${tenantId}`)

    return res.status(202).json({
      task_id: run.id,
      status: 'queued',
      estimated_seconds: 30,
      message: 'Task has been submitted and is queued for processing.',
    })
  } catch (err: any) {
    logger.error('[Public API] Submit task error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /api/v1/tasks/:id — Get task status/result ────────────────────────────

router.get('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const run = await queryOne(
      `SELECT wr.id, wr.status, wr.output_data, wr.error_message, wr.created_at, wr.completed_at, wr.duration_ms,
              w.name as workflow_name
       FROM workflow_runs wr
       LEFT JOIN workflows w ON wr.workflow_id = w.id
       WHERE wr.id = $1 AND wr.tenant_id = $2`,
      [req.params.id, req.tenantId]
    )

    if (!run) return res.status(404).json({ error: 'Task not found' })

    return res.json({
      task_id: run.id,
      status: run.status,
      workflow: run.workflow_name,
      output: run.output_data || null,
      error: run.error_message || null,
      created_at: run.created_at,
      completed_at: run.completed_at || null,
      duration_ms: run.duration_ms || null,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /api/v1/tasks — List recent tasks ────────────────────────────────────

router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const runs = await query(
      `SELECT wr.id, wr.status, wr.created_at, wr.completed_at, wr.duration_ms,
              w.name as workflow_name
       FROM workflow_runs wr
       LEFT JOIN workflows w ON wr.workflow_id = w.id
       WHERE wr.tenant_id = $1
       ORDER BY wr.created_at DESC
       LIMIT 20`,
      [req.tenantId]
    )

    return res.json({ tasks: runs })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /api/v1/integrations — Get connected integrations ────────────────────

router.get('/integrations', async (req: Request, res: Response) => {
  try {
    const integrations = await query(
      `SELECT service, created_at FROM user_integrations WHERE tenant_id = $1`,
      [req.tenantId]
    ).catch(() => [])
    return res.json({ integrations })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /api/v1/memory — Get top memory facts ────────────────────────────────

router.get('/memory', async (req: Request, res: Response) => {
  try {
    const facts = await query(
      `SELECT key, value, category, confidence FROM agent_memory
       WHERE tenant_id = $1
       ORDER BY confidence DESC NULLS LAST
       LIMIT 20`,
      [req.tenantId]
    ).catch(() => [])
    return res.json({ facts })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /api/v1/message — Send a message to an agent ────────────────────────

const MessageSchema = z.object({
  agent_id: z.string().uuid(),
  message: z.string().min(1).max(4000),
  session_id: z.string().optional(),
})

router.post('/message', async (req: Request, res: Response) => {
  try {
    const parsed = MessageSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const { agent_id, message, session_id } = parsed.data

    // Verify agent ownership
    const agent = await queryOne(
      'SELECT id, name, system_prompt FROM agents WHERE id = $1 AND tenant_id = $2',
      [agent_id, req.tenantId]
    )
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    const sessionId = session_id || `api-${Date.now()}`

    // Simple LLM call using OpenRouter/Mistral
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.MISTRAL_API_KEY
    const model = process.env.OPENROUTER_API_KEY ? 'mistralai/mistral-7b-instruct:free' : 'mistral-small-latest'
    const baseUrl = process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.mistral.ai/v1'

    if (!apiKey) {
      return res.status(503).json({ error: 'No LLM API key configured' })
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: agent.system_prompt || 'You are a helpful assistant.' },
          { role: 'user', content: message }
        ],
        max_tokens: 1000,
      })
    }).then(r => r.json()).catch(() => null)

    const reply = response?.choices?.[0]?.message?.content || 'I could not process your request at this time.'

    return res.json({
      response: reply,
      session_id: sessionId,
      agent: agent.name,
    })
  } catch (err: any) {
    logger.error('[Public API] Message error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

export default router
