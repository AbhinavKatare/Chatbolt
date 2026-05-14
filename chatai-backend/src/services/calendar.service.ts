import { google } from 'googleapis'

interface CalendarEventInput {
  summary: string
  description: string
  start: string
  end: string
  attendeeEmail: string
}

export async function createCalendarEvent(input: CalendarEventInput) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    })

    const calendar = google.calendar({ version: 'v3', auth })
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'

    const event = {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.start,
        timeZone: 'UTC',
      },
      end: {
        dateTime: input.end,
        timeZone: 'UTC',
      },
      attendees: [{ email: input.attendeeEmail }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    }

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    })

    console.log(`✅ Calendar event created: ${response.data.htmlLink}`)
    return response.data
  } catch (err) {
    console.error('Failed to create calendar event:', err)
    throw err
  }
}
