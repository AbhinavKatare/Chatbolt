import { logger } from '../services/logger.service';
import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { query, queryOne } from '../db'
import { z } from 'zod'

const router = Router()
router.use(authMiddleware)

const workspaceSchema = z.object({
  name: z.string().min(1).max(200),
})

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  status: z.enum(['active', 'archived', 'completed']).default('active'),
})

// ── BACKWARD COMPATIBILITY SELF-HEALING BACKFILL ──────────────────────────────
export async function runWorkspaceBackfill(tenantId: string) {
  try {
    // 1. Ensure at least one workspace exists for this tenant
    let workspace = await queryOne('SELECT id FROM workspaces WHERE tenant_id = $1 LIMIT 1', [tenantId])
    if (!workspace) {
      logger.info(`[Backfill] Creating Primary Workspace for tenant ${tenantId}...`)
      const rows = await query(`
        INSERT INTO workspaces (tenant_id, name)
        VALUES ($1, 'Primary Workspace')
        RETURNING id
      `, [tenantId])
      workspace = rows[0]
    }

    // 2. Ensure at least one project exists for this workspace
    let project = await queryOne('SELECT id FROM projects WHERE workspace_id = $1 LIMIT 1', [workspace.id])
    if (!project) {
      logger.info(`[Backfill] Creating Default Project for workspace ${workspace.id}...`)
      const rows = await query(`
        INSERT INTO projects (workspace_id, name, description)
        VALUES ($1, 'Default Project', 'Primary project for workspace operations.')
        RETURNING id
      `, [workspace.id])
      project = rows[0]
    }

    // 3. Backfill workflows
    await query(`
      UPDATE workflows 
      SET project_id = $1 
      WHERE tenant_id = $2 AND project_id IS NULL
    `, [project.id, tenantId])

    // 4. Backfill workflow runs
    await query(`
      UPDATE workflow_runs 
      SET project_id = $1 
      WHERE tenant_id = $2 AND project_id IS NULL
    `, [project.id, tenantId])

    // 5. Backfill custom tools
    await query(`
      UPDATE custom_tools 
      SET project_id = $1 
      WHERE tenant_id = $2 AND project_id IS NULL
    `, [project.id, tenantId])

    // 6. Backfill customer agents
    await query(`
      UPDATE agents 
      SET project_id = $1 
      WHERE tenant_id = $2 AND project_id IS NULL
    `, [project.id, tenantId])

  } catch (err: any) {
    console.error('[Backfill] Error during workspace self-healing backfill:', err.message)
  }
}

// ── WORKSPACE ENDPOINTS ────────────────────────────────────────────────────────

// 1. List workspaces with aggregate counts
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId!
    
    // Automatically run self-healing backfill check on load
    await runWorkspaceBackfill(tenantId)

    const workspaces = await query(`
      SELECT w.*,
        (SELECT COUNT(*) FROM projects p WHERE p.workspace_id = w.id) as project_count
      FROM workspaces w
      WHERE w.tenant_id = $1
      ORDER BY w.created_at DESC
    `, [tenantId])

    res.json({ workspaces })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 2. Create workspace
router.post('/', async (req, res) => {
  try {
    const body = workspaceSchema.parse(req.body)
    const [workspace] = await query(`
      INSERT INTO workspaces (tenant_id, name)
      VALUES ($1, $2)
      RETURNING *
    `, [req.tenantId, body.name])
    res.status(201).json({ workspace })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// 3. Update workspace
router.patch('/:id', async (req, res) => {
  try {
    const body = workspaceSchema.parse(req.body)
    const [workspace] = await query(`
      UPDATE workspaces 
      SET name = $1, updated_at = NOW() 
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `, [body.name, req.params.id, req.tenantId])
    
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' })
    res.json({ workspace })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// 4. Delete workspace
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM workspaces WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId])
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})


// ── PROJECT ENDPOINTS ──────────────────────────────────────────────────────────

// 5. List projects under a workspace
router.get('/:workspaceId/projects', async (req, res) => {
  try {
    // Verify workspace ownership
    const ws = await queryOne('SELECT id FROM workspaces WHERE id = $1 AND tenant_id = $2', [req.params.workspaceId, req.tenantId])
    if (!ws) return res.status(404).json({ error: 'Workspace not found' })

    const projects = await query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM workflows WHERE project_id = p.id) as workflow_count,
        (SELECT COUNT(*) FROM workflow_runs WHERE project_id = p.id) as run_count,
        (SELECT COUNT(*) FROM artifacts WHERE project_id = p.id) as artifact_count
      FROM projects p
      WHERE p.workspace_id = $1
      ORDER BY p.created_at DESC
    `, [req.params.workspaceId])

    res.json({ projects })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 6. Create project
router.post('/:workspaceId/projects', async (req, res) => {
  try {
    const ws = await queryOne('SELECT id FROM workspaces WHERE id = $1 AND tenant_id = $2', [req.params.workspaceId, req.tenantId])
    if (!ws) return res.status(404).json({ error: 'Workspace not found' })

    const body = projectSchema.parse(req.body)
    const [project] = await query(`
      INSERT INTO projects (workspace_id, name, description, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.params.workspaceId, body.name, body.description, body.status])
    
    res.status(201).json({ project })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// 7. Update project
router.patch('/projects/:projectId', async (req, res) => {
  try {
    const body = projectSchema.partial().parse(req.body)
    
    // Verify project belongs to workspace of this tenant
    const proj = await queryOne(`
      SELECT p.id FROM projects p
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE p.id = $1 AND w.tenant_id = $2
    `, [req.params.projectId, req.tenantId])
    if (!proj) return res.status(404).json({ error: 'Project not found' })

    const [updated] = await query(`
      UPDATE projects SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [body.name || null, body.description || null, body.status || null, req.params.projectId])

    res.json({ project: updated })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// 8. Delete project
router.delete('/projects/:projectId', async (req, res) => {
  try {
    const proj = await queryOne(`
      SELECT p.id FROM projects p
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE p.id = $1 AND w.tenant_id = $2
    `, [req.params.projectId, req.tenantId])
    if (!proj) return res.status(404).json({ error: 'Project not found' })

    await query('DELETE FROM projects WHERE id = $1', [req.params.projectId])
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 9. List active persistent agent heartbeats and budgets
router.get('/heartbeats', async (req, res) => {
  try {
    const heartbeats = await query(`
      SELECT 
        wa.id as agent_id,
        wa.name,
        wa.role,
        COALESCE(h.status, 'idle') as status,
        COALESCE(h.budget_allocated, 10.0000) as budget_allocated,
        COALESCE(h.budget_spent, 0.0000) as budget_spent,
        h.last_seen,
        h.current_task_id
      FROM workflow_agents wa
      JOIN workflows w ON wa.workflow_id = w.id
      LEFT JOIN agent_heartbeats h ON h.agent_id = wa.id
      WHERE w.tenant_id = $1
      ORDER BY h.last_seen DESC NULLS LAST
    `, [req.tenantId])
    res.json({ heartbeats })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
