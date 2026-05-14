import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query } from '../db'
import { syncLeadToSheet } from '../services/sheets.service'

const router = Router()

// POST /webhooks/lead
// This can be called by the AI agent when it detects a complete lead
router.post('/lead', async (req: Request, res: Response) => {
  try {
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
    console.error('Lead webhook error:', err)
    res.status(400).json({ error: err.message })
  }
})

export default router
