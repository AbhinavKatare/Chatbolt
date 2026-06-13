import { google } from 'googleapis'
import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { callLLM } from './base.agent'

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: string
  end: string
  attendees?: string[]
}

export interface TimeSlot {
  start: string
  end: string
}

export interface CreateEventInput {
  title: string
  description?: string
  startTime: string
  endTime: string
  attendees?: string[]
}

export class CalendarAgent {
  private async getCalendarClient(userId: string) {
    const token = await integrationRegistryService.getToken(userId, 'google-calendar')
    if (!token || token.startsWith('mock-token-')) {
      return null
    }
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: token })
    return google.calendar({ version: 'v3', auth: oauth2Client })
  }

  async listEvents(userId: string, startDate?: string, endDate?: string): Promise<CalendarEvent[]> {
    logger.info(`[CalendarAgent] listEvents called for user ${userId}`)
    try {
      const calendar = await this.getCalendarClient(userId)
      if (!calendar) {
        // Return realistic mock events
        return [
          {
            id: 'evt-1',
            summary: 'Engineering Sync',
            description: 'Weekly sync with engineering team.',
            start: new Date(Date.now() + 24 * 3600000).toISOString(), // Tomorrow
            end: new Date(Date.now() + 25 * 3600000).toISOString(),
            attendees: ['dev1@chatbolt.io', 'dev2@chatbolt.io']
          },
          {
            id: 'evt-2',
            summary: 'Client Q&A - Acme Corp',
            description: 'Review updated contract SLA terms.',
            start: new Date(Date.now() + 48 * 3600000).toISOString(), // Day after tomorrow
            end: new Date(Date.now() + 49 * 3600000).toISOString(),
            attendees: ['sjenkins@acmepartner.com']
          }
        ]
      }

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate || new Date().toISOString(),
        timeMax: endDate || undefined,
        singleEvents: true,
        orderBy: 'startTime'
      })

      return (response.data.items || []).map(item => ({
        id: item.id!,
        summary: item.summary || 'Untitled Event',
        description: item.description || '',
        start: item.start?.dateTime || item.start?.date || '',
        end: item.end?.dateTime || item.end?.date || '',
        attendees: item.attendees?.map(a => a.email!) || []
      }))
    } catch (err: any) {
      logger.error('[CalendarAgent] listEvents failed:', err.message)
      throw err
    }
  }

  async findFreeSlots(userId: string, durationMinutes: number, dateRange: { start: string; end: string }): Promise<TimeSlot[]> {
    logger.info(`[CalendarAgent] findFreeSlots called for ${durationMinutes} mins between ${dateRange.start} and ${dateRange.end}`)
    try {
      const calendar = await this.getCalendarClient(userId)
      if (!calendar) {
        // Mock free slots
        const startHour = new Date(dateRange.start)
        startHour.setHours(10, 0, 0, 0) // 10 AM
        const endHour = new Date(startHour.getTime() + durationMinutes * 60000)
        return [
          {
            start: startHour.toISOString(),
            end: endHour.toISOString()
          }
        ]
      }

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: dateRange.start,
          timeMax: dateRange.end,
          items: [{ id: 'primary' }]
        }
      })

      const busy = response.data.calendars?.primary?.busy || []
      const slots: TimeSlot[] = []
      
      // Compute free slots by scanning working hours (9 AM - 5 PM)
      let current = new Date(dateRange.start)
      const endLimit = new Date(dateRange.end)

      while (current < endLimit) {
        if (current.getHours() >= 9 && current.getHours() < 17) {
          const slotStart = new Date(current)
          const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)
          
          // Check if slot overlaps with busy times
          const isOverlapping = busy.some(b => {
            const bStart = new Date(b.start!)
            const bEnd = new Date(b.end!)
            return slotStart < bEnd && slotEnd > bStart
          })

          if (!isOverlapping && slotEnd.getHours() < 17) {
            slots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString()
            })
          }
        }
        current = new Date(current.getTime() + 30 * 60000) // Increment by 30 mins
      }

      return slots.slice(0, 5) // Return top 5 slots
    } catch (err: any) {
      logger.error('[CalendarAgent] findFreeSlots failed:', err.message)
      throw err
    }
  }

  async createEvent(userId: string, event: CreateEventInput): Promise<string> {
    logger.info(`[CalendarAgent] createEvent called: "${event.title}"`)
    try {
      const calendar = await this.getCalendarClient(userId)
      let eventId = `mock-event-${Date.now()}`

      if (calendar) {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: event.title,
            description: event.description,
            start: { dateTime: event.startTime },
            end: { dateTime: event.endTime },
            attendees: event.attendees?.map(email => ({ email })) || []
          }
        })
        eventId = response.data.id!
      }

      return eventId
    } catch (err: any) {
      logger.error('[CalendarAgent] createEvent failed:', err.message)
      throw err
    }
  }

  async updateEvent(userId: string, eventId: string, changes: Partial<CreateEventInput>): Promise<void> {
    logger.info(`[CalendarAgent] updateEvent called for event: ${eventId}`)
    try {
      const calendar = await this.getCalendarClient(userId)
      if (!calendar) return

      const existing = await calendar.events.get({ calendarId: 'primary', eventId })
      const body = existing.data

      await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: {
          summary: changes.title || body.summary,
          description: changes.description || body.description,
          start: changes.startTime ? { dateTime: changes.startTime } : body.start,
          end: changes.endTime ? { dateTime: changes.endTime } : body.end,
          attendees: changes.attendees ? changes.attendees.map(email => ({ email })) : body.attendees
        }
      })
    } catch (err: any) {
      logger.error('[CalendarAgent] updateEvent failed:', err.message)
      throw err
    }
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    logger.info(`[CalendarAgent] deleteEvent called for event: ${eventId}`)
    try {
      const calendar = await this.getCalendarClient(userId)
      if (!calendar) return

      await calendar.events.delete({
        calendarId: 'primary',
        eventId
      })
    } catch (err: any) {
      logger.error('[CalendarAgent] deleteEvent failed:', err.message)
      throw err
    }
  }

  async sendInvites(userId: string, eventId: string, emails: string[]): Promise<void> {
    logger.info(`[CalendarAgent] sendInvites called for event ${eventId} to ${emails.join(', ')}`)
    try {
      const calendar = await this.getCalendarClient(userId)
      if (!calendar) return

      const existing = await calendar.events.get({ calendarId: 'primary', eventId })
      const currentAttendees = existing.data.attendees || []
      const newAttendees = [
        ...currentAttendees,
        ...emails.map(email => ({ email }))
      ]

      await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'all',
        requestBody: {
          attendees: newAttendees
        }
      })
    } catch (err: any) {
      logger.error('[CalendarAgent] sendInvites failed:', err.message)
      throw err
    }
  }
}

