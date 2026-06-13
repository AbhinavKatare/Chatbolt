import { query, queryOne } from '../db'
import Stripe from 'stripe'
import { logger } from './logger.service'

export interface PlanLimits {
  tasks_per_month: number | 'unlimited';
  integrations: number | 'all';
  team_members: number | 'unlimited';
  automations: number | 'unlimited';
  api_calls: number | 'unlimited';
  sso?: boolean;
  custom_agents?: boolean;
}

export interface Plan {
  name: string;
  limits: PlanLimits;
}

export const PLANS: Record<string, Plan> = {
  free: {
    name: 'Free',
    limits: {
      tasks_per_month: 20,
      integrations: 2,
      team_members: 1,
      automations: 2,
      api_calls: 0
    }
  },
  pro: {
    name: 'Pro',
    limits: {
      tasks_per_month: 500,
      integrations: 'all',
      team_members: 1,
      automations: 20,
      api_calls: 500
    }
  },
  team: {
    name: 'Team',
    limits: {
      tasks_per_month: 2000,
      integrations: 'all',
      team_members: 10,
      automations: 'unlimited',
      api_calls: 2000
    }
  },
  enterprise: {
    name: 'Enterprise',
    limits: {
      tasks_per_month: 'unlimited',
      integrations: 'all',
      team_members: 'unlimited',
      automations: 'unlimited',
      api_calls: 'unlimited',
      sso: true,
      custom_agents: true
    }
  }
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'mock_key', {
  apiVersion: '2023-10-16'
});

const PRICE_IDS: Record<string, Record<string, string>> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_mock_pro_monthly',
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_mock_pro_annual',
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || 'price_mock_team_monthly',
    annual: process.env.STRIPE_PRICE_TEAM_ANNUAL || 'price_mock_team_annual',
  }
};

const PRICE_TO_PLAN_INFO: Record<string, { plan: string; interval: 'monthly' | 'annual' }> = {};
Object.entries(PRICE_IDS).forEach(([plan, intervals]) => {
  Object.entries(intervals).forEach(([interval, priceId]) => {
    PRICE_TO_PLAN_INFO[priceId] = { plan, interval: interval as 'monthly' | 'annual' };
  });
});

interface CacheEntry {
  plan: Plan;
  expiresAt: number;
}
const planCache = new Map<string, CacheEntry>();

function normalizePlanName(planName: string): string {
  const p = (planName || 'free').toLowerCase();
  if (p === 'none' || p === 'hobby') return 'free';
  if (p === 'pro' || p === 'premium') return 'pro';
  if (p === 'team') return 'team';
  if (p === 'enterprise') return 'enterprise';
  return 'free';
}

class BillingService {
  /**
   * Returns current user plan and limits. Falls back to 'free' if no active subscription found. Cached 5 minutes.
   */
  async getUserPlan(userId: string): Promise<Plan> {
    const cached = planCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.plan;
    }

