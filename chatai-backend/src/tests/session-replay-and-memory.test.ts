import {
  saveCrossSessionMemory,
  listCrossSessionMemories,
  updateCrossSessionMemory,
  deleteCrossSessionMemory,
  hydrateAgentRoleContext
} from '../services/memory.service'
import { sessionReplayService } from '../services/session-replay.service'

async function runTests() {
  console.log('🧠 Starting Native Cross-Session Memory & Session Replay Test Suite...\n')

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

  const TENANT_ID = 'tenant-replay-test-303'
  const TEAM_ID = 'team-growth-303'

  // ── TEST 1: Cross-Session Memory Persistence & Curation ──
  await test('Item 1: Persistent cross-session memory supports CRUD and scope filtering (team, role, category)', async () => {
    // 1. Save architecture decision for technical team
    const mem1 = await saveCrossSessionMemory({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      agentRole: 'developer',
      key: 'architecture_database_engine',
      value: 'Always use PostgreSQL with connection pooling (max 20 connections) and parameterized queries.',
      category: 'architecture',
      importance: 9,
      source: 'lead_architect'
    })

    if (!mem1.id || mem1.category !== 'architecture') {
      throw new Error(`Failed to save memory item: ${JSON.stringify(mem1)}`)
    }

    // 2. Save user preference for copywriting
    const mem2 = await saveCrossSessionMemory({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      agentRole: 'writer',
      key: 'brand_tone_guideline',
      value: 'Adopt a crisp, technical, confident tone. Avoid generic AI marketing buzzwords.',
      category: 'preference',
      importance: 8,
      source: 'user_curated'
    })

    // 3. List and filter memories
    const devMemories = await listCrossSessionMemories({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      agentRole: 'developer'
    })
    if (devMemories.length === 0 || !devMemories.some(m => m.key === 'architecture_database_engine')) {
      throw new Error('Failed to retrieve developer-scoped cross-session memory')
    }

    const searchResults = await listCrossSessionMemories({
      tenantId: TENANT_ID,
      search: 'buzzwords'
    })
    if (searchResults.length === 0 || searchResults[0].key !== 'brand_tone_guideline') {
      throw new Error('Search filtering on memory value failed')
    }

    // 4. Update memory
    const updated = await updateCrossSessionMemory(TENANT_ID, mem2.id, {
      importance: 10,
      value: 'Adopt a crisp, technical, confident tone. Avoid generic AI buzzwords and passive voice.'
    })
    if (!updated || updated.importance !== 10 || !updated.value.includes('passive voice')) {
      throw new Error('Failed to update cross-session memory')
    }

    // 5. Hydrate agent prompt context
    const hydratedPrompt = await hydrateAgentRoleContext(TENANT_ID, TEAM_ID, 'developer')
    if (!hydratedPrompt.includes('architecture_database_engine') || !hydratedPrompt.includes('PostgreSQL')) {
      throw new Error(`Hydrated agent prompt context missing expected memory: ${hydratedPrompt}`)
    }

    // 6. Delete memory
    const deleted = await deleteCrossSessionMemory(TENANT_ID, mem1.id)
    if (!deleted) {
      throw new Error('Failed to delete memory item')
    }
  })

  // ── TEST 2: Full Session Replay Timeline Assembly ──
  await test('Item 2: Session replay synthesizes complete timeline with rationales, tool calls, and permissions', async () => {
    const RUN_ID = `run_replay_${Date.now()}`

    // Record Step 1: Research with tool execution and accountability rationale
    sessionReplayService.recordReplayStep(RUN_ID, {
      stepIndex: 1,
      agentRole: 'researcher',
      actionType: 'tool_execution',
      toolName: 'web_search',
      toolInput: { query: 'NextJS 15 server actions best practices' },
      toolSummary: 'Scraped 4 documentation references on NextJS server actions',
      contentRef: 'ref_tool_search_101',
      rationale: 'Gathered authoritative framework guidelines before writing database mutation logic.',
      confidence: 0.98,
      alternativesConsidered: ['Direct file rewrite without docs', 'Querying local cached embedding'],
      approvalStatus: 'auto_approved',
      permissionDecisionCode: 'auto_approved_read_only',
      isDestructive: false,
      modelUsed: 'openai/gpt-4o',
      promptTokens: 1200,
      completionTokens: 250,
      stepCostUSD: 0.0055,
      durationMs: 420,
      timestamp: new Date(Date.now() - 5000).toISOString()
    }, {
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamName: 'Growth & Architecture Squad',
      missionGoal: 'Implement NextJS 15 server action with PostgreSQL transaction'
    })

    // Record Step 2: Code Diff with standing rule auto-approval
    sessionReplayService.recordReplayStep(RUN_ID, {
      stepIndex: 2,
      agentRole: 'code',
      actionType: 'file_edit',
      toolName: 'apply_file_diff',
      toolInput: { path: 'src/actions/checkout.ts', diff: '@@ -12,4 +12,8 @@ ...' },
      toolSummary: 'Applied targeted diff replacing 6 lines in checkout.ts',
      rationale: 'Targeted diff was chosen over whole file replacement to reduce token spend and preserve surrounding context.',
      confidence: 0.96,
      approvalStatus: 'auto_approved',
      permissionDecisionCode: 'auto_approved_by_standing_rule',
      isDestructive: false,
      modelUsed: 'anthropic/claude-3-5-sonnet',
      promptTokens: 850,
      completionTokens: 60,
      stepCostUSD: 0.00345,
      durationMs: 310,
      timestamp: new Date().toISOString()
    })

    // Fetch and verify replay
    const replay = await sessionReplayService.getReplay(RUN_ID, TENANT_ID)
    if (!replay) {
      throw new Error('Failed to retrieve compiled session replay')
    }

    if (replay.timeline.length !== 2) {
      throw new Error(`Expected 2 steps in timeline, got ${replay.timeline.length}`)
    }
    if (replay.missionGoal !== 'Implement NextJS 15 server action with PostgreSQL transaction') {
      throw new Error(`Unexpected mission goal: ${replay.missionGoal}`)
    }
    if (!replay.timeline[0].rationale || !replay.timeline[1].rationale) {
      throw new Error('Missing agent decision rationale in session replay timeline')
    }
  })

  // ── TEST 3: Native In-Replay Cost Visibility ──
  await test('Item 3: Replay view provides step-by-step and session total itemized costs by model', async () => {
    const RUN_ID = `run_cost_check_${Date.now()}`

    sessionReplayService.recordReplayStep(RUN_ID, {
      stepIndex: 1,
      agentRole: 'team_lead',
      actionType: 'task_decomposition',
      modelUsed: 'openai/gpt-4o',
      promptTokens: 3000,
      completionTokens: 500,
      stepCostUSD: 0.0125,
      durationMs: 400,
      approvalStatus: 'auto_approved',
      timestamp: new Date().toISOString()
    }, { tenantId: TENANT_ID, teamId: TEAM_ID })

    sessionReplayService.recordReplayStep(RUN_ID, {
      stepIndex: 2,
      agentRole: 'researcher',
      actionType: 'market_analysis',
      modelUsed: 'anthropic/claude-3-5-sonnet',
      promptTokens: 4000,
      completionTokens: 800,
      stepCostUSD: 0.0240,
      durationMs: 650,
      approvalStatus: 'auto_approved',
      timestamp: new Date().toISOString()
    })

    const replay = await sessionReplayService.getReplay(RUN_ID, TENANT_ID)
    if (!replay) {
      throw new Error('Failed to retrieve session replay for cost verification')
    }

    const { costSummary } = replay
    if (costSummary.totalTokens !== 8300) {
      throw new Error(`Expected total tokens 8300, got ${costSummary.totalTokens}`)
    }
    if (Math.abs(costSummary.totalSessionCostUSD - 0.0365) > 0.0001) {
      throw new Error(`Expected session cost $0.0365, got $${costSummary.totalSessionCostUSD}`)
    }
    if (costSummary.modelItemizedCosts.length !== 2) {
      throw new Error(`Expected 2 model cost items, got ${costSummary.modelItemizedCosts.length}`)
    }
    if (typeof costSummary.cumulativeTeamSpendUSD !== 'number') {
      throw new Error('Cumulative team spend is missing from replay summary')
    }
  })

  // ── TEST 4: Shareable Links Lifecycle & Strict Privacy Model ──
  await test('Item 4: Shareable links are private by default, revocable, and scrub PII/secrets for public viewers', async () => {
    const RUN_ID = `run_share_test_${Date.now()}`

    // 1. Initial replay is private by default
    sessionReplayService.recordReplayStep(RUN_ID, {
      stepIndex: 1,
      agentRole: 'developer',
      actionType: 'api_integration',
      toolName: 'api_caller',
      toolInput: {
        url: 'https://api.stripe.com/v1/customers',
        contactEmail: 'client-ceo@acmecorp.com',
        apiKey: 'sk-live-51a89c72d9e1f9a2b0c3d4e5f6a7b8c9'
      },
      outputSummary: 'Registered customer client-ceo@acmecorp.com with secret token sk-live-51a89c72d9e1f9a2b0c3d4e5f6a7b8c9',
      rationale: 'Created customer billing record.',
      approvalStatus: 'approved_by_user',
      modelUsed: 'openai/gpt-4o',
      promptTokens: 1000,
      completionTokens: 200,
      stepCostUSD: 0.0045,
      durationMs: 380,
      timestamp: new Date().toISOString()
    }, { tenantId: TENANT_ID, teamId: TEAM_ID, missionGoal: 'Setup customer billing' })

    const replayPrivate = await sessionReplayService.getReplay(RUN_ID, TENANT_ID)
    if (replayPrivate?.shareInfo.isShared) {
      throw new Error('CRITICAL PRIVACY VIOLATION: Session replay should be private by default!')
    }

    // 2. Explicitly create share link
    const shareRes = await sessionReplayService.createShareLink(RUN_ID, TENANT_ID, { expiresInDays: 7 })
    if (!shareRes.shareToken || !shareRes.shareUrl.startsWith('/api/public/replays/')) {
      throw new Error(`Invalid share link response: ${JSON.stringify(shareRes)}`)
    }

    // 3. Public unauthenticated request to view shared replay
    const publicReplay = await sessionReplayService.getPublicReplay(shareRes.shareToken)
    if (!publicReplay) {
      throw new Error('Public viewer failed to access shared replay')
    }

    // 4. Verify strict PII & token redaction
    const rawPublicJson = JSON.stringify(publicReplay)
    if (rawPublicJson.includes('client-ceo@acmecorp.com')) {
      throw new Error('CRITICAL SECURITY FAILURE: Sensitive email address was not redacted in public share!')
    }
    if (rawPublicJson.includes('sk-live-51a89c72d9e1f9a2b0c3d4e5f6a7b8c9')) {
      throw new Error('CRITICAL SECURITY FAILURE: Sensitive API token was not redacted in public share!')
    }
    if (!rawPublicJson.includes('[REDACTED_EMAIL]') || !rawPublicJson.includes('[REDACTED_TOKEN]')) {
      throw new Error('Expected redaction placeholders in public replay output')
    }

    // 5. Revoke share link
    const revoked = await sessionReplayService.revokeShareLink(RUN_ID, TENANT_ID)
    if (!revoked) {
      throw new Error('Failed to revoke share link')
    }

    // 6. Verify public access is now blocked
    let accessBlocked = false
    try {
      const replayAfterRevoke = await sessionReplayService.getPublicReplay(shareRes.shareToken)
      if (!replayAfterRevoke) accessBlocked = true
    } catch {
      accessBlocked = true
    }

    if (!accessBlocked) {
      throw new Error('Public access was NOT blocked after share link revocation!')
    }
  })

  console.log(`\n=============================================`)
  console.log(`Cross-Session Memory & Replay Results: ${passed}/${total} Passed (${Math.round(passed/total * 100)}%)`)
  console.log(`=============================================\n`)

  if (passed !== total) {
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
