import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { sessionReplayService } from '../services/session-replay.service'

const router = Router()

// 1. GET /api/sessions/:runId/replay - Full authenticated replay view
router.get('/:runId/replay', authMiddleware, async (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const runId = req.params.runId

  try {
    const replay = await sessionReplayService.getReplay(runId, tenantId)
    if (!replay) {
      return res.status(404).json({ error: 'Session replay not found' })
    }
    res.json({ success: true, replay })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 2. POST /api/sessions/:runId/share - Generate shareable link
router.post('/:runId/share', authMiddleware, async (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const runId = req.params.runId
  const { expiresInDays, customTitle } = req.body

  try {
    const shareResult = await sessionReplayService.createShareLink(runId, tenantId, { expiresInDays, customTitle })
    res.json({ success: true, ...shareResult })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 3. DELETE /api/sessions/:runId/share - Revoke shareable link
router.delete('/:runId/share', authMiddleware, async (req: Request, res: Response) => {
  const tenantId = (req.tenantId as string) || '00000000-0000-0000-0000-000000000000'
  const runId = req.params.runId

  try {
    const revoked = await sessionReplayService.revokeShareLink(runId, tenantId)
    res.json({ success: true, message: 'Share link revoked successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 4. GET /api/public/replays/:token - Public unauthenticated view
router.get('/public/replays/:token', async (req: Request, res: Response) => {
  const token = req.params.token

  try {
    const publicReplay = await sessionReplayService.getPublicReplay(token)
    if (!publicReplay) {
      return res.status(404).json({ error: 'Public session replay not found or link has expired' })
    }
    res.json({ success: true, replay: publicReplay })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
