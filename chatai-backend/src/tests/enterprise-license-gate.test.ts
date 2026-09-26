import dotenv from 'dotenv'
dotenv.config()

import { enterpriseLicenseService } from '../enterprise/enterprise-license.service'

let passed = 0
let failed = 0

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`  ✅ PASS: ${name}`)
    passed++
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`)
    console.error(`     Error: ${err.message}`)
    if (err.stack) console.error(`     Stack: ${err.stack.split('\n')[1]}`)
    failed++
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

async function runTests() {
  console.log('🔐 Starting Enterprise License-Key Gate & Cryptographic Validator Test Suite...\n')
  const testTenantId = '11111111-1111-1111-1111-111111111111'
  const otherTenantId = '22222222-2222-2222-2222-222222222222'

  // -------------------------------------------------------------
  // Test 1: Generate & Validate Valid Enterprise License Key
  // -------------------------------------------------------------
  await test('Item 1: Generates valid HMAC-signed enterprise key and verifies entitlements', async () => {
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    const key = enterpriseLicenseService.generateLicenseKey({
      tenantId: testTenantId,
      licensedTo: 'Global Corp Inc.',
      plan: 'enterprise',
      expiresAt,
      maxConcurrentAgents: 100,
      features: ['company_orchestrator', 'sla_post_mortem', 'unlimited_concurrency']
    })

    assert(key.startsWith('CB-ENT-V1.'), 'Key must start with CB-ENT-V1 header')

    const validation = enterpriseLicenseService.validateLicenseKey(key, testTenantId)
    assert(validation.valid === true, `Expected valid key, got: ${validation.error}`)
    assert(validation.entitlements?.tenantId === testTenantId, 'Tenant ID must match')
    assert(validation.entitlements?.plan === 'enterprise', 'Plan must be enterprise')
    assert(validation.entitlements?.maxConcurrentAgents === 100, 'Max agents must be 100')
    assert(validation.entitlements?.features.includes('company_orchestrator'), 'Expected feature entitlement')
  })

  // -------------------------------------------------------------
  // Test 2: Reject Tampered Signature, Expired Key, and Wrong Tenant
  // -------------------------------------------------------------
  await test('Item 2: Cryptographic validator detects tampered signatures, expired keys, and tenant mismatch', async () => {
    // 1. Tampered payload / signature
    const validKey = enterpriseLicenseService.generateLicenseKey({
      tenantId: testTenantId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    const tamperedKey = validKey.slice(0, -4) + 'abcd'
    const tamperedValidation = enterpriseLicenseService.validateLicenseKey(tamperedKey, testTenantId)
    assert(tamperedValidation.valid === false, 'Tampered key must be rejected')
    assert(tamperedValidation.error?.includes('signature'), 'Error must specify signature verification failure')

    // 2. Expired Key
    const expiredKey = enterpriseLicenseService.generateLicenseKey({
      tenantId: testTenantId,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    })
    const expiredValidation = enterpriseLicenseService.validateLicenseKey(expiredKey, testTenantId)
    assert(expiredValidation.valid === false, 'Expired key must be rejected')
    assert(expiredValidation.error?.includes('expired'), 'Error must specify expiration')

    // 3. Tenant mismatch
    const mismatchValidation = enterpriseLicenseService.validateLicenseKey(validKey, otherTenantId)
    assert(mismatchValidation.valid === false, 'Key for another tenant must be rejected')
    assert(mismatchValidation.error?.includes('belongs to tenant'), 'Error must flag tenant mismatch')
  })

  // -------------------------------------------------------------
  // Test 3: Express Middleware Route Gate
  // -------------------------------------------------------------
  await test('Item 3: requireEnterpriseLicense middleware blocks non-licensed tenants with 402', async () => {
    let statusCode = 0
    let jsonResponse: any = null
    let nextCalled = false

    const mockReqUnlicensed = {
      tenant: { id: 'unlicensed-tenant-999' },
      headers: {}
    } as any

    const mockRes = {
      status: (code: number) => {
        statusCode = code
        return {
          json: (data: any) => {
            jsonResponse = data
          }
        }
      }
    } as any

    const mockNext = () => {
      nextCalled = true
    }

    // Call middleware for unlicensed tenant
    await enterpriseLicenseService.requireEnterpriseLicense(mockReqUnlicensed, mockRes, mockNext)
    assert(statusCode === 402, `Expected 402 Payment Required, got ${statusCode}`)
    assert(jsonResponse?.error === 'ENTERPRISE_LICENSE_REQUIRED', 'Expected ENTERPRISE_LICENSE_REQUIRED error code')
    assert(!nextCalled, 'next() should NOT be called for unlicensed tenant')

    // Call middleware with valid header key
    const validKey = enterpriseLicenseService.generateLicenseKey({
      tenantId: 'licensed-tenant-777',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })

    const mockReqLicensed = {
      tenant: { id: 'licensed-tenant-777' },
      headers: { 'x-enterprise-license-key': validKey }
    } as any

    nextCalled = false
    await enterpriseLicenseService.requireEnterpriseLicense(mockReqLicensed, mockRes, mockNext)
    assert(nextCalled === true, 'next() MUST be called when valid enterprise license key is present')
  })

  console.log(`\n📊 Enterprise License-Gate Results: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runTests().catch(err => {
  console.error('Fatal error in enterprise-license-gate.test.ts:', err)
  process.exit(1)
})
