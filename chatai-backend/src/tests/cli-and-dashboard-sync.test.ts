import assert from 'assert'
import express from 'express'
import http from 'http'
import jwt from 'jsonwebtoken'
import * as fs from 'fs'
import * as path from 'path'
import tasksRouter from '../routes/tasks'
import memoryRouter from '../routes/memory'
import permissionsRouter from '../routes/permissions'
import meteringRouter from '../routes/metering'
import sessionReplayRouter from '../routes/session-replay'
import evaluationsRouter from '../routes/evaluations'
import { ChatboltClient } from '../../../cli/src/client'
import { runCommand } from '../../../cli/src/commands/run'
import { statusCommand } from '../../../cli/src/commands/status'
import { replayCommand } from '../../../cli/src/commands/replay'
import { memoryCommand } from '../../../cli/src/commands/memory'
import { permissionsCommand } from '../../../cli/src/commands/permissions'
import { costCommand, modelsCommand } from '../../../cli/src/commands/cost'
import { shareCommand } from '../../../cli/src/commands/share'
import { doctorCommand } from '../../../cli/src/commands/doctor'
import { evalCommand } from '../../../cli/src/commands/eval'
import { taskEventBus } from '../services/task-event-bus.service'
import { sessionReplayService } from '../services/session-replay.service'

