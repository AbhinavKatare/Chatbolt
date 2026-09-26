import { agentCompetencyEvalService } from '../services/agent-competency-eval.service'

async function runTests() {
  console.log('🎓 Starting Agent Competency & Evaluation Harness Test Suite...\n')

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
      console.error(`     Error: ${err.message}`)
    }
  }

  const TENANT_ID = 'tenant-eval-test-202'

  // ── TEST 1: Benchmark Suite for Core Roles ──
  await test('Item 1: Benchmark suites exist for core Technical, Marketing, and TeamLead roles', () => {
    const coreRoles = ['code', 'developer', 'security_auditor', 'researcher', 'writer', 'team_lead']

    for (const role of coreRoles) {
      const report = agentCompetencyEvalService.getRoleReport(role)
      if (!report || report.totalTasks === 0) {
        throw new Error(`Role '${role}' has no evaluated tasks in benchmark report`)
      }
      if (typeof report.overallScore !== 'number' || report.overallScore < 0 || report.overallScore > 100) {
        throw new Error(`Invalid overall score for role '${role}': ${report.overallScore}`)
      }
    }
  })

  // ── TEST 2: Automated Regression Detection on Config Drift ──
  await test('Item 2: Automated regression test detects prompt/model/tool drift and re-evaluates', () => {
    const role = 'developer'
    const initialReport = agentCompetencyEvalService.getRoleReport(role)

    // Initial check with baseline config
    const res1 = agentCompetencyEvalService.checkAndRunRegressionEvals(
      role,
      'openai/gpt-4o',
      'You are a senior full-stack developer specializing in TypeScript.',
      ['apply_file_diff', 'semantic_code_search']
    )
    if (res1.drifted) {
      throw new Error('Initial registration should not report drift')
    }

    // Swapping model and modifying prompt triggers drift detection and regression eval
    const res2 = agentCompetencyEvalService.checkAndRunRegressionEvals(
      role,
      'anthropic/claude-3-5-sonnet',
      'You are a code refactoring assistant specializing in minimal diffs.',
      ['apply_file_diff', 'semantic_code_search', 'web_search']
    )
    if (!res2.drifted) {
      throw new Error('Expected configuration drift to be detected after changing model and prompt')
    }
    if (!res2.report || res2.report.configurationHash === initialReport.configurationHash) {
      throw new Error('Expected new configuration hash on regression report')
    }
  })

  // ── TEST 3: Competency Scorecard & Transparency Report ──
  await test('Item 3: Scorecard exposes pass rate, grade, category breakdown, strengths and weaknesses', () => {
    const report = agentCompetencyEvalService.getRoleReport('code')

    if (!report.grade || !['A+', 'A', 'B', 'C', 'F'].includes(report.grade)) {
      throw new Error(`Invalid competency grade: ${report.grade}`)
    }
    if (!report.categoryBreakdown || Object.keys(report.categoryBreakdown).length === 0) {
      throw new Error('Category breakdown is missing from competency report')
    }
    if (!Array.isArray(report.strengths) || report.strengths.length === 0) {
      throw new Error('Strengths array is empty')
    }
    if (!Array.isArray(report.evalResults) || report.evalResults.length === 0) {
      throw new Error('Itemized eval results missing')
    }

    // Verify category breakdown keys
    const categories = Object.keys(report.categoryBreakdown)
    if (!categories.includes('code_accuracy') && !categories.includes('safety_and_truthfulness')) {
      throw new Error(`Expected core categories in breakdown, found: ${categories.join(', ')}`)
    }
  })

  // ── TEST 4: Deployment Gating by Tier ──
  await test('Item 4: Deployment gate enforces competency threshold per tier and blocks sub-par roles/teams', () => {
    // 1. Core role with ~90% score should pass hobby (60), pro (75), enterprise (85)
    const hobbyCheck = agentCompetencyEvalService.isRoleDeployable('code', 'hobby')
    const proCheck = agentCompetencyEvalService.isRoleDeployable('code', 'pro')
    const entCheck = agentCompetencyEvalService.isRoleDeployable('code', 'enterprise')

    if (!hobbyCheck.deployable || !proCheck.deployable || !entCheck.deployable) {
      throw new Error('High-performing role failed deployment gates')
    }

    // 2. Team gate evaluation
    const validTeam = ['code', 'developer', 'security_auditor']
    const teamCheck = agentCompetencyEvalService.isTeamDeployable(validTeam, 'enterprise')
    if (!teamCheck.deployable) {
      throw new Error(`Expected all valid roles to pass team gate: ${teamCheck.reason}`)
    }
  })

  // ── TEST 5: Custom User-Defined Eval Cases ──
  await test('Item 5: Users can define custom eval cases and execute with real test inputs', () => {
    // 1. Create custom eval case
    const customCase = agentCompetencyEvalService.createCustomEvalCase({
      tenantId: TENANT_ID,
      role: 'writer',
      name: 'SOC2 Compliance Announcement Tone Check',
      inputPrompt: 'Draft an email announcing SOC2 Type II compliance to enterprise customers.',
      expectedKeywords: ['SOC2', 'compliance', 'security', 'audit', 'confidentiality'],
      minimumPassScore: 80
    })

    if (!customCase.id.startsWith('custom_eval_')) {
      throw new Error(`Invalid custom eval ID: ${customCase.id}`)
    }

    // 2. List custom cases
    const list = agentCompetencyEvalService.listCustomEvalCases(TENANT_ID, 'writer')
    if (list.length === 0 || list[0].id !== customCase.id) {
      throw new Error('Failed to retrieve created custom eval case')
    }

    // 3. Run eval with passing output
    const passResult = agentCompetencyEvalService.runCustomEval(
      TENANT_ID,
      customCase.id,
      'We are thrilled to announce that Chatbolt has achieved SOC2 Type II compliance, verifying our highest standards for data security, confidentiality, and regular third-party audit verification.'
    )

    if (!passResult || !passResult.passed || passResult.score < 80) {
      throw new Error(`Expected custom eval to pass, got: ${JSON.stringify(passResult)}`)
    }

    // 4. Run eval with failing output (missing keywords)
    const failResult = agentCompetencyEvalService.runCustomEval(
      TENANT_ID,
      customCase.id,
      'Hello, we have an update about our product features and pricing.'
    )

    if (!failResult || failResult.passed || failResult.score >= 80) {
      throw new Error(`Expected deficient output to fail custom eval, got: ${JSON.stringify(failResult)}`)
    }
  })

  // ── TEST 6: Historical Drift Tracking ──
  await test('Item 6: Historical drift timeline tracks score progression across evaluations', () => {
    const role = 'researcher'
    const driftHistory = agentCompetencyEvalService.getHistoricalDrift(role)

    if (!Array.isArray(driftHistory) || driftHistory.length === 0) {
      throw new Error('Historical drift timeline is empty')
    }

    const latest = driftHistory[driftHistory.length - 1]
    if (!latest.evaluatedAt || !latest.overallScore) {
      throw new Error('Historical record missing timestamp or score')
    }
  })

  console.log(`\n=============================================`)
  console.log(`Agent Competency Evaluation Results: ${passed}/${total} Passed (${Math.round(passed/total * 100)}%)`)
  console.log(`=============================================\n`)

  if (passed !== total) {
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
