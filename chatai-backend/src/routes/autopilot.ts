import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { generateAutopilotAgents } from '../services/autopilot.service'

const router = Router()

const autopilotSchema = z.object({
  company_type: z.string().min(3, 'Describe your company type').max(200),
  description: z.string().min(10, 'Provide more detail about what you do').max(1000),
  goals: z.string().min(5, 'List at least one goal').max(1000),
})

// POST /autopilot/generate
router.post('/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const body = autopilotSchema.parse(req.body)

    const result = await generateAutopilotAgents(req.tenantId!, {
      company_type: body.company_type,
      description: body.description,
      goals: body.goals,
    })

    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors })
    }
    console.error('Autopilot generation error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate agents' })
  }
})

export default router
