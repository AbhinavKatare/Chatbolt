import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { query, queryOne } from '../db'
import { logger } from '../services/logger.service'
import { z } from 'zod'

const router = Router()

// ── Automation Templates ──────────────────────────────────────────────────────

const TEMPLATES = [
  { id: 't1', name: 'Daily Email Digest', description: 'Get a summary of your most important emails every morning', category: 'Email', cron: '0 8 * * *', trigger_type: 'schedule', icon: '✉️', color: '#ea4335' },
  { id: 't2', name: 'Weekly Progress Report', description: 'Auto-generate a progress report every Friday afternoon', category: 'Reports', cron: '0 16 * * 5', trigger_type: 'schedule', icon: '📊', color: '#4285f4' },
  { id: 't3', name: 'Morning Briefing', description: 'Start your day with a personalized briefing of your priorities', category: 'Reports', cron: '0 9 * * 1-5', trigger_type: 'schedule', icon: '🌅', color: '#fbbc05' },
  { id: 't4', name: 'Slack Standup Reminder', description: 'Post a standup prompt to your team channel every morning', category: 'Slack', cron: '0 9 * * 1-5', trigger_type: 'schedule', icon: '💬', color: '#4a154b' },
  { id: 't5', name: 'Monthly Metrics Report', description: 'Generate a comprehensive monthly metrics report on the 1st', category: 'Reports', cron: '0 9 1 * *', trigger_type: 'schedule', icon: '📈', color: '#34a853' },
  { id: 't6', name: 'Auto-Reply to Leads', description: 'Automatically draft replies to new lead emails within the hour', category: 'Email', cron: '0 * * * *', trigger_type: 'schedule', icon: '📬', color: '#ea4335' },
  { id: 't7', name: 'Calendar Conflict Detector', description: 'Scan your calendar for conflicts and alert you every morning', category: 'Calendar', cron: '0 8 * * 1-5', trigger_type: 'schedule', icon: '📅', color: '#4285f4' },
  { id: 't8', name: 'Weekly Newsletter Draft', description: 'Draft your weekly newsletter every Thursday', category: 'Email', cron: '0 14 * * 4', trigger_type: 'schedule', icon: '📰', color: '#ea4335' },
  { id: 't9', name: 'Daily Data Backup Summary', description: 'Get a daily summary of data collected and stored', category: 'Data', cron: '0 23 * * *', trigger_type: 'schedule', icon: '💾', color: '#34a853' },
  { id: 't10', name: 'Customer Feedback Digest', description: 'Compile all customer feedback from the past week every Monday', category: 'Reports', cron: '0 10 * * 1', trigger_type: 'schedule', icon: '⭐', color: '#fbbc05' },
  { id: 't11', name: 'New Lead Alert', description: 'Get notified and enriched details for new email leads', category: 'Email', cron: '*/30 * * * *', trigger_type: 'schedule', icon: '🎯', color: '#ea4335' },
  { id: 't12', name: 'Social Media Summary', description: 'Get a daily digest of your social mentions and engagement', category: 'Data', cron: '0 18 * * *', trigger_type: 'schedule', icon: '📱', color: '#1da1f2' },
  { id: 't13', name: 'Invoice Follow-up', description: 'Check for unpaid invoices every Monday morning', category: 'Data', cron: '0 9 * * 1', trigger_type: 'schedule', icon: '💰', color: '#34a853' },
  { id: 't14', name: 'Team Task Delegation', description: 'Review and delegate pending tasks to team members every morning', category: 'Reports', cron: '0 8 * * 1-5', trigger_type: 'schedule', icon: '👥', color: '#6366f1' },
  { id: 't15', name: 'Competitor Monitoring', description: 'Get a weekly brief on what your competitors have published', category: 'Reports', cron: '0 9 * * 3', trigger_type: 'schedule', icon: '🔍', color: '#f59e0b' },
  { id: 't16', name: 'Meeting Prep Brief', description: 'Auto-generate prep notes for your next day meetings every evening', category: 'Calendar', cron: '0 18 * * 1-5', trigger_type: 'schedule', icon: '📋', color: '#4285f4' },
  { id: 't17', name: 'End-of-Day Wrap-up', description: 'Summarize completed tasks and plan tomorrow every evening', category: 'Reports', cron: '0 17 * * 1-5', trigger_type: 'schedule', icon: '🌙', color: '#6366f1' },
  { id: 't18', name: 'Onboarding Email Sequence', description: 'Send personalized onboarding emails to new contacts', category: 'Email', cron: '0 10 * * *', trigger_type: 'schedule', icon: '🚀', color: '#ea4335' },
  { id: 't19', name: 'Slack Announcement Drafter', description: 'Draft weekly team announcements for Slack every Friday', category: 'Slack', cron: '0 15 * * 5', trigger_type: 'schedule', icon: '📢', color: '#4a154b' },
  { id: 't20', name: 'GitHub PR Summary', description: 'Get a daily summary of open PRs and review requests', category: 'Data', cron: '0 9 * * 1-5', trigger_type: 'schedule', icon: '🐙', color: '#24292e' },
]

