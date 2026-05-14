import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { createCalendarEvent } from '../services/calendar.service'

const router = Router()

// GET /calendar/slots?date=2024-05-20
router.get('/slots', authMiddleware, async (req: Request, res: Response) => {
  const date = req.query.date as string
  if (!date) return res.status(400).json({ error: 'Date is required' })

  // Mock slots for now (9 AM to 5 PM, every 1 hour)
  const slots = [
    '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'
  ]
  
  res.json({ date, slots })
})

// POST /calendar/book
router.post('/book', authMiddleware, async (req: Request, res: Response) => {
  try {
    const body = z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string(),
      slot: z.string(), // e.g. "2024-05-20 10:00"
      notes: z.string().optional(),
    }).parse(req.body)

    const startTime = new Date(body.slot)
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000) // 1 hour later

    const event = await createCalendarEvent({
      summary: `Booking: ${body.name}`,
      description: `Phone: ${body.phone}\nNotes: ${body.notes || 'None'}`,
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      attendeeEmail: body.email,
    })

    res.json({ success: true, event_link: (event as any).htmlLink })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

export default router
