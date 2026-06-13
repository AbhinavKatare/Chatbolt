import { logger } from '../services/logger.service'
import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { authMiddleware } from '../middleware/auth.middleware'
import { billingService } from '../services/billing.service'

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'mock_key', {
  apiVersion: '2023-10-16'
})

// GET /billing/plan — returns current plan details
router.get('/plan', authMiddleware, async (req: Request, res: Response) => {
  try {
    const plan = await billingService.getUserPlan(req.tenantId!)
    res.json({ plan })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /billing/subscription — returns current subscription details
router.get('/subscription', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { queryOne } = await import('../db')
    const subscription = await queryOne(
      `SELECT * FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' AND current_period_end > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [req.tenantId!]
    )
    const plan = req.tenant?.plan || 'free'
    res.json({ subscription, plan })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /billing/usage — returns current usage counters
router.get('/usage', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const tasks = await billingService.checkLimit(tenantId, 'tasks')
    const apiCalls = await billingService.checkLimit(tenantId, 'api_calls')
    const automations = await billingService.checkLimit(tenantId, 'automations')
    const integrations = await billingService.checkLimit(tenantId, 'integrations')
    const teamMembers = await billingService.checkLimit(tenantId, 'team_members')

    res.json({
      tasks,
      api_calls: apiCalls,
      automations,
      integrations,
      team_members: teamMembers
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/checkout — create checkout session
router.post('/checkout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { plan, interval = 'monthly' } = req.body
    if (plan !== 'pro' && plan !== 'team') {
      return res.status(400).json({ error: 'Invalid plan' })
    }
    const url = await billingService.createCheckoutSession(req.tenantId!, plan, interval)
    res.json({ url })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/portal — portal redirect
router.post('/portal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant!
    if (!tenant.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found.' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings/billing`,
    })

    res.json({ url: session.url })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /billing/annual-nudge-check — check if user is eligible for annual nudge
router.get('/annual-nudge-check', authMiddleware, async (req: Request, res: Response) => {
  try {
    const eligible = await billingService.checkAnnualNudgeEligibility(req.tenantId!)
    res.json({ eligible })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/annual-nudge-dismiss — mark annual nudge as sent
router.post('/annual-nudge-dismiss', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { query } = await import('../db')
    await query(
      `UPDATE subscriptions SET annual_nudge_sent = NOW() 
       WHERE user_id = $1 AND plan = 'pro' AND status = 'active'`,
      [req.tenantId!]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/overage/toggle — enable or disable pay-as-you-go overage billing
router.post('/overage/toggle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body
    const { query } = await import('../db')
    await query(
      `UPDATE subscriptions SET overage_enabled = $1 WHERE user_id = $2 AND status = 'active'`,
      [enabled, req.tenantId!]
    )
    res.json({ success: true, overage_enabled: enabled })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/webhook — verified signature webhook receiver
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || 'mock_webhook_secret'
    )
  } catch (err: any) {
    logger.warn(`[Billing Webhook] Signature verification failed: ${err.message}`)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  try {
    await billingService.handleWebhook(event)
    res.json({ received: true })
  } catch (err: any) {
    logger.error(`[Billing Webhook] Handler failed: ${err.message}`)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

export default router
