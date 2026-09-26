import { permissionSystemService, StandingRule } from '../services/permission-system.service'
import { agentGovernanceService } from '../services/agent-governance.service'

async function runTests() {
  console.log('🛡️ Starting Granular Incremental Trust & Standing Rules Permission Test Suite...\n')

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

  const TENANT_ID = 'tenant-perm-test-101'
  const TEAM_ID = 'team-eng-101'

  // ── TEST 1: Granular Tool Category & Path Scope Evaluation ──
  await test('Item 1: Granular evaluation categorizes tools and matches path glob scopes', () => {
    // Read actions are auto-approved by default in act_with_approval
    const readEval = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      agentRole: 'developer',
      toolName: 'file_read',
      targetPath: 'src/components/Header.tsx',
      autonomyLevel: 'act_with_approval'
    })
    if (!readEval.allowed || readEval.requiresApproval) {
      throw new Error(`Expected read tool to be auto-approved, got allowed=${readEval.allowed}`)
    }

    // Write action without standing rule requires approval
    const writeEval = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      agentRole: 'developer',
      toolName: 'apply_file_diff',
      targetPath: 'src/components/Header.tsx',
      autonomyLevel: 'act_with_approval'
    })
    if (writeEval.allowed || !writeEval.requiresApproval) {
      throw new Error(`Expected write tool without standing rule to require approval`)
    }

    // Scope matcher tests
    if (!permissionSystemService.matchScope('src/components/**', 'src/components/ui/Button.tsx')) {
      throw new Error('Glob directory match failed for src/components/**')
    }
    if (permissionSystemService.matchScope('src/components/**', 'src/services/auth.service.ts')) {
      throw new Error('Glob directory should have rejected non-matching path')
    }
    if (!permissionSystemService.matchScope('*.json', 'package.json')) {
      throw new Error('Extension match failed for *.json')
    }
  })

  // ── TEST 2: "Remember this decision" Standing Rules Lifecycle ──
  await test('Item 2: Standing rules auto-approve scoped actions and revert upon revocation', () => {
    // 1. Create a standing rule for developer role writing to src/components/**
    const rule = permissionSystemService.createStandingRule({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      agentRole: 'developer',
      toolCategory: 'file_write',
      scopePattern: 'src/components/**',
      action: 'allow',
      createdBy: 'user_approved',
      rationale: 'User clicked "remember this decision" on Header.tsx edit'
    })

    if (!rule.id.startsWith('rule_')) {
      throw new Error(`Invalid rule ID generated: ${rule.id}`)
    }

    // 2. Evaluate write to src/components/Header.tsx -> should now be auto-approved
    const evalAllowed = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      agentRole: 'developer',
      toolName: 'apply_file_diff',
      targetPath: 'src/components/Header.tsx',
      autonomyLevel: 'act_with_approval'
    })

    if (!evalAllowed.allowed || evalAllowed.requiresApproval || evalAllowed.matchedRuleId !== rule.id) {
      throw new Error(`Expected auto-approval via standing rule ${rule.id}, got ${JSON.stringify(evalAllowed)}`)
    }

    // 3. Write outside scope (e.g. src/db/schema.ts) -> should still require approval
    const evalOutsideScope = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      agentRole: 'developer',
      toolName: 'apply_file_diff',
      targetPath: 'src/db/schema.ts',
      autonomyLevel: 'act_with_approval'
    })

    if (evalOutsideScope.allowed || !evalOutsideScope.requiresApproval) {
      throw new Error(`Action outside standing rule scope should still require approval`)
    }

    // 4. Revoke the rule and verify action immediately reverts to requiring approval
    const revoked = permissionSystemService.revokeStandingRule(TENANT_ID, rule.id)
    if (!revoked) {
      throw new Error('Failed to revoke standing rule')
    }

    const evalAfterRevocation = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      agentRole: 'developer',
      toolName: 'apply_file_diff',
      targetPath: 'src/components/Header.tsx',
      autonomyLevel: 'act_with_approval'
    })

    if (evalAfterRevocation.allowed || !evalAfterRevocation.requiresApproval) {
      throw new Error('Action should require approval immediately after rule revocation')
    }
  })

  // ── TEST 3: Per-Agent Trust Signal Tracking & Suggested Promotions ──
  await test('Item 3: Incremental trust tracking suggests promotions at milestones without silent expansion', () => {
    const AGENT_ROLE = 'writer'
    const SCOPE = 'docs/**'
    const CATEGORY = 'file_write'

    // 1. Record 9 clean approvals (under threshold of 10)
    for (let i = 0; i < 9; i++) {
      const res = permissionSystemService.recordApprovalDecision({
        tenantId: TENANT_ID,
        agentRole: AGENT_ROLE,
        toolCategory: CATEGORY,
        scopePattern: SCOPE,
        outcome: 'approved_unmodified'
      })
      if (res.promotionTriggered) {
        throw new Error('Promotion should not trigger before milestone of 10')
      }
    }

    // 2. Record 10th clean approval -> triggers suggested promotion proposal
    const res10 = permissionSystemService.recordApprovalDecision({
      tenantId: TENANT_ID,
      agentRole: AGENT_ROLE,
      toolCategory: CATEGORY,
      scopePattern: SCOPE,
      outcome: 'approved_unmodified'
    })

    if (!res10.promotionTriggered) {
      throw new Error('Expected 10th consecutive approval to trigger suggested promotion')
    }
    const promotion = res10.promotionTriggered
    if (promotion.status !== 'pending' || promotion.consecutiveApprovals !== 10) {
      throw new Error(`Unexpected promotion state: ${JSON.stringify(promotion)}`)
    }

    // 3. Verify that the agent is NOT auto-approved yet (ZERO SILENT EXPANSION INVARIANT)
    const evalBeforeAccept = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      agentRole: AGENT_ROLE,
      toolName: 'apply_file_diff',
      targetPath: 'docs/README.md',
      autonomyLevel: 'act_with_approval'
    })
    if (evalBeforeAccept.allowed) {
      throw new Error('CRITICAL INVARIANT VIOLATION: Suggested promotion was auto-applied without user confirmation!')
    }

    // 4. User explicitly accepts the promotion
    const accepted = permissionSystemService.acceptSuggestedPromotion(TENANT_ID, promotion.id)
    if (!accepted || accepted.promotion.status !== 'accepted' || !accepted.standingRule) {
      throw new Error('Failed to accept suggested promotion')
    }

    // 5. Verify agent is now auto-approved under docs/**
    const evalAfterAccept = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      agentRole: AGENT_ROLE,
      toolName: 'apply_file_diff',
      targetPath: 'docs/README.md',
      autonomyLevel: 'act_with_approval'
    })
    if (!evalAfterAccept.allowed || evalAfterAccept.requiresApproval) {
      throw new Error('Expected action to be auto-approved after explicit promotion acceptance')
    }

    // 6. Test modification penalty: user modifies proposal -> resets consecutive counter
    const modifiedRes = permissionSystemService.recordApprovalDecision({
      tenantId: TENANT_ID,
      agentRole: AGENT_ROLE,
      toolCategory: CATEGORY,
      scopePattern: SCOPE,
      outcome: 'approved_with_modification'
    })
    if (modifiedRes.trustRecord.consecutiveApprovals !== 0) {
      throw new Error(`Expected consecutive count to reset to 0 upon modification, got ${modifiedRes.trustRecord.consecutiveApprovals}`)
    }
  })

  // ── TEST 4: Absolute Destructive Danger-Pattern Invariant ──
  await test('Item 4: Destructive actions ALWAYS require approval regardless of standing rules or 100% trust', () => {
    // 1. Create a blanket wildcard allow rule
    const wildcardRule = permissionSystemService.createStandingRule({
      tenantId: TENANT_ID,
      agentRole: '*',
      toolCategory: '*',
      scopePattern: '*',
      action: 'allow',
      createdBy: 'admin',
      rationale: 'Wildcard blanket rule testing'
    })

    // 2. Test dangerous shell command: rm -rf /
    const rmRfEval = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      agentRole: 'developer',
      toolName: 'shell_exec',
      payload: { command: 'rm -rf /var/data' },
      autonomyLevel: 'act_with_approval'
    })
    if (rmRfEval.allowed || !rmRfEval.requiresApproval || !rmRfEval.isDestructive) {
      throw new Error('CRITICAL SAFETY FAILURE: rm -rf bypassed danger invariant!')
    }

    // 3. Test destructive SQL command: DROP TABLE users
    const dropTableEval = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      agentRole: 'developer',
      toolName: 'code_executor',
      payload: { query: 'DROP TABLE tenants CASCADE;' },
      autonomyLevel: 'act_with_approval'
    })
    if (dropTableEval.allowed || !dropTableEval.requiresApproval || !dropTableEval.isDestructive) {
      throw new Error('CRITICAL SAFETY FAILURE: drop table bypassed danger invariant!')
    }

    // 4. Test git force push
    const gitForceEval = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      agentRole: 'developer',
      toolName: 'shell_exec',
      payload: { command: 'git push origin main --force' },
      autonomyLevel: 'act_with_approval'
    })
    if (gitForceEval.allowed || !gitForceEval.requiresApproval || !gitForceEval.isDestructive) {
      throw new Error('CRITICAL SAFETY FAILURE: git push --force bypassed danger invariant!')
    }

    // 5. Test explicit file delete tool
    const deleteFileEval = permissionSystemService.evaluatePermission({
      tenantId: TENANT_ID,
      agentRole: 'developer',
      toolName: 'delete_file',
      targetPath: 'src/index.ts',
      autonomyLevel: 'act_with_approval'
    })
    if (deleteFileEval.allowed || !deleteFileEval.requiresApproval || !deleteFileEval.isDestructive) {
      throw new Error('CRITICAL SAFETY FAILURE: delete_file bypassed danger invariant!')
    }

    // Clean up wildcard rule
    permissionSystemService.revokeStandingRule(TENANT_ID, wildcardRule.id)
  })

  // ── TEST 5: Transparent Auto-Approval Surface Summary ──
  await test('Item 5: Surface log renders clear at-a-glance matrix of auto-approved vs. prompted scopes', () => {
    // Create specific standing rule
    permissionSystemService.createStandingRule({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      agentRole: 'copywriter',
      toolCategory: 'file_write',
      scopePattern: 'marketing/copy/**',
      action: 'allow',
      createdBy: 'user_approved',
      rationale: 'Copywriting content editing'
    })

    const surface = permissionSystemService.getAutoApprovalSurface(TENANT_ID, TEAM_ID)

    if (surface.tenantId !== TENANT_ID) {
      throw new Error(`Tenant mismatch on surface summary: ${surface.tenantId}`)
    }
    if (surface.autoApprovedScopes.length === 0) {
      throw new Error('Auto-approved scopes list is empty')
    }
    if (surface.alwaysPromptedScopes.length === 0) {
      throw new Error('Always-prompted scopes list is empty')
    }
    if (surface.nonBypassableDangerPatterns.length === 0) {
      throw new Error('Danger patterns list is empty')
    }

    const copyRule = surface.autoApprovedScopes.find(s => s.scopePattern === 'marketing/copy/**')
    if (!copyRule) {
      throw new Error('Failed to locate marketing/copy/** standing rule on surface log')
    }
  })

  console.log(`\n=============================================`)
  console.log(`Permission & Trust System Results: ${passed}/${total} Passed (${Math.round(passed/total * 100)}%)`)
  console.log(`=============================================\n`)

  if (passed !== total) {
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
