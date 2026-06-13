import { db, queryOne } from '../db'
import { callLLM } from '../agents/base.agent'
import { logger } from './logger.service'
import { hydrateContext } from './memory.service'
import { integrationRegistryService } from './integration-registry.service'
import { EmailSummary } from '../agents/gmail.agent'

export interface BriefingSection {
  title: string
  content: string
  icon: string
}

export interface MorningBriefing {
  greeting: string
  date: string
  sections: BriefingSection[]
  suggested_actions: string[]
  summary: string
}

class BriefingService {
  /**
   * Generates a morning briefing for a user by pulling together
   * calendar events, pending tasks, scheduled processes, and memory context.
   */
  async generateMorningBriefing(tenantId: string): Promise<MorningBriefing | null> {
    logger.info(`[Briefing] Generating morning briefing for tenant ${tenantId}`)

    // 1. Check if user has any connected integrations
    const hasGmail = await integrationRegistryService.hasIntegration(tenantId, 'gmail')
    const hasCalendar = await integrationRegistryService.hasIntegration(tenantId, 'google-calendar')
    const hasSlack = await integrationRegistryService.hasIntegration(tenantId, 'slack')
    const hasDrive = await integrationRegistryService.hasIntegration(tenantId, 'google-drive')
    const hasNotion = await integrationRegistryService.hasIntegration(tenantId, 'notion')

    // empty_state_guard: If user has zero integrations connected, do NOT run briefing
    if (!hasGmail && !hasCalendar && !hasSlack && !hasDrive && !hasNotion) {
      logger.info(`[Briefing] Skipping briefing for tenant ${tenantId}: zero integrations connected.`)
      return null
    }

    // 2. Fetch tenant first name
    let firstName = 'there'
    try {
      const tenant = await queryOne('SELECT name FROM tenants WHERE id = $1', [tenantId])
      if (tenant?.name) {
        firstName = tenant.name.split(' ')[0]
      }
    } catch (err: any) {
      logger.warn('[Briefing] Could not fetch tenant name: ' + err.message)
    }

    // 3. Gather Calendar events if connected
    let calendarText = ''
    if (hasCalendar) {
      try {
        const { calendarAgent } = await import('../agents/calendar.agent')
        const events = await calendarAgent.listEvents(tenantId)
        if (events && events.length > 0) {
          calendarText = events.map(e => {
            const timeStr = e.start ? new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All day'
            return `- ${e.summary} (${timeStr})`
          }).join('\n')
        } else {
          calendarText = 'No calendar events scheduled for today.'
        }
      } catch (err: any) {
        logger.warn('[Briefing] Could not list calendar events: ' + err.message)
      }
    }

    // 4. Gather Top 3 unread emails if connected
    let emailsText = ''
    if (hasGmail) {
      try {
        const { gmailAgent } = await import('../agents/gmail.agent')
        const unreadResult = await gmailAgent.listUnread(tenantId)
        const unread: EmailSummary[] = Array.isArray(unreadResult) 
          ? unreadResult 
          : (unreadResult && (unreadResult as any).groups 
            ? [
                ...(unreadResult as any).groups.urgent,
                ...(unreadResult as any).groups.awaiting_reply,
                ...(unreadResult as any).groups.fyi,
                ...(unreadResult as any).groups.newsletters
              ] 
            : [])
        const important = unread.filter(e => e.isImportant).slice(0, 3)
        const displayEmails = important.length > 0 ? important : unread.slice(0, 3)
        if (displayEmails.length > 0) {
          emailsText = displayEmails.map(e => {
            const sender = e.from.split('<')[0].replace(/"/g, '').trim()
            return `- From ${sender}: "${e.subject}"`
          }).join('\n')
        } else {
          emailsText = 'No unread emails require attention today.'
        }
      } catch (err: any) {
        logger.warn('[Briefing] Could not list emails: ' + err.message)
      }
    }

    // 5. Gather scheduled items
    let scheduledText = ''
    try {
      const { rows } = await db.query(
        `SELECT name, cron_expression FROM scheduled_tasks
         WHERE tenant_id = $1 AND is_active = true
         LIMIT 5`,
        [tenantId]
      )
      if (rows && rows.length > 0) {
        scheduledText = rows.map(s => `- ${s.name} (${s.cron_expression})`).join('\n')
      } else {
        scheduledText = 'No scheduled automations.'
      }
    } catch (err: any) {
      logger.warn('[Briefing] Could not fetch scheduled tasks: ' + err.message)
    }

    // 6. Pull memory context (user facts & preferences)
    const memoryContext = await hydrateContext(tenantId, 'briefing')

    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const hour = now.getHours()
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

    const systemPrompt = `You are a personal assistant.
Generate a daily morning briefing for the user in plain English.
NEVER use technical AI words: agent, pipeline, workflow, LLM, token, etc.
Focus entirely on the outcome and what the user should know.

Return ONLY valid JSON matching this structure:
{
  "greeting": "Warm greeting, e.g. Good morning ${firstName}!",
  "sections": [
    {"title": "Section Title", "content": "1-2 sentences summary of details", "icon": "icon_emoji"}
  ],
  "suggested_actions": ["suggested action 1", "suggested action 2"],
  "closing_note": "A friendly one-line closing note"
}`

    const userMsg = `Date: ${dateStr}
First Name: ${firstName}
Greeting: ${timeGreeting}

Today's Calendar Events:
${calendarText || 'Not connected'}

Top Emails:
${emailsText || 'Not connected'}

Scheduled Automations:
${scheduledText}
${memoryContext ? '\nUser Context:\n' + memoryContext : ''}

Generate the morning briefing.`

    try {
      const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
      const { content } = await callLLM(modelToUse, systemPrompt, userMsg, 800)
      const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      
      const sections: BriefingSection[] = (parsed.sections || []).filter((s: any) => s.content && s.content.trim())
      const suggested_actions: string[] = parsed.suggested_actions || []
      const summary = parsed.closing_note || 'Have a productive day!'

      return {
        greeting: parsed.greeting || `${timeGreeting} ${firstName}!`,
        date: dateStr,
        sections,
        suggested_actions,
        summary
      }
    } catch (err: any) {
      logger.warn('[Briefing] LLM briefing generation failed, using fallback: ' + err.message)
      
      const sections: BriefingSection[] = []
      if (hasCalendar && calendarText) {
        sections.push({ title: 'Today\'s Agenda', content: calendarText, icon: '📅' })
      }
      if (hasGmail && emailsText) {
        sections.push({ title: 'Urgent Emails', content: emailsText, icon: '✉️' })
      }
      if (scheduledText && !scheduledText.includes('No scheduled')) {
        sections.push({ title: 'Scheduled Tasks', content: scheduledText, icon: '⚡' })
      }

      return {
        greeting: `${timeGreeting} ${firstName}!`,
        date: dateStr,
        sections,
        suggested_actions: ['Review outstanding tasks', 'Check email inbox'],
        summary: 'Have a productive day!'
      }
    }
  }

  /**
   * Registers a scheduled briefing delivery.
   */
  async scheduleDailyBriefing(tenantId: string, deliveryHour = 8): Promise<void> {
    const cronExpr = `0 ${deliveryHour} * * *`
    const workflowName = 'Daily Morning Briefing'

    try {
      const { rows } = await db.query(
        `SELECT id FROM scheduled_tasks WHERE tenant_id = $1 AND name = $2`,
        [tenantId, workflowName]
      )
      if (rows.length === 0) {
        await db.query(
          `INSERT INTO scheduled_tasks (tenant_id, workflow_id, name, cron_expression, is_active)
           VALUES ($1, NULL, $2, $3, true)`,
          [tenantId, workflowName, cronExpr]
        )
        logger.info(`[Briefing] Scheduled daily briefing at ${deliveryHour}:00 for tenant ${tenantId}`)
      }
    } catch (err: any) {
      logger.warn('[Briefing] Schedule registration failed: ' + err.message)
    }
  }
}

export const briefingService = new BriefingService()
