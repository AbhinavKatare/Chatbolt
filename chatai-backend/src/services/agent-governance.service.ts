import { logger } from './logger.service';
import { db } from '../db'
import crypto from 'crypto'
import { AutonomyLevel } from '../config/team-templates.config'

export interface GovernancePolicy {
  can_send_emails: boolean
  can_call_external_api: boolean
  daily_cost_limit: number
  approval_required_above_cost: number
  risk_tolerance_threshold: number
}

class AgentGovernanceService {
  /**
   * Enforces 4-tier org chart autonomy levels at the tool execution boundary:
   * - observe_only: Only read/query tools permitted; all mutating tools rejected.
   * - suggest_only: Formulates recommendations; mutating tools return simulated proposals.
   * - act_with_approval: Routine read/write allowed; high-impact & destructive actions require human approval.
   * - fully_autonomous: Full execution within safety guardrails.  /**
   * Evaluates if a tool invocation is allowed based on the agent's AutonomyLevel matrix
   */
  validateToolExecutionByAutonomy(
    arg1: string | { tenantId?: string; runId?: string; role?: string; toolName?: string; payload?: any; autonomyLevel?: AutonomyLevel | string },
    arg2?: string,
    arg3?: any,
    arg4?: string
  ): { allowed: boolean; reason?: string; requiresApproval?: boolean } {
    let autonomyLevel: string = 'act_with_approval'
    let toolName: string = ''
    let payload: any = {}
    let role: string = 'agent'
    let runId: string | undefined
    let tenantId: string = '00000000-0000-0000-0000-000000000000'
    let targetPath: string | undefined

    if (typeof arg1 === 'string') {
      autonomyLevel = arg1
      toolName = arg2 || ''
      payload = arg3 || {}
      role = arg4 || 'agent'
    } else if (arg1 && typeof arg1 === 'object') {
      autonomyLevel = arg1.autonomyLevel || 'act_with_approval'
      toolName = arg1.toolName || ''
      payload = arg1.payload || {}
      role = arg1.role || 'agent'
      runId = arg1.runId
      tenantId = arg1.tenantId || '00000000-0000-0000-0000-000000000000'
      targetPath = payload?.filePath || payload?.path || payload?.targetPath
    }

    // Check with permission system service (standing rules, granular scopes, danger invariants)
    try {
      const { permissionSystemService } = require('./permission-system.service')
      const permEval = permissionSystemService.evaluatePermission({
        tenantId,
        agentRole: role,
        toolName,
        targetPath,
        payload,
        autonomyLevel
      })

      if (permEval.allowed && !permEval.requiresApproval) {
        return { allowed: true, requiresApproval: false }
      }

      if (permEval.decisionCode === 'blocked_by_deny_rule') {
        return { allowed: false, requiresApproval: false, reason: permEval.reason }
      }

      if (permEval.requiresApproval) {
        const isApproved = payload?.approved === true || payload?.preApproved === true
        if (isApproved) {
          return { allowed: true, requiresApproval: false }
        }
        if (runId) {
          try {
            const { runEmitter } = require('./sse.service')
            runEmitter.emitEvent(runId, 'action:approval_required', {
              toolName,
              role,
              payload,
              isDestructive: permEval.isDestructive,
              message: permEval.reason
            })
          } catch {}
        }
        return {
          allowed: false,
          requiresApproval: true,
          reason: permEval.reason
        }
      }
    } catch {}

    const level = (autonomyLevel || 'act_with_approval').toLowerCase() as AutonomyLevel
    const normalizedTool = (toolName || '').toLowerCase().trim()

    const READ_ONLY_TOOLS = new Set([
      'file_read',
      'read_file',
      'query_team_memory',
      'query_memory',
      'inspect_runtime_metrics',
      'inspect_metrics',
      'web_search',
      'fetch_page_content',
      'extract_citations',
      'grammar_check',
      'sentiment_check',
      'seo_keyword_density',
    ])

    const HIGH_IMPACT_MUTATING_TOOLS = new Set([
      'file_write',
      'write_file',
      'execute_sandbox_code',
      'shell_exec',
      'delete_file',
      'file_delete',
      'git_commit',
      'send_email',
      'publish_live_campaign',
      'spend_ad_budget',
      'restart_production_cluster',
      'delete_database'
    ])

    // 1. Observe-Only Autonomy Gate: Only explicit read-only tools permitted
    if (level === 'observe_only') {
      if (!READ_ONLY_TOOLS.has(normalizedTool)) {
        return {
          allowed: false,
          requiresApproval: true,
          reason: `Autonomy Level Violation: Role '${role}' is set to 'observe_only' and cannot invoke mutating tool '${toolName}'.`
        }
      }
      return { allowed: true }
    }

    // 2. Suggest-Only Autonomy Gate: Allows read tools, blocks mutating actions
    if (level === 'suggest_only') {
      if (HIGH_IMPACT_MUTATING_TOOLS.has(normalizedTool) || !READ_ONLY_TOOLS.has(normalizedTool)) {
        return {
          allowed: false,
          requiresApproval: true,
          reason: `Autonomy Level Notice: Role '${role}' is set to 'suggest_only'. Action '${toolName}' held as a proposed suggestion awaiting approval.`
        }
      }
      return { allowed: true }
    }

    // 3. Act-With-Approval Autonomy Gate
    if (level === 'act_with_approval') {
      const isHighImpact = HIGH_IMPACT_MUTATING_TOOLS.has(normalizedTool) ||
        normalizedTool.includes('delete') ||
        normalizedTool.includes('write') ||
        normalizedTool.includes('exec') ||
        normalizedTool.includes('commit')

      if (isHighImpact) {
        const isApproved = payload?.approved === true || payload?.preApproved === true
        if (!isApproved) {
          if (runId) {
            try {
              const { runEmitter } = require('./sse.service')
              runEmitter.emitEvent(runId, 'action:approval_required', {
                toolName,
                role,
                payload,
                message: `Approval Gate: Action '${toolName}' by '${role}' requires operator approval before execution.`
              })
            } catch {}
          }
          return {
            allowed: false,
            requiresApproval: true,
            reason: `Pre-execution gate blocked tool '${toolName}' for role '${role}': requires operator approval under 'act_with_approval' autonomy level.`
          }
        }
      }
      return { allowed: true, requiresApproval: false }
    }

    // 4. Fully Autonomous Mode
    return { allowed: true, requiresApproval: false }
  }

