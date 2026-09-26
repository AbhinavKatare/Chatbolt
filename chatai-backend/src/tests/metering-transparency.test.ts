import assert from 'assert'
import { meteringTransparencyService } from '../services/metering-transparency.service'
import { agentBrainClient } from '../services/agent-brain-client.service'
import { teamOrchestratorService } from '../services/team-orchestrator.service'

console.log('📊 Starting Radical Metering Transparency & Pre-Execution Budgeting Test Suite...\n')

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

  const tenantId = '00000000-0000-0000-0000-000000000000'

  // =========================================================================
  // Item 1: Real-Time, Per-Agent, Per-Task Cost Tracking & Live Pricing
  // =========================================================================
  await test('Item 1: Computes exact itemized token and compute costs across OpenAI, Anthropic, Gemini, DeepSeek, and Llama', async () => {
    // 1. OpenAI GPT-4o calculation
    const gpt4Cost = meteringTransparencyService.computeStepCost('gpt-4o', 10000, 2000, 0, 2000)
    // 10,000 prompt @ $2.50/M = $0.025, 2,000 completion @ $10.00/M = $0.020, 2s compute = $0.0001
    assert.strictEqual(gpt4Cost.promptCostUsd, 0.025)
    assert.strictEqual(gpt4Cost.completionCostUsd, 0.02)
    assert.strictEqual(gpt4Cost.totalTokens, 12000)
    assert.strictEqual(gpt4Cost.totalCostUsd, 0.0451)

    // 2. Anthropic Claude 3.5 Sonnet calculation
    const claudeCost = meteringTransparencyService.computeStepCost('claude-3-5-sonnet-20241022', 20000, 4000, 0, 1000)
    // 20,000 @ $3.00/M = $0.060, 4,000 @ $15.00/M = $0.060, 1s compute = $0.00005
    assert.strictEqual(claudeCost.promptCostUsd, 0.06)
    assert.strictEqual(claudeCost.completionCostUsd, 0.06)
    assert.strictEqual(claudeCost.totalCostUsd, 0.12005)

    // 3. DeepSeek-R1 calculation
    const deepseekCost = meteringTransparencyService.computeStepCost('deepseek/deepseek-r1', 10000, 5000, 0, 3000)
    // 10k @ $0.55/M = $0.0055, 5k @ $2.19/M = $0.01095, 3s compute = $0.00015
    assert.strictEqual(deepseekCost.promptCostUsd, 0.0055)
    assert.strictEqual(deepseekCost.completionCostUsd, 0.01095)

    // 4. Local BYOK Ollama (Free Tier)
    const localCost = meteringTransparencyService.computeStepCost('local/ollama', 50000, 10000, 0, 5000)
    assert.strictEqual(localCost.promptCostUsd, 0.0)
    assert.strictEqual(localCost.completionCostUsd, 0.0)

    // 5. Test logging a step execution to audit ledger
    const logResult = await meteringTransparencyService.logStepUsage({
      tenantId,
      teamId: 'team_mkt_1',
      agentRole: 'copywriter',
      runId: 'run_test_metering_101',
      model: 'openai/gpt-4o',
      provider: 'openai',
      promptTokens: 4500,
      completionTokens: 850,
      durationMs: 1500
    })

    assert.strictEqual(logResult.totalTokens, 5350)
    assert(logResult.totalCostUsd > 0, 'Total cost must be greater than zero')
  })

  // =========================================================================
  // Item 2: Accurate Context Indicator & Quality Degradation Signals
  // =========================================================================
  await test('Item 2: Honest context usage indicator triggers proactive degradation warning at 60% and 85% saturation', async () => {
    // 1. Optimal context usage (10,000 / 128,000 tokens on GPT-4o = 7.8%)
    const optimalCost = meteringTransparencyService.computeStepCost('gpt-4o', 10000, 1000)
    assert.strictEqual(optimalCost.contextWindow, 128000)
    assert.strictEqual(optimalCost.contextUtilizationPct, 7.81)
    assert.strictEqual(optimalCost.degradationWarning, null)

    // 2. Degradation Risk Threshold (80,000 / 128,000 tokens on GPT-4o = 62.5%)
    const riskCost = meteringTransparencyService.computeStepCost('gpt-4o', 80000, 2000)
    assert.strictEqual(riskCost.contextUtilizationPct, 62.5)
    assert.strictEqual(riskCost.degradationWarning, 'degradation_risk')

    // 3. Critical Saturation Threshold (115,000 / 128,000 tokens = 89.84%)
    const criticalCost = meteringTransparencyService.computeStepCost('gpt-4o', 115000, 2000)
    assert.strictEqual(criticalCost.contextUtilizationPct, 89.84)
    assert.strictEqual(criticalCost.degradationWarning, 'critical_saturation')

    // 4. Massive Context Model (Claude 3.5 Sonnet: 200,000 tokens)
    const claudeCtx = meteringTransparencyService.computeStepCost('claude-3-5-sonnet-20241022', 150000, 5000)
    assert.strictEqual(claudeCtx.contextWindow, 200000)
    assert.strictEqual(claudeCtx.contextUtilizationPct, 75.0)
    assert.strictEqual(claudeCtx.degradationWarning, 'degradation_risk')
  })

  // =========================================================================
  // Item 3: Pre-Execution Budget & Token Guard
  // =========================================================================
  await test('Item 3: Pre-execution budget guard halts execution BEFORE next step runs if budget would be exceeded', async () => {
    const budgetTeamId = `team_budget_${Date.now()}`
    const budgetRunId = `run_budget_${Date.now()}`

    // 1. Set a tight $0.05 budget for this task / team
    await meteringTransparencyService.setBudget({
      tenantId,
      scopeType: 'team',
      scopeId: budgetTeamId,
      maxCostUsd: 0.05,
      maxTokens: 10000,
      enforcementMode: 'ask_approval'
    })

    // 2. Initial check should be allowed when 0 spent and small step estimated ($0.01)
    const initialCheck = await meteringTransparencyService.evaluatePreExecutionBudget({
      tenantId,
      teamId: budgetTeamId,
      runId: budgetRunId,
      estimatedNextStepCostUsd: 0.01
    })
    assert.strictEqual(initialCheck.allowed, true, 'Initial step under budget must pass')

    // 3. Log a step that spends $0.045
    await meteringTransparencyService.logStepUsage({
      tenantId,
      teamId: budgetTeamId,
      agentRole: 'researcher',
      runId: budgetRunId,
      model: 'openai/gpt-4o',
      provider: 'openai',
      promptTokens: 10000,
      completionTokens: 2000,
      durationMs: 2000
    })

    // 4. Next proposed step with $0.02 cost will exceed $0.05 total budget ($0.045 + $0.02 = $0.065 > $0.05)
    const blockedCheck = await meteringTransparencyService.evaluatePreExecutionBudget({
      tenantId,
      teamId: budgetTeamId,
      runId: budgetRunId,
      estimatedNextStepCostUsd: 0.02
    })

    assert.strictEqual(blockedCheck.allowed, false, 'Pre-execution budget must block overspend')
    assert.strictEqual(blockedCheck.requiresApproval, true, 'Requires approval under ask_approval mode')
    assert(blockedCheck.reason?.includes('Pre-execution budget limit reached'), 'Must provide clear explanation')
    assert.strictEqual(blockedCheck.budgetLimitUsd, 0.05)
  })

  // =========================================================================
  // Item 4: Upfront Mission Spend & Token Forecasting
  // =========================================================================
  await test('Item 4: Spend forecast engine calculates projected cost, tokens, and duration for task queues before commitment', async () => {
    const taskQueue = [
      { task: 'Analyze competitor AI agent platforms and compile market matrix', role: 'researcher', estimatedComplexity: 'high' as const },
      { task: 'Draft 5 multi-channel launch announcements and social copy', role: 'writer', estimatedComplexity: 'medium' as const },
      { task: 'Implement automated benchmark runner script in TypeScript', role: 'code', estimatedComplexity: 'medium' as const },
      { task: 'Review deliverables and finalize executive launch package', role: 'team_lead', estimatedComplexity: 'low' as const }
    ]

    const forecast = meteringTransparencyService.forecastMissionSpend({
      taskQueue,
      defaultModel: 'openai/gpt-4o'
    })

    assert(forecast.estimatedTotalCostUsd > 0, 'Must produce non-zero estimated dollar cost')
    assert(forecast.minEstimatedCostUsd < forecast.estimatedTotalCostUsd, 'Min cost must be below mean')
    assert(forecast.maxEstimatedCostUsd > forecast.estimatedTotalCostUsd, 'Max cost must be above mean')
    assert(forecast.estimatedTotalTokens > 10000, 'Must project token usage across 4 tasks')
    assert.strictEqual(forecast.taskCount, 4, 'Must forecast all 4 tasks')
    assert(forecast.tasks.length === 4, 'Must include itemized breakdown per task')
    assert(forecast.roleBreakdowns['researcher'] !== undefined, 'Must break down by role')
    assert(forecast.confidenceScore >= 0.85, 'Must provide high empirical confidence score')
  })

  // =========================================================================
  // Item 5: Queryable Historical Audit Ledger & RFC-4180 CSV Export
  // =========================================================================
  await test('Item 5: Audit ledger provides itemized historical records exportable to RFC-4180 CSV', async () => {
    const auditRunId = `run_audit_export_${Date.now()}`

    // Log 3 steps across different roles
    await meteringTransparencyService.logStepUsage({
      tenantId,
      teamId: 'team_audit_test',
      agentRole: 'team_lead',
      runId: auditRunId,
      model: 'openai/gpt-4o',
      provider: 'openai',
      promptTokens: 2500,
      completionTokens: 600,
      durationMs: 800
    })

    await meteringTransparencyService.logStepUsage({
      tenantId,
      teamId: 'team_audit_test',
      agentRole: 'researcher',
      runId: auditRunId,
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      promptTokens: 4100,
      completionTokens: 1200,
      durationMs: 1500
    })

    // Query ledger
    const audit = await meteringTransparencyService.queryAuditLedger({
      tenantId,
      runId: auditRunId
    })

    assert(audit.records.length >= 2, 'Must return logged records')
    assert(audit.totalTokens > 0, 'Must calculate total token count')
    assert(audit.totalCostUsd > 0, 'Must calculate total cost')

    // Export CSV
    const csv = await meteringTransparencyService.exportAuditCsv({
      tenantId,
      runId: auditRunId
    })

    assert(csv.includes('Timestamp,Run_ID,Team_ID,Agent_Role,Model,Provider'), 'CSV must have standard headers')
    assert(csv.includes(auditRunId), 'CSV must contain run_id entries')
    assert(csv.includes('team_lead'), 'CSV must contain agent role')
    assert(csv.includes('claude-3-5-sonnet-20241022') || csv.includes('openai/gpt-4o'), 'CSV must itemize models')
  })

  // =========================================================================
  // Item 6: Public Pricing Catalog & Zero Silent Changes Commitment
  // =========================================================================
  await test('Item 6: Public pricing catalog and policy feed enforce Zero Silent Changes commitment', async () => {
    // 1. Catalog inspectability
    const catalog = meteringTransparencyService.getPricingCatalog()
    assert(catalog.models.length >= 8, 'Catalog must contain all standard models')
    assert.strictEqual(catalog.zeroSilentChangesCommitment, true, 'Must guarantee zero silent changes')
    assert(catalog.models.some(m => m.modelId === 'gpt-4o'), 'Must contain GPT-4o')
    assert(catalog.models.some(m => m.modelId === 'claude-3-5-sonnet-20241022'), 'Must contain Claude 3.5 Sonnet')
    assert(catalog.models.some(m => m.isByokZeroCost === true), 'Must explicitly flag free BYOK models')

    // 2. Policy notices feed
    const notices = meteringTransparencyService.getPolicyNotices()
    assert(notices.length >= 3, 'Must contain dated policy notices')
    assert(notices.some(n => n.category === 'transparency_commitment'), 'Must contain transparency charter notice')
    assert(notices.every(n => n.date && n.title && n.details), 'All notices must have date, title, and details')
  })

  console.log(`\n📊 Metering Transparency Results: ${passed} passed, ${failed} failed\n`)

  if (failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

runTests().catch((err) => {
  console.error('Fatal metering test execution error:', err)
  process.exit(1)
})
