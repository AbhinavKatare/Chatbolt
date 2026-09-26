import dotenv from 'dotenv'
dotenv.config()

import { companyOrchestratorService } from '../services/company-orchestrator.service'
import { agentGovernanceService } from '../services/agent-governance.service'
import { actionJournalService } from '../services/action-journal.service'
import { postMortemService } from '../services/post-mortem.service'
import { COMPANY_BLUEPRINTS, getCompanyBlueprint } from '../config/company-blueprints.config'
import { AutonomyLevel } from '../config/team-templates.config'

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
  console.log('🏢 Starting Simulated Company Orchestration & Governance Test Suite...\n')
  const tenantId = '00000000-0000-0000-0000-000000000000'
  const companyRunId = `comp-run-${Date.now()}`

  await actionJournalService.ensureTable()

  // -------------------------------------------------------------
  // Test 1: Company Blueprints & Instantiation
  // -------------------------------------------------------------
  await test('Item 1: Company blueprints load correctly and instantiate multi-squad structure', async () => {
    const launchBlueprint = getCompanyBlueprint('product_launch_company')
    assert(!!launchBlueprint, 'Expected product_launch_company blueprint to exist')
    assert(launchBlueprint.squads.length >= 3, `Expected at least 3 squads in product launch, got ${launchBlueprint.squads.length}`)

    // Check dependency structure
    const techSquad = launchBlueprint.squads.find(s => s.squad_id === 'tech_squad')
    const opsSquad = launchBlueprint.squads.find(s => s.squad_id === 'ops_squad')
    const marketingSquad = launchBlueprint.squads.find(s => s.squad_id === 'marketing_squad')

    assert(!!techSquad && !!opsSquad && !!marketingSquad, 'Expected tech, ops, and marketing squads')
    assert(opsSquad.depends_on.includes('tech_squad'), 'Ops squad must depend on Tech squad')
    assert(marketingSquad.depends_on.includes('tech_squad'), 'Marketing squad must depend on Tech squad')

    // Instantiate company
    const instantiated = await companyOrchestratorService.instantiateCompany({
      tenantId,
      blueprintId: 'product_launch_company',
      companyName: 'Acme Autonomous Labs'
    })

    assert(!!instantiated.companyId, 'Expected valid companyId')
    assert(instantiated.squads.length === launchBlueprint.squads.length, 'All squads must be instantiated')
    assert(instantiated.squads.every(s => !!s.team_id), 'Every squad must have an associated team_id')
  })

  // -------------------------------------------------------------
  // Test 2: Org-Chart Autonomy Matrix & Tool Policy Enforcement
  // -------------------------------------------------------------
  await test('Item 2: Autonomy level matrix strictly enforces tool-execution boundaries', async () => {
    // 1. observe_only: Allowed read tools, blocked write/exec tools
    const readCheck1 = agentGovernanceService.validateToolExecutionByAutonomy(
      'observe_only',
      'web_search',
      { query: 'market trends' }
    )
    assert(readCheck1.allowed, 'observe_only should allow web_search')

    const readCheck2 = agentGovernanceService.validateToolExecutionByAutonomy(
      'observe_only',
      'read_file',
      { path: 'README.md' }
    )
    assert(readCheck2.allowed, 'observe_only should allow read_file')

    const writeCheck1 = agentGovernanceService.validateToolExecutionByAutonomy(
      'observe_only',
      'file_write',
      { path: 'src/index.ts', content: 'hack' }
    )
    assert(!writeCheck1.allowed, 'observe_only must block file_write')
    assert(writeCheck1.reason?.includes('observe_only'), 'Must state reason for observe_only blockage')

    const execCheck1 = agentGovernanceService.validateToolExecutionByAutonomy(
      'observe_only',
      'execute_sandbox_code',
      { code: 'console.log(1)' }
    )
    assert(!execCheck1.allowed, 'observe_only must block execute_sandbox_code')

    // 2. suggest_only: Allowed read tools, blocks mutating actions
    const suggestWriteCheck = agentGovernanceService.validateToolExecutionByAutonomy(
      'suggest_only',
      'git_commit',
      { message: 'deploy update' }
    )
    assert(!suggestWriteCheck.allowed, 'suggest_only must block git_commit')

    // 3. act_with_approval: flags approval requirement when unapproved, allows when approved
    const unapprovedCheck = agentGovernanceService.validateToolExecutionByAutonomy(
      'act_with_approval',
      'file_write',
      { path: 'config.json' }
    )
    assert(!unapprovedCheck.allowed, 'act_with_approval blocks unapproved mutating action')
    assert(unapprovedCheck.requiresApproval === true, 'act_with_approval must flag requiresApproval=true')

    const approvedCheck = agentGovernanceService.validateToolExecutionByAutonomy(
      'act_with_approval',
      'file_write',
      { path: 'config.json', approved: true }
    )
    assert(approvedCheck.allowed === true, 'act_with_approval allows mutating action when approved=true')

    // 4. fully_autonomous: allows mutating actions without manual gate
    const autonomousCheck = agentGovernanceService.validateToolExecutionByAutonomy(
      'fully_autonomous',
      'file_write',
      { path: 'config.json' }
    )
    assert(autonomousCheck.allowed, 'fully_autonomous allows file_write')
    assert(!autonomousCheck.requiresApproval, 'fully_autonomous does not require approval')
  })

  // -------------------------------------------------------------
  // Test 3: Agent Accountability Ledger & Decision Logging
  // -------------------------------------------------------------
  await test('Item 3: Agent accountability ledger records decisions with rationale and confidence', async () => {
    const decisionLogId = await actionJournalService.logDecisionRationale({
      tenantId,
      companyId: 'company-acme-1',
      teamId: 'team-tech-squad',
      agentRole: 'software_engineer',
      actionTaken: 'refactor_database_pooling',
      whyChosen: 'Connection saturation observed during load spikes; pooled client eliminates latency spikes.',
      alternativesConsidered: ['Scale up Postgres instance', 'Increase connection timeout limit'],
      confidence: 0.94,
      context: { connections: 100, p99_latency_ms: 450 }
    })

    assert(!!decisionLogId && decisionLogId !== 'noop', 'Expected valid decisionLogId')

    const ledger = await actionJournalService.getAccountabilityLedger(tenantId, 'company-acme-1')
    assert(ledger.length >= 1, `Expected at least 1 entry in accountability ledger, got ${ledger.length}`)

    const entry = ledger[0]
    assert(entry.agentRole === 'software_engineer', 'Expected software_engineer role in entry')
    assert(entry.actionTaken === 'refactor_database_pooling', 'Expected correct actionTaken in entry')
    assert(entry.confidence === 0.94, `Expected confidence 0.94, got ${entry.confidence}`)
    assert(entry.alternativesConsidered.length === 2, 'Expected 2 alternatives recorded')
  })

  // -------------------------------------------------------------
  // Test 4: Cross-Team DAG Execution & Inter-Team Memory Handoffs
  // -------------------------------------------------------------
  await test('Item 4: CompanyOrchestrator executes cross-team DAG with handoff state propagation', async () => {
    const instantiated = await companyOrchestratorService.instantiateCompany({
      tenantId,
      blueprintId: 'product_launch_company',
      companyName: 'NextGen Analytics Corp'
    })

    const execution = await companyOrchestratorService.executeCompanyMission({
      tenantId,
      companyId: instantiated.companyId,
      missionGoal: 'Launch real-time analytics v2 feature and prepare release campaign',
      context: { targetMarket: 'Enterprise B2B', launchQuarter: 'Q4' }
    })

    assert(!!execution.missionRunId, 'Expected valid missionRunId')
    assert(execution.status === 'completed', `Expected status completed, got ${execution.status}`)
    assert(execution.squadResults.length === 3, `Expected 3 squad results, got ${execution.squadResults.length}`)

    // Verify topological order: tech must finish before ops and marketing
    const techResultIndex = execution.squadResults.findIndex(r => r.squadId === 'tech_squad')
    const opsResultIndex = execution.squadResults.findIndex(r => r.squadId === 'ops_squad')
    const mktgResultIndex = execution.squadResults.findIndex(r => r.squadId === 'marketing_squad')

    assert(techResultIndex < opsResultIndex, 'Tech squad must execute before Ops squad')
    assert(techResultIndex < mktgResultIndex, 'Tech squad must execute before Marketing squad')

    // Verify executive summary was produced
    assert(!!execution.executiveSummary, 'Expected executiveSummary in mission result')
    assert(execution.executiveSummary.length > 50, 'Executive summary should be comprehensive')
  })

  // -------------------------------------------------------------
  // Test 5: Automated Incident Post-Mortem Synthesizer
  // -------------------------------------------------------------
  await test('Item 5: Automated Post-Mortem synthesizes 5-Whys, self-healing timeline, and action items', async () => {
    // Log a failure first to provide context
    await actionJournalService.logFailureRecovery({
      tenantId,
      runId: companyRunId,
      failureClass: 'team_role',
      errorMessage: 'Technical Team pipeline failed at step 2 due to timeout',
      attemptNumber: 1,
      recoveryAction: 'teamlead_reassign',
      outcome: 'escalated',
      details: { squad: 'tech_squad', step: 'deploy_staging' }
    })

    const postMortem = await postMortemService.generatePostMortem({
      tenantId,
      companyId: 'company-acme-1',
      runId: companyRunId,
      missionGoal: 'Deploy critical zero-downtime security patch',
      failureReason: 'Build timeout during Docker compilation in sandboxed container',
      impactAssessment: 'Staging deployment delayed by 15 minutes; no production user impact.',
      squadsInvolved: ['tech_squad', 'ops_squad']
    })

    assert(!!postMortem.postMortemId, 'Expected valid postMortemId')
    assert(postMortem.status === 'generated', 'Post-mortem status should be generated')
    assert(postMortem.markdownReport.includes('## 1. Incident Overview & Impact'), 'Must contain Incident Overview section')
    assert(postMortem.markdownReport.includes('## 3. 5-Whys Root Cause Analysis'), 'Must contain 5-Whys section')
    assert(postMortem.markdownReport.includes('## 4. Self-Healing & Mitigation Timeline'), 'Must contain Self-Healing Timeline section')
    assert(postMortem.markdownReport.includes('## 5. Preventative Action Items'), 'Must contain Preventative Action Items')
    assert(postMortem.actionItems.length >= 3, `Expected at least 3 preventative action items, got ${postMortem.actionItems.length}`)
  })

  console.log(`\n📊 Company Orchestration & Governance Results: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runTests().catch(err => {
  console.error('Fatal error in company-orchestration.test.ts:', err)
  process.exit(1)
})