  /**
   * Asserts if an agent has permission to execute an action
   */
  async verifyAgentPolicy(
    tenantId: string,
    role: string,
    actionType: string
  ): Promise<boolean> {
    try {
      const { rows } = await db.query(
        `SELECT * FROM agent_governance_rules WHERE tenant_id = $1 AND agent_role = $2`,
        [tenantId, role]
      )

      if (rows.length === 0) {
        // Fallback default enterprise safety policies
        if (actionType === 'send_email') return false // restrict outgoing email by default
        return true
      }

      const policy = rows[0] as GovernancePolicy
      if (actionType === 'send_email') return policy.can_send_emails
      if (actionType === 'api_caller') return policy.can_call_external_api
      
      return true
    } catch (err: any) {
      console.error('[Governance] Policy check failure:', err.message)
      return true // fail-safe under fallback conditions
    }
  }

  /**
   * Pre-execution interception gate for destructive and irreversible actions
   * (e.g. file deletion, arbitrary shell/code execution, database mutations).
   * If autonomy level is below 'fully_autonomous', explicit user approval is required BEFORE execution.
   */
  async checkPreExecutionApproval(params: {
    tenantId: string
    runId?: string
    actionType: string
    payload: any
    autonomyLevel?: 'supervised' | 'semi_autonomous' | 'fully_autonomous' | string
  }): Promise<{ allowed: boolean; reason?: string; requiresApproval?: boolean }> {
    const { tenantId, runId, actionType, payload, autonomyLevel = 'supervised' } = params

    const DESTRUCTIVE_ACTIONS = [
      'file_delete',
      'delete_file',
      'shell_exec',
      'code_executor',
      'execute_python',
      'rm_rf',
      'delete_database',
      'drop_table',
      'truncate_table'
    ]

    const isDestructive = DESTRUCTIVE_ACTIONS.some(act => 
      actionType.toLowerCase().includes(act) || 
      (payload?.command && (payload.command.includes('rm ') || payload.command.includes('del ') || payload.command.includes('drop '))) ||
      (payload?.operation && payload.operation.toLowerCase().includes('delete'))
    )

    if (!isDestructive) {
      return { allowed: true }
    }

    // If fully autonomous, allow execution but log cryptographic audit event
    if (autonomyLevel === 'fully_autonomous') {
      if (runId) {
        await this.logCryptographicEvent(tenantId, runId, 'DESTRUCTIVE_ACTION_AUTONOMOUS_EXECUTION', {
          actionType,
          payloadSummary: typeof payload === 'object' ? Object.keys(payload) : 'raw'
        })
      }
      return { allowed: true }
    }

    // Check if explicit approval is present in payload / execution context
    const isExplicitlyApproved = payload?.approved === true || payload?.preApproved === true

    if (isExplicitlyApproved) {
      if (runId) {
        await this.logCryptographicEvent(tenantId, runId, 'DESTRUCTIVE_ACTION_APPROVED_BY_USER', {
          actionType,
          approvedAt: new Date().toISOString()
        })
      }
      return { allowed: true }
    }

    // Block execution and emit approval requirement event
    if (runId) {
      try {
        const { runEmitter } = require('./sse.service')
        runEmitter.emitEvent(runId, 'action:approval_required', {
          actionType,
          payload,
          message: `Approval Gate: Action "${actionType}" requires explicit confirmation before running.`
        })
      } catch {}
    }

    return {
      allowed: false,
      requiresApproval: true,
      reason: `Pre-execution gate blocked action "${actionType}": requires explicit user confirmation under ${autonomyLevel} autonomy mode.`
    }
  }


