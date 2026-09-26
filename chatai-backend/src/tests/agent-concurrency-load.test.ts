import dotenv from 'dotenv'
dotenv.config()

import { agentRuntimeService, AgentConfig } from '../runtime/agent-runtime.service'
import { agentBus, AgentBusMessage } from '../runtime/agent-bus.service'
import { actionJournalService } from '../services/action-journal.service'

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
  console.log('⚡ Starting High-Concurrency Local Agent Runtime (20+ Agents) Test Suite...\n')
  const tenantId = '00000000-0000-0000-0000-000000000000'
  const teamId = `team_load_${Date.now()}`

  await actionJournalService.ensureTable()
  agentRuntimeService.reset()
  agentBus.clearHistory()

  // -------------------------------------------------------------
  // Test 1: Agent Registration & Elastic Pool Sizing
  // -------------------------------------------------------------
  await test('Item 1: Spawn a 20+ agent instance pool with distinct roles, models, and tools', async () => {
    const roles = [
      'copywriter', 'researcher', 'backend_engineer', 'frontend_dev', 'qa_tester',
      'sre_engineer', 'sec_auditor', 'seo_specialist', 'growth_hacker', 'support_lead',
      'data_analyst', 'prompt_engineer', 'db_optimizer', 'api_architect', 'ux_designer',
      'content_editor', 'infra_specialist', 'compliance_officer', 'social_manager', 'financial_analyst'
    ]

    const configs: AgentConfig[] = roles.map((role, idx) => ({
      id: `agent_${idx + 1}_${role}`,
      name: `Specialist ${idx + 1} (${role})`,
      role,
      assignedModel: idx % 2 === 0 ? 'Qwen/Qwen2.5-7B-Instruct' : 'openai/gpt-4o-mini',
      systemPrompt: `You are an expert ${role} specialized in high-performance delivery.`,
      toolAccessList: ['web_search', 'file_read', 'query_team_memory'],
      teamId,
      tenantId
    }))

    const spawned = agentRuntimeService.spawnAgentPool(configs)
    assert(spawned.length === 20, `Expected 20 agents spawned, got ${spawned.length}`)

    const poolMetrics = agentRuntimeService.getPoolMetrics()
    assert(poolMetrics.totalAgents === 20, `Expected totalAgents 20 in metrics, got ${poolMetrics.totalAgents}`)
    assert(poolMetrics.idleAgents === 20, `All agents should start in idle state`)
  })

  // -------------------------------------------------------------
  // Test 2: AgentBus Pub/Sub Communication & Supervisor Alerting
  // -------------------------------------------------------------
  await test('Item 2: AgentBus delivers direct messages, team broadcasts, and supervisor alerts across agents', async () => {
    const receivedDirectMessages: AgentBusMessage[] = []
    const receivedTeamBroadcasts: AgentBusMessage[] = []
    const receivedSupervisorAlerts: AgentBusMessage[] = []

    // Subscribe to channels
    agentBus.subscribe('agent:agent_2_researcher', (msg) => {
      receivedDirectMessages.push(msg)
    })
    agentBus.subscribe(`team:${teamId}`, (msg) => {
      receivedTeamBroadcasts.push(msg)
    })
    agentBus.subscribe(`team:${teamId}:supervisor`, (msg) => {
      receivedSupervisorAlerts.push(msg)
    })

    // 1. Send direct message
    await agentBus.sendDirect('agent_1_copywriter', 'agent_2_researcher', {
      query: 'Need stats on Q3 conversion rates'
    }, teamId)

    // 2. Broadcast to team
    await agentBus.broadcastToTeam(teamId, 'agent_1_copywriter', {
      announcement: 'All agents synchronize state for sprint review'
    })

    // 3. Emit supervisor alert
    await agentBus.alertSupervisor(teamId, 'agent_6_sre_engineer', {
      warning: 'High latency detected on endpoint'
    })

    assert(receivedDirectMessages.length === 1, `Expected 1 direct message, got ${receivedDirectMessages.length}`)
    assert(receivedDirectMessages[0].payload.query === 'Need stats on Q3 conversion rates', 'Direct message payload mismatch')

    assert(receivedTeamBroadcasts.length >= 1, `Expected at least 1 team broadcast, got ${receivedTeamBroadcasts.length}`)
    assert(receivedSupervisorAlerts.length === 1, `Expected 1 supervisor alert, got ${receivedSupervisorAlerts.length}`)
  })

  // -------------------------------------------------------------
  // Test 3: 20-Agent Concurrency Load & Zero-Deadlock Verification
  // -------------------------------------------------------------
  await test('Item 3: Execute 20 concurrent agent tasks with bounded concurrency throttling (no deadlock)', async () => {
    // Set concurrency limit to 8
    agentRuntimeService.setMaxConcurrency(8)

    const agents = agentRuntimeService.listAgents()
    assert(agents.length === 20, 'Expected 20 registered agents')

    const tasks = agents.map((agent, i) => ({
      agentId: agent.id,
      task: `Analyze project requirement #${i + 1} and produce role-specific summary for ${agent.role}`
    }))

    const startTime = Date.now()
    const results = await agentRuntimeService.executeConcurrentTasks(tasks)
    const duration = Date.now() - startTime

    assert(results.length === 20, `Expected 20 results, got ${results.length}`)
    assert(results.every(r => r.status === 'completed'), 'All 20 agents must complete tasks successfully')
    assert(results.every(r => r.output.length > 10), 'All agent outputs must be non-empty')

    const metrics = agentRuntimeService.getPoolMetrics()
    assert(metrics.activeWorkers === 0, `Active workers must return to 0 after completion, got ${metrics.activeWorkers}`)
    assert(metrics.queuedTasks === 0, `Queue must be empty after completion`)

    console.log(`     ⚡ 20 Agents Concurrency Run finished in ${duration}ms (average ${Math.round(duration / 20)}ms per task)`)
  })

  // -------------------------------------------------------------
  // Test 4: Dynamic Concurrency Limit Throttling
  // -------------------------------------------------------------
  await test('Item 4: Runtime dynamic throttling scales worker pool without dropping queued tasks', async () => {
    // Set strict max concurrency to 3
    agentRuntimeService.setMaxConcurrency(3)
    const agents = agentRuntimeService.listAgents().slice(0, 6)

    const tasks = agents.map((agent, i) => ({
      agentId: agent.id,
      task: `High-frequency priority task #${i + 1}`
    }))

    const results = await agentRuntimeService.executeConcurrentTasks(tasks)
    assert(results.length === 6, `Expected 6 results, got ${results.length}`)
    assert(results.every(r => r.status === 'completed'), 'All 6 tasks must complete')
  })

  console.log(`\n📊 High-Concurrency Agent Runtime Results: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runTests().catch(err => {
  console.error('Fatal error in agent-concurrency-load.test.ts:', err)
  process.exit(1)
})
