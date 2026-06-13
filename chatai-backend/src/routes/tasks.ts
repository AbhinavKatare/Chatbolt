import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { query } from '../db'

const router = Router()

router.use(authMiddleware)

router.get('/active', async (req: Request, res: Response) => {
  try {
    const runRows = await query<any>(
      `SELECT wr.*, w.name as workflow_name, w.original_prompt
       FROM workflow_runs wr
       LEFT JOIN workflows w ON wr.workflow_id = w.id
       WHERE wr.tenant_id = $1 AND wr.status IN ('pending', 'planning', 'executing', 'tool_running', 'waiting')
       ORDER BY wr.created_at DESC
       LIMIT 1`,
      [req.tenantId]
    )

    if (runRows.length === 0) {
      return res.json({ success: true, run: null, steps: [] })
    }

    const activeRun = runRows[0]
    const stepsRows = await query<any>(
      'SELECT * FROM workflow_steps WHERE run_id = $1 ORDER BY step_number ASC',
      [activeRun.id]
    )

    let receiptText = ''
    if (activeRun.task_receipt) {
      if (typeof activeRun.task_receipt === 'string') {
        try {
          const parsed = JSON.parse(activeRun.task_receipt)
          receiptText = parsed.text || parsed.receipt || activeRun.task_receipt
        } catch {
          receiptText = activeRun.task_receipt
        }
      } else if (typeof activeRun.task_receipt === 'object') {
        receiptText = activeRun.task_receipt.text || activeRun.task_receipt.receipt || JSON.stringify(activeRun.task_receipt)
      }
    }

    res.json({
      success: true,
      run: {
        id: activeRun.id,
        workflow_id: activeRun.workflow_id,
        workflow_name: activeRun.workflow_name || 'Autonomous Task',
        status: activeRun.status,
        created_at: activeRun.created_at,
        completed_at: activeRun.completed_at,
        prompt: activeRun.original_prompt || '',
        duration_ms: activeRun.duration_ms,
        task_receipt: receiptText
      },
      steps: stepsRows.map((s: any) => ({
        id: s.agent_id,
        position: s.step_number,
        name: s.step_name || `Step ${s.step_number}`,
        role: s.role || 'assistant',
        status: s.status
      }))
    })
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch active run: ' + err.message })
  }
})

router.get('/history', async (req: Request, res: Response) => {
  try {
    const { limit = '50' } = req.query
    const rows = await query<any>(
      `SELECT wr.*, w.name as workflow_name, w.original_prompt
       FROM workflow_runs wr
       LEFT JOIN workflows w ON wr.workflow_id = w.id
       WHERE wr.tenant_id = $1
       ORDER BY wr.created_at DESC
       LIMIT $2`,
      [req.tenantId, parseInt(String(limit), 10) || 50]
    )
    
    const formattedRuns = rows.map((r: any) => {
      let receiptText = ''
      if (r.task_receipt) {
        if (typeof r.task_receipt === 'string') {
          try {
            const parsed = JSON.parse(r.task_receipt)
            receiptText = parsed.text || parsed.receipt || r.task_receipt
          } catch {
            receiptText = r.task_receipt
          }
        } else if (typeof r.task_receipt === 'object') {
          receiptText = r.task_receipt.text || r.task_receipt.receipt || JSON.stringify(r.task_receipt)
        }
      }
      return {
        id: r.id,
        workflow_id: r.workflow_id,
        workflow_name: r.workflow_name || 'Autonomous Task',
        status: r.status,
        created_at: r.created_at,
        completed_at: r.completed_at,
        prompt: r.original_prompt || '',
        duration_ms: r.duration_ms,
        task_receipt: receiptText
      }
    })

    res.json({ success: true, runs: formattedRuns })
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch task history: ' + err.message })
  }
})

export default router