  /**
   * Evaluates the safety risk score of an agent action (0.0 to 1.0)
   */
  async assessWorkflowRisk(runId: string, agentName: string, toolsNeeded: string[]): Promise<number> {
    let riskScore = 0.1 // Base risk index
    
    if (toolsNeeded.includes('send_email')) riskScore += 0.4
    if (toolsNeeded.includes('api_caller')) riskScore += 0.3
    if (toolsNeeded.includes('code_executor')) riskScore += 0.2
    
    logger.info(`[Governance] Assessed risk score for "${agentName}": ${riskScore.toFixed(2)}`)
    return Math.min(1.0, riskScore)
  }

  /**
   * Writes a persistent audit record to the database
   */
  async logAuditRecord(
    tenantId: string,
    agentId: string,
    action: string,
    details: string
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO memory_agent_actions (tenant_id, agent_id, action_type, details)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, agentId, action, details]
      ).catch(() => {
        // Fallback to memory graph general entities table if memory_agent_actions isn't fully migrated yet
        db.query(
          `INSERT INTO memory_entities (tenant_id, entity_type, name, description)
           VALUES ($1, 'Task', $2, $3)`,
          [tenantId, `Agent Action: ${action}`, details]
        )
      })

      // Also chain cryptographically in Phase 2
      await this.logCryptographicEvent(tenantId, null, action, { agent_id: agentId, details })
    } catch (err: any) {
      console.error('[Governance] Failed to log audit record:', err.message)
    }
  }

  /**
   * Logs a cryptographically chained event for SOC2 verification
   */
  async logCryptographicEvent(
    tenantId: string,
    runId: string | null,
    eventType: string,
    payload: Record<string, any>,
    client?: any
  ): Promise<string> {
    try {
      const createdAt = new Date().toISOString()
      const executor = client || db
      
      // 1. Fetch latest record to get parent_hash
      const { rows } = await executor.query(
        `SELECT current_hash FROM cryptographic_audit_ledger 
         WHERE tenant_id = $1 
         ORDER BY created_at DESC LIMIT 1`,
         [tenantId]
      )
      
      const parentHash = rows.length > 0 ? rows[0].current_hash : '0'.repeat(64)
      
      // 2. Compute current SHA-256 hash
      const hashInput = parentHash + eventType + JSON.stringify(payload) + createdAt
      const currentHash = crypto.createHash('sha256').update(hashInput).digest('hex')
      
      // 3. Write to tamper-proof ledger
      await executor.query(
        `INSERT INTO cryptographic_audit_ledger (tenant_id, run_id, event_type, payload, parent_hash, current_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, runId, eventType, JSON.stringify(payload), parentHash, currentHash, createdAt]
      )
      
      logger.info(`[Governance Ledger] Chained event "${eventType}" logged. Hash: ${currentHash.slice(0, 12)}...`)
      return currentHash
    } catch (err: any) {
      console.error('[Governance Ledger] Tamper-proof logging failed:', err.message)
      return ''
    }
  }
}

export const agentGovernanceService = new AgentGovernanceService()
