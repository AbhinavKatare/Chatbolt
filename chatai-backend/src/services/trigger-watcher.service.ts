import { query } from '../db'
import { logger } from './logger.service'
import { gmailAgent, EmailSummary } from '../agents/gmail.agent'
import { slackAgent } from '../agents/slack.agent'
import { calendarAgent } from '../agents/calendar.agent'
import { githubAgent } from '../agents/github.agent'
import { handleExecuteV2 } from './execution-router.service'

export interface EventTriggerRule {
  id: string
  tenant_id: string
  trigger_type: string
  workflow_id: string | null
  filter_config: {
    from_contains?: string
    subject_contains?: string
    channel_id?: string
    channel?: string
    text_contains?: string
    contains?: string
    threshold_minutes?: number
    repo?: string
    webhook_endpoint_id?: string
  }
  is_active: boolean
  last_fired_at?: string
  fire_count: number
  created_at: string
  task_prompt: string
}

class TriggerWatcherService {
  private intervalId: NodeJS.Timeout | null = null

  start() {
    logger.info('[TriggerWatcher] Starting event trigger polling loop (every 60s)...')
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
    this.intervalId = setInterval(() => this.pollAndEvaluate(), 60000)
    // Run an initial poll asynchronously on startup
    this.pollAndEvaluate().catch(err => {
      logger.error('[TriggerWatcher] Initial polling error:', err.message)
    })
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.info('[TriggerWatcher] Stopped event trigger polling loop.')
    }
  }

  async pollAndEvaluate() {
    try {
      const activeRules = await query<EventTriggerRule>(
        `SELECT * FROM event_trigger_rules WHERE is_active = true`
      )

      for (const rule of activeRules) {
        try {
          const matched = await this.evaluateRuleCondition(rule)
          if (matched) {
            // Check if rule.last_fired_at is null or > 5 minutes ago
            const now = Date.now()
            const lastFired = rule.last_fired_at ? new Date(rule.last_fired_at).getTime() : 0
            const fiveMinutes = 5 * 60 * 1000

            if (!rule.last_fired_at || (now - lastFired) > fiveMinutes) {
              logger.info(`[TriggerWatcher] Trigger rule ${rule.id} (${rule.trigger_type}) met. Initiating workflow execution...`)
              
              // Update rule's last_fired_at and fire_count
              await query(
                `UPDATE event_trigger_rules 
                 SET last_fired_at = NOW(), fire_count = fire_count + 1 
                 WHERE id = $1`,
                [rule.id]
              )

              // Call handleExecuteV2
              const mockRes: any = {
                write: () => {},
                end: () => {},
                status: (code: any) => mockRes,
                json: () => {}
              }

              // Run handleExecuteV2 in background
              handleExecuteV2({
                prompt: rule.task_prompt || 'Triggered automation',
                tenantId: rule.tenant_id,
                sessionId: `trigger-${rule.id}-${Date.now()}`,
                res: mockRes
              }).catch(err => {
                logger.error(`[TriggerWatcher] Error executing trigger workflow for rule ${rule.id}:`, err.message)
              })
            }
          }
        } catch (err: any) {
          logger.error(`[TriggerWatcher] Error evaluating rule ${rule.id}:`, err.message)
        }
      }
    } catch (err: any) {
      logger.error('[TriggerWatcher] Polling query error:', err.message)
    }
  }

  private async evaluateRuleCondition(rule: EventTriggerRule): Promise<boolean> {
    const type = rule.trigger_type.toLowerCase()

    switch (type) {
      case 'new_email': {
        const unreadResult = await gmailAgent.listUnread(rule.tenant_id).catch(() => [] as EmailSummary[])
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
        if (!unread || unread.length === 0) return false

        const fromFilter = rule.filter_config?.from_contains?.toLowerCase()
        const subjectFilter = rule.filter_config?.subject_contains?.toLowerCase()

        return unread.some(email => {
          const matchFrom = !fromFilter || email.from.toLowerCase().includes(fromFilter)
          const matchSubject = !subjectFilter || email.subject.toLowerCase().includes(subjectFilter)
          return matchFrom && matchSubject
        })
      }

      case 'slack': {
        const channelId = rule.filter_config?.channel_id || rule.filter_config?.channel || 'general'
        const messages = await slackAgent.readChannel(rule.tenant_id, channelId).catch(() => [])
        if (!messages || messages.length === 0) return false

        const textFilter = (rule.filter_config?.text_contains || rule.filter_config?.contains)?.toLowerCase()
        const lastFired = rule.last_fired_at ? new Date(rule.last_fired_at).getTime() : 0

        return messages.some(msg => {
          const matchText = !textFilter || msg.text.toLowerCase().includes(textFilter)
          const msgTime = new Date(msg.timestamp).getTime()
          // Check if message is newer than last fired time, or if not fired yet, check if it's within the last 5 minutes
          const isNew = lastFired ? msgTime > lastFired : (Date.now() - msgTime) < 5 * 60 * 1000
          return matchText && isNew
        })
      }

      case 'calendar': {
        const events = await calendarAgent.listEvents(rule.tenant_id).catch(() => [])
        if (!events || events.length === 0) return false

        const now = Date.now()
        const thresholdMs = (rule.filter_config?.threshold_minutes || 15) * 60 * 1000

        return events.some(event => {
          const startTime = new Date(event.start).getTime()
          // Trigger if event is starting soon (between now and threshold)
          return startTime > now && (startTime - now) <= thresholdMs
        })
      }

      case 'github': {
        // Safe check for listRepos existence in githubAgent
        const agent = githubAgent as any
        if (typeof agent.listRepos === 'function') {
          const repos = await agent.listRepos(rule.tenant_id).catch(() => [])
          return repos && repos.length > 0
        }
        return false
      }

      case 'webhook': {
        // Query recent webhook activity for endpoint
        const endpointId = rule.filter_config?.webhook_endpoint_id
        if (endpointId) {
          const endpoint = await query<{ last_triggered_at: string | null }>(
            `SELECT last_triggered_at FROM webhook_endpoints 
             WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
            [endpointId, rule.tenant_id]
          )
          if (endpoint && endpoint[0]?.last_triggered_at) {
            const triggeredTime = new Date(endpoint[0].last_triggered_at).getTime()
            return (Date.now() - triggeredTime) < 60000 // Triggered within the last 60 seconds
          }
        } else {
          // Fallback: check any active webhook endpoint for the tenant
          const endpoints = await query<{ last_triggered_at: string | null }>(
            `SELECT last_triggered_at FROM webhook_endpoints 
             WHERE tenant_id = $1 AND is_active = true`,
            [rule.tenant_id]
          )
          return endpoints.some(ep => {
            if (!ep.last_triggered_at) return false
            const triggeredTime = new Date(ep.last_triggered_at).getTime()
            return (Date.now() - triggeredTime) < 60000
          })
        }
        return false
      }

      default:
        logger.warn(`[TriggerWatcher] Unknown trigger type: ${rule.trigger_type}`)
        return false
    }
  }
}

export const triggerWatcher = new TriggerWatcherService()
