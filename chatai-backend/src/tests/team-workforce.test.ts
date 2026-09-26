import assert from 'assert'
import { TEAM_TEMPLATES } from '../config/team-templates.config'
import { teamOrchestratorService } from '../services/team-orchestrator.service'
import { teamLeadAgent } from '../agents/team-lead.agent'
import { saveTeamMemory, getTeamMemory, searchTeamMemory, listTeamMemories, clearTeamMemory } from '../services/memory.service'
import { agentBrainClient } from '../services/agent-brain-client.service'
import { agentRuntimeClient } from '../services/agent-runtime-client.service'

async function runTests() {
  console.log('🧪 Starting Autonomous Team Workforce & TeamLead Orchestration Test Suite...\n')
  let passed = 0
  let total = 0

  async function test(name: string, fn: () => Promise<void> | void) {
    total++
    try {
      await fn()
      console.log(`  ✅ PASS: ${name}`)
      passed++
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`)
      console.error(`     Error: ${err.message}\n`)
    }
  }

  // =========================================================================
  // 1. Team Templates Configuration Tests
  // =========================================================================
  await test('Item 1: Starter templates exist for Marketing, Technical, and Operations teams', () => {
    assert.ok(TEAM_TEMPLATES.marketing, 'Marketing template must be defined')
    assert.ok(TEAM_TEMPLATES.technical, 'Technical template must be defined')
    assert.ok(TEAM_TEMPLATES.operations, 'Operations template must be defined')

    assert.strictEqual(TEAM_TEMPLATES.marketing.lead_role, 'team_lead')
    assert.strictEqual(TEAM_TEMPLATES.technical.lead_role, 'team_lead')
    assert.strictEqual(TEAM_TEMPLATES.operations.lead_role, 'team_lead')

    // Verify roles and tools
    const mktRoles = TEAM_TEMPLATES.marketing.roles.map(r => r.role)
    assert.ok(mktRoles.includes('team_lead'), 'Marketing team must have team_lead')
    assert.ok(mktRoles.includes('researcher'), 'Marketing team must have researcher')
    assert.ok(mktRoles.includes('writer'), 'Marketing team must have writer')

    const techRoles = TEAM_TEMPLATES.technical.roles.map(r => r.role)
    assert.ok(techRoles.includes('team_lead'), 'Technical team must have team_lead')
    assert.ok(techRoles.includes('code'), 'Technical team must have code agent')

    const opsRoles = TEAM_TEMPLATES.operations.roles.map(r => r.role)
    assert.ok(opsRoles.includes('team_lead'), 'Ops team must have team_lead')
    assert.ok(opsRoles.includes('ops'), 'Ops team must have ops agent')
  })

  await test('Item 1: Escalation policies define required human approval actions', () => {
    assert.ok(TEAM_TEMPLATES.marketing.escalation_policy.require_human_approval_for.length > 0)
    assert.ok(TEAM_TEMPLATES.technical.escalation_policy.require_human_approval_for.includes('git_push_main'))
    assert.ok(TEAM_TEMPLATES.operations.escalation_policy.require_human_approval_for.includes('restart_production_cluster'))
  })

  // =========================================================================
  // 2. Team-Scoped Shared Memory Tests
  // =========================================================================
  await test('Item 2: Extended agent_memory supports team-scoped shared memory CRUD', async () => {
    const testTeamId = `test_team_${Date.now()}`
    const testTenantId = '00000000-0000-0000-0000-000000000000'

    // 1. Save team memory
    await saveTeamMemory(testTeamId, testTenantId, 'brand:voice', 'Bold, innovative, customer-obsessed', 'brand_guidelines', 8)
    await saveTeamMemory(testTeamId, testTenantId, 'product:core_feature', 'LangGraph ReAct loop with Go execution', 'product_fact', 9)

    // 2. Get specific key
    const voice = await getTeamMemory(testTeamId, 'brand:voice')
    assert.strictEqual(voice, 'Bold, innovative, customer-obsessed')

    // 3. Search team memory
    const searchResults = await searchTeamMemory(testTeamId, 'ReAct')
    assert.ok(searchResults.length >= 1, 'Search query should return matching team memories')
    assert.ok(searchResults[0].value.includes('LangGraph ReAct'))

    // 4. List team memories
    const listResults = await listTeamMemories(testTeamId)
    assert.strictEqual(listResults.length, 2, 'Should list all memories for team')

    // 5. Clear team memory
    const cleared = await clearTeamMemory(testTeamId)
    assert.strictEqual(cleared, 2, 'Should clear created team memories')
  })

  // =========================================================================
  // 3. Team Lead & AgentBus Multi-Agent Delegation Tests
  // =========================================================================
  await test('Item 3: TeamLead ReAct loop decomposes goal, assigns via AgentBus, and writes to shared memory', async () => {
    const testTeamId = `mkt_team_e2e_${Date.now()}`
    const testTenantId = '00000000-0000-0000-0000-000000000000'
    const mission = 'Launch product announcement campaign for Chatbolt Autonomous Teams'

    // Verify Go Agent-Runtime and Python Agent-Brain health
    const isGoHealthy = await agentRuntimeClient.isAvailable()
    assert.strictEqual(isGoHealthy, true, 'Go agent-runtime must be available')

    const isBrainHealthy = await agentBrainClient.isAvailable()
    assert.strictEqual(isBrainHealthy, true, 'Python agent-brain must be available')

    // Execute TeamLead run
    const leadResult = await teamLeadAgent.run({
      teamId: testTeamId,
      tenantId: testTenantId,
      mission,
      task: mission,
      availableRoles: ['team_lead', 'researcher', 'writer', 'analyst'],
      maxIterations: 4
    })

    assert.strictEqual(leadResult.success, true, 'TeamLead execution must succeed')
    assert.ok(leadResult.data.teamId, 'Output must include teamId')

    // Verify team memory received mission records
    const storedMission = await getTeamMemory(testTeamId, 'mission:goal')
    assert.strictEqual(storedMission, mission, 'Mission goal must be preserved in team memory')

    const storedReport = await getTeamMemory(testTeamId, 'mission:final_report')
    assert.ok(storedReport && storedReport.length > 0, 'Final report must be stored in team memory')
  })

  // =========================================================================
  // 4. End-to-End Multi-Step Team Orchestration Test
  // =========================================================================
  await test('Item 4: End-to-end Marketing Team mission produces reviewable output set across sub-agents', async () => {
    const testTenantId = '00000000-0000-0000-0000-000000000000'
    
    // 1. Instantiate team from template
    const initRes = await teamOrchestratorService.instantiateTeamFromTemplate({
      templateKey: 'marketing',
      tenantId: testTenantId,
      customName: 'E2E Growth Squad',
      customMission: 'Launch Q4 autonomous agent marketing campaign'
    })

    assert.ok(initRes.teamId, 'Team ID must be created')
    assert.strictEqual(initRes.agentCount, 4, 'Marketing team must instantiate 4 agent roles')

    // 2. Dispatch mission
    const missionResult = await teamOrchestratorService.dispatchMission({
      teamId: initRes.teamId,
      tenantId: testTenantId,
      mission: 'Launch comprehensive product announcement campaign for Chatbolt Autonomous Teams',
      templateKey: 'marketing',
      maxIterations: 4
    })

    assert.strictEqual(missionResult.status, 'completed', 'Mission status must be completed')
    assert.ok(missionResult.sharedMemoriesCreated >= 3, 'Shared memories must be created across team steps')
    assert.ok(missionResult.subagentOutputs['researcher'], 'Researcher subagent must produce output')
    assert.ok(missionResult.subagentOutputs['writer'], 'Writer subagent must produce output')

    // 3. Verify Team status and final deliverable
    const status = await teamOrchestratorService.getTeamStatus(initRes.teamId, testTenantId)
    assert.strictEqual(status.status, 'completed')
    assert.ok(status.finalDeliverable.includes('Team Mission Review & Deliverables'))
    assert.ok(status.memoryCount >= 3)
  })

  // =========================================================================
  // 5. Human Intervention Actions Test
  // =========================================================================
  await test('Item 5: Human-in-the-loop intervention supports pause, inject_guidance, and resume', async () => {
    const testTeamId = `intervene_team_${Date.now()}`
    const testTenantId = '00000000-0000-0000-0000-000000000000'

    // 1. Pause
    const pauseRes = await teamOrchestratorService.intervene({
      teamId: testTeamId,
      tenantId: testTenantId,
      action: 'pause'
    })
    assert.strictEqual(pauseRes.success, true)

    let status = await teamOrchestratorService.getTeamStatus(testTeamId, testTenantId)
    assert.strictEqual(status.status, 'paused')

    // 2. Inject Guidance
    const guidanceRes = await teamOrchestratorService.intervene({
      teamId: testTeamId,
      tenantId: testTenantId,
      action: 'inject_guidance',
      guidance: 'Focus marketing copy on developer productivity and zero setup latency.'
    })
    assert.strictEqual(guidanceRes.success, true)

    // Check guidance recorded in team memory
    const searchGuidance = await searchTeamMemory(testTeamId, 'developer productivity')
    assert.ok(searchGuidance.length >= 1, 'Human guidance must be searchable in team memory')

    // 3. Resume
    const resumeRes = await teamOrchestratorService.intervene({
      teamId: testTeamId,
      tenantId: testTenantId,
      action: 'resume'
    })
    assert.strictEqual(resumeRes.success, true)

    status = await teamOrchestratorService.getTeamStatus(testTeamId, testTenantId)
    assert.strictEqual(status.status, 'running')
  })

  console.log(`\n=============================================`)
  console.log(`Team Workforce Test Results: ${passed}/${total} Passed (${Math.round((passed/total)*100)}%)`)
  console.log(`=============================================\n`)

  if (passed !== total) {
    process.exit(1)
  }
  process.exit(0)
}

runTests().catch(err => {
  console.error('Fatal team test execution error:', err)
  process.exit(1)
})
