// src/routes/billing-razorpay.ts
// Add to index.ts: app.use('/billing/razorpay', razorpayRoutes)
// Install: npm install razorpay

import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { refillCredits, PLAN_CREDITS } from '../services/credits.service'
import crypto from 'crypto'

const router = Router()

// Lazy init Razorpay to avoid crash if keys not set
function getRazorpay() {
  const Razorpay = require('razorpay')
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  })
}

const PLAN_PRICES_INR: Record<string, number> = {
  hobby:    2700,   //  ₹2,700/mo (~$32)
  standard: 10000,  // ₹10,000/mo (~$120)
  pro:      33500,  // ₹33,500/mo (~$400)
}

// POST /billing/razorpay/order — create Razorpay order
router.post('/order', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { plan } = req.body
    if (!PLAN_PRICES_INR[plan]) return res.status(400).json({ error: 'Invalid plan' })

    const razorpay = getRazorpay()
    const order = await razorpay.orders.create({
      amount: PLAN_PRICES_INR[plan] * 100, // paise
      currency: 'INR',
      receipt: `chatai_${req.tenantId}_${Date.now()}`,
      notes: { tenant_id: req.tenantId!, plan },
    })

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      plan,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/razorpay/verify — verify payment signature + activate plan
router.post('/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed — invalid signature' })
    }

    // Activate plan
    const credits = PLAN_CREDITS[plan] || 500
    await query(
      `UPDATE tenants SET plan = $1, credits_monthly = $2, credits_remaining = $2 WHERE id = $3`,
      [plan, credits, req.tenantId]
    )

    // Log transaction
    await query(
      `INSERT INTO credit_transactions (tenant_id, amount, type, description)
       VALUES ($1, $2, 'recharge', $3)`,
      [req.tenantId, credits, `Plan upgrade to ${plan} via Razorpay`]
    )

    res.json({ success: true, plan, credits_added: credits })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/razorpay/credits — buy extra credits
router.post('/credits', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { amount = 1000 } = req.body // credits to buy
    const validAmounts = [1000, 5000, 10000]
    if (!validAmounts.includes(amount)) return res.status(400).json({ error: 'Invalid amount' })

    const inrAmount = Math.round((amount / 1000) * 3300) // ₹3300 per 1000 credits (~$40)
    const razorpay = getRazorpay()

    const order = await razorpay.orders.create({
      amount: inrAmount * 100,
      currency: 'INR',
      receipt: `credits_${req.tenantId}_${Date.now()}`,
      notes: { tenant_id: req.tenantId!, credit_amount: String(amount), type: 'credit_recharge' },
    })

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      credits: amount,
      price_inr: inrAmount,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/razorpay/credits/verify
router.post('/credits/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, credits } = req.body

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed' })
    }

    await refillCredits(req.tenantId!, parseInt(credits), 'recharge', `Credit top-up: +${credits} via Razorpay`)
    res.json({ success: true, credits_added: parseInt(credits) })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
