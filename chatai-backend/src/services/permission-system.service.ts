import { logger } from './logger.service'
import crypto from 'crypto'

export type ToolCategory = 'file_read' | 'file_write' | 'shell_exec' | 'external_api' | 'destructive' | '*'

export interface StandingRule {
  id: string
  tenantId: string
  teamId?: string
  agentRole?: string
  toolCategory: ToolCategory
  toolName?: string
  scopePattern: string // e.g. "src/components/**", "docs/*", "*.json", "*"
  action: 'allow' | 'deny'
  createdAt: string
  expiresAt?: string
  maxUses?: number
  useCount: number
  createdBy: 'user_approved' | 'trust_promotion' | 'admin'
  rationale?: string
}

export interface AgentTrustRecord {
  tenantId: string
  agentRole: string
  teamId?: string
  scopePattern: string
  toolCategory: ToolCategory
  consecutiveApprovals: number
  totalApprovals: number
  totalRejections: number
  totalModifications: number
  trustScore: number // 0.0 to 1.0
  lastEvaluationAt: string
}

export interface SuggestedPromotion {
  id: string
  tenantId: string
  agentRole: string
  teamId?: string
  toolCategory: ToolCategory
  scopePattern: string
  consecutiveApprovals: number
  reason: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

export interface PermissionEvaluationResult {
  allowed: boolean
  requiresApproval: boolean
  isDestructive: boolean
  matchedRuleId?: string
  decisionCode: 
    | 'auto_approved_by_standing_rule'
    | 'auto_approved_read_only'
    | 'auto_approved_fully_autonomous'
    | 'prompted_destructive_danger_pattern'
    | 'prompted_unmatched_scope'
    | 'prompted_observe_only_mode'
    | 'prompted_suggest_only_mode'
    | 'blocked_by_deny_rule'
  reason: string
}

export interface AutoApprovalSurface {
  tenantId: string
  teamId?: string
  summary: {
    totalStandingRules: number
    activePromotionsCount: number
    trustedAgentScopesCount: number
  }
  autoApprovedScopes: Array<{
    toolCategory: ToolCategory
    scopePattern: string
    agentRole?: string
    ruleId: string
    source: string
    useCount: number
  }>
  alwaysPromptedScopes: Array<{
    categoryOrAction: string
    reason: string
    bypassable: boolean
  }>
  nonBypassableDangerPatterns: string[]
  standingRules: StandingRule[]
  trustRecords: AgentTrustRecord[]
  pendingPromotions: SuggestedPromotion[]
}

export class PermissionSystemService {
  private standingRules: Map<string, StandingRule> = new Map()
  private trustRecords: Map<string, AgentTrustRecord> = new Map()
  private suggestedPromotions: Map<string, SuggestedPromotion> = new Map()

  // 1. Tool Category Mapping
  private readonly TOOL_CATEGORY_MAP: Record<string, ToolCategory> = {
    // Read tools
    file_read: 'file_read',
    read_file: 'file_read',
    semantic_code_search: 'file_read',
    query_memory: 'file_read',
    query_team_memory: 'file_read',
    inspect_runtime_metrics: 'file_read',
    inspect_metrics: 'file_read',
    web_search: 'file_read',
    fetch_page_content: 'file_read',
    extract_citations: 'file_read',
    scraper: 'file_read',
    grammar_check: 'file_read',
    sentiment_check: 'file_read',
    seo_keyword_density: 'file_read',

    // Write tools
    file_write: 'file_write',
    write_file: 'file_write',
    apply_file_diff: 'file_write',
    apply_diff: 'file_write',
    file_processor: 'file_write',

    // Shell & Execution
    shell_exec: 'shell_exec',
    execute_sandbox_code: 'shell_exec',
    terminal_exec: 'shell_exec',
    code_executor: 'shell_exec',
    execute_python: 'shell_exec',

    // External API & Network
    api_caller: 'external_api',
    send_email: 'external_api',
    stripe_api: 'external_api',
    publish_campaign: 'external_api',
    browser: 'external_api',

    // Destructive Actions (Absolute Human Invariant)
    file_delete: 'destructive',
    delete_file: 'destructive',
    rm_rf: 'destructive',
    delete_database: 'destructive',
    drop_table: 'destructive',
    truncate_table: 'destructive',
    git_force_push: 'destructive',
    git_reset_hard: 'destructive'
  }

