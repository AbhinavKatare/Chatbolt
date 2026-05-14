import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router()

// GET /analytics/overview
router.get('/overview', authMiddleware, async (req: Request, res: Response) => {
  const { agentId, days = '30' } = req.query
  const daysNum = parseInt(days as string)
  const agentFilter = agentId ? 'AND c.agent_id = $3' : ''
  const params: any[] = [req.tenantId, daysNum]
  if (agentId) params.push(agentId)

  const [stats] = await query(
    `SELECT
      COUNT(DISTINCT c.id) AS total_conversations,
      COUNT(m.id) AS total_messages,
      COUNT(DISTINCT CASE WHEN c.resolved THEN c.id END) AS resolved_conversations,
      COUNT(DISTINCT CASE WHEN c.escalated THEN c.id END) AS escalated_conversations,
      ROUND(
        COUNT(DISTINCT CASE WHEN c.resolved THEN c.id END)::numeric /
        NULLIF(COUNT(DISTINCT c.id), 0) * 100, 1
      ) AS resolution_rate
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE c.tenant_id = $1
       AND c.created_at >= NOW() - INTERVAL '1 day' * $2
       ${agentFilter}`,
    params
  )

  const creditStats = await queryOne(
    `SELECT SUM(ABS(amount)) AS credits_used
     FROM credit_transactions
     WHERE tenant_id = $1 AND type = 'usage'
       AND created_at >= NOW() - INTERVAL '1 day' * $2`,
    [req.tenantId, daysNum]
  )

  res.json({ ...stats, credits_used: creditStats?.credits_used || 0, period_days: daysNum })
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
