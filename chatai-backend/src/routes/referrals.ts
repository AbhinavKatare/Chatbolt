import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import crypto from 'crypto'

const router = Router()

function generateReferralCode(): string {
  // Generate 8-char alphanumeric code
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

// GET /api/referrals/my-code
router.get('/my-code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!
    
    // Check if user already has a referral code
    const existing = await queryOne(
      'SELECT code FROM referrals WHERE referrer_user_id = $1 AND referred_user_id IS NULL LIMIT 1',
      [tenantId]
    )

    if (existing && existing.code) {
      return res.json({ code: existing.code })
    }

    // Generate new unique code
    let code = generateReferralCode()
    let codeExists = true
    let attempts = 0
    
    while (codeExists && attempts < 10) {
      const check = await queryOne('SELECT id FROM referrals WHERE code = $1 LIMIT 1', [code])
      if (!check) {
        codeExists = false
      } else {
        code = generateReferralCode()
        attempts++
      }
    }

    await query(
      'INSERT INTO referrals (referrer_user_id, code, referred_user_id) VALUES ($1, $2, NULL)',
      [tenantId, code]
    )

    res.json({ code })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/referrals/stats
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!
    const stats = await queryOne(
      `SELECT 
         COUNT(*)::integer as total_clicks,
         COUNT(CASE WHEN converted_at IS NOT NULL THEN 1 END)::integer as converted,
         COUNT(CASE WHEN reward_granted_at IS NOT NULL THEN 1 END)::integer as rewarded
       FROM referrals 
       WHERE referrer_user_id = $1 AND referred_user_id IS NOT NULL`,
      [tenantId]
    )

    res.json({
      total: stats?.total_clicks || 0,
      converted: stats?.converted || 0,
      rewarded: stats?.rewarded || 0
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/referrals/apply
router.post('/apply', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!
    const { code } = req.body

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Referral code is required' })
    }

    const cleanCode = code.trim().toUpperCase()

    // Check if user already referred
    const alreadyReferred = await queryOne(
      'SELECT id FROM referrals WHERE referred_user_id = $1 LIMIT 1',
      [tenantId]
    )
    if (alreadyReferred) {
      return res.status(400).json({ error: 'Referral already applied' })
    }

    // Find referrer
    const referrer = await queryOne(
      'SELECT referrer_user_id FROM referrals WHERE code = $1 AND referred_user_id IS NULL LIMIT 1',
      [cleanCode]
    )

    if (!referrer) {
      return res.status(404).json({ error: 'Invalid referral code' })
    }

    if (referrer.referrer_user_id === tenantId) {
      return res.status(400).json({ error: 'Cannot refer yourself' })
    }

    // Insert conversion row
    await query(
      `INSERT INTO referrals (referrer_user_id, code, referred_user_id, created_at) 
       VALUES ($1, $2, $3, NOW())`,
      [referrer.referrer_user_id, cleanCode, tenantId]
    )

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