  // 2. Absolute Danger Patterns (Can NEVER be blanket-approved by standing rules)
  public readonly DANGER_PATTERNS: RegExp[] = [
    /\brm\s+-(?:r|f|rf|fr)\b/i,
    /\bdel\s+(?:\/s|\/q|\/f)\b/i,
    /\b(drop\s+table|drop\s+database|truncate\s+table)\b/i,
    /\bgit\s+push\s+.*(?:--force|-f)\b/i,
    /\bgit\s+reset\s+--hard\b/i,
    /\b(mkfs|format\s+[a-z]:)\b/i,
    /\bchmod\s+(?:-R\s+)?777\b/i,
    /\bdelete_database\b/i,
    /\bdelete_file\b|\bfile_delete\b|\brm_rf\b/i
  ]

  /**
   * Categorizes a tool into a permission bucket
   */
  public getToolCategory(toolName: string, payload?: any): ToolCategory {
    const normalized = (toolName || '').toLowerCase().trim()
    
    // Check if destructive payload
    if (this.isDestructiveAction(toolName, payload)) {
      return 'destructive'
    }

    if (this.TOOL_CATEGORY_MAP[normalized]) {
      return this.TOOL_CATEGORY_MAP[normalized]
    }

    if (normalized.includes('delete') || normalized.includes('drop') || normalized.includes('destroy')) {
      return 'destructive'
    }
    if (normalized.includes('read') || normalized.includes('search') || normalized.includes('query') || normalized.includes('fetch')) {
      return 'file_read'
    }
    if (normalized.includes('write') || normalized.includes('edit') || normalized.includes('diff') || normalized.includes('patch')) {
      return 'file_write'
    }
    if (normalized.includes('exec') || normalized.includes('run') || normalized.includes('terminal')) {
      return 'shell_exec'
    }
    if (normalized.includes('api') || normalized.includes('email') || normalized.includes('http') || normalized.includes('webhook')) {
      return 'external_api'
    }

    return 'shell_exec'
  }

  /**
   * Evaluates whether an action or its payload matches any non-bypassable danger pattern
   */
  public isDestructiveAction(toolName: string, payload?: any): boolean {
    const normalized = (toolName || '').toLowerCase().trim()
    if (this.DANGER_PATTERNS.some(rx => rx.test(normalized))) {
      return true
    }

    if (payload) {
      const inspectString = typeof payload === 'string' ? payload : JSON.stringify(payload)
      if (this.DANGER_PATTERNS.some(rx => rx.test(inspectString))) {
        return true
      }
    }

    return false
  }

  /**
   * Matches a target path or scope string against a glob pattern
   */
  public matchScope(pattern: string, targetPath?: string): boolean {
    if (!pattern || pattern === '*' || pattern === '**') return true
    if (!targetPath) return false

    const normalizedTarget = targetPath.replace(/\\/g, '/').toLowerCase()
    const normalizedPattern = pattern.replace(/\\/g, '/').toLowerCase()

    if (normalizedPattern === normalizedTarget) return true

    // Wildcard directory pattern e.g. "src/components/**" or "docs/*"
    if (normalizedPattern.endsWith('/**')) {
      const prefix = normalizedPattern.slice(0, -3)
      return normalizedTarget.startsWith(prefix)
    }
    if (normalizedPattern.endsWith('/*')) {
      const prefix = normalizedPattern.slice(0, -2)
      return normalizedTarget.startsWith(prefix)
    }

    // Extension pattern e.g. "*.ts" or "**/*.json"
    if (normalizedPattern.startsWith('*.')) {
      const ext = normalizedPattern.slice(1)
      return normalizedTarget.endsWith(ext)
    }
    if (normalizedPattern.startsWith('**/*.')) {
      const ext = normalizedPattern.slice(4)
      return normalizedTarget.endsWith(ext)
    }

    return normalizedTarget.includes(normalizedPattern)
  }

