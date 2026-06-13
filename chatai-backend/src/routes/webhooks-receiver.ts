import { Router, Request, Response } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { logger } from '../services/logger.service'

const router = Router()

// ── DB Migration: ensure webhook_endpoints table exists ──────────────────────
// This runs once at module load-time. Safe to call repeatedly (CREATE IF NOT EXISTS).
;(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS webhook_endpoints (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     UUID        NOT NULL,
        name          VARCHAR(200) NOT NULL,
        token         TEXT        NOT NULL UNIQUE,
        trigger_workflow_id UUID,
        is_active     BOOLEAN     DEFAULT true,
        last_triggered_at TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS webhook_endpoints_tenant_idx ON webhook_endpoints(tenant_id);
      CREATE UNIQUE INDEX IF NOT EXISTS webhook_endpoints_token_idx ON webhook_endpoints(token);
    `)
    logger.info('[WebhookReceiver] webhook_endpoints table ready.')
  } catch (err: any) {
    logger.warn('[WebhookReceiver] webhook_endpoints migration skipped:', err.message)
  }
})()

// ────────────────────────────────────────────────────────────────────────────
// POST /webhooks-receiver/receive/:token
// Public endpoint (no auth). Looks up webhook by token, queues a workflow run.
// ────────────────────────────────────────────────────────────────────────────
router.post('/receive/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    if (!token) {
      return res.status(400).json({ error: 'Missing webhook token.' })
    }

    // Look up the webhook endpoint by token
    const endpoint = await queryOne<{
      id: string
      tenant_id: string
      name: string
      trigger_workflow_id: string | null
      is_active: boolean
    }>(
      'SELECT id, tenant_id, name, trigger_workflow_id, is_active FROM webhook_endpoints WHERE token = $1',
      [token]
    )

    if (!endpoint) {
      return res.status(404).json({ error: 'Webhook endpoint not found.' })
    }

    if (!endpoint.is_active) {
      return res.status(403).json({ error: 'Webhook endpoint is disabled.' })
    }

    // Update last_triggered_at
    await query(
      'UPDATE webhook_endpoints SET last_triggered_at = NOW() WHERE id = $1',
      [endpoint.id]
    )

    // If a trigger_workflow_id is set, create a workflow_run for it
    let runId: string | null = null

    if (endpoint.trigger_workflow_id) {
      try {
        const run = await queryOne<{ id: string }>(
          `INSERT INTO workflow_runs
             (workflow_id, tenant_id, status, trigger, input_data)
           VALUES ($1, $2, 'running', 'webhook', $3)
           RETURNING id`,
          [
            endpoint.trigger_workflow_id,
            endpoint.tenant_id,
            JSON.stringify({ webhook_payload: req.body, source_token: token }),
          ]
        )
        runId = run?.id || null
        logger.info(`[WebhookReceiver] Created workflow run ${runId} for endpoint ${endpoint.id}`)
      } catch (runErr: any) {
        logger.error('[WebhookReceiver] Failed to create workflow run:', runErr.message)
        // Non-fatal — still acknowledge receipt
      }
    } else {
      logger.info(`[WebhookReceiver] Endpoint ${endpoint.id} (${endpoint.name}) triggered — no workflow linked.`)
    }

    return res.json({
      received: true,
      endpoint_name: endpoint.name,
      run_id: runId,
    })
  } catch (err: any) {
    logger.error('[WebhookReceiver] Error processing webhook:', err.message)
    return res.status(500).json({ error: 'Internal error processing webhook.' })
  }
})

// ────────────────────────────────────────────────────────────────────────────
// GET /webhooks-receiver/list
// Lists the current tenant's webhook endpoints.
// ────────────────────────────────────────────────────────────────────────────
router.get('/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!
    const frontendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace('3000', '4000') || 'http://localhost:4000'

    const rows = await query(
      `SELECT id, name, token, trigger_workflow_id, is_active, last_triggered_at, created_at
       FROM webhook_endpoints
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    )

    const endpoints = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      token: r.token,
      trigger_workflow_id: r.trigger_workflow_id,
      is_active: r.is_active,
      last_triggered_at: r.last_triggered_at,
      created_at: r.created_at,
      webhook_url: `${frontendUrl}/webhooks-receiver/receive/${r.token}`,
    }))

    return res.json({ endpoints })
  } catch (err: any) {
    logger.error('[WebhookReceiver] Error listing endpoints:', err.message)
    return res.status(500).json({ error: 'Failed to list webhook endpoints.' })
  }
})

// ────────────────────────────────────────────────────────────────────────────
// POST /webhooks-receiver/create
// Creates a new webhook endpoint. Returns the unique webhook URL.
// ────────────────────────────────────────────────────────────────────────────
const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  trigger_workflow_id: z.string().uuid().optional(),
})

router.post('/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!
    const body = createSchema.parse(req.body)

    // Generate a cryptographically secure unique token
    const token = crypto.randomBytes(32).toString('hex')

    const row = await queryOne<{
      id: string
      token: string
      name: string
      trigger_workflow_id: string | null
      is_active: boolean
      created_at: string
    }>(
      `INSERT INTO webhook_endpoints (tenant_id, name, token, trigger_workflow_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, token, name, trigger_workflow_id, is_active, created_at`,
      [tenantId, body.name, token, body.trigger_workflow_id || null]
    )

    if (!row) {
      return res.status(500).json({ error: 'Failed to create webhook endpoint.' })
    }

    const frontendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace('3000', '4000') || 'http://localhost:4000'
    const webhookUrl = `${frontendUrl}/webhooks-receiver/receive/${row.token}`

    logger.info(`[WebhookReceiver] Created endpoint "${body.name}" for tenant ${tenantId}`)

    return res.status(201).json({
      endpoint: {
        id: row.id,
        name: row.name,
        token: row.token,
        trigger_workflow_id: row.trigger_workflow_id,
        is_active: row.is_active,
        created_at: row.created_at,
        webhook_url: webhookUrl,
      },
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input.' })
    }
    logger.error('[WebhookReceiver] Error creating endpoint:', err.message)
    return res.status(500).json({ error: 'Failed to create webhook endpoint.' })
  }
})

// ────────────────────────────────────────────────────────────────────────────
// DELETE /webhooks-receiver/:id
// Deletes a webhook endpoint owned by the current tenant.
// ────────────────────────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!
    const { id } = req.params

    const existing = await queryOne(
      'SELECT id FROM webhook_endpoints WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    )

    if (!existing) {
      return res.status(404).json({ error: 'Webhook endpoint not found.' })
    }

    await query('DELETE FROM webhook_endpoints WHERE id = $1 AND tenant_id = $2', [id, tenantId])

    logger.info(`[WebhookReceiver] Deleted endpoint ${id} for tenant ${tenantId}`)
    return res.json({ success: true, id })
  } catch (err: any) {
    logger.error('[WebhookReceiver] Error deleting endpoint:', err.message)
    return res.status(500).json({ error: 'Failed to delete webhook endpoint.' })
  }
})

export default router
