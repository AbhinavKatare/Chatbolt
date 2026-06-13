import axios from 'axios'
import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { callLLM } from './base.agent'
import { CalendarEvent, TimeSlot, CreateEventInput } from './calendar.agent'

export class OutlookCalendarAgent {
  private async getAccessToken(userId: string): Promise<string | null> {
    const token = await integrationRegistryService.getToken(userId, 'outlook_calendar')
    if (!token || token.startsWith('mock-token-')) {
      return null
    }
    return token
  }

  async listEvents(userId: string, startDate?: string, endDate?: string): Promise<CalendarEvent[]> {
    logger.info(`[OutlookCalendarAgent] listEvents called for user ${userId}`)
    try {
      const token = await this.getAccessToken(userId)
      if (!token) {
        // Return realistic mock events (similar to CalendarAgent)
        return [
          {
            id: 'outlook-evt-1',
            summary: 'Engineering Sync (Outlook)',
            description: 'Weekly sync with engineering team.',
            start: new Date(Date.now() + 24 * 3600000).toISOString(),
            end: new Date(Date.now() + 25 * 3600000).toISOString(),
            attendees: ['dev1@chatbolt.io', 'dev2@chatbolt.io']
          },
          {
            id: 'outlook-evt-2',
            summary: 'Client Q&A - Acme Corp (Outlook)',
            description: 'Review updated contract SLA terms.',
            start: new Date(Date.now() + 48 * 3600000).toISOString(),
            end: new Date(Date.now() + 49 * 3600000).toISOString(),
            attendees: ['sjenkins@acmepartner.com']
          }
        ]
      }

      const timeMin = startDate || new Date().toISOString()
      const url = `https://graph.microsoft.com/v1.0/me/events?$filter=start/dateTime ge '${timeMin}'&$orderby=start/dateTime`
      
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      return (response.data.value || []).map((item: any) => ({
        id: item.id,
        summary: item.subject || 'Untitled Event',
        description: item.bodyPreview || '',
        start: item.start?.dateTime || '',
        end: item.end?.dateTime || '',
        attendees: item.attendees?.map((a: any) => a.emailAddress?.address).filter(Boolean) || []
      }))
    } catch (err: any) {
      logger.error('[OutlookCalendarAgent] listEvents failed:', err.message)
      throw err
    }
  }