  /**
   * Main evaluation gate: checks danger invariants, standing rules, and autonomy policies
   */
  public evaluatePermission(params: {
    tenantId: string
    teamId?: string
    agentRole?: string
    toolName: string
    targetPath?: string
    payload?: any
    autonomyLevel?: 'observe_only' | 'suggest_only' | 'act_with_approval' | 'fully_autonomous' | string
  }): PermissionEvaluationResult {
    const { tenantId, teamId, agentRole = 'agent', toolName, targetPath, payload, autonomyLevel = 'act_with_approval' } = params
    const category = this.getToolCategory(toolName, payload)
    const isDestructive = this.isDestructiveAction(toolName, payload)

    // ── INVARIANT 1: Destructive Danger Patterns NEVER Auto-Approve ──
    if (isDestructive || category === 'destructive') {
      return {
        allowed: false,
        requiresApproval: true,
        isDestructive: true,
        decisionCode: 'prompted_destructive_danger_pattern',
        reason: `Destructive Safety Guard: Action '${toolName}' matches a non-bypassable danger pattern and requires explicit human confirmation.`
      }
    }

    // ── INVARIANT 2: Check Active Standing Rules ("Remember this decision") ──
    const matchingRules = this.findMatchingStandingRules(tenantId, {
      teamId,
      agentRole,
      toolCategory: category,
      toolName,
      targetPath
    })

    // Check deny rules first
    const denyRule = matchingRules.find(r => r.action === 'deny')
    if (denyRule) {
      return {
        allowed: false,
        requiresApproval: false,
        isDestructive: false,
        matchedRuleId: denyRule.id,
        decisionCode: 'blocked_by_deny_rule',
        reason: `Access Denied: Blocked by standing rule '${denyRule.id}' on scope '${denyRule.scopePattern}'.`
      }
    }

    // Check allow rules
    const allowRule = matchingRules.find(r => r.action === 'allow')
    if (allowRule) {
      allowRule.useCount += 1
      return {
        allowed: true,
        requiresApproval: false,
        isDestructive: false,
        matchedRuleId: allowRule.id,
        decisionCode: 'auto_approved_by_standing_rule',
        reason: `Auto-Approved: Matched active standing rule '${allowRule.id}' for scope '${allowRule.scopePattern}'.`
      }
    }

    // ── INVARIANT 3: Autonomy Level Base Policy Evaluation ──
    const level = (autonomyLevel || 'act_with_approval').toLowerCase()

    if (level === 'observe_only') {
      if (category === 'file_read') {
        return {
          allowed: true,
          requiresApproval: false,
          isDestructive: false,
          decisionCode: 'auto_approved_read_only',
          reason: `Auto-Approved: Read-only action under observe_only mode.`
        }
      }
      return {
        allowed: false,
        requiresApproval: true,
        isDestructive: false,
        decisionCode: 'prompted_observe_only_mode',
        reason: `Autonomy Gate: Role '${agentRole}' is in 'observe_only' mode. Action '${toolName}' held for user confirmation.`
      }
    }

    if (level === 'suggest_only') {
      if (category === 'file_read') {
        return {
          allowed: true,
          requiresApproval: false,
          isDestructive: false,
          decisionCode: 'auto_approved_read_only',
          reason: `Auto-Approved: Read-only query allowed under suggest_only mode.`
        }
      }
      return {
        allowed: false,
        requiresApproval: true,
        isDestructive: false,
        decisionCode: 'prompted_suggest_only_mode',
        reason: `Autonomy Gate: Role '${agentRole}' is in 'suggest_only' mode. Action '${toolName}' proposed as suggestion awaiting approval.`
      }
    }

    if (level === 'fully_autonomous') {
      return {
        allowed: true,
        requiresApproval: false,
        isDestructive: false,
        decisionCode: 'auto_approved_fully_autonomous',
        reason: `Auto-Approved: Action permitted under fully_autonomous mode.`
      }
    }

    // Default 'act_with_approval': read actions are auto-approved; mutating actions require approval
    if (category === 'file_read') {
      return {
        allowed: true,
        requiresApproval: false,
        isDestructive: false,
        decisionCode: 'auto_approved_read_only',
        reason: `Auto-Approved: Routine read action permitted.`
      }
    }

    return {
      allowed: false,
      requiresApproval: true,
      isDestructive: false,
      decisionCode: 'prompted_unmatched_scope',
      reason: `Approval Required: Action '${toolName}' on '${targetPath || 'workspace'}' has no standing rule in effect.`
    }
  }

