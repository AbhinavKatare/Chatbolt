import { google } from 'googleapis'

export async function getAvailableSlots({ calendarId, date, apiKey }: { calendarId: string, date: string, apiKey?: string }) {
  const calendar = google.calendar({ version: 'v3', auth: apiKey || process.env.GOOGLE_API_KEY })
  
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      items: [{ id: calendarId }]
    }
  })

  const busy = response.data.calendars?.[calendarId]?.busy || []
  return { busy, date }
}

export async function createCalendarEvent({ 
  calendarId, 
  title, 
  start, 
  end, 
  attendees, 
  description, 
  apiKey 
}: { 
  calendarId: string, 
  title: string, 
  start: string, 
  end: string, 
  attendees?: string[], 
  description?: string, 
  apiKey?: string 
}) {
  const calendar = google.calendar({ version: 'v3', auth: apiKey || process.env.GOOGLE_API_KEY })
  
  const event = await calendar.events.insert({
    calendarId: calendarId || 'primary',
    requestBody: {
      summary: title,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
      attendees: attendees?.map(email => ({ email }))
    }
  })

  return {
    eventId: event.data.id,
    eventUrl: event.data.htmlLink
  }
}

export async function cancelCalendarEvent({ calendarId, eventId, apiKey }: { calendarId: string, eventId: string, apiKey?: string }) {
  const calendar = google.calendar({ version: 'v3', auth: apiKey || process.env.GOOGLE_API_KEY })
  await calendar.events.delete({
    calendarId: calendarId || 'primary',
    eventId
  })
  return { success: true }
}

export async function listEvents({ calendarId, timeMin, timeMax, apiKey }: { calendarId: string, timeMin?: string, timeMax?: string, apiKey?: string }) {
  const calendar = google.calendar({ version: 'v3', auth: apiKey || process.env.GOOGLE_API_KEY })
  const response = await calendar.events.list({
    calendarId: calendarId || 'primary',
    timeMin: timeMin || new Date().toISOString(),
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  })
  return response.data.items || []
}
