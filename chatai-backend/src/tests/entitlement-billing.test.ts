import assert from 'assert'
import { entitlementService, FEATURE_TIER_MATRIX } from '../services/entitlement.service'
import { billingService } from '../services/billing.service'
import { enterpriseLicenseService } from '../enterprise/enterprise-license.service'
import { db } from '../db'
import Stripe from 'stripe'

console.log('💳 Starting Stripe Billing & Server-Side Entitlement Test Suite...\n')

async function runTests() {
  let passed = 0
  let failed = 0

  function test(name: string, fn: () => Promise<void> | void) {
    return Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`  ✅ PASS: ${name}`)
        passed++
      })
      .catch((err) => {
        console.error(`  ❌ FAIL: ${name}`)
        console.error(err)
        failed++
      })
  }

  // --- Test 1: Feature Matrix Tier Gating & Resolution ---
  await test('Item 1: EntitlementService enforces tier-level access controls across all features', async () => {
    const freeTenantId = 'tenant-test-free-' + Date.now()
    const proTenantId = 'tenant-test-pro-' + Date.now()
    const teamTenantId = 'tenant-test-team-' + Date.now()
    const entTenantId = 'tenant-test-ent-' + Date.now()

    // 1. Check Free tenant
    const freeCompanyCheck = await entitlementService.checkEntitlement(freeTenantId, 'company_orchestration')
    assert.strictEqual(freeCompanyCheck.allowed, false, 'Free tenant must not access company_orchestration')
    assert.strictEqual(freeCompanyCheck.plan, 'free')

    const freeTeamCheck = await entitlementService.checkEntitlement(freeTenantId, 'team_workforce')
    assert.strictEqual(freeTeamCheck.allowed, false, 'Free tenant must not access team_workforce')

    // 2. Mock Pro tenant in DB
    await db.query(
      `INSERT INTO tenants (id, email, name, plan, is_active) VALUES ($1, $2, $3, $4, $5)`,
      [proTenantId, 'pro@example.com', 'Pro Tenant', 'pro', true]
    )

    const proAgentCheck = await entitlementService.checkEntitlement(proTenantId, 'pro_agents')
    assert.strictEqual(proAgentCheck.allowed, true, 'Pro tenant must be entitled to pro_agents')

    const proTeamCheck = await entitlementService.checkEntitlement(proTenantId, 'team_workforce')
    assert.strictEqual(proTeamCheck.allowed, false, 'Pro tenant must not access team_workforce')

    const proCompanyCheck = await entitlementService.checkEntitlement(proTenantId, 'company_orchestration')
    assert.strictEqual(proCompanyCheck.allowed, false, 'Pro tenant must not access company_orchestration')

    // 3. Mock Team tenant in DB
    await db.query(
      `INSERT INTO tenants (id, email, name, plan, is_active) VALUES ($1, $2, $3, $4, $5)`,
      [teamTenantId, 'team@example.com', 'Team Tenant', 'team', true]
    )

    const teamWorkforceCheck = await entitlementService.checkEntitlement(teamTenantId, 'team_workforce')
    assert.strictEqual(teamWorkforceCheck.allowed, true, 'Team tenant must access team_workforce')

    const teamMemoryCheck = await entitlementService.checkEntitlement(teamTenantId, 'team_shared_memory')
    assert.strictEqual(teamMemoryCheck.allowed, true, 'Team tenant must access team_shared_memory')

    const teamCompanyCheck = await entitlementService.checkEntitlement(teamTenantId, 'company_orchestration')
    assert.strictEqual(teamCompanyCheck.allowed, false, 'Team tenant must not access company_orchestration')

    // 4. Mock Enterprise tenant in DB
    await db.query(
      `INSERT INTO tenants (id, email, name, plan, is_active) VALUES ($1, $2, $3, $4, $5)`,
      [entTenantId, 'ent@example.com', 'Enterprise Tenant', 'enterprise', true]
    )

    const entCompanyCheck = await entitlementService.checkEntitlement(entTenantId, 'company_orchestration')
    assert.strictEqual(entCompanyCheck.allowed, true, 'Enterprise tenant must access company_orchestration')

    const entPostMortemCheck = await entitlementService.checkEntitlement(entTenantId, 'sla_post_mortem')
    assert.strictEqual(entPostMortemCheck.allowed, true, 'Enterprise tenant must access sla_post_mortem')

    const entAuditCheck = await entitlementService.checkEntitlement(entTenantId, 'soc2_audit_export')
    assert.strictEqual(entAuditCheck.allowed, true, 'Enterprise tenant must access soc2_audit_export')
  })

  // --- Test 2: Server-Side Express Middleware HTTP 402 Rejections ---
  await test('Item 2: requireEntitlement middleware rejects non-entitled requests with RFC 7807 402 Payment Required', async () => {
    const unentitledTenantId = 'tenant-unentitled-' + Date.now()
    const middleware = entitlementService.requireEntitlement('company_orchestration')

    let statusCode = 0
    let responseBody: any = null
    let nextCalled = false

    const mockReq: any = {
      tenantId: unentitledTenantId,
      headers: {}
    }
    const mockRes: any = {
      status(code: number) {
        statusCode = code
        return this
      },
      json(body: any) {
        responseBody = body
        return this
      }
    }
    const mockNext = () => { nextCalled = true }

    await middleware(mockReq, mockRes, mockNext)

    assert.strictEqual(nextCalled, false, 'Next middleware should not be called for unentitled tenant')
    assert.strictEqual(statusCode, 402, 'Must return HTTP status 402 Payment Required')
    assert.strictEqual(responseBody?.error, 'PAYMENT_REQUIRED')
    assert.strictEqual(responseBody?.code, 'FEATURE_NOT_ENTITLED')
    assert.strictEqual(responseBody?.feature, 'company_orchestration')
    assert(responseBody?.upgradeUrl?.includes('upgrade=enterprise'), 'Must provide upgrade URL pointing to enterprise')
  })

  // --- Test 3: Digital HMAC License Key Grants Full Entitlements ---
  await test('Item 3: Digital HMAC-SHA256 license key unlocks enterprise features and passes middleware', async () => {
    const licensedTenantId = 'tenant-licensed-' + Date.now()
    
    // Generate valid enterprise license key
    const licenseKey = enterpriseLicenseService.generateLicenseKey({
      tenantId: licensedTenantId,
      licensedTo: 'ACME Corp Enterprise',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    })

    // Store key in tenant metadata
    await db.query(
      `INSERT INTO tenants (id, email, name, plan, metadata, is_active) VALUES ($1, $2, $3, $4, $5, $6)`,
      [licensedTenantId, 'acme@example.com', 'ACME Corp', 'enterprise', JSON.stringify({ enterprise_license_key: licenseKey }), true]
    )

    entitlementService.invalidateTenantCache(licensedTenantId)

    const check = await entitlementService.checkEntitlement(licensedTenantId, 'company_orchestration')
    assert.strictEqual(check.allowed, true, 'Digital license key must entitle company_orchestration')
    assert.strictEqual(check.source, 'digital_key')

    // Test middleware execution with digital key
    const middleware = entitlementService.requireEntitlement('company_orchestration')
    let nextCalled = false
    const mockReq: any = { tenantId: licensedTenantId, headers: {} }
    const mockRes: any = { status: () => mockRes, json: () => mockRes }
    
    await middleware(mockReq, mockRes, () => { nextCalled = true })
    assert.strictEqual(nextCalled, true, 'Middleware must pass for digital enterprise license key')
  })

  // --- Test 4: Stripe Webhook Lifecycle & Instant Entitlement Cache Invalidation ---
  await test('Item 4: Stripe webhook subscription updates sync plan and immediately flush cache', async () => {
    const customerTenantId = 'tenant-stripe-' + Date.now()
    const stripeCustomerId = 'cus_test_' + Date.now()
    const stripeSubId = 'sub_test_' + Date.now()

    await db.query(
      `INSERT INTO tenants (id, email, name, plan, stripe_customer_id, is_active) VALUES ($1, $2, $3, $4, $5, $6)`,
      [customerTenantId, 'customer@example.com', 'Customer Inc', 'free', stripeCustomerId, true]
    )

    // Initial check: Free
    const initialCheck = await entitlementService.checkEntitlement(customerTenantId, 'team_workforce')
    assert.strictEqual(initialCheck.allowed, false, 'Initial state is free')

    // 1. Simulate Stripe Webhook customer.subscription.created (Plan: team)
    const mockCreatedEvent: any = {
      type: 'customer.subscription.created',
      data: {
        object: {
          id: stripeSubId,
          customer: stripeCustomerId,
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
          metadata: { tenant_id: customerTenantId },
          items: {
            data: [{ price: { id: process.env.STRIPE_PRICE_TEAM_MONTHLY || 'price_mock_team_monthly' } }]
          }
        }
      }
    }

    await billingService.handleWebhook(mockCreatedEvent)

    // Verify immediate entitlement upgrade without stale cache
    const upgradedCheck = await entitlementService.checkEntitlement(customerTenantId, 'team_workforce')
    assert.strictEqual(upgradedCheck.allowed, true, 'Upgraded to team via webhook must immediately unlock team_workforce')
    assert.strictEqual(upgradedCheck.plan, 'team')

    // 2. Simulate Stripe Webhook customer.subscription.deleted (Cancellation)
    const mockDeletedEvent: any = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: stripeSubId,
          customer: stripeCustomerId,
          metadata: { tenant_id: customerTenantId }
        }
      }
    }

    await billingService.handleWebhook(mockDeletedEvent)

    // Verify immediate revocation
    const cancelledCheck = await entitlementService.checkEntitlement(customerTenantId, 'team_workforce')
    assert.strictEqual(cancelledCheck.allowed, false, 'Cancellation via webhook must immediately revoke team_workforce')
    assert.strictEqual(cancelledCheck.plan, 'free')
  })

  // --- Test 5: Usage Limit Quotas and Pay-As-You-Go Overage Logic ---
  await test('Item 5: Quota limit checks block at boundary without overage, allows & meters with overage', async () => {
    const quotaTenantId = 'tenant-quota-' + Date.now()
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    await db.query(
      `INSERT INTO tenants (id, email, name, plan, is_active) VALUES ($1, $2, $3, $4, $5)`,
      [quotaTenantId, 'quota@example.com', 'Quota Tenant', 'free', true]
    )

    // Set usage counters to 20 tasks (Free limit is 20)
    await db.query(
      `INSERT INTO usage_counters (user_id, workspace_id, month, tasks_run, api_calls) VALUES ($1, $1, $2, $3, $4)`,
      [quotaTenantId, monthStr, 20, 0]
    )

    // Check limit without overage (Free tier has no overage option)
    const limitCheck1 = await billingService.checkLimit(quotaTenantId, 'tasks')
    assert.strictEqual(limitCheck1.allowed, false, 'Must block task execution when quota 20/20 reached on free tier')
    assert.strictEqual(limitCheck1.current, 20)
    assert.strictEqual(limitCheck1.limit, 20)

    // Upgrade to Pro (limit 500) and set usage to 500
    await db.query(`UPDATE tenants SET plan = 'pro' WHERE id = $1`, [quotaTenantId])
    entitlementService.invalidateTenantCache(quotaTenantId)

    await db.query(
      `UPDATE usage_counters SET tasks_run = 500 WHERE user_id = $1 AND month = $2`,
      [quotaTenantId, monthStr]
    )

    // Case A: Pro user at 500/500 with overage_enabled: false in subscription
    await db.query(
      `INSERT INTO subscriptions (user_id, workspace_id, plan, status, current_period_end, overage_enabled)
       VALUES ($1, $1, 'pro', 'active', NOW() + interval '30 days', false)`,
      [quotaTenantId]
    )

    const limitCheckProNoOverage = await billingService.checkLimit(quotaTenantId, 'tasks')
    assert.strictEqual(limitCheckProNoOverage.allowed, false, 'Must block Pro user at 500/500 when overage is disabled')

    // Case B: Pro user enables overage (overage_enabled: true)
    await db.query(
      `UPDATE subscriptions SET overage_enabled = true WHERE user_id = $1`,
      [quotaTenantId]
    )

    const limitCheckProWithOverage = await billingService.checkLimit(quotaTenantId, 'tasks')
    assert.strictEqual(limitCheckProWithOverage.allowed, true, 'Must permit execution when overage is enabled')
    assert.strictEqual(limitCheckProWithOverage.overage, true, 'Must flag as overage execution')

    // Increment usage and verify overage counter tracks
    await billingService.incrementUsage(quotaTenantId, 'tasks', 3)
    
    const subRow = await db.query(
      `SELECT overage_tasks_this_month FROM subscriptions WHERE user_id = $1 AND status = 'active'`,
      [quotaTenantId]
    )
    assert.strictEqual(subRow.rows[0]?.overage_tasks_this_month, 3, 'Must track 3 overage tasks on subscription')
  })

  console.log(`\n📊 Stripe Billing & Entitlement Results: ${passed} passed, ${failed} failed\n`)

  if (failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

runTests().catch(err => {
  console.error('Fatal test execution error:', err)
  process.exit(1)
})