  /**
   * Searches for standing rules matching the current execution context
   */
  public findMatchingStandingRules(tenantId: string, criteria: {
    teamId?: string
    agentRole?: string
    toolCategory: ToolCategory
    toolName?: string
    targetPath?: string
  }): StandingRule[] {
    const now = new Date()
    const results: StandingRule[] = []

    for (const rule of this.standingRules.values()) {
      if (rule.tenantId !== tenantId) continue

      // Check expiration
      if (rule.expiresAt && new Date(rule.expiresAt) < now) continue

      // Check max uses
      if (rule.maxUses && rule.useCount >= rule.maxUses) continue

      // Check team match
      if (rule.teamId && criteria.teamId && rule.teamId !== criteria.teamId) continue

      // Check role match
      if (rule.agentRole && rule.agentRole !== '*' && criteria.agentRole && rule.agentRole !== criteria.agentRole) continue

      // Check tool category / name match
      if (rule.toolCategory !== '*' && rule.toolCategory !== criteria.toolCategory) continue
      if (rule.toolName && criteria.toolName && rule.toolName !== criteria.toolName) continue

      // Check scope path match
      if (!this.matchScope(rule.scopePattern, criteria.targetPath)) continue

      results.push(rule)
    }

    return results
  }

  /**
   * Creates a standing rule (via "Remember this decision", admin config, or promotion acceptance)
   */
  public createStandingRule(ruleData: Omit<StandingRule, 'id' | 'createdAt' | 'useCount'>): StandingRule {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const rule: StandingRule = {
      id,
      ...ruleData,
      createdAt: new Date().toISOString(),
      useCount: 0
    }
    this.standingRules.set(id, rule)
    logger.info(`[PermissionSystem] Created standing rule '${id}' for tenant '${rule.tenantId}' (scope: ${rule.scopePattern}, category: ${rule.toolCategory})`)
    return rule
  }

  /**
   * Lists active standing rules for a tenant
   */
  public listStandingRules(tenantId: string, filters?: { teamId?: string; role?: string; category?: ToolCategory }): StandingRule[] {
    const rules: StandingRule[] = []
    const now = new Date()

    for (const rule of this.standingRules.values()) {
      if (rule.tenantId !== tenantId) continue
      if (rule.expiresAt && new Date(rule.expiresAt) < now) continue
      if (rule.maxUses && rule.useCount >= rule.maxUses) continue
      if (filters?.teamId && rule.teamId && rule.teamId !== filters.teamId) continue
      if (filters?.role && rule.agentRole && rule.agentRole !== '*' && rule.agentRole !== filters.role) continue
      if (filters?.category && rule.toolCategory !== '*' && rule.toolCategory !== filters.category) continue
      rules.push(rule)
    }

    return rules
  }

  /**
   * Updates an existing standing rule
   */
  public updateStandingRule(tenantId: string, ruleId: string, updates: Partial<StandingRule>): StandingRule | null {
    const rule = this.standingRules.get(ruleId)
    if (!rule || rule.tenantId !== tenantId) return null

    Object.assign(rule, updates)
    return rule
  }

