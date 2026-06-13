import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { query, queryOne } from '../db'
import { runEnrichmentAgent } from '../agents/enrichment.agent'
import { WorkflowAgent } from '../types'

const router = Router()
router.use(authMiddleware)

// ── Zod schemas ──────────────────────────────────────────────────────────────

const singleEnrichSchema = z.object({
  company: z.string().min(1).max(500),
  domain: z.string().max(500).optional(),
})

const bulkEnrichSchema = z.object({
  companies: z
    .array(
      z.object({
        company: z.string().min(1).max(500),
        domain: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(20),
})

// ── Helper: build a minimal WorkflowAgent stub ────────────────────────────────
function buildEnrichmentAgent(tenantId: string): WorkflowAgent {
  return {
    id: uuidv4(),
    workflow_id: 'enrichment-direct',
    tenant_id: tenantId,
    position: 1,
    name: 'Enrichment Agent',
    role: 'enricher',
    description: 'Enriches company data from the web',
    system_prompt:
      'You are a B2B intelligence analyst. Extract and synthesise structured company data from raw web content.',
    config: {
      model: '',           // base.agent picks the right model from the tenant plan
      temperature: 0.3,
      max_tokens: 3000,
      tools_needed: ['web_search', 'scraper'],
    },
    inputs_from_user: [],
    inputs_from_previous: [],
    output_type: 'json',
    output_description: 'Structured company enrichment profile',
    status: 'idle',
    created_at: new Date(),
  }
}

// ── Helper: persist result to enrichment_results table ───────────────────────
async function persistResult(
  tenantId: string,
  company: string,
  domain: string | undefined,
  result: any,
  success: boolean,
  durationMs: number
) {
  try {
    await query(
      `INSERT INTO enrichment_results
         (tenant_id, company_name, domain, result, success, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, company, domain || null, JSON.stringify(result), success, durationMs]
    )
  } catch (err: any) {
    // Non-fatal — do not throw; log and continue
    console.error('[Enrichment] Failed to persist result:', err.message)
  }
}

// ── POST /enrich/company ──────────────────────────────────────────────────────
// Synchronous single-company enrichment
router.post('/company', async (req, res) => {
  const t0 = Date.now()
  try {
    const body = singleEnrichSchema.parse(req.body)
    const tenantId = req.tenantId!

    const agent = buildEnrichmentAgent(tenantId)
    const runId = uuidv4()

    const agentOutput = await runEnrichmentAgent(
      agent,
      {
        user_inputs: { company: body.company, domain: body.domain },
        previous_outputs: {},
      },
      runId
    )

    const durationMs = Date.now() - t0
    await persistResult(tenantId, body.company, body.domain, agentOutput.data, agentOutput.success, durationMs)

    if (!agentOutput.success) {
      return res.status(500).json({
        error: agentOutput.error || 'Enrichment failed',
        summary: agentOutput.summary,
      })
    }

    return res.json({
      success: true,
      data: agentOutput.data,
      summary: agentOutput.summary,
      confidence: agentOutput.confidence,
      duration_ms: durationMs,
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors })
    }
    console.error('[POST /enrich/company]', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /enrich/history ───────────────────────────────────────────────────────
// Returns the last 20 enrichments for this tenant
router.get('/history', async (req, res) => {
  try {
    const rows = await query(
      `SELECT
         id,
         company_name,
         domain,
         result,
         success,
         duration_ms,
         created_at
       FROM enrichment_results
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.tenantId]
    )

    return res.json({ history: rows, total: rows.length })
  } catch (err: any) {
    console.error('[GET /enrich/history]', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /enrich/bulk ─────────────────────────────────────────────────────────
// Sequential enrichment to respect rate limits (max 20 companies per call)
router.post('/bulk', async (req, res) => {
  try {
    const body = bulkEnrichSchema.parse(req.body)
    const tenantId = req.tenantId!

    const results: Array<{
      company: string
      domain?: string
      success: boolean
      data: any
      summary: string
      confidence: number
      error?: string
      duration_ms: number
    }> = []

    for (const item of body.companies) {
      const t0 = Date.now()
      const agent = buildEnrichmentAgent(tenantId)
      const runId = uuidv4()

      try {
        const agentOutput = await runEnrichmentAgent(
          agent,
          {
            user_inputs: { company: item.company, domain: item.domain },
            previous_outputs: {},
          },
          runId
        )

        const durationMs = Date.now() - t0
        await persistResult(tenantId, item.company, item.domain, agentOutput.data, agentOutput.success, durationMs)

        results.push({
          company: item.company,
          domain: item.domain,
          success: agentOutput.success,
          data: agentOutput.data,
          summary: agentOutput.summary,
          confidence: agentOutput.confidence,
          error: agentOutput.error,
          duration_ms: durationMs,
        })
      } catch (itemErr: any) {
        const durationMs = Date.now() - t0
        await persistResult(tenantId, item.company, item.domain, null, false, durationMs)

        results.push({
          company: item.company,
          domain: item.domain,
          success: false,
          data: null,
          summary: 'Enrichment failed',
          confidence: 0,
          error: itemErr.message,
          duration_ms: durationMs,
        })
      }

      // Small back-off between requests to avoid hammering search/LLM APIs
      if (results.length < body.companies.length) {
        await new Promise((r) => setTimeout(r, 500))
      }
    }

    const successCount = results.filter((r) => r.success).length
    return res.json({
      total: results.length,
      succeeded: successCount,
      failed: results.length - successCount,
      results,
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors })
    }
    console.error('[POST /enrich/bulk]', err.message)
    return res.status(500).json({ error: err.message })
  }
})

export default router
