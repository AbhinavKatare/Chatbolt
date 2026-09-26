import { Router, Request, Response } from 'express'
import { COMPANY_BLUEPRINTS } from '../config/company-blueprints.config'
import { companyOrchestratorService } from '../services/company-orchestrator.service'
import { actionJournalService } from '../services/action-journal.service'
import { postMortemService } from '../services/post-mortem.service'
import { logger } from '../services/logger.service'
import { authMiddleware } from '../middleware/auth.middleware'
import { entitlementService } from '../services/entitlement.service'

const router = Router()

// All company dashboard routes require authentication
router.use(authMiddleware)

/**
 * GET /api/company/blueprints
 * Lists all multi-team company blueprints
 */
router.get('/blueprints', async (_req: Request, res: Response) => {
  try {
    const blueprints = Object.values(COMPANY_BLUEPRINTS)
    res.json({ blueprints })
  } catch (err: any) {
    logger.error(`[CompanyDashboard] Failed to fetch blueprints: ${err.message}`)
    res.status(500).json({ error: 'Failed to retrieve company blueprints' })
  }
})

/**
 * POST /api/company/instantiate
 * Instantiates an entire simulated company org with teams (Enterprise only)
 */
router.post('/instantiate', entitlementService.requireEntitlement('company_orchestration'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || (req as any).tenant?.id || '00000000-0000-0000-0000-000000000000'
    const { blueprint_key, name } = req.body

    const company = await companyOrchestratorService.instantiateCompany({
      blueprintKey: blueprint_key || 'product_launch_company',
      tenantId,
      customName: name
    })

    res.status(201).json(company)
  } catch (err: any) {
    logger.error(`[CompanyDashboard] Instantiation failed: ${err.message}`)
    res.status(500).json({ error: err.message || 'Company instantiation failed' })
  }
})

/**
 * POST /api/company/mission
 * Launches a cross-team mission DAG across all company squads (Enterprise only)
 */
router.post('/mission', entitlementService.requireEntitlement('company_orchestration'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || (req as any).tenant?.id || '00000000-0000-0000-0000-000000000000'
    const { company_id, mission, blueprint_key } = req.body

    if (!mission) {
      return res.status(400).json({ error: 'mission description is required' })
    }

    const result = await companyOrchestratorService.executeCompanyMission({
      companyId: company_id || `company_${Date.now()}`,
      tenantId,
      mission,
      blueprintKey: blueprint_key
    })

    res.json(result)
  } catch (err: any) {
    logger.error(`[CompanyDashboard] Mission execution error: ${err.message}`)
    res.status(500).json({ error: err.message || 'Company mission execution failed' })
  }
})

/**
 * GET /api/company/:id/status
 * Returns overall company status, squad progression, and deliverables
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenant?.id || '00000000-0000-0000-0000-000000000000'
    const companyId = req.params.id

    const status = await companyOrchestratorService.getCompanyStatus(companyId, tenantId)
    res.json(status)
  } catch (err: any) {
    logger.error(`[CompanyDashboard] Failed to fetch company status: ${err.message}`)
    res.status(500).json({ error: 'Failed to fetch company status' })
  }
})

/**
 * GET /api/company/:id/accountability
 * Queries the agent accountability ledger with decision rationales
 */
router.get('/:id/accountability', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenant?.id || '00000000-0000-0000-0000-000000000000'
    const companyId = req.params.id
    const runId = req.query.run_id as string | undefined

    const entries = await actionJournalService.getAccountabilityLedger(tenantId, { companyId, runId })
    res.json({ companyId, entries, count: entries.length })
  } catch (err: any) {
    logger.error(`[CompanyDashboard] Failed to fetch accountability ledger: ${err.message}`)
    res.status(500).json({ error: 'Failed to fetch accountability ledger' })
  }
})

/**
 * POST /api/company/:id/post-mortem
 * Generates an automated post-mortem report from incident/failure data (Enterprise only)
 */
router.post('/:id/post-mortem', entitlementService.requireEntitlement('sla_post_mortem'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || (req as any).tenant?.id || '00000000-0000-0000-0000-000000000000'
    const companyId = req.params.id
    const { team_id, mission, run_id, error_reason, severity } = req.body

    const postMortem = await postMortemService.generatePostMortem({
      teamId: team_id || companyId,
      tenantId,
      mission: mission || 'Simulated Company Incident',
      runId: run_id || `run_${Date.now()}`,
      errorReason: error_reason || 'Sandbox process memory saturation and timeout',
      severity: severity || 'high'
    })

    res.status(201).json(postMortem)
  } catch (err: any) {
    logger.error(`[CompanyDashboard] Failed to generate post-mortem: ${err.message}`)
    res.status(500).json({ error: err.message || 'Failed to generate post-mortem' })
  }
})

export default router