    try {
      // First, check active subscriptions
      const sub = await queryOne(
        `SELECT plan FROM subscriptions WHERE user_id = $1 AND status = 'active' AND current_period_end > NOW() ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      
      let planKey = 'free';
      if (sub && sub.plan) {
        planKey = normalizePlanName(sub.plan);
      } else {
        // Fallback to tenants table
        const tenant = await queryOne(`SELECT plan FROM tenants WHERE id = $1`, [userId]);
        if (tenant && tenant.plan) {
          planKey = normalizePlanName(tenant.plan);
        }
      }

      const plan = PLANS[planKey] || PLANS.free;
      planCache.set(userId, {
        plan,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes cache
      });
      return plan;
    } catch (err) {
      return PLANS.free;
    }
  }

  /**
   * Checks usage against plan limits
   */
  async checkLimit(
    userId: string,
    resource: 'tasks' | 'api_calls' | 'automations' | 'integrations' | 'team_members'
  ): Promise<{ allowed: boolean; current: number; limit: number; overage?: boolean }> {
    const plan = await this.getUserPlan(userId);
    const limit = plan.limits[`${resource}_per_month` as keyof PlanLimits] ?? plan.limits[resource as keyof PlanLimits];

    if (limit === 'unlimited' || limit === 'all') {
      return { allowed: true, current: 0, limit: -1 };
    }

    let current = 0;
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (resource === 'tasks' || resource === 'api_calls') {
      const dbUsage = await queryOne(
        `SELECT tasks_run, api_calls FROM usage_counters WHERE user_id = $1 AND month = $2`,
        [userId, monthStr]
      );
      if (dbUsage) {
        current = resource === 'tasks' ? (dbUsage.tasks_run || 0) : (dbUsage.api_calls || 0);
      }
    } else if (resource === 'integrations') {
      const { count } = (await queryOne(
        `SELECT COUNT(*) as count FROM user_integrations WHERE tenant_id = $1`,
        [userId]
      )) || { count: 0 };
      current = parseInt(count);
    } else if (resource === 'team_members') {
      const { count } = (await queryOne(
        `SELECT COUNT(tm.id) as count 
         FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
         WHERE t.owner_tenant_id = $1`,
         [userId]
      )) || { count: 0 };
      current = parseInt(count);
    } else if (resource === 'automations') {
      const sched = (await queryOne(
        `SELECT COUNT(*) as count FROM scheduled_tasks WHERE tenant_id = $1 AND is_active = true`,
        [userId]
      )) || { count: 0 };
      const rules = (await queryOne(
        `SELECT COUNT(*) as count FROM event_trigger_rules WHERE tenant_id = $1 AND is_active = true`,
        [userId]
      )) || { count: 0 };
      current = parseInt(sched.count) + parseInt(rules.count);
    }

    const maxLimit = typeof limit === 'number' ? limit : 0;
    let allowed = current < maxLimit;
    let overage = false;

    if (resource === 'tasks' && !allowed) {
      const activeSub = await queryOne(
        `SELECT overage_enabled FROM subscriptions 
         WHERE user_id = $1 AND status = 'active' AND current_period_end > NOW() 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (activeSub && activeSub.overage_enabled) {
        allowed = true;
        overage = true;
      }
    }

    return {
      allowed,
      current,
      limit: maxLimit,
      overage
    };
  }

