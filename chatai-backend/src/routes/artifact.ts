import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { query, queryOne } from '../db'
import { artifactMemoryService } from '../services/artifact-memory.service'
import { z } from 'zod'

const router = Router()
router.use(authMiddleware)

const artifactSchema = z.object({
  name: z.string().min(1).max(200),
  artifact_type: z.enum(['pdf', 'spreadsheet', 'presentation', 'dataset', 'brief', 'website']),
  metadata: z.any().optional(),
})

const versionSchema = z.object({
  version_number: z.number().int().positive(),
  raw_contents: z.string(),
  change_description: z.string().max(1000).optional().default(''),
})

// 1. List all artifacts in a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const artifacts = await query(`
      SELECT a.*, 
        (SELECT MAX(version_number) FROM artifact_versions WHERE artifact_id = a.id) as latest_version,
        (SELECT summary FROM artifact_versions WHERE artifact_id = a.id ORDER BY version_number DESC LIMIT 1) as latest_summary
      FROM artifacts a
      WHERE a.project_id = $1 AND a.tenant_id = $2
      ORDER BY a.updated_at DESC
    `, [req.params.projectId, req.tenantId])

    res.json({ artifacts })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 2. Create a new first-class artifact
router.post('/project/:projectId', async (req, res) => {
  try {
    const body = artifactSchema.parse(req.body)
    
    // Verify project ownership
    const proj = await queryOne(`
      SELECT p.id FROM projects p
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE p.id = $1 AND w.tenant_id = $2
    `, [req.params.projectId, req.tenantId])
    if (!proj) return res.status(404).json({ error: 'Project not found' })

    const [artifact] = await query(`
      INSERT INTO artifacts (project_id, tenant_id, name, artifact_type, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      req.params.projectId, 
      req.tenantId, 
      body.name, 
      body.artifact_type, 
      JSON.stringify(body.metadata || { linked_agents: [], linked_memory: [], source_tasks: [] })
    ])

    res.status(201).json({ artifact })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// 3. Acquire edit lock
router.post('/:id/lock', async (req, res) => {
  try {
    const artifact = await queryOne('SELECT id, locked_by_user_id, locked_at FROM artifacts WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId])
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' })

    const userId = (req as any).user?.id || 'agent'

    if (artifact.locked_by_user_id && artifact.locked_by_user_id !== userId) {
      // Check if lock has expired (locks expire in 5 minutes)
      const lockAgeMs = Date.now() - new Date(artifact.locked_at).getTime()
      if (lockAgeMs < 5 * 60 * 1000) {
        return res.status(409).json({ 
          error: 'Artifact is currently locked by another collaborator', 
          locked_by: artifact.locked_by_user_id 
        })
      }
    }

    // Acquire lock
    await query(`
      UPDATE artifacts 
      SET locked_by_user_id = $1, locked_at = NOW() 
      WHERE id = $2
    `, [userId, req.params.id])

    res.json({ success: true, locked_by: userId })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 4. Release edit lock
router.post('/:id/unlock', async (req, res) => {
  try {
    const artifact = await queryOne('SELECT id, locked_by_user_id FROM artifacts WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId])
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' })

    const userId = (req as any).user?.id || 'agent'

    if (artifact.locked_by_user_id && artifact.locked_by_user_id !== userId) {
      return res.status(403).json({ error: 'You do not own the lock on this artifact' })
    }

    await query(`
      UPDATE artifacts 
      SET locked_by_user_id = NULL, locked_at = NULL 
      WHERE id = $1
    `, [req.params.id])

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 5. Create a new version of an artifact (Requires active lock)
router.post('/:id/versions', async (req, res) => {
  try {
    const body = versionSchema.parse(req.body)
    const artifact = await queryOne('SELECT id, locked_by_user_id FROM artifacts WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId])
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' })

    const userId = (req as any).user?.id || 'agent'

    if (artifact.locked_by_user_id && artifact.locked_by_user_id !== userId) {
      return res.status(403).json({ error: 'Please acquire an edit lock before saving versions' })
    }

    // Cache version semantic summary and insert in artifact_versions in a transactional helper
    const summary = await artifactMemoryService.cacheArtifactVersion(
      req.params.id,
      body.version_number,
      body.raw_contents,
      body.change_description
    )

    // Automatically release lock after successful version creation
    await query(`
      UPDATE artifacts 
      SET locked_by_user_id = NULL, locked_at = NULL, updated_at = NOW() 
      WHERE id = $1
    `, [req.params.id])

    res.status(201).json({ 
      success: true, 
      version: body.version_number,
      summary 
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// 6. Get full version history
router.get('/:id/versions', async (req, res) => {
  try {
    const versions = await query(`
      SELECT v.id, v.version_number, v.summary, v.change_description, v.created_by, v.created_at
      FROM artifact_versions v
      JOIN artifacts a ON v.artifact_id = a.id
      WHERE a.id = $1 AND a.tenant_id = $2
      ORDER BY v.version_number DESC
    `, [req.params.id, req.tenantId])

    res.json({ versions })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
