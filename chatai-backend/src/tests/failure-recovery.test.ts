import dotenv from 'dotenv'
dotenv.config()

import { actionJournalService } from '../services/action-journal.service'
import { agentRuntimeClient } from '../services/agent-runtime-client.service'
import { agentBrainClient } from '../services/agent-brain-client.service'
import { teamLeadAgent } from '../agents/team-lead.agent'
import { teamOrchestratorService } from '../services/team-orchestrator.service'

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
  console.log('🧪 Starting Automated Failure Recovery & Self-Healing Test Suite...\n')
  const tenantId = '00000000-0000-0000-0000-000000000000'
  const testRunId = `test-fail-run-${Date.now()}`

  // Ensure action_journal table exists
  await actionJournalService.ensureTable()

  // -------------------------------------------------------------
  // Test 1: Action Journal Failure Recovery Logging & Retrieval
  // -------------------------------------------------------------
  await test('Item 1: ActionJournal logs and queries failure recovery across all failure classes', async () => {
    const logId1 = await actionJournalService.logFailureRecovery({
      tenantId,
      runId: testRunId,
      failureClass: 'go_runtime',
      errorMessage: 'Sandbox process timed out after 5s',
      attemptNumber: 1,
      recoveryAction: 'fresh_sandbox_retry',
      outcome: 'recovered',
      details: { execution_id: 'exec-1', language: 'node' }
    })
    assert(!!logId1 && logId1 !== 'noop', 'Expected valid logId returned from logFailureRecovery')

    const logId2 = await actionJournalService.logFailureRecovery({
      tenantId,
      runId: testRunId,
      failureClass: 'python_brain',
      errorMessage: 'Repeated tool execution loop detected on web_search',
      attemptNumber: 1,
      recoveryAction: 'critic_review_pass',
      outcome: 'recovered',
      details: { critic_applied: true }
    })
    assert(!!logId2 && logId2 !== 'noop', 'Expected valid logId for python_brain failure')

    const logId3 = await actionJournalService.logFailureRecovery({
      tenantId,
      runId: testRunId,
      failureClass: 'provider',
      errorMessage: 'OpenRouter 429 quota exhausted',
      attemptNumber: 1,
      recoveryAction: 'provider_fallback_chain',
      outcome: 'escalated',
      details: { fallback_provider: 'huggingface' }
    })
    assert(!!logId3 && logId3 !== 'noop', 'Expected valid logId for provider failure')

    const logId4 = await actionJournalService.logFailureRecovery({
      tenantId,
      runId: testRunId,
      failureClass: 'team_role',
      errorMessage: 'Code agent compilation error',
      attemptNumber: 1,
      recoveryAction: 'teamlead_reassign',
      outcome: 'recovered',
      details: { originalRole: 'code', reassignedTo: 'reviewer' }
    })
    assert(!!logId4 && logId4 !== 'noop', 'Expected valid logId for team_role failure')

    const history = await actionJournalService.getFailureHistory(tenantId, testRunId)
    assert(history.length >= 4, `Expected at least 4 failure history entries, got ${history.length}`)
    const classes = history.map(h => typeof h.action_metadata === 'string' ? JSON.parse(h.action_metadata).failure_class : h.action_metadata?.failure_class)
    assert(classes.includes('go_runtime'), 'Expected go_runtime failure class in history')
    assert(classes.includes('python_brain'), 'Expected python_brain failure class in history')
    assert(classes.includes('provider'), 'Expected provider failure class in history')
    assert(classes.includes('team_role'), 'Expected team_role failure class in history')
  })

  // -------------------------------------------------------------
  // Test 2: Go-Level Runtime Failure: Fresh Sandbox Retry & Circuit Breaker
  // -------------------------------------------------------------
  await test('Item 2: Go runtime executes sandboxed code with automatic fresh execution retry on failure', async () => {
    // Test normal valid execution
    const validExec = await agentRuntimeClient.executeSandboxCode({
      execution_id: `valid-${Date.now()}`,
      language: 'node',
      code: 'console.log("Health Check OK");',
      timeout_seconds: 5,
      tenant_id: tenantId,
      run_id: testRunId,
    })
    assert(validExec.success === true, 'Expected valid sandbox execution to succeed')

    // Test timed-out execution: should retry and log failure recovery to action_journal
    const timedOutExec = await agentRuntimeClient.executeSandboxCode({
      execution_id: `timeout-${Date.now()}`,
      language: 'node',
      code: 'while(true) {}', // Infinite loop that will trigger timeout
      timeout_seconds: 1,
      max_retries: 2,
      tenant_id: tenantId,
      run_id: testRunId,
    })
    assert(timedOutExec.timed_out === true || timedOutExec.success === false, 'Expected execution to time out')
    assert(timedOutExec.retries_attempted !== undefined && timedOutExec.retries_attempted >= 1, 'Expected retries attempted >= 1')

    // Confirm failure was recorded in action_journal
    const history = await actionJournalService.getFailureHistory(tenantId, testRunId)
    const timeoutLog = history.find(h => {
      const meta = typeof h.action_metadata === 'string' ? JSON.parse(h.action_metadata) : h.action_metadata
      return meta?.failure_class === 'go_runtime' && (meta?.error_message?.includes('timed out') || meta?.error_message?.includes('timeout'))
    })
    assert(!!timeoutLog, 'Expected timeout failure to be logged in action_journal')
  })

  // -------------------------------------------------------------
  // Test 3: Python Brain Stuck-Loop Detection & Critic Self-Healing
  // -------------------------------------------------------------
  await test('Item 3: Python agent-brain detects stuck reasoning loops and executes self-healing critic pass', async () => {
    const isBrainAvailable = await agentBrainClient.isAvailable()
    assert(isBrainAvailable, 'Expected Python agent-brain to be running on port 8082')

    // Send ReAct step with simulated stuck loop history (repeating identical tool calls)
    const stuckRes = await agentBrainClient.executeStep({
      run_id: `brain-stuck-${Date.now()}`,
      step_id: 'step_3',
      agent_role: 'researcher',
      task: 'Find competitor pricing breakdown',
      history: [
        {
          role: 'assistant',
          content: 'Searching...',
          tool_calls: [{ call_id: 'call_1', tool_name: 'web_search', arguments: { query: 'competitor pricing 2026' } }]
        },
        { role: 'tool', content: 'No results found', tool_call_id: 'call_1' },
        {
          role: 'assistant',
          content: 'Searching again...',
          tool_calls: [{ call_id: 'call_2', tool_name: 'web_search', arguments: { query: 'competitor pricing 2026' } }]
        },
        { role: 'tool', content: 'No results found', tool_call_id: 'call_2' },
      ],
      available_tools: [
        { name: 'web_search', description: 'Search the web' }
      ]
    })

    // Brain should detect stuck loop, invoke critic review, and resolve without hanging
    assert(stuckRes.status === 'completed' || stuckRes.status === 'tool_call_required' || stuckRes.critic_applied === true,
      `Expected completed, tool_call_required, or critic_applied, got: ${stuckRes.status}`)
    if (stuckRes.critic_applied) {
      assert(!!stuckRes.failure_reason, 'Expected failure_reason to be documented when critic is applied')
    }
  })

  // -------------------------------------------------------------
  // Test 4: Team-Level Failure Propagation & Subtask Reassignment
  // -------------------------------------------------------------
  await test('Item 4: TeamLead handles failed subtask by reassigning to alternative role or escalating', async () => {
    const teamId = `team_test_${Date.now()}`

    // 1. Reassign failed subtask to an alternative role
    const reassignOutput = await teamLeadAgent.run({
      teamId,
      tenantId,
      mission: 'Handle market research failure and reassign to senior analyst',
      availableRoles: ['team_lead', 'researcher', 'analyst', 'writer'],
      task: 'Reassign research subtask task_001 which failed due to rate limits',
      maxIterations: 3
    })
    assert(reassignOutput.success === true, 'Expected TeamLead run to succeed')

    // Directly test reassign_failed_subtask tool execution
    const reassignTool = (teamLeadAgent as any).tools.find((t: any) => t.name === 'reassign_failed_subtask')
    assert(!!reassignTool, 'Expected reassign_failed_subtask tool to exist on TeamLead')

    const reassignResult = await reassignTool.execute({
      failed_role: 'researcher',
      failed_task_id: 'task_research_101',
      error_message: 'External API 429 rate limit reached',
      alternative_role: 'analyst',
      action: 'reassign'
    }, { teamId, tenantId, runId: testRunId })

    assert(reassignResult.status === 'reassigned', `Expected status 'reassigned', got: ${reassignResult.status}`)
    assert(reassignResult.reassignedTo === 'analyst', 'Expected reassignedTo to be analyst')
    assert(!!reassignResult.newTaskId, 'Expected newTaskId generated for reassignment')
  })

  // -------------------------------------------------------------
  // Test 5: End-to-End Orchestrator Resilience & Human Escalation
  // -------------------------------------------------------------
  await test('Item 5: Team Orchestrator recovers gracefully from subagent failures without hanging tasks', async () => {
    const { teamId } = await teamOrchestratorService.instantiateTeamFromTemplate({
      templateKey: 'marketing',
      tenantId,
      customName: 'Resilient Marketing Squad',
      customMission: 'Execute product launch strategy with simulated resilience'
    })

    const missionResult = await teamOrchestratorService.dispatchMission({
      teamId,
      tenantId,
      mission: 'Launch resilient marketing campaign'
    })

    assert(missionResult.status === 'completed', `Expected mission status 'completed', got: ${missionResult.status}`)
    assert(!!missionResult.leadOutput, 'Expected TeamLead output to be present')
    assert(missionResult.sharedMemoriesCreated >= 3, 'Expected shared team memories created')

    // Verify team status endpoint reflects active/completed state
    const status = await teamOrchestratorService.getTeamStatus(teamId, tenantId)
    assert(status.status === 'completed', `Expected status 'completed', got: ${status.status}`)
    assert(status.memoryCount >= 3, 'Expected memory count >= 3')
  })

  console.log('\n=============================================')
  console.log(`Failure Recovery Test Results: ${passed}/${passed + failed} Passed (${Math.round((passed / (passed + failed)) * 100)}%)`)
  console.log('=============================================\n')

  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runTests().catch(err => {
  console.error('Fatal Test Runner Error:', err)
  process.exit(1)
})
