import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { agentCompetencyEvalService } from '../services/agent-competency-eval.service'

const router = Router()
router.use(authMiddleware)

// 1. GET /api/evaluations/reports - List all agent role competency reports
router.get('/reports', (req: Request, res: Response) => {
  const reports = agentCompetencyEvalService.getAllReports()
  res.json({ success: true, reports })
})

// 2. GET /api/evaluations/reports/:role - Get specific role scorecard
router.get('/reports/:role', (req: Request, res: Response) => {
  const role = req.params.role
  const report = agentCompetencyEvalService.getRoleReport(role)
  res.json({ success: true, report })
})

// 3. GET /api/evaluations/drift/:role - Get historical drift timeline
router.get('/drift/:role', (req: Request, res: Response) => {
  const role = req.params.role
  const history = agentCompetencyEvalService.getHistoricalDrift(role)
  res.json({ success: true, history })
})

// 4. POST /api/evaluations/gate - Check deployment readiness for a role or team template
router.post('/gate', (req: Request, res: Response) => {
  const { role, roles, tier = 'pro' } = req.body

  if (role) {
    const result = agentCompetencyEvalService.isRoleDeployable(role, tier)
    return res.json({ success: true, ...result })
  }

  if (roles && Array.isArray(roles)) {
    const result = agentCompetencyEvalService.isTeamDeployable(roles, tier)
    return res.json({ success: true, ...result })
  }

  res.status(400).json({ error: 'Either role or roles array is required' })
})

// 5. POST /api/evaluations/regression - Check and run regression evaluation
router.post('/regression', (req: Request, res: Response) => {
  const { role, model, systemPrompt, tools = [] } = req.body

  if (!role || !model || !systemPrompt) {
    return res.status(400).json({ error: 'role, model, and systemPrompt are required' })
  }

  const result = agentCompetencyEvalService.checkAndRunRegressionEvals(role, model, systemPrompt, tools)
  res.json({ success: true, drifted: result.drifted, report: result.report })
})

// 6. GET /api/evaluations/custom - List custom eval cases
router.get('/custom', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const role = req.query.role as string | undefined
  const cases = agentCompetencyEvalService.listCustomEvalCases(tenantId, role)
  res.json({ success: true, cases })
})

// 7. POST /api/evaluations/custom - Create a custom eval case
router.post('/custom', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const { role, name, inputPrompt, expectedKeywords = [], requiredTools = [], forbiddenTools = [], minimumPassScore = 70 } = req.body

  if (!role || !name || !inputPrompt) {
    return res.status(400).json({ error: 'role, name, and inputPrompt are required' })
  }

  const evalCase = agentCompetencyEvalService.createCustomEvalCase({
    tenantId,
    role,
    name,
    inputPrompt,
    expectedKeywords,
    requiredTools,
    forbiddenTools,
    minimumPassScore
  })

  res.json({ success: true, evalCase })
})

// 8. POST /api/evaluations/custom/:id/run - Run custom eval against agent output
router.post('/custom/:id/run', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const evalId = req.params.id
  const { actualAgentOutput } = req.body

  const result = agentCompetencyEvalService.runCustomEval(tenantId, evalId, actualAgentOutput)
  if (!result) {
    return res.status(404).json({ error: 'Custom evaluation case not found' })
  }

  res.json({ success: true, ...result })
})

export default router