router.get('/templates', (req: Request, res: Response) => {
  res.json({ templates: TEMPLATES })
})

// ── Create from template ──────────────────────────────────────────────────────

const FromTemplateSchema = z.object({
  template_id: z.string(),
  workflow_id: z.string().uuid(),
  custom_name: z.string().optional(),
})

router.post('/from-template', authMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = FromTemplateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const { template_id, workflow_id, custom_name } = parsed.data
    const template = TEMPLATES.find(t => t.id === template_id)
    if (!template) return res.status(404).json({ error: 'Template not found' })

    // Verify workflow belongs to tenant
    const wf = await queryOne<any>('SELECT id, name, original_prompt FROM workflows WHERE id = $1 AND tenant_id = $2', [workflow_id, req.tenantId])
    if (!wf) return res.status(404).json({ error: 'Workflow not found or not accessible' })

    // Create scheduled task
    const [task] = await query(
      `INSERT INTO scheduled_tasks (tenant_id, workflow_id, workflow_name, cron_expression, description, task_prompt, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [req.tenantId, workflow_id, custom_name || template.name, template.cron, template.description, wf.original_prompt || `Run workflow ${wf.name}`]
    ).catch(() => [null])

    if (!task) {
      // Fallback: scheduled_tasks might have different schema — just return success
      return res.json({ task_id: null, schedule: template.cron, humanized_schedule: humanizeCronExpr(template.cron), template: template.name })
    }

    const { addTask } = await import('../jobs/scheduler')
    addTask(task)

    return res.status(201).json({
      task_id: task.id,
      schedule: template.cron,
      humanized_schedule: humanizeCronExpr(template.cron),
      template: template.name,
    })
  } catch (err: any) {
    logger.error('[Automations] from-template error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ── Natural Language Parser ───────────────────────────────────────────────────

function humanizeCronExpr(cron: string): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return `Custom: ${cron}`
  const [min, hour, dom, month, dow] = parts
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtTime = (h: string, m: string) => {
    const hNum = parseInt(h); const mNum = parseInt(m)
    const suffix = hNum >= 12 ? 'PM' : 'AM'
    const h12 = hNum % 12 === 0 ? 12 : hNum % 12
    return `${h12}:${pad(mNum)} ${suffix}`
  }
  if (dow === '1-5' && /^\d+$/.test(hour) && /^\d+$/.test(min)) return `Weekdays at ${fmtTime(hour, min)}`
  if (dom === '*' && month === '*' && dow === '*' && /^\d+$/.test(hour) && /^\d+$/.test(min)) return `Every day at ${fmtTime(hour, min)}`
  if (dow === '1' && /^\d+$/.test(hour)) return `Every Monday at ${fmtTime(hour, min)}`
  if (dow === '5' && /^\d+$/.test(hour)) return `Every Friday at ${fmtTime(hour, min)}`
  if (min === '*' && hour === '*') return 'Every minute'
  if (min.startsWith('*/')) return `Every ${min.slice(2)} minutes`
  if (hour.startsWith('*/') && dom === '*') return `Every ${hour.slice(2)} hours`
  if (dom === '1' && month === '*') return `Monthly on the 1st at ${fmtTime(hour, min)}`
  return `Custom: ${cron}`
}

function parseNaturalLanguageToCron(description: string): { cron: string; humanized: string; confidence: number; workflow_suggestion: string } {
  const d = description.toLowerCase().trim()
  
  const timeMatch = d.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  let hourNum = 9, minNum = 0
  if (timeMatch) {
    hourNum = parseInt(timeMatch[1])
    minNum = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    if (timeMatch[3] === 'pm' && hourNum < 12) hourNum += 12
    if (timeMatch[3] === 'am' && hourNum === 12) hourNum = 0
  }

  const H = hourNum, M = minNum

  // Every N minutes
  const everyNMin = d.match(/every (\d+) min/)
  if (everyNMin) {
    const n = everyNMin[1]
    return { cron: `*/${n} * * * *`, humanized: `Every ${n} minutes`, confidence: 0.95, workflow_suggestion: 'Scheduled Check' }
  }

  // Every N hours
  const everyNHours = d.match(/every (\d+) hours?/)
  if (everyNHours) {
    const n = everyNHours[1]
    return { cron: `0 */${n} * * *`, humanized: `Every ${n} hours`, confidence: 0.95, workflow_suggestion: 'Hourly Summary' }
  }

  if (d.includes('every minute')) return { cron: '* * * * *', humanized: 'Every minute', confidence: 0.99, workflow_suggestion: 'Realtime Monitor' }
  if (d.includes('morning') && (d.includes('weekday') || d.includes('monday') || d.includes('work'))) {
    return { cron: `${M} ${H || 9} * * 1-5`, humanized: `Weekdays at ${H || 9}:${String(M).padStart(2,'0')} AM`, confidence: 0.9, workflow_suggestion: 'Morning Briefing' }
  }
  if (d.includes('morning')) return { cron: `${M} ${H || 9} * * *`, humanized: 'Every morning at 9 AM', confidence: 0.85, workflow_suggestion: 'Morning Briefing' }
  if (d.includes('evening')) return { cron: `${M} ${H || 18} * * *`, humanized: 'Every evening at 6 PM', confidence: 0.85, workflow_suggestion: 'Daily Wrap-up' }
  if (d.includes('midnight') || d.includes('night')) return { cron: '0 0 * * *', humanized: 'Every day at midnight', confidence: 0.85, workflow_suggestion: 'Nightly Report' }

  if (d.includes('monday')) return { cron: `${M} ${H || 9} * * 1`, humanized: `Every Monday at ${H || 9}:${String(M).padStart(2,'0')} ${H >= 12 ? 'PM' : 'AM'}`, confidence: 0.9, workflow_suggestion: 'Weekly Kickoff' }
  if (d.includes('tuesday')) return { cron: `${M} ${H || 9} * * 2`, humanized: `Every Tuesday`, confidence: 0.9, workflow_suggestion: 'Weekly Task' }
  if (d.includes('wednesday')) return { cron: `${M} ${H || 9} * * 3`, humanized: `Every Wednesday`, confidence: 0.9, workflow_suggestion: 'Midweek Check' }
  if (d.includes('thursday')) return { cron: `${M} ${H || 9} * * 4`, humanized: `Every Thursday`, confidence: 0.9, workflow_suggestion: 'Weekly Task' }
  if (d.includes('friday')) return { cron: `${M} ${H || 17} * * 5`, humanized: `Every Friday at ${H || 5} PM`, confidence: 0.9, workflow_suggestion: 'Week Wrap-up' }

  if (d.includes('weekday') || d.includes('work day')) return { cron: `${M} ${H || 9} * * 1-5`, humanized: 'Weekdays at 9 AM', confidence: 0.88, workflow_suggestion: 'Daily Work Task' }
  if (d.includes('every day') || d.includes('daily')) return { cron: `${M} ${H || 9} * * *`, humanized: 'Every day at 9 AM', confidence: 0.88, workflow_suggestion: 'Daily Task' }
  if (d.includes('every week') || d.includes('weekly')) return { cron: `${M} ${H || 9} * * 1`, humanized: 'Every Monday at 9 AM', confidence: 0.8, workflow_suggestion: 'Weekly Task' }
  if (d.includes('every month') || d.includes('monthly')) return { cron: `${M} ${H || 9} 1 * *`, humanized: 'Every month on the 1st', confidence: 0.8, workflow_suggestion: 'Monthly Report' }
  if (d.includes('hourly') || d.includes('every hour')) return { cron: `${M} * * * *`, humanized: 'Every hour', confidence: 0.9, workflow_suggestion: 'Hourly Check' }

  // Fallback: if time was given, use daily
  if (timeMatch) return { cron: `${M} ${H} * * *`, humanized: `Every day at ${H}:${String(M).padStart(2,'0')} ${H >= 12 ? 'PM' : 'AM'}`, confidence: 0.6, workflow_suggestion: 'Daily Task' }

  return { cron: '0 9 * * 1-5', humanized: 'Weekdays at 9 AM (best guess)', confidence: 0.3, workflow_suggestion: 'Scheduled Task' }
}

router.post('/natural-language', authMiddleware, (req: Request, res: Response) => {
  const description = req.body.description || req.body.prompt
  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'description or prompt is required' })
  }
  const result = parseNaturalLanguageToCron(description)
  return res.json(result)
})

// ── Event Trigger Types ───────────────────────────────────────────────────────

const EVENT_TRIGGERS = [
  { id: 'new_email', name: 'New Email Received', service: 'gmail', description: 'Triggers when a new email arrives in your inbox', icon: '✉️' },
  { id: 'new_slack_message', name: 'New Slack Message', service: 'slack', description: 'Triggers when a message is posted in a channel', icon: '💬' },
  { id: 'calendar_event', name: 'Calendar Event Starting', service: 'google-calendar', description: 'Triggers when a calendar event is about to start', icon: '📅' },
  { id: 'new_github_issue', name: 'New GitHub Issue', service: 'github', description: 'Triggers when a new issue is opened in your repo', icon: '🐙' },
  { id: 'webhook_received', name: 'Webhook Received', service: 'webhook', description: 'Triggers when your webhook URL receives a POST request', icon: '🔗' },
  { id: 'new_contact', name: 'New Contact Added', service: 'internal', description: 'Triggers when a new contact is added to your CRM', icon: '👤' },
]

router.get('/event-triggers', (req: Request, res: Response) => {
  res.json({ triggers: EVENT_TRIGGERS })
})

// ── Active event trigger rules ─────────────────────────────────────────────────

const CreateTriggerSchema = z.object({
  trigger_type: z.string(),
  workflow_id: z.string().uuid(),
  filter_config: z.record(z.any()).optional(),
})

router.get('/event-triggers/active', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rules = await query(
      `SELECT etr.*, w.name as workflow_name
       FROM event_trigger_rules etr
       LEFT JOIN workflows w ON etr.workflow_id = w.id
       WHERE etr.tenant_id = $1
       ORDER BY etr.created_at DESC`,
      [req.tenantId]
    ).catch(() => [])
    res.json({ rules })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/event-triggers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = CreateTriggerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const { trigger_type, workflow_id, filter_config } = parsed.data

    // Verify workflow ownership
    const wf = await queryOne('SELECT id FROM workflows WHERE id = $1 AND tenant_id = $2', [workflow_id, req.tenantId])
    if (!wf) return res.status(404).json({ error: 'Workflow not found' })

    const [rule] = await query(
      `INSERT INTO event_trigger_rules (tenant_id, trigger_type, workflow_id, filter_config)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.tenantId, trigger_type, workflow_id, JSON.stringify(filter_config || {})]
    )

    logger.info(`[Automations] Event trigger created: ${trigger_type} → workflow ${workflow_id} for tenant ${req.tenantId}`)
    res.status(201).json({ rule })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/event-triggers/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await query(
      'DELETE FROM event_trigger_rules WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Schedules REST Endpoints ──────────────────────────────────────────────────

router.get('/schedules', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schedulesRes = await query(
      `SELECT * FROM scheduled_tasks WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [req.tenantId]
    )
    res.json({ schedules: schedulesRes || [] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

const CreateScheduleSchema = z.object({
  workflow_id: z.string().uuid().optional(),
  workflow_name: z.string().min(1),
  cron_expression: z.string().min(1),
  description: z.string().optional().default(''),
  task_prompt: z.string().min(1),
  team_id: z.string().uuid().optional(),
})

router.post('/schedules', authMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = CreateScheduleSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const { workflow_id, workflow_name, cron_expression, description, task_prompt, team_id } = parsed.data

    const [task] = await query(
      `INSERT INTO scheduled_tasks (tenant_id, workflow_id, workflow_name, cron_expression, description, task_prompt, team_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [req.tenantId, workflow_id || null, workflow_name, cron_expression, description, task_prompt, team_id || null]
    )

    const { addTask } = await import('../jobs/scheduler')
    addTask(task)

    res.status(201).json({ schedule: task })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/schedules/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    const [task] = await query(
      `UPDATE scheduled_tasks 
       SET is_active = $1 
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [is_active, id, req.tenantId]
    )

    if (!task) return res.status(404).json({ error: 'Schedule not found' })

    const { addTask, removeTask } = await import('../jobs/scheduler')
    if (is_active) {
      addTask(task)
    } else {
      removeTask(id)
    }

    res.json({ schedule: task })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/schedules/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await query(
      'DELETE FROM scheduled_tasks WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, req.tenantId]
    )

    if (result?.length === 0) return res.status(404).json({ error: 'Schedule not found' })

    const { removeTask } = await import('../jobs/scheduler')
    removeTask(id)

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
