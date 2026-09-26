import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { permissionSystemService, ToolCategory } from '../services/permission-system.service'

const router = Router()
router.use(authMiddleware)

// 1. GET /api/permissions/surface - Transparent auto-approval matrix & active rules
router.get('/surface', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const teamId = req.query.teamId as string | undefined
  const surface = permissionSystemService.getAutoApprovalSurface(tenantId, teamId)
  res.json({ success: true, surface })
})

// 2. GET /api/permissions/rules - List standing rules
router.get('/rules', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const teamId = req.query.teamId as string | undefined
  const role = req.query.role as string | undefined
  const category = req.query.category as ToolCategory | undefined

  const rules = permissionSystemService.listStandingRules(tenantId, { teamId, role, category })
  res.json({ success: true, rules })
})

// 3. POST /api/permissions/rules - Create standing rule (manual or "remember this decision")
router.post('/rules', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const { teamId, agentRole, toolCategory, toolName, scopePattern, action = 'allow', expiresAt, maxUses, rationale } = req.body

  if (!toolCategory || !scopePattern) {
    return res.status(400).json({ error: 'toolCategory and scopePattern are required' })
  }

  const rule = permissionSystemService.createStandingRule({
    tenantId,
    teamId,
    agentRole,
    toolCategory,
    toolName,
    scopePattern,
    action,
    expiresAt,
    maxUses,
    createdBy: 'user_approved',
    rationale
  })

  res.json({ success: true, rule })
})

// 4. DELETE /api/permissions/rules/:id - Revoke standing rule
router.delete('/rules/:id', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const ruleId = req.params.id

  const revoked = permissionSystemService.revokeStandingRule(tenantId, ruleId)
  if (!revoked) {
    return res.status(404).json({ error: 'Standing rule not found or already revoked' })
  }

  res.json({ success: true, message: `Standing rule ${ruleId} revoked successfully` })
})

// 5. GET /api/permissions/promotions - List suggested permission promotions
router.get('/promotions', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const status = req.query.status as any
  const promotions = permissionSystemService.listSuggestedPromotions(tenantId, status)
  res.json({ success: true, promotions })
})

// 6. POST /api/permissions/promotions/:id/accept - Explicitly accept suggested promotion
router.post('/promotions/:id/accept', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const promotionId = req.params.id

  const result = permissionSystemService.acceptSuggestedPromotion(tenantId, promotionId)
  if (!result) {
    return res.status(404).json({ error: 'Promotion not found' })
  }

  res.json({ success: true, promotion: result.promotion, standingRule: result.standingRule })
})

// 7. POST /api/permissions/promotions/:id/reject - Reject suggested promotion
router.post('/promotions/:id/reject', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const promotionId = req.params.id

  const promotion = permissionSystemService.rejectSuggestedPromotion(tenantId, promotionId)
  if (!promotion) {
    return res.status(404).json({ error: 'Promotion not found' })
  }

  res.json({ success: true, promotion })
})

// 8. POST /api/permissions/evaluate - Test/dry-run permission evaluation
router.post('/evaluate', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const { teamId, agentRole, toolName, targetPath, payload, autonomyLevel } = req.body

  const evaluation = permissionSystemService.evaluatePermission({
    tenantId,
    teamId,
    agentRole,
    toolName,
    targetPath,
    payload,
    autonomyLevel
  })

  res.json({ success: true, evaluation })
})

// 9. POST /api/permissions/decisions - Record user decision on approval prompt & optionally create standing rule
router.post('/decisions', (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const { agentRole, teamId, toolCategory, scopePattern, outcome, rememberDecision, maxUses, expiresAt } = req.body

  if (!agentRole || !toolCategory || !scopePattern || !outcome) {
    return res.status(400).json({ error: 'agentRole, toolCategory, scopePattern, and outcome are required' })
  }

  const { trustRecord, promotionTriggered } = permissionSystemService.recordApprovalDecision({
    tenantId,
    agentRole,
    teamId,
    toolCategory,
    scopePattern,
    outcome
  })

  let standingRule = null
  if (rememberDecision && (outcome === 'approved_unmodified' || outcome === 'approved_with_modification')) {
    standingRule = permissionSystemService.createStandingRule({
      tenantId,
      teamId,
      agentRole,
      toolCategory,
      scopePattern,
      action: 'allow',
      maxUses,
      expiresAt,
      createdBy: 'user_approved',
      rationale: `User chose "Remember this decision" upon approving action in scope '${scopePattern}'.`
    })
  }

  res.json({ success: true, trustRecord, promotionTriggered, standingRule })
})

export default router
