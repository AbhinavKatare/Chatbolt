import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import crypto from 'crypto'
import { sanitizePayload } from '../services/execution-router.service'

const router = Router()

// POST /api/shares - generates token + sets 7-day expiry
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!
    const { runId } = req.body

    if (!runId || typeof runId !== 'string') {
      return res.status(400).json({ error: 'runId is required' })
    }

    // Verify ownership of the workflow run
    const run = await queryOne(
      'SELECT id FROM workflow_runs WHERE id = $1 AND tenant_id = $2 LIMIT 1',
      [runId, tenantId]
    )
    if (!run) {
      return res.status(404).json({ error: 'Run not found' })
    }

    // Generate token
    const shareToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const [share] = await query(
      `INSERT INTO task_shares (run_id, user_id, share_token, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [runId, tenantId, shareToken, expiresAt]
    )

    res.status(201).json({ shareToken, expiresAt })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/shares/:token - public no-auth
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' })
    }

    // Fetch share record
    const share = await queryOne(
      'SELECT id, run_id, expires_at, view_count FROM task_shares WHERE share_token = $1 LIMIT 1',
      [token]
    )

    if (!share) {
      return res.status(404).json({ error: 'Share link not found.' })
    }

    // Check expiry
    if (new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired.' })
    }

    // Increment view count
    await query('UPDATE task_shares SET view_count = view_count + 1 WHERE id = $1', [share.id])

    // Fetch run details
    const run = await queryOne(
      `SELECT r.id, r.status, r.started_at, r.completed_at, r.duration_ms, r.output_data, r.task_receipt, w.name, w.original_prompt
       FROM workflow_runs r
       JOIN workflows w ON r.workflow_id = w.id
       WHERE r.id = $1 LIMIT 1`,
      [share.run_id]
    )

    if (!run) {
      return res.status(404).json({ error: 'Workflow run details not found.' })
    }

    // Fetch potential artifacts linked to this run
    const artifacts = await query(
      `SELECT name, artifact_type, metadata->>'downloadUrl' as download_url 
       FROM artifacts 
       WHERE metadata->>'source_run_id' = $1`,
      [share.run_id]
    )

    // Sanitize output (PII check, token removal, etc.)
    const rawReceipt = run.task_receipt 
      ? (typeof run.task_receipt === 'string' ? JSON.parse(run.task_receipt) : run.task_receipt)
      : null

    const payloadToSanitize = {
      name: run.name,
      prompt: run.original_prompt,
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      duration_ms: run.duration_ms,
      receipt: rawReceipt,
      output: run.output_data,
      artifacts: artifacts.map((art: any) => ({
        name: art.name,
        type: art.artifact_type,
        download_url: art.download_url
      }))
    }

    // Apply strict user-facing sanitization from execution router
    const sanitized = sanitizePayload(payloadToSanitize)

    // Extra manual PII scrubbing (strip emails / auth tokens)
    const scrubbed = JSON.parse(
      JSON.stringify(sanitized)
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
        .replace(/\b(xoxb|xoxp|xapp)-[0-9a-zA-Z-]+\b/g, '[REDACTED_TOKEN]')
    )

    res.json(scrubbed)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
