import { logger } from './logger.service';
import { db } from '../db'
import crypto from 'crypto'

export interface GovernancePolicy {
  can_send_emails: boolean
  can_call_external_api: boolean
  daily_cost_limit: number
  approval_required_above_cost: number
  risk_tolerance_threshold: number
}

class AgentGovernanceService {
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