  /**
   * Increments usage counters for current month
   */
  async incrementUsage(userId: string, resource: 'tasks' | 'api_calls', amount = 1): Promise<void> {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      // If tasks usage exceeds monthly limit, check if overage is enabled to increment overage counter
      if (resource === 'tasks') {
        const limitCheck = await this.checkLimit(userId, 'tasks');
        if (limitCheck.overage) {
          await query(
            `UPDATE subscriptions 
             SET overage_tasks_this_month = COALESCE(overage_tasks_this_month, 0) + $1 
             WHERE user_id = $2 AND status = 'active' AND current_period_end > NOW()`,
            [amount, userId]
          );
        }
      }

      const existing = await queryOne(
        `SELECT id FROM usage_counters WHERE user_id = $1 AND month = $2`,
        [userId, monthStr]
      );

      if (existing) {
        if (resource === 'tasks') {
          await query(
            `UPDATE usage_counters SET tasks_run = tasks_run + $1, updated_at = NOW() WHERE id = $2`,
            [amount, existing.id]
          );
        } else {
          await query(
            `UPDATE usage_counters SET api_calls = api_calls + $1, updated_at = NOW() WHERE id = $2`,
            [amount, existing.id]
          );
        }
      } else {
        await query(
          `INSERT INTO usage_counters (user_id, workspace_id, month, tasks_run, api_calls)
           VALUES ($1, $1, $2, $3, $4)`,
          [userId, monthStr, resource === 'tasks' ? amount : 0, resource === 'api_calls' ? amount : 0]
        );
      }
    } catch (err) {
      console.error('[Billing Service] Failed to increment usage:', err);
    }
  }

  /**
   * Creates Stripe checkout session URL
   */
  async createCheckoutSession(userId: string, plan: string, billingPeriod: 'monthly' | 'annual'): Promise<string> {
    const tenant = await queryOne(`SELECT email, name, stripe_customer_id FROM tenants WHERE id = $1`, [userId]);
    if (!tenant) throw new Error('Tenant not found');

    if (!process.env.STRIPE_SECRET_KEY) {
      // In development / fallback mode when key is absent, return mock success page
      return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?checkout=success&plan=${plan}`;
    }

    const priceId = PRICE_IDS[plan]?.[billingPeriod];
    if (!priceId) throw new Error(`Price ID not configured for plan "${plan}" and period "${billingPeriod}"`);

    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name: tenant.name,
        metadata: { tenant_id: userId }
      });
      customerId = customer.id;
      await query(`UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2`, [customerId, userId]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { tenant_id: userId, plan }
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?checkout=success&plan=${plan}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing?checkout=cancelled`,
      metadata: { tenant_id: userId, plan }
    });

    return session.url || '';
  }

  /**
   * Webhook handler for Stripe Event
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'invoice.upcoming': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;

        // Find active subscription
        const sub = await queryOne(
          `SELECT overage_tasks_this_month, overage_enabled, id FROM subscriptions 
           WHERE stripe_customer_id = $1 AND status = 'active' AND current_period_end > NOW() 
           ORDER BY created_at DESC LIMIT 1`,
          [customerId]
        );

        if (sub && sub.overage_enabled && (sub.overage_tasks_this_month || 0) > 0) {
          const overageTasks = sub.overage_tasks_this_month;
          const chargeAmountCents = overageTasks * 5; // $0.05 per task

          if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'mock_key') {
            try {
              // Add custom invoice line item to the upcoming invoice
              await stripe.invoiceItems.create({
                customer: customerId,
                amount: chargeAmountCents,
                currency: 'usd',
                description: `Chatbolt Pay-as-you-go task overages: ${overageTasks} tasks`,
                invoice: invoice.id || undefined
              });
              logger.info(`[Billing] Created upcoming invoice item for ${overageTasks} overage tasks for customer ${customerId}`);
            } catch (err: any) {
              logger.error(`[Billing] Failed to create Stripe invoice item: ${err.message}`);
            }
          } else {
            logger.info(`[Billing MOCK] Charged $${(chargeAmountCents / 100).toFixed(2)} for ${overageTasks} overage tasks on customer ${customerId}`);
          }

          // Reset the overage task count for the new cycle
          await query(
            `UPDATE subscriptions SET overage_tasks_this_month = 0 WHERE id = $1`,
            [sub.id]
          );
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        let tenantId = sub.metadata.tenant_id;
        
        if (!tenantId && sub.customer) {
          const t = await queryOne(`SELECT id FROM tenants WHERE stripe_customer_id = $1`, [sub.customer as string]);
          tenantId = t?.id;
        }
        
        if (!tenantId) break;

        const priceId = sub.items.data[0]?.price?.id;
        const planInfo = PRICE_TO_PLAN_INFO[priceId || ''] || { plan: 'free' };
        const plan = planInfo.plan;

        const currentPeriodEnd = new Date(sub.current_period_end * 1000);
        
        // 1. Update tenants table
        await query(
          `UPDATE tenants SET plan = $1, stripe_subscription_id = $2 WHERE id = $3`,
          [plan, sub.id, tenantId]
        );

        // 2. Upsert subscriptions table
        const existing = await queryOne(`SELECT id FROM subscriptions WHERE stripe_subscription_id = $1`, [sub.id]);
        if (existing) {
          await query(
            `UPDATE subscriptions SET plan = $1, status = $2, current_period_end = $3 WHERE id = $4`,
            [plan, sub.status, currentPeriodEnd, existing.id]
          );
        } else {
          await query(
            `INSERT INTO subscriptions (user_id, workspace_id, plan, stripe_subscription_id, stripe_customer_id, status, current_period_end)
             VALUES ($1, $1, $2, $3, $4, $5, $6)`,
            [tenantId, plan, sub.id, sub.customer as string, sub.status, currentPeriodEnd]
          );
        }

        // Clear cache
        planCache.delete(tenantId);

        // Check referral upgrades
        if (plan !== 'free') {
          const referral = await queryOne(
            `SELECT id, referrer_user_id FROM referrals WHERE referred_user_id = $1 AND reward_granted_at IS NULL`,
            [tenantId]
          );
          if (referral) {
            await this.grantReferralReward(referral.referrer_user_id);
            await query(
              `UPDATE referrals SET reward_granted_at = NOW(), converted_at = NOW() WHERE id = $1`,
              [referral.id]
            );
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        let tenantId = sub.metadata.tenant_id;
        if (!tenantId && sub.customer) {
          const t = await queryOne(`SELECT id FROM tenants WHERE stripe_customer_id = $1`, [sub.customer as string]);
          tenantId = t?.id;
        }

        if (tenantId) {
          await query(`UPDATE tenants SET plan = 'free', stripe_subscription_id = NULL WHERE id = $1`, [tenantId]);
          await query(`UPDATE subscriptions SET status = 'cancelled' WHERE stripe_subscription_id = $1`, [sub.id]);
          planCache.delete(tenantId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const t = await queryOne(`SELECT id FROM tenants WHERE stripe_customer_id = $1`, [customerId]);
        if (t) {
          await query(
            `UPDATE subscriptions SET status = 'past_due' WHERE stripe_customer_id = $1 AND status = 'active'`,
            [customerId]
          );
          planCache.delete(t.id);
        }
        break;
      }
    }
  }

  /**
   * Grants referrer 1 month extension on subscription
   */
  async grantReferralReward(referrerId: string): Promise<void> {
    try {
      const activeSub = await queryOne(
        `SELECT id, current_period_end FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        [referrerId]
      );

      if (activeSub) {
        const currentEnd = new Date(activeSub.current_period_end || Date.now());
        const newEnd = new Date(currentEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
        await query(
          `UPDATE subscriptions SET current_period_end = $1 WHERE id = $2`,
          [newEnd, activeSub.id]
        );
        await query(
          `UPDATE tenants SET plan = 'pro' WHERE id = $1 AND (plan = 'free' OR plan = 'none' OR plan = 'hobby')`,
          [referrerId]
        );
      } else {
        const newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await query(
          `INSERT INTO subscriptions (user_id, workspace_id, plan, status, current_period_end)
           VALUES ($1, $1, 'pro', 'active', $2)`,
          [referrerId, newEnd]
        );
        await query(
          `UPDATE tenants SET plan = 'pro' WHERE id = $1`,
          [referrerId]
        );
      }

      planCache.delete(referrerId);

      // Send email alert
      try {
        const { sendEmail } = await import('./email.service');
        const referrer = await queryOne(`SELECT email, name FROM tenants WHERE id = $1`, [referrerId]);
        if (referrer && sendEmail) {
          await sendEmail({
            to: referrer.email,
            subject: "Your friend just upgraded — you've earned 1 free month of Pro!",
            html: `<p>Hi ${referrer.name || 'there'},</p><p>Great news! Your friend has upgraded their Chatbolt account, and we've added 30 free days of Pro to your account. Enjoy!</p><p>Best,<br>The Chatbolt Team</p>`
          });
        }
      } catch (err: any) {
        console.warn('[Billing Service] Referral email skipped/failed:', err.message);
      }
    } catch (err) {
      console.error('[Billing Service] Failed to grant referral reward:', err);
    }
  }

  /**
   * Checks if a monthly Pro user has been subscribed for 90+ days.
   */
  async checkAnnualNudgeEligibility(userId: string): Promise<boolean> {
    try {
      const sub = await queryOne(
        `SELECT created_at, annual_nudge_sent FROM subscriptions 
         WHERE user_id = $1 AND plan = 'pro' AND status = 'active'
         ORDER BY created_at ASC LIMIT 1`,
        [userId]
      );
      if (!sub) return false;
      if (sub.annual_nudge_sent) return false;

      const createdAt = new Date(sub.created_at);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      return createdAt < ninetyDaysAgo;
    } catch (err: any) {
      console.warn('[Billing Service] Nudge eligibility check failed:', err.message);
      return false;
    }
  }
}

export const billingService = new BillingService();
