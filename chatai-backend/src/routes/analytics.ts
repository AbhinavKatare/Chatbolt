import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router()

// GET /analytics/overview
router.get('/overview', authMiddleware, async (req: Request, res: Response) => {
  const { days = '30' } = req.query
  const daysNum = parseInt(days as string)

  // 1. Chat stats
  const chatStats = await queryOne(
    `SELECT COUNT(DISTINCT id) AS total_conversations FROM conversations WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2`,
    [req.tenantId, daysNum]
  )

  // 2. Workflow stats
  const wfStats = await queryOne(
    `SELECT COUNT(*) AS total_runs, SUM(credits_used) AS wf_credits FROM workflow_runs WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2`,
    [req.tenantId, daysNum]
  )

  // 3. Agent count
  const agentStats = await queryOne(
    `SELECT COUNT(*) AS active_agents FROM workflow_agents WHERE tenant_id = $1`,
    [req.tenantId]
  )

  // 4. Credit transactions
  const creditStats = await queryOne(
    `SELECT SUM(ABS(amount)) AS credits_used FROM credit_transactions WHERE tenant_id = $1 AND type = 'usage' AND created_at >= NOW() - INTERVAL '1 day' * $2`,
    [req.tenantId, daysNum]
  )

  const totalCredits = (parseInt(creditStats?.credits_used || '0')) + (parseInt(wfStats?.wf_credits || '0'))

  res.json({ 
    total_conversations: (chatStats?.total_conversations || 0) + (wfStats?.total_runs || 0),
    active_agents: agentStats?.active_agents || 0,
    credits_used: totalCredits,
    period_days: daysNum
  })
})

// GET /analytics/conversations-over-time
router.get('/conversations-over-time', authMiddleware, async (req: Request, res: Response) => {
  const { agentId, days = '30' } = req.query
  const params: any[] = [req.tenantId, parseInt(days as string)]
  const agentFilter = agentId ? 'AND agent_id = $3' : ''
  if (agentId) params.push(agentId)

  const rows = await query(
    `SELECT
       DATE(created_at) AS date,
       COUNT(*) AS conversations,
       COUNT(CASE WHEN resolved THEN 1 END) AS resolved,
       COUNT(CASE WHEN escalated THEN 1 END) AS escalated
     FROM conversations
     WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2 ${agentFilter}
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    params
  )
  res.json({ data: rows })
})

// GET /analytics/top-queries
router.get('/top-queries', authMiddleware, async (req: Request, res: Response) => {
  const { agentId, limit = '10' } = req.query
  const agentFilter = agentId ? 'AND c.agent_id = $3' : ''
  const params: any[] = [req.tenantId, parseInt(limit as string)]
  if (agentId) params.push(agentId)

  const rows = await query(
    `SELECT m.content, COUNT(*) AS frequency
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.role = 'user' AND c.tenant_id = $1 ${agentFilter}
     GROUP BY m.content
     ORDER BY frequency DESC
     LIMIT $2`,
    params
  )
  res.json({ queries: rows })
})

// GET /analytics/credits-usage
router.get('/credits-usage', authMiddleware, async (req: Request, res: Response) => {
  const rows = await query(
    `SELECT DATE(created_at) AS date, SUM(ABS(amount)) AS credits_used
     FROM credit_transactions
     WHERE tenant_id = $1 AND type = 'usage' AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [req.tenantId]
  )
  res.json({ data: rows })
})

export default router