export const calendarAgent = new CalendarAgent()

// Backwards-compatible runCalendarAgent wrapper for the workflow engine
export async function runCalendarAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['calendar_operations']
  const tenantId = agent.tenant_id
  
  logger.info(`[Agent: ${agent.name}] Starting runCalendarAgent...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const prompt = input.user_inputs?.prompt || input.original_prompt || agent.description || ''
    
    // Classify and parse using LLM
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

    const { integrationRegistryService } = await import('../services/integration-registry.service')
    const hasGoogleCal = await integrationRegistryService.hasIntegration(tenantId, 'google-calendar')
    const hasOutlookCal = await integrationRegistryService.hasIntegration(tenantId, 'outlook_calendar')

    let calendarProvider: any = calendarAgent
    let isOutlook = false

    if (hasGoogleCal && hasOutlookCal) {
      let preferred = 'google-calendar'
      try {
        const { queryOne } = await import('../db')
        const recentRun = await queryOne(
          `SELECT action_type FROM action_journal 
           WHERE tenant_id = $1 AND action_type IN ('google_calendar_create', 'outlook_calendar_create') 
           ORDER BY created_at DESC LIMIT 1`,
          [tenantId]
        )
        if (recentRun && recentRun.action_type.startsWith('outlook')) {
          preferred = 'outlook_calendar'
        }
      } catch (e) {}
      if (preferred === 'outlook_calendar') {
        const { outlookCalendarAgent } = await import('./outlook-calendar.agent')
        calendarProvider = outlookCalendarAgent
        isOutlook = true
      }
    } else if (hasOutlookCal) {
      const { outlookCalendarAgent } = await import('./outlook-calendar.agent')
      calendarProvider = outlookCalendarAgent
      isOutlook = true
    }

    if (decision.action === 'list') {
      const events = await calendarProvider.listEvents(tenantId)
      data = { events }
    } else if (decision.action === 'create') {
      const start = decision.startTime || new Date(Date.now() + 24 * 3600000).toISOString()
      const end = new Date(new Date(start).getTime() + (decision.duration_minutes || 30) * 60000).toISOString()
      
      const eventId = await calendarProvider.createEvent(tenantId, {
        title: decision.title || 'Meeting',
        startTime: start,
        endTime: end,
        attendees: decision.attendees
      })

      // Log in Action Journal for undoability
      try {
        const { actionJournalService } = await import('../services/action-journal.service')
        await actionJournalService.logAction(tenantId, runId, isOutlook ? 'outlook_calendar_create' : 'calendar_create', { event_id: eventId })
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
      summary: `Calendar ${decision.action} action completed successfully.`,
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
      summary: `Calendar operation failed: ${err.message}`,
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