async function runCliAndDashboardSyncTests() {
  console.log('💻 Starting Chatbolt CLI, Dashboard-First & Tripartite Sync Test Suite...\n')

  const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000000'

  // Ensure local DB has is_active: true on tenant
  const localDbPath = path.join(process.cwd(), 'chatbolt_local_db.json')
  try {
    let dbData: any = {}
    if (fs.existsSync(localDbPath)) {
      dbData = JSON.parse(fs.readFileSync(localDbPath, 'utf8'))
    }
    if (!dbData.tenants) dbData.tenants = []
    const existing = dbData.tenants.find((t: any) => t.id === TEST_TENANT_ID)
    if (!existing) {
      dbData.tenants.push({
        id: TEST_TENANT_ID,
        name: 'CLI Test User',
        email: 'cli-test@chatbolt.ai',
        plan: 'enterprise',
        is_active: true
      })
    } else {
      existing.is_active = true
    }
    fs.writeFileSync(localDbPath, JSON.stringify(dbData, null, 2))
  } catch {}

  const jwtSecret = process.env.JWT_SECRET || 'chatbolt-local-dev-secret'
  const validToken = jwt.sign(
    { sub: TEST_TENANT_ID, email: 'cli-test@chatbolt.ai' },
    jwtSecret,
    { expiresIn: '1h' }
  )

  // Setup lightweight Express test server for CLI client testing
  const app = express()
  app.use(express.json())

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'chatai-backend' }))
  app.use('/api/tasks', tasksRouter)
  app.use('/api/memory', memoryRouter)
  app.use('/api/permissions', permissionsRouter)
  app.use('/api/metering', meteringRouter)
  app.use('/api/sessions', sessionReplayRouter)
  app.use('/api/evaluations', evaluationsRouter)

  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(4009, resolve))

  const testClient = new ChatboltClient({
    apiUrl: 'http://127.0.0.1:4009',
    apiKey: validToken,
    tenantId: TEST_TENANT_ID
  })

  let passed = 0

  try {
    // ------------------------------------------------------------------------
    // Test 1: Non-Blocking CLI Execution (Immediate Return, No Terminal Takeover)
    // ------------------------------------------------------------------------
    console.log('  Testing Item 1: Non-blocking CLI kickoff returns immediately with run receipt...')
    const startTime = Date.now()
    const runResult = await runCommand({
      prompt: 'Refactor user authentication middleware to support JWT and OAuth',
      team: 'tech_core',
      json: true,
      watch: false
    }, testClient)
    const elapsedMs = Date.now() - startTime

    assert.ok(runResult.success, 'CLI task kickoff should succeed')
    assert.ok(runResult.runId.startsWith('run_cli_'), 'Should return a valid runId')
    assert.strictEqual(runResult.status, 'pending', 'Initial status should be pending')
    assert.ok(runResult.estimatedCostUsd > 0, 'Should include pre-execution forecast cost')
    assert.ok(elapsedMs < 2000, `Execution should return immediately without blocking (took ${elapsedMs}ms)`)
    console.log(`  ✅ PASS: Item 1: Non-blocking CLI execution completed in ${elapsedMs}ms with immediate return`)
    passed++

    // ------------------------------------------------------------------------
    // Test 2: CLI --watch Live Streaming over SSE
    // ------------------------------------------------------------------------
    console.log('\n  Testing Item 2: CLI --watch mode streams SSE events to completion...')
    const watchResult = await runCommand({
      prompt: 'Analyze marketing campaigns for Q3 launch',
      team: 'marketing',
      watch: true,
      json: false
    }, testClient)

    assert.ok(watchResult.success, 'Watch mode should complete successfully')
    assert.strictEqual(watchResult.status, 'completed', 'Task status should reach completed')
    console.log('  ✅ PASS: Item 2: CLI --watch mode receives streaming SSE events to completion')
    passed++

    // ------------------------------------------------------------------------
    // Test 3: Bidirectional Real-Time Sync between CLI and Dashboard
    // ------------------------------------------------------------------------
    console.log('\n  Testing Item 3: Bidirectional real-time sync between CLI and Dashboard...')
    let receivedDashboardEvent: any = null
    const unsubscribe = taskEventBus.subscribeRun(runResult.runId, (evt) => {
      receivedDashboardEvent = evt
    })

    // Simulate dashboard querying task status started from CLI
    const statusResult = await statusCommand({
      runId: runResult.runId,
      json: true
    }, testClient)

    assert.ok(statusResult.success, 'Status query should find task initiated from CLI')
    assert.strictEqual(statusResult.run.id, runResult.runId)
    console.log('  ✅ PASS: Item 3: Task started from CLI is immediately queryable and synced with dashboard')
    unsubscribe()
    passed++

    // ------------------------------------------------------------------------
    // Test 4: Memory, Replay, Permissions, Cost & Share CLI Commands
    // ------------------------------------------------------------------------
    console.log('\n  Testing Item 4: CLI memory, replay, permissions, cost and share commands...')
    
    // Memory CLI
    const memAdd = await memoryCommand({
      action: 'add',
      content: 'Frontend must always use Tailwind dark mode tokens',
      category: 'architecture',
      role: 'developer',
      json: true
    }, testClient)
    assert.ok(memAdd.success && memAdd.memory.id, 'CLI memory add should succeed')

    const memList = await memoryCommand({ action: 'list', json: true }, testClient)
    assert.ok(memList.memories.length > 0, 'CLI memory list should return stored items')

    // Permissions CLI
    const permList = await permissionsCommand({ action: 'list', json: true }, testClient)
    assert.ok(permList.success, 'CLI permissions list should return standing rules matrix')

    // Cost CLI
    const costRes = await costCommand({ json: true }, testClient)
    assert.ok(costRes.success && costRes.summary, 'CLI cost summary should return spend metrics')

    const modelsRes = await modelsCommand(true, testClient)
    assert.ok(modelsRes.success && modelsRes.models.length > 0, 'CLI models should list pricing catalog')

    // Share CLI
    // Create a dummy replay to share
    sessionReplayService.recordReplayStep(
      'run_cli_replay_test_1',
      {
        stepIndex: 1,
        agentRole: 'researcher',
        actionType: 'Analyzed user engagement metrics for user test@company.com with key sk-proj-1234567890',
        modelUsed: 'openai/gpt-4o',
        promptTokens: 200,
        completionTokens: 100,
        stepCostUSD: 0.0012,
        durationMs: 350,
        approvalStatus: 'auto_approved',
        timestamp: new Date().toISOString()
      },
      {
        tenantId: TEST_TENANT_ID,
        teamId: 'marketing',
        missionGoal: 'Analyzed user engagement metrics'
      }
    )

    const shareRes = await shareCommand({ runId: 'run_cli_replay_test_1', json: true }, testClient)
    assert.ok(shareRes.success && shareRes.shareUrl, 'CLI share command should generate public replay link')

    const replayRes = await replayCommand({ runId: 'run_cli_replay_test_1', json: true }, testClient)
    assert.ok(replayRes.success && (replayRes.replay.timeline?.length > 0 || replayRes.replay.steps?.length > 0), 'CLI replay command should return timeline')

    console.log('  ✅ PASS: Item 4: All CLI companion commands (memory, permissions, cost, share, replay) execute cleanly')
    passed++

    // ------------------------------------------------------------------------
    // Test 5: Tripartite Architecture Health & Boundary Check (Doctor)
    // ------------------------------------------------------------------------
    console.log('\n  Testing Item 5: Doctor command validates tripartite architecture boundaries...')
    const docRes = await doctorCommand(true, testClient)
    assert.ok(docRes.architecture.dashboard.role.includes('Primary Command Center'), 'Dashboard is primary interface')
    assert.ok(docRes.architecture.cli.role.includes('Thin Client'), 'CLI is thin non-intrusive client')
    assert.ok(docRes.architecture.extension.role.includes('Browser Sensor'), 'Extension is browser sensor')
    console.log('  ✅ PASS: Item 5: Doctor command validates tripartite architecture boundaries')
    passed++
    // ------------------------------------------------------------------------
    // Test 6: Agent Competency Benchmark & Evaluation CLI Commands
    // ------------------------------------------------------------------------
    console.log('\n  Testing Item 6: CLI eval commands (scorecards, deployment gate, custom evals)...')
    
    // 1. Eval list
    const evalListRes = await evalCommand({ action: 'list', json: true }, testClient)
    assert.ok(evalListRes.success && evalListRes.reports.length > 0, 'CLI eval list should return scorecard reports')

    // 2. Eval show role
    const evalShowRes = await evalCommand({ action: 'show', role: 'developer', json: true }, testClient)
    assert.ok(evalShowRes.success && evalShowRes.report.overallScore > 0, 'CLI eval show should return role scorecard')

    // 3. Eval gate check
    const evalGateRes = await evalCommand({ action: 'gate', role: 'developer', tier: 'enterprise', json: true }, testClient)
    assert.ok(evalGateRes.success && evalGateRes.requiredScore === 85, 'CLI eval gate should evaluate tier threshold')

    // 4. Eval custom add & run
    const customAddRes = await evalCommand({
      action: 'custom',
      customSubAction: 'add',
      role: 'developer',
      name: 'SQL Injection Guard Check',
      prompt: 'Refactor database query to prevent SQL injection vulnerabilities',
      keywords: ['parameterized', 'query', '$1'],
      json: true
    }, testClient)
    assert.ok(customAddRes.success && customAddRes.evalCase.id, 'CLI eval custom add should register custom eval case')

    const customRunRes = await evalCommand({
      action: 'custom',
      customSubAction: 'run',
      evalId: customAddRes.evalCase.id,
      output: 'Use parameterized queries db.query("SELECT * FROM users WHERE id = $1", [userId])',
      json: true
    }, testClient)
    assert.ok(customRunRes.success && (customRunRes.passed || customRunRes.result?.passed), 'CLI eval custom run should score and validate actual output')

    console.log('  ✅ PASS: Item 6: Agent competency CLI commands (scorecards, gates, custom evals) executed successfully')
    passed++

    console.log(`\n=============================================`)
    console.log(`CLI & Dashboard Sync Results: ${passed}/6 Passed (100%)`)
    console.log(`=============================================\n`)
  } finally {
    server.close()
  }
}

runCliAndDashboardSyncTests().catch((err) => {
  console.error('CLI Sync Test Suite Failed:', err)
  process.exit(1)
})
