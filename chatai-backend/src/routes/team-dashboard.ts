import { Router, Request, Response } from 'express'
import { TEAM_TEMPLATES } from '../config/team-templates.config'
import { teamOrchestratorService } from '../services/team-orchestrator.service'
import { listTeamMemories, searchTeamMemory, clearTeamMemory } from '../services/memory.service'
import { logger } from '../services/logger.service'
import { authMiddleware } from '../middleware/auth.middleware'
import { entitlementService } from '../services/entitlement.service'

const router = Router()

// All team routes require authentication
router.use(authMiddleware)

/**
 * GET /api/teams/templates
 * Lists all available starter team templates
 */
router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const templates = Object.values(TEAM_TEMPLATES).map(t => ({
      id: t.id,
      key: t.category,
      name: t.name,
      category: t.category,
      description: t.description,
      mission: t.mission,
      lead_role: t.lead_role,
      roles: t.roles.map(r => ({
        role: r.role,
        name: r.name,
        title: r.title,
        description: r.description,
        tools: r.tools_available.map(tool => tool.name),
        is_lead: r.is_lead || false
      })),
      escalation_policy: t.escalation_policy,
      suggested_tasks: t.suggested_tasks
    }))

    res.json({ templates })
  } catch (err: any) {
    logger.error(`[TeamDashboard] Failed to fetch templates: ${err.message}`)
    res.status(500).json({ error: 'Failed to retrieve team templates' })
  }
})

/**
 * POST /api/teams/instantiate
 * Instantiates a team from a chosen template (Team/Enterprise only)
 */
router.post('/instantiate', entitlementService.requireEntitlement('team_workforce'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || (req as any).tenant?.id || '00000000-0000-0000-0000-000000000000'
    const { template_key, name, mission } = req.body

    if (!template_key) {
      return res.status(400).json({ error: 'template_key is required (marketing | technical | operations)' })
    }

    const result = await teamOrchestratorService.instantiateTeamFromTemplate({
      templateKey: template_key,
      tenantId,
      customName: name,
      customMission: mission
    })

    res.status(201).json(result)
  } catch (err: any) {
    logger.error(`[TeamDashboard] Failed to instantiate team: ${err.message}`)
    res.status(500).json({ error: err.message || 'Failed to instantiate team' })
  }
})

/**
 * GET /api/teams/:id/status
 * Returns real-time status, active tasks, memory count, and intervention states
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenant?.id || '00000000-0000-0000-0000-000000000000'
    const teamId = req.params.id

    const status = await teamOrchestratorService.getTeamStatus(teamId, tenantId)
    res.json(status)
  } catch (err: any) {
    logger.error(`[TeamDashboard] Failed to fetch status for team ${req.params.id}: ${err.message}`)
    res.status(500).json({ error: 'Failed to fetch team status' })
  }
})

/**
 * POST /api/teams/:id/mission
 * Dispatches a goal/mission to the team's TeamLead (Team/Enterprise only)
 */
router.post('/:id/mission', entitlementService.requireEntitlement('team_workforce'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || (req as any).tenant?.id || '00000000-0000-0000-0000-000000000000'
    const teamId = req.params.id
    const { mission, template_key, max_iterations } = req.body

    if (!mission) {
      return res.status(400).json({ error: 'mission text is required' })
    }

    const result = await teamOrchestratorService.dispatchMission({
      teamId,
      tenantId,
      mission,
      templateKey: template_key,
      maxIterations: max_iterations || 6
    })

    res.json(result)
  } catch (err: any) {
    logger.error(`[TeamDashboard] Mission execution failed for team ${req.params.id}: ${err.message}`)
    res.status(500).json({ error: err.message || 'Team mission execution failed' })
  }
})

/**
 * POST /api/teams/:id/intervene
 * Human-in-the-loop intervention (pause, resume, inject guidance, cancel, approve)
 */
router.post('/:id/intervene', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || (req as any).tenant?.id || '00000000-0000-0000-0000-000000000000'
    const teamId = req.params.id
    const { action, guidance } = req.body

    if (!action || !['pause', 'resume', 'inject_guidance', 'cancel', 'approve_action'].includes(action)) {
      return res.status(400).json({
        error: 'Valid action required: pause | resume | inject_guidance | cancel | approve_action'
      })
    }

    const result = await teamOrchestratorService.intervene({
      teamId,
      tenantId,
      action,
      guidance
    })

    res.json(result)
  } catch (err: any) {
    logger.error(`[TeamDashboard] Intervention failed for team ${req.params.id}: ${err.message}`)
    res.status(500).json({ error: err.message || 'Intervention action failed' })
  }
})

/**
 * GET /api/teams/:id/memory
 * Retrieves team-scoped shared memory entries (Team/Enterprise only)
 */
router.get('/:id/memory', entitlementService.requireEntitlement('team_shared_memory'), async (req: Request, res: Response) => {
  try {
    const teamId = req.params.id
    const query = req.query.q as string | undefined
    const limit = parseInt(req.query.limit as string) || 50

    if (query) {
      const results = await searchTeamMemory(teamId, query, limit)
      return res.json({ query, results, count: results.length })
    }

    const memories = await listTeamMemories(teamId, limit)
    res.json({ memories, count: memories.length })
  } catch (err: any) {
    logger.error(`[TeamDashboard] Failed to fetch memories for team ${req.params.id}: ${err.message}`)
    res.status(500).json({ error: 'Failed to fetch team memory' })
  }
})

/**
 * DELETE /api/teams/:id/memory
 * Clears team-scoped shared memory (Team/Enterprise only)
 */
router.delete('/:id/memory', entitlementService.requireEntitlement('team_shared_memory'), async (req: Request, res: Response) => {
  try {
    const teamId = req.params.id
    const count = await clearTeamMemory(teamId)
    res.json({ success: true, cleared_count: count })
  } catch (err: any) {
    logger.error(`[TeamDashboard] Failed to clear memories for team ${req.params.id}: ${err.message}`)
    res.status(500).json({ error: 'Failed to clear team memory' })
  }
})

export default router
