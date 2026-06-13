import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { actionJournalService } from '../services/action-journal.service'
import { query } from '../db'

const router = Router()

// All routes are protected
router.use(authMiddleware)

// DELETE /api/actions/:id - Rollback/undo the action
router.delete('/:id', async (req: Request, res: Response) => {
  const actionId = req.params.id
  const tenantId = req.tenantId as string
  try {
    const result = await actionJournalService.executeUndo(actionId, tenantId)
    if (result.success) {
      res.json({ success: true, message: result.message })
    } else {
      res.status(400).json({ success: false, error: result.message })
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reverse action: ' + err.message })
  }
})

// GET /api/actions - Fetch actions (optionally filtered by runId)
router.get('/', async (req: Request, res: Response) => {
  const runId = req.query.runId as string
  const tenantId = req.tenantId as string
  try {
    let queryStr = 'SELECT * FROM action_journal WHERE tenant_id = $1'
    const params: any[] = [tenantId]
    if (runId) {
      queryStr += ' AND run_id = $2'
      params.push(runId)
    }
    queryStr += ' ORDER BY created_at DESC LIMIT 20'
    const rows = await query<any>(queryStr, params)
    res.json({ success: true, actions: rows })
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch actions: ' + err.message })
  }
})

export default router
