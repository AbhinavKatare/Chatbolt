import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import Razorpay from 'razorpay'
import crypto from 'crypto'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { refillCredits, PLAN_CREDITS } from '../services/credits.service'

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
})

const PRICE_IDS: Record<string, string> = {
  hobby: process.env.STRIPE_PRICE_HOBBY || '',
  standard: process.env.STRIPE_PRICE_STANDARD || '',
  pro: process.env.STRIPE_PRICE_PRO || '',
}

const PRICE_TO_PLAN: Record<string, string> = Object.fromEntries(
  Object.entries(PRICE_IDS).map(([k, v]) => [v, k])
)

// GET /billing/plans
router.get('/plans', (_, res) => {
  res.json({
    plans: [
      { id: 'hobby', name: 'Hobby', price_monthly: 32, price_annual: 26, inr_monthly: 2600, credits: 500, agents: 1 },
      { id: 'standard', name: 'Standard', price_monthly: 120, price_annual: 96, inr_monthly: 9900, credits: 4000, agents: 3 },
      { id: 'pro', name: 'Pro', price_monthly: 400, price_annual: 320, inr_monthly: 33000, credits: 15000, agents: 10 },
    ]
  })
})

// POST /billing/checkout — create Stripe checkout session
router.post('/checkout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { plan, interval = 'month' } = req.body
    if (!PRICE_IDS[plan]) return res.status(400).json({ error: 'Invalid plan' })

    const tenant = req.tenant!
    let customerId = tenant.stripe_customer_id

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name: tenant.name,
        metadata: { tenant_id: tenant.id },
      })
      customerId = customer.id
      await query('UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2', [customerId, tenant.id])
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      subscription_data: {
        metadata: { tenant_id: tenant.id, plan },
        trial_period_days: 14,
      },
      success_url: `${process.env.FRONTEND_URL}/dashboard?checkout=success&plan=${plan}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?checkout=cancelled`,
      metadata: { tenant_id: tenant.id, plan },
    })

    res.json({ url: session.url })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/razorpay/checkout
router.post('/razorpay/checkout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { plan } = req.body
    const tenant = req.tenant!
    const plansInr: Record<string, number> = { hobby: 2600, standard: 9900, pro: 33000 }
    
    if (!plansInr[plan]) return res.status(400).json({ error: 'Invalid plan' })

    const options = {
      amount: plansInr[plan] * 100, // paise
      currency: 'INR',
      receipt: `rcpt_${tenant.id.slice(0, 8)}`,
      notes: { tenant_id: tenant.id, plan },
    }

    const order = await razorpay.orders.create(options)
    res.json({ orderId: order.id, amount: options.amount, key: process.env.RAZORPAY_KEY_ID })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/razorpay/verify
router.post('/razorpay/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body
    const tenantId = req.tenantId!

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid signature' })
    }

    const credits = PLAN_CREDITS[plan] || 500
    await query(
      `UPDATE tenants SET plan = $1, credits_monthly = $2, credits_remaining = $2 WHERE id = $3`,
      [plan, credits, tenantId]
    )

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/portal — customer portal to manage subscription
router.post('/portal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant!
    if (!tenant.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard/billing`,
    })

    res.json({ url: session.url })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /billing/subscription
router.get('/subscription', authMiddleware, async (req: Request, res: Response) => {
  const tenant = req.tenant!
  if (!tenant.stripe_customer_id || !tenant.stripe_subscription_id) {
    return res.json({ subscription: null, plan: 'hobby' })
  }

  try {
    const sub = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id)
    res.json({
      subscription: {
        id: sub.id,
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000),
        cancel_at_period_end: sub.cancel_at_period_end,
        plan: tenant.plan,
      }
    })
  } catch {
    res.json({ subscription: null, plan: tenant.plan })
  }
})

// GET /billing/credits
router.get('/credits', authMiddleware, async (req: Request, res: Response) => {
  const tenant = req.tenant!
  const history = await query(
    `SELECT * FROM credit_transactions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.tenantId]
  )
  res.json({
    credits_remaining: tenant.credits_remaining,
    credits_monthly: tenant.credits_monthly,
    plan: tenant.plan,
    history,
  })
})

// POST /billing/credits/recharge — manual top-up
router.post('/credits/recharge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { amount = 1000 } = req.body
    const validAmounts = [1000, 5000, 10000]
    if (!validAmounts.includes(amount)) {
      return res.status(400).json({ error: 'Invalid amount. Choose: 1000, 5000, or 10000' })
    }

    const tenant = req.tenant!
    const pricePerCredit = 0.04 // $40 per 1000
    const totalCents = Math.round((amount / 1000) * 40 * 100)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      customer: tenant.stripe_customer_id || undefined,
      metadata: { tenant_id: tenant.id, credit_amount: amount.toString(), type: 'credit_recharge' },
    })

    res.json({ client_secret: paymentIntent.client_secret, amount, price_usd: totalCents / 100 })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /billing/webhook — Stripe events
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata.tenant_id
        if (!tenantId) break

        const priceId = sub.items.data[0]?.price?.id
        const plan = PRICE_TO_PLAN[priceId] || 'hobby'
        const credits = PLAN_CREDITS[plan] || 500

        await query(
          `UPDATE tenants SET plan = $1, credits_monthly = $2, stripe_subscription_id = $3 WHERE id = $4`,
          [plan, credits, sub.id, tenantId]
        )
        console.log(`✅ Subscription updated: tenant ${tenantId} -> ${plan}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const tenant = await queryOne<{ id: string; credits_monthly: number; plan: string }>(
          'SELECT id, credits_monthly, plan FROM tenants WHERE stripe_customer_id = $1',
          [customerId]
        )
        if (!tenant) break

        // Refill monthly credits on renewal
        if (invoice.billing_reason === 'subscription_cycle') {
          const credits = PLAN_CREDITS[tenant.plan] || 500
          await query('UPDATE tenants SET credits_remaining = $1 WHERE id = $2', [credits, tenant.id])
          await refillCredits(tenant.id, credits, 'recharge', `Monthly renewal — ${tenant.plan} plan`)
          console.log(`✅ Credits refilled: tenant ${tenant.id} (${credits} credits)`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata.tenant_id
        if (!tenantId) break

        await query(
          `UPDATE tenants SET plan = 'hobby', credits_monthly = 500, stripe_subscription_id = NULL WHERE id = $1`,
          [tenantId]
        )
        console.log(`⚠️ Subscription cancelled: tenant ${tenantId} downgraded to hobby`)
        break
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi.metadata.type === 'credit_recharge') {
          const tenantId = pi.metadata.tenant_id
          const amount = parseInt(pi.metadata.credit_amount || '0')
          if (tenantId && amount > 0) {
            await refillCredits(tenantId, amount, 'recharge', `Manual recharge: ${amount} credits`)
            console.log(`✅ Credits recharged: tenant ${tenantId} (+${amount})`)
          }
        }
        break
      }
    }

    res.json({ received: true })
  } catch (err: any) {
    console.error('Webhook handler error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

export default router