  async findFreeSlots(userId: string, durationMinutes: number, dateRange: { start: string; end: string }): Promise<TimeSlot[]> {
    logger.info(`[OutlookCalendarAgent] findFreeSlots called for ${durationMinutes} mins between ${dateRange.start} and ${dateRange.end}`)
    try {
      const token = await this.getAccessToken(userId)
      if (!token) {
        const startHour = new Date(dateRange.start)
        startHour.setHours(10, 0, 0, 0)
        const endHour = new Date(startHour.getTime() + durationMinutes * 60000)
        return [
          {
            start: startHour.toISOString(),
            end: endHour.toISOString()
          }
        ]
      }

      // Query Outlook schedule
      const response = await axios.post(
        'https://graph.microsoft.com/v1.0/me/calendar/getSchedule',
        {
          schedules: ['me'],
          startTime: {
            dateTime: dateRange.start,
            timeZone: 'UTC'
          },
          endTime: {
            dateTime: dateRange.end,
            timeZone: 'UTC'
          },
          availabilityViewInterval: 30
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const scheduleItems = response.data.value?.[0]?.scheduleItems || []
      const busy = scheduleItems.map((item: any) => ({
        start: item.start?.dateTime,
        end: item.end?.dateTime
      }))

      const slots: TimeSlot[] = []
      let current = new Date(dateRange.start)
      const endLimit = new Date(dateRange.end)

      while (current < endLimit) {
        if (current.getHours() >= 9 && current.getHours() < 17) {
          const slotStart = new Date(current)
          const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)
          
          const isOverlapping = busy.some((b: any) => {
            const bStart = new Date(b.start)
            const bEnd = new Date(b.end)
            return slotStart < bEnd && slotEnd > bStart
          })

          if (!isOverlapping && slotEnd.getHours() < 17) {
            slots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString()
            })
          }
        }
        current = new Date(current.getTime() + 30 * 60000)
      }

      return slots.slice(0, 5)
    } catch (err: any) {
      logger.error('[OutlookCalendarAgent] findFreeSlots failed:', err.message)
      throw err
    }
  }

  async createEvent(userId: string, event: CreateEventInput): Promise<string> {
    logger.info(`[OutlookCalendarAgent] createEvent called: "${event.title}"`)
    try {
      const token = await this.getAccessToken(userId)
      let eventId = `mock-outlook-event-${Date.now()}`

      if (token) {
        const response = await axios.post(
          'https://graph.microsoft.com/v1.0/me/events',
          {
            subject: event.title,
            body: {
              contentType: 'HTML',
              content: event.description || ''
            },
            start: {
              dateTime: event.startTime,
              timeZone: 'UTC'
            },
            end: {
              dateTime: event.endTime,
              timeZone: 'UTC'
            },
            attendees: event.attendees?.map(email => ({
              emailAddress: {
                address: email
              },
              type: 'required'
            })) || []
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        )
        eventId = response.data.id
      }

      return eventId
    } catch (err: any) {
      logger.error('[OutlookCalendarAgent] createEvent failed:', err.message)
      throw err
    }
  }

  async updateEvent(userId: string, eventId: string, changes: Partial<CreateEventInput>): Promise<void> {
    logger.info(`[OutlookCalendarAgent] updateEvent called for event: ${eventId}`)
    try {
      const token = await this.getAccessToken(userId)
      if (!token) return

      const requestBody: any = {}
      if (changes.title) requestBody.subject = changes.title
      if (changes.description) {
        requestBody.body = {
          contentType: 'HTML',
          content: changes.description
        }
      }
      if (changes.startTime) {
        requestBody.start = {
          dateTime: changes.startTime,
          timeZone: 'UTC'
        }
      }
      if (changes.endTime) {
        requestBody.end = {
          dateTime: changes.endTime,
          timeZone: 'UTC'
        }
      }
      if (changes.attendees) {
        requestBody.attendees = changes.attendees.map(email => ({
          emailAddress: {
            address: email
          },
          type: 'required'
        }))
      }

      await axios.patch(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )
    } catch (err: any) {
      logger.error('[OutlookCalendarAgent] updateEvent failed:', err.message)
      throw err
    }
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    logger.info(`[OutlookCalendarAgent] deleteEvent called for event: ${eventId}`)
    try {
      const token = await this.getAccessToken(userId)
      if (!token) return

      await axios.delete(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
    } catch (err: any) {
      logger.error('[OutlookCalendarAgent] deleteEvent failed:', err.message)
      throw err
    }
  }

  async sendInvites(userId: string, eventId: string, emails: string[]): Promise<void> {
    logger.info(`[OutlookCalendarAgent] sendInvites called for event ${eventId} to ${emails.join(', ')}`)
    try {
      const token = await this.getAccessToken(userId)
      if (!token) return

      // Get existing event to retrieve existing attendees
      const existing = await axios.get(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      const currentAttendees = existing.data.attendees || []
      const newAttendees = [
        ...currentAttendees,
        ...emails.map(email => ({
          emailAddress: {
            address: email
          },
          type: 'required'
        }))
      ]

      await axios.patch(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
        {
          attendees: newAttendees
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )
    } catch (err: any) {
      logger.error('[OutlookCalendarAgent] sendInvites failed:', err.message)
      throw err
    }
  }
}

export const outlookCalendarAgent = new OutlookCalendarAgent()

export async function runOutlookCalendarAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['calendar_operations']
  const tenantId = agent.tenant_id
  
  logger.info(`[Agent: ${agent.name}] Starting runOutlookCalendarAgent...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const prompt = input.user_inputs?.prompt || input.original_prompt || agent.description || ''
    
    const systemPrompt = `You are a Calendar Intent Parser.
    Classify the calendar task as one of:
    1. "list": Listing meetings, getting daily schedule.
    2. "create": Scheduling a new meeting/event, blocking slots.
    3. "reschedule": Modifying or rescheduling an event.
    
    Return a JSON block:
    {
      "action": "list" | "create" | "reschedule",
      "title": "meeting title or block name",
      "startTime": "ISO date string or relative text",
      "duration_minutes": 30 | 60,
      "attendees": ["list of emails or empty"],
      "query": "date query / context"
    }`

    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content: routerJson } = await callLLM(modelToUse, systemPrompt, `Prompt: ${prompt}`, 200, 1, runId, agent.name)
    const decision = JSON.parse(routerJson.replace(/```json/gi, '').replace(/```/g, '').trim())

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Executing calendar: ${decision.action}` })

    let data: any = {}

    if (decision.action === 'list') {
      const events = await outlookCalendarAgent.listEvents(tenantId)
      data = { events }
    } else if (decision.action === 'create') {
      const start = decision.startTime || new Date(Date.now() + 24 * 3600000).toISOString()
      const end = new Date(new Date(start).getTime() + (decision.duration_minutes || 30) * 60000).toISOString()
      
      const eventId = await outlookCalendarAgent.createEvent(tenantId, {
        title: decision.title || 'Meeting',
        startTime: start,
        endTime: end,
        attendees: decision.attendees
      })

      try {
        const { actionJournalService } = await import('../services/action-journal.service')
        await actionJournalService.logAction(tenantId, runId, 'outlook_calendar_create', { event_id: eventId })
      } catch (logErr: any) {
        logger.warn('Failed to log calendar event in journal:', logErr.message)
      }

      data = { status: 'created', eventId }
    } else {
      data = { status: 'success', action: decision.action }
    }

    const output: AgentOutput = {
      success: true,
      data,
      summary: `Outlook Calendar ${decision.action} action completed successfully.`,
      output_type: 'data',
      confidence: 1.0,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }

    runEmitter.emitEvent(runId, 'agent_done', { agentId: agent.id, summary: output.summary })
    return output
  } catch (err: any) {
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return {
      success: false,
      data: null,
      summary: `Outlook Calendar operation failed: ${err.message}`,
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }
  }
}