  /**
   * Revokes / deletes a standing rule
   */
  public revokeStandingRule(tenantId: string, ruleId: string): boolean {
    const rule = this.standingRules.get(ruleId)
    if (!rule || rule.tenantId !== tenantId) return false

    this.standingRules.delete(ruleId)
    logger.info(`[PermissionSystem] Revoked standing rule '${ruleId}' for tenant '${tenantId}'`)
    return true
  }

  /**
   * Records user feedback on a proposal to update the agent's trust score and evaluate promotions
   */
  public recordApprovalDecision(params: {
    tenantId: string
    agentRole: string
    teamId?: string
    toolCategory: ToolCategory
    scopePattern: string
    outcome: 'approved_unmodified' | 'approved_with_modification' | 'rejected'
  }): { trustRecord: AgentTrustRecord; promotionTriggered?: SuggestedPromotion } {
    const { tenantId, agentRole, teamId, toolCategory, scopePattern, outcome } = params
    const trustKey = `${tenantId}:${teamId || 'global'}:${agentRole}:${toolCategory}:${scopePattern}`

    let record = this.trustRecords.get(trustKey)
    if (!record) {
      record = {
        tenantId,
        agentRole,
        teamId,
        scopePattern,
        toolCategory,
        consecutiveApprovals: 0,
        totalApprovals: 0,
        totalRejections: 0,
        totalModifications: 0,
        trustScore: 0.5,
        lastEvaluationAt: new Date().toISOString()
      }
      this.trustRecords.set(trustKey, record)
    }

    record.lastEvaluationAt = new Date().toISOString()

    if (outcome === 'approved_unmodified') {
      record.consecutiveApprovals += 1
      record.totalApprovals += 1
    } else if (outcome === 'approved_with_modification') {
      record.consecutiveApprovals = 0 // Reset consecutive count on modifications
      record.totalApprovals += 1
      record.totalModifications += 1
    } else if (outcome === 'rejected') {
      record.consecutiveApprovals = 0 // Reset consecutive count on rejections
      record.totalRejections += 1
    }

    // Compute trust score: weighted ratio of clean approvals vs modifications and rejections
    const totalDecisions = record.totalApprovals + record.totalRejections + record.totalModifications
    if (totalDecisions > 0) {
      const cleanWeight = record.totalApprovals - record.totalModifications
      const penaltyWeight = (record.totalRejections * 3) + record.totalModifications
      record.trustScore = Math.max(0.0, Math.min(1.0, (cleanWeight / (cleanWeight + penaltyWeight + 1))))
    }

    // Check if consecutive clean approvals earned a suggested promotion milestone (e.g. 10, 25, 50)
    let promotionTriggered: SuggestedPromotion | undefined
    const PROMOTION_MILESTONES = [10, 25, 50]

    if (PROMOTION_MILESTONES.includes(record.consecutiveApprovals)) {
      const existingPending = Array.from(this.suggestedPromotions.values()).find(p => 
        p.tenantId === tenantId && 
        p.agentRole === agentRole && 
        p.toolCategory === toolCategory && 
        p.scopePattern === scopePattern && 
        p.status === 'pending'
      )

      if (!existingPending) {
        const promotionId = `prom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        promotionTriggered = {
          id: promotionId,
          tenantId,
          agentRole,
          teamId,
          toolCategory,
          scopePattern,
          consecutiveApprovals: record.consecutiveApprovals,
          reason: `Agent '${agentRole}' has achieved ${record.consecutiveApprovals} consecutive clean approvals in scope '${scopePattern}'. Suggested: Auto-approve ${toolCategory} in '${scopePattern}'.`,
          status: 'pending',
          createdAt: new Date().toISOString()
        }
        this.suggestedPromotions.set(promotionId, promotionTriggered)
        logger.info(`[PermissionSystem] Generated Suggested Promotion '${promotionId}' for agent '${agentRole}'`)
      }
    }

    return { trustRecord: record, promotionTriggered }
  }

  /**
   * Lists suggested promotions awaiting user decision
   */
  public listSuggestedPromotions(tenantId: string, status?: 'pending' | 'accepted' | 'rejected'): SuggestedPromotion[] {
    const list: SuggestedPromotion[] = []
    for (const p of this.suggestedPromotions.values()) {
      if (p.tenantId !== tenantId) continue
      if (status && p.status !== status) continue
      list.push(p)
    }
    return list
  }

  /**
   * User explicitly accepts a suggested promotion -> creates a standing rule
   */
  public acceptSuggestedPromotion(tenantId: string, promotionId: string): { promotion: SuggestedPromotion; standingRule: StandingRule } | null {
    const promotion = this.suggestedPromotions.get(promotionId)
    if (!promotion || promotion.tenantId !== tenantId) return null

    promotion.status = 'accepted'

    const standingRule = this.createStandingRule({
      tenantId: promotion.tenantId,
      teamId: promotion.teamId,
      agentRole: promotion.agentRole,
      toolCategory: promotion.toolCategory,
      scopePattern: promotion.scopePattern,
      action: 'allow',
      createdBy: 'trust_promotion',
      rationale: `Earned via ${promotion.consecutiveApprovals} consecutive verified approvals without modifications.`
    })

    return { promotion, standingRule }
  }

  /**
   * User rejects a suggested promotion -> resets consecutive counter
   */
  public rejectSuggestedPromotion(tenantId: string, promotionId: string): SuggestedPromotion | null {
    const promotion = this.suggestedPromotions.get(promotionId)
    if (!promotion || promotion.tenantId !== tenantId) return null

    promotion.status = 'rejected'

    // Reset trust record's consecutive counter
    const trustKey = `${tenantId}:${promotion.teamId || 'global'}:${promotion.agentRole}:${promotion.toolCategory}:${promotion.scopePattern}`
    const record = this.trustRecords.get(trustKey)
    if (record) {
      record.consecutiveApprovals = 0
    }

    return promotion
  }

  /**
   * Surfaces what is currently auto-approved vs. prompted for transparent user inspection
   */
  public getAutoApprovalSurface(tenantId: string, teamId?: string): AutoApprovalSurface {
    const standingRules = this.listStandingRules(tenantId, { teamId })
    const pendingPromotions = this.listSuggestedPromotions(tenantId, 'pending')
    
    const trustRecords: AgentTrustRecord[] = []
    for (const rec of this.trustRecords.values()) {
      if (rec.tenantId === tenantId && (!teamId || rec.teamId === teamId)) {
        trustRecords.push(rec)
      }
    }

    const autoApprovedScopes = standingRules
      .filter(r => r.action === 'allow')
      .map(r => ({
        toolCategory: r.toolCategory,
        scopePattern: r.scopePattern,
        agentRole: r.agentRole,
        ruleId: r.id,
        source: r.createdBy,
        useCount: r.useCount
      }))

    const alwaysPromptedScopes = [
      {
        categoryOrAction: 'Destructive Actions (rm -rf, drop table, git push --force, file_delete)',
        reason: 'Hard invariant: destructive operations always require explicit confirmation.',
        bypassable: false
      },
      {
        categoryOrAction: 'Unscoped Shell Executions',
        reason: 'Arbitrary terminal commands outside sandbox directories require review.',
        bypassable: true
      },
      {
        categoryOrAction: 'External Live Email & Payment Dispatches',
        reason: 'Real-world customer-facing outbound actions require operator approval.',
        bypassable: true
      }
    ]

    return {
      tenantId,
      teamId,
      summary: {
        totalStandingRules: standingRules.length,
        activePromotionsCount: pendingPromotions.length,
        trustedAgentScopesCount: trustRecords.filter(t => t.trustScore >= 0.8).length
      },
      autoApprovedScopes,
      alwaysPromptedScopes,
      nonBypassableDangerPatterns: this.DANGER_PATTERNS.map(rx => rx.source),
      standingRules,
      trustRecords,
      pendingPromotions
    }
  }
}

export const permissionSystemService = new PermissionSystemService()
