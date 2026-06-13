import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { logger } from '../services/logger.service'

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

// Track 7: Personal Productivity Analytics
router.get('/productivity', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!
    
    // Query workflow runs last 30 days
    const rows = await query(
      `SELECT COALESCE(task_type, 'other') as task_type, DATE(created_at) as date, COUNT(*) as count
       FROM workflow_runs
       WHERE tenant_id = $1 AND status = 'completed' AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY COALESCE(task_type, 'other'), DATE(created_at)
       ORDER BY date ASC`,
      [tenantId]
    )

    const multipliers: Record<string, number> = {
      research: 45,
      spreadsheet: 30,
      email: 10,
      code: 60,
      presentation: 45,
      web: 15,
      other: 15
    }

    let totalTasks = 0
    let totalTimeSavedMinutes = 0
    const categoryMap: Record<string, { count: number; timeSavedMinutes: number }> = {}
    const dailyMap: Record<string, { count: number; timeSavedMinutes: number }> = {}

    for (const row of rows) {
      const taskType = (row.task_type || 'other').toLowerCase()
      const multiplier = multipliers[taskType] ?? multipliers.other
      const count = parseInt(row.count)
      const timeSaved = count * multiplier
      
      const dateStr = row.date instanceof Date 
        ? row.date.toISOString().split('T')[0] 
        : new Date(row.date).toISOString().split('T')[0]

      totalTasks += count
      totalTimeSavedMinutes += timeSaved

      if (!categoryMap[taskType]) {
        categoryMap[taskType] = { count: 0, timeSavedMinutes: 0 }
      }
      categoryMap[taskType].count += count
      categoryMap[taskType].timeSavedMinutes += timeSaved

      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { count: 0, timeSavedMinutes: 0 }
      }
      dailyMap[dateStr].count += count
      dailyMap[dateStr].timeSavedMinutes += timeSaved
    }

    const byCategory = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      count: data.count,
      timeSavedMinutes: data.timeSavedMinutes
    }))

    const dailyActivity = Object.entries(dailyMap).map(([date, data]) => ({
      date,
      count: data.count,
      timeSavedMinutes: data.timeSavedMinutes
    })).sort((a, b) => a.date.localeCompare(b.date))

    res.json({
      totalTasks,
      totalTimeSavedMinutes,
      byCategory,
      dailyActivity
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Task quality feedback
router.post('/feedback', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { run_id, rating, comment } = req.body // rating: 1 (thumbs up) or -1 (thumbs down)
    
    await query(
      `INSERT INTO task_feedback (tenant_id, run_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, run_id) DO UPDATE SET rating = $3, comment = $4`,
      [req.tenantId, run_id, rating, comment || null]
    )

    // Retrieve task_type of this run
    const run = await queryOne(
      `SELECT task_type FROM workflow_runs WHERE id = $1`,
      [run_id]
    )
    const taskType = run?.task_type || 'other'

    // Compute negative rate (negative_rate = COUNT(rating=-1) / COUNT(*) WHERE task_type = [type] AND created_at > now()-7days)
    const rateCheck = await queryOne(
      `SELECT 
         COUNT(CASE WHEN tf.rating = -1 THEN 1 END)::float / NULLIF(COUNT(*), 0)::float as negative_rate
       FROM task_feedback tf
       JOIN workflow_runs wr ON tf.run_id = wr.id
       WHERE wr.task_type = $1 AND tf.created_at > NOW() - INTERVAL '7 days'`,
      [taskType]
    )

    const negativeRate = parseFloat(rateCheck?.negative_rate || '0')
    if (negativeRate > 0.2) {
      logger.warn(`Quality alert: [${taskType}] negative feedback rate [${negativeRate}]`)
    }

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get automation performance
router.get('/automations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await query(
      `SELECT
        w.id, w.name, w.type,
        COUNT(wr.id) as total_runs,
        SUM(CASE WHEN wr.status='completed' THEN 1 ELSE 0 END) as successful_runs,
        AVG(wr.duration_ms) as avg_duration_ms,
        MAX(wr.created_at) as last_run_at
       FROM workflows w
       LEFT JOIN workflow_runs wr ON wr.workflow_id = w.id
       WHERE w.tenant_id = $1
       GROUP BY w.id, w.name, w.type
       ORDER BY total_runs DESC LIMIT 10`,
      [req.tenantId]
    ).catch(() => [])
    res.json({ automations: stats })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /analytics/admin/stats
router.get('/admin/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.tenant?.is_admin) {
      return res.status(403).json({ error: 'Access denied: Admin privileges required.' })
    }

    // 1. Live Stats
    const totalRunsQuery = await queryOne('SELECT COUNT(*)::integer AS total FROM workflow_runs')
    const totalConvsQuery = await queryOne('SELECT COUNT(*)::integer AS total FROM conversations')
    const activeTenantsQuery = await queryOne('SELECT COUNT(*)::integer AS total FROM tenants WHERE is_active = true')
    const metricsCounts = await query(`
      SELECT outcome, COUNT(*)::integer AS count 
      FROM execution_metrics 
      GROUP BY outcome
    `)

    let successCount = 0
    let totalMetrics = 0
    if (Array.isArray(metricsCounts)) {
      for (const row of metricsCounts) {
        const cnt = row.count
        totalMetrics += cnt
        if (row.outcome === 'success' || row.outcome === 'partial') {
          successCount += cnt
        }
      }
    }
    const successRate = totalMetrics > 0 ? (successCount / totalMetrics) * 100 : 100

    // 2. Failure Log
    const failureLog = await query(`
      SELECT wr.id, wr.error_message, wr.created_at, w.name as workflow_name, t.email as tenant_email 
      FROM workflow_runs wr 
      JOIN workflows w ON wr.workflow_id = w.id 
      JOIN tenants t ON wr.tenant_id = t.id 
      WHERE wr.status = 'failed' 
      ORDER BY wr.created_at DESC 
      LIMIT 10
    `)

    // 3. Integration Health
    const userInts = await query(`
      SELECT service, COUNT(*)::integer as count 
      FROM user_integrations 
      GROUP BY service
    `)
    const wsInts = await query(`
      SELECT service, COUNT(*)::integer as count 
      FROM workspace_integrations 
      GROUP BY service
    `)

    // Combine them into a general health object
    const integrationHealth: Record<string, { count: number; status: string }> = {}
    if (Array.isArray(userInts)) {
      for (const row of userInts) {
        integrationHealth[row.service] = { count: (integrationHealth[row.service]?.count || 0) + row.count, status: 'healthy' }
      }
    }
    if (Array.isArray(wsInts)) {
      for (const row of wsInts) {
        integrationHealth[row.service] = { count: (integrationHealth[row.service]?.count || 0) + row.count, status: 'healthy' }
      }
    }

    // 4. Top Tasks by type
    const topTasks = await query(`
      SELECT COALESCE(task_type, 'other') as task_type, COUNT(*)::integer as count 
      FROM workflow_runs 
      GROUP BY COALESCE(task_type, 'other') 
      ORDER BY count DESC 
      LIMIT 5
    `)

    res.json({
      liveStats: {
        totalRuns: totalRunsQuery?.total || 0,
        totalConversations: totalConvsQuery?.total || 0,
        activeTenants: activeTenantsQuery?.total || 0,
        successRate: Math.round(successRate * 10) / 10
      },
      failureLog: failureLog || [],
      integrationHealth: Object.entries(integrationHealth).map(([service, info]) => ({
        service,
        count: info.count,
        status: info.status
      })),
      topTasks: topTasks || []
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
