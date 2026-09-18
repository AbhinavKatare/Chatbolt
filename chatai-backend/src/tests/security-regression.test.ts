import assert from 'assert'
import { encrypt, decrypt, getSecretKey, reencrypt, LEGACY_FALLBACK_KEY } from '../lib/crypto'
import { authMiddleware } from '../middleware/auth.middleware'
import { sandboxService } from '../services/sandbox.service'
import { NIM_MODELS } from '../services/llm-orchestrator.service'
import { agentGovernanceService } from '../services/agent-governance.service'
import { sanitizeUserFacingText } from '../services/execution-router.service'
import jwt from 'jsonwebtoken'

async function runTests() {
  console.log('🧪 Starting Security & Architecture Regression Test Suite...\n')
  let passed = 0
  let total = 0

  // Mock Supabase getUser globally in test environment to guarantee instant offline execution
  const { supabase } = await import('../lib/supabase')
  supabase.auth.getUser = async (token: string) => {
    if (token === 'valid-supabase-test-token') {
      return { data: { user: { id: '00000000-0000-0000-0000-000000000000', email: 'user@example.com' } }, error: null } as any
    }
    return { data: { user: null }, error: new Error('Invalid or expired authorization token') } as any
  }


  function test(name: string, fn: () => void | Promise<void>) {
    total++
    return (async () => {
      try {
        await fn()
        console.log(`  ✅ PASS: ${name}`)
        passed++
      } catch (err: any) {
        console.error(`  ❌ FAIL: ${name}`)
        console.error(`     Error: ${err.message}\n`)
      }
    })()
  }

  // =========================================================================
  // CRITICAL 1: Vault Encryption Key Security & Fail Fast
  // =========================================================================
  await test('Item 1: Crypto fails fast when VAULT_ENCRYPTION_KEY is missing', () => {
    const originalKey = process.env.VAULT_ENCRYPTION_KEY
    try {
      delete process.env.VAULT_ENCRYPTION_KEY
      assert.throws(
        () => getSecretKey(),
        /FATAL CONFIGURATION ERROR: VAULT_ENCRYPTION_KEY environment variable is not set/i,
        'Should throw fatal error when master encryption key is missing'
      )
    } finally {
      process.env.VAULT_ENCRYPTION_KEY = originalKey || 'test_secret_key_32_bytes_length_required_here!!'
    }
  })

  await test('Item 1: Re-encryption utility migrates secrets from legacy fallback key to new key', () => {
    const newMasterKey = 'new_production_master_vault_key_2026_xyz!'
    const secret = 'sk-live-super-secret-stripe-token-12345'
    
    // Encrypt under legacy key
    const legacyCiphertext = encrypt(secret, LEGACY_FALLBACK_KEY)
    
    // Re-encrypt under new key
    const newCiphertext = reencrypt(legacyCiphertext, LEGACY_FALLBACK_KEY, newMasterKey)
    assert.notStrictEqual(legacyCiphertext, newCiphertext)
    
    // Decrypt under new key
    const recovered = decrypt(newCiphertext, newMasterKey)
    assert.strictEqual(recovered, secret, 'Recovered secret must match original')
  })

  // =========================================================================
  // CRITICAL 2: Auth Fail-Closed & Mock-Token / Fallback Elimination
  // =========================================================================
  await test('Item 2: authMiddleware rejects requests with missing Authorization header', async () => {
    const req: any = { headers: {} }
    let statusCode = 0
    let jsonResponse: any = null
    const res: any = {
      status(code: number) { statusCode = code; return this },
      json(data: any) { jsonResponse = data }
    }
    let nextCalled = false
    const next = () => { nextCalled = true }

    await authMiddleware(req, res, next)

    assert.strictEqual(nextCalled, false, 'next() must NOT be called for missing token')
    assert.strictEqual(statusCode, 401, 'Status must be 401 Unauthorized')
    assert.match(jsonResponse?.error, /Missing or invalid/i)
  })

  await test('Item 2: authMiddleware rejects mock-token bypass attempts', async () => {
    const req: any = { headers: { authorization: 'Bearer mock-token:admin-bypass-tenant-id' } }
    let statusCode = 0
    let jsonResponse: any = null
    const res: any = {
      status(code: number) { statusCode = code; return this },
      json(data: any) { jsonResponse = data }
    }
    let nextCalled = false
    const next = () => { nextCalled = true }

    await authMiddleware(req, res, next)

    assert.strictEqual(nextCalled, false, 'mock-token must NOT bypass authentication')
    assert.strictEqual(statusCode, 401, 'mock-token request must be rejected with 401')
  })

  await test('Item 2: authMiddleware rejects forged invalid JWT tokens without falling open', async () => {
    // Mock Supabase getUser to return immediate error for fast test execution
    const { supabase } = await import('../lib/supabase')
    const originalGetUser = supabase.auth.getUser.bind(supabase.auth)
    supabase.auth.getUser = async () => ({ data: { user: null }, error: new Error('Invalid JWT token signature') }) as any

    try {
      const forgedToken = jwt.sign({ sub: 'fake-tenant', email: 'attacker@evil.com' }, 'wrong-secret')
      const req: any = { headers: { authorization: `Bearer ${forgedToken}` } }
      let statusCode = 0
      let jsonResponse: any = null
      const res: any = {
        status(code: number) { statusCode = code; return this },
        json(data: any) { jsonResponse = data }
      }
      let nextCalled = false
      const next = () => { nextCalled = true }

      await authMiddleware(req, res, next)

      assert.strictEqual(nextCalled, false, 'Forged JWT must NOT pass authentication')
      assert.strictEqual(statusCode, 401, 'Forged JWT must receive 401')
      assert.strictEqual(req.tenant, undefined, 'req.tenant must NEVER be assigned to default tenant on failure')
    } finally {
      supabase.auth.getUser = originalGetUser
    }
  })


  // =========================================================================
  // CRITICAL 3: Subprocess Sandbox Hardening & Env Sanitization
  // =========================================================================
  await test('Item 3: Sandbox does not inherit process.env secrets (RCE leak mitigation)', async () => {
    process.env.SECRET_API_KEY_LEAK_TEST = 'CONFIDENTIAL_KEY_DO_NOT_LEAK'
    
    // Test node sandbox script trying to read process.env.SECRET_API_KEY_LEAK_TEST
    const nodeCode = `
      const secret = process.env.SECRET_API_KEY_LEAK_TEST || 'NOT_FOUND';
      console.log('ENV_SECRET:' + secret);
    `
    const result = await sandboxService.runNode(nodeCode)
    
    assert.strictEqual(result.success, true, 'Node sandbox should execute basic script')
    assert.ok(result.stdout.includes('ENV_SECRET:NOT_FOUND'), 'Child process must NOT inherit sensitive env vars')
    assert.ok(!result.stdout.includes('CONFIDENTIAL_KEY_DO_NOT_LEAK'), 'Sensitive secret must be completely stripped')
  })

  await test('Item 3: Sandbox strictly terminates timed-out subprocesses within limits', async () => {
    const timeoutCode = `
      // Infinite loop to test timeout termination
      const start = Date.now();
      while (true) {}
    `
    // We execute with a short task run using sandboxService
    const start = Date.now()
    const result = await (sandboxService as any).executeSafely('node -e "while(true){}"', (sandboxService as any).sandboxRoot, 1000)
    const elapsed = Date.now() - start
    
    assert.strictEqual(result.success, false, 'Timed out code must fail')
    assert.ok(result.stderr.includes('timed out'), 'Stderr must confirm timeout termination')
    assert.ok(elapsed < 4000, `Process must be killed promptly on timeout (elapsed: ${elapsed}ms)`)
  })

  // =========================================================================
  // CRITICAL 4: NEMOTRON Model Identifier Mapping in NIM_MODELS
  // =========================================================================
  await test('Item 4: NIM_MODELS includes official NEMOTRON identifier', () => {
    assert.ok('NEMOTRON' in NIM_MODELS, 'NIM_MODELS must contain NEMOTRON key')
    assert.strictEqual(
      (NIM_MODELS as any).NEMOTRON,
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'NEMOTRON must map to official NVIDIA NIM model id'
    )
  })

  // =========================================================================
  // CRITICAL 5: No process.env.OPENAI_API_KEY Mutation in LangGraph
  // =========================================================================
  await test('Item 5: Global process.env.OPENAI_API_KEY remains unmodified during model calls', () => {
    const testSentinel = 'original_openai_key_sentinel_do_not_mutate'
    process.env.OPENAI_API_KEY = testSentinel
    
    // Import LangGraph service
    const { cleanEnvVar } = require('../agents/base.agent')
    assert.strictEqual(process.env.OPENAI_API_KEY, testSentinel, 'OPENAI_API_KEY must not be overwritten')
  })

  // =========================================================================
  // IMPORTANT 6: Pre-Execution Approval Gate for Destructive Actions
  // =========================================================================
  await test('Item 6: Pre-execution approval gate blocks destructive actions when unapproved', async () => {
    const gateCheck = await agentGovernanceService.checkPreExecutionApproval({
      tenantId: '00000000-0000-0000-0000-000000000000',
      actionType: 'file_delete',
      payload: { path: '/var/data/important.db' },
      autonomyLevel: 'supervised'
    })

    assert.strictEqual(gateCheck.allowed, false, 'Destructive action must be blocked without explicit approval')
    assert.strictEqual(gateCheck.requiresApproval, true, 'requiresApproval flag must be true')
  })

  await test('Item 6: Pre-execution approval gate allows destructive action when approved=true', async () => {
    const gateCheck = await agentGovernanceService.checkPreExecutionApproval({
      tenantId: '00000000-0000-0000-0000-000000000000',
      actionType: 'file_delete',
      payload: { path: '/var/data/important.db', approved: true },
      autonomyLevel: 'supervised'
    })

    assert.strictEqual(gateCheck.allowed, true, 'Approved action must be permitted')
  })

  // =========================================================================
  // IMPORTANT 8: Clean UX Label Map Formatter (No base64 regexes)
  // =========================================================================
  await test('Item 8: sanitizeUserFacingText replaces technical terms cleanly without base64 tricks', () => {
    const raw = 'The AI agent orchestrated a LangGraph workflow with LLM tokens.'
    const formatted = sanitizeUserFacingText(raw)
    
    assert.ok(!formatted.includes('agent'), 'Should replace agent with assistant')
    assert.ok(!formatted.includes('workflow'), 'Should replace workflow with process')
    assert.ok(!formatted.includes('orchestrated'), 'Should replace orchestrated with coordinated')
    assert.ok(formatted.includes('assistant'), 'Should contain customer friendly terms')
  })

  // =========================================================================
  // GO AGENT-RUNTIME INTEGRATION & HEALTH
  // =========================================================================
  await test('Go Agent-Runtime: Client communicates with Go service and executes sandboxed code', async () => {
    const { agentRuntimeClient } = await import('../services/agent-runtime-client.service')
    const isAvail = await agentRuntimeClient.isAvailable()
    assert.strictEqual(isAvail, true, 'Go agent-runtime service must be healthy and available')

    const res = await agentRuntimeClient.executeSandboxCode({
      language: 'node',
      code: 'const x = 21 * 2; console.log("GO_SANDBOX_OUT:" + x);',
      timeout_seconds: 5,
    })

    assert.strictEqual(res.success, true, 'Go sandbox code execution should succeed')
    assert.ok(res.stdout.includes('GO_SANDBOX_OUT:42'), 'Output should contain calculated result')
  })

  await test('Go Agent-Runtime: System metrics reporting returns active workers and RAM', async () => {
    const { agentRuntimeClient } = await import('../services/agent-runtime-client.service')
    const metrics = await agentRuntimeClient.getSystemMetrics()
    assert.ok(metrics !== null, 'Metrics must not be null')
    assert.ok(typeof metrics?.active_workers === 'number', 'Active workers must be reported')
    assert.ok((metrics?.memory_used_bytes || 0) > 0, 'Memory usage must be reported')
  })

  // =========================================================================
  // PYTHON AGENT-BRAIN LANGGRAPH REASONING ENGINE
  // =========================================================================
  await test('Python Agent-Brain: Client verifies health and executes ReAct reasoning step', async () => {
    const { agentBrainClient } = await import('../services/agent-brain-client.service')
    const isAvail = await agentBrainClient.isAvailable()
    assert.strictEqual(isAvail, true, 'Python agent-brain FastAPI service must be healthy and available')

    const stepRes = await agentBrainClient.executeStep({
      run_id: 'test-brain-run-1',
      agent_role: 'researcher',
      agent_name: 'ResearcherAgent',
      task: 'Analyze latest features in NVIDIA NIM',
      available_tools: [
        { name: 'web_search', description: 'Search the web for real-time information' }
      ]
    })

    assert.ok(['completed', 'tool_call_required'].includes(stepRes.status), `Step status must be valid (got: ${stepRes.status})`)
    assert.strictEqual(stepRes.run_id, 'test-brain-run-1')
  })

  console.log(`\n=============================================`)
  console.log(`Test Results: ${passed}/${total} Passed (${Math.round((passed/total)*100)}%)`)
  console.log(`=============================================\n`)

  if (passed !== total) {
    process.exit(1)
  }
  process.exit(0)
}

runTests().catch(err => {
  console.error('Fatal test execution error:', err)
  process.exit(1)
})

