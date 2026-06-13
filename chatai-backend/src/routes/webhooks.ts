import { Router, Request, Response } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { query } from '../db'
import { syncLeadToSheet } from '../services/sheets.service'

const router = Router()
const webhookLimiters = new Map<string, number[]>()

// POST /webhooks/lead
// This can be called by the support assistant when it detects a complete lead
router.post('/lead', async (req: Request, res: Response) => {
  try {
    // 1. 1MB payload limit check
    const contentLength = req.headers['content-length']
    if (contentLength && parseInt(contentLength) > 1024 * 1024) {
      return res.status(413).json({ error: 'Payload Too Large: Limit is 1MB' })
    }

    // 2. 10/min rate limit
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const now = Date.now()
    let timestamps = webhookLimiters.get(ip) || []
    timestamps = timestamps.filter(t => now - t < 60000)
    if (timestamps.length >= 10) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Too many calls. Limit is 10/min.',
        retryAfter: 60
      })
    }
    timestamps.push(now)
    webhookLimiters.set(ip, timestamps)

    // 3. timingSafeEqual secret check
    const secret = process.env.WEBHOOK_SECRET || 'webhook_secret_key_2026'
    const clientSecret = req.headers['x-webhook-secret'] || ''
    const secretHash = crypto.createHash('sha256').update(secret).digest()
    const clientHash = crypto.createHash('sha256').update(clientSecret as string).digest()

    if (!crypto.timingSafeEqual(secretHash, clientHash)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid secret' })
    }

    const leadSchema = z.object({
      tenant_id: z.string().uuid(),
      agent_id: z.string().uuid(),
      conversation_id: z.string().uuid().optional(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      requirement: z.string().optional(),
      budget: z.string().optional(),
      score: z.number().optional().default(0),
      notes: z.string().optional(),
    })

    const data = leadSchema.parse(req.body)

    const [lead] = await query(
      `INSERT INTO leads (tenant_id, agent_id, conversation_id, name, email, phone, company, qualification_score, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        data.tenant_id,
        data.agent_id,
        data.conversation_id,
        data.name,
        data.email,
        data.phone,
        data.company,
        data.score,
        JSON.stringify({
          requirement: data.requirement,
          budget: data.budget,
          notes: data.notes,
        }),
      ]
    )

    // Trigger background sync to sheets
    if (process.env.LEADS_SHEET_ID) {
      syncLeadToSheet(lead.id).catch(err => console.error('Failed to sync lead to sheet:', err))
    }

    res.json({ success: true, lead_id: lead.id })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors })
    res.status(400).json({ error: err.message })
  }
})

export default router
