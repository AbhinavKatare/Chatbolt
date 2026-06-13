import { logger } from './logger.service';
import { query, queryOne } from '../db'

export interface AgentHeartbeat {
  agent_id: string
  last_seen: Date
  status: 'idle' | 'running' | 'waiting' | 'paused' | 'blocked' | 'failed' | 'completed'
  budget_allocated: number
  budget_spent: number
  current_task_id?: string
}

class SupervisorService {
  /**
   * Periodically updates an agent's heartbeat state and checks budget constraints
   */
  async registerHeartbeat(
    agentId: string,
    status: AgentHeartbeat['status'],
    taskId?: string
  ): Promise<boolean> {
    try {
      // Upsert heartbeat entry
      await query(`
        INSERT INTO agent_heartbeats (agent_id, status, current_task_id, last_seen)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (agent_id) DO UPDATE SET
          status = EXCLUDED.status,
          current_task_id = COALESCE(EXCLUDED.current_task_id, agent_heartbeats.current_task_id),
          last_seen = NOW(),
          updated_at = NOW()
      `, [agentId, status, taskId || null])
      
      // Verify budget is not depleted
      const budgetOk = await this.checkBudget(agentId)
      if (!budgetOk) {
        console.warn(`[Supervisor] Agent ${agentId} has exceeded its allocated compute budget. Blocking execution.`)
        await query(`
          UPDATE agent_heartbeats 
          SET status = 'blocked', updated_at = NOW() 
          WHERE agent_id = $1
        `, [agentId])
        return false
      }
      
      return true
    } catch (err: any) {
      console.error('[Supervisor] Failed to register heartbeat:', err.message)
      return false
    }
  }

  /**
   * Checks if an agent has remaining compute budget
   */
  async checkBudget(agentId: string): Promise<boolean> {
    try {
      const row = await queryOne(`
        SELECT budget_allocated, budget_spent 
        FROM agent_heartbeats 
        WHERE agent_id = $1
      `, [agentId])

      if (!row) return true // Budget default applies, allowed
      const allocated = parseFloat((row as any).budget_allocated)
      const spent = parseFloat((row as any).budget_spent)
      return spent < allocated
    } catch (err: any) {
      console.error('[Supervisor] Budget check failure:', err.message)
      return true // Fail safe to allow progress, but log
    }
  }

  /**
   * Deducts budget from an agent run
   */
  async logComputeUsage(agentId: string, amount: number): Promise<void> {
    try {
      await query(`
        UPDATE agent_heartbeats 
        SET budget_spent = budget_spent + $1, updated_at = NOW()
        WHERE agent_id = $2
      `, [amount, agentId])
      logger.info(`[Supervisor] Agent ${agentId} consumed $${amount.toFixed(4)} compute budget.`)
    } catch (err: any) {
      console.error('[Supervisor] Failed to log compute usage:', err.message)
    }
  }

  /**
   * Monitor thread: Identifies stalled or crashed agent tasks
   * Runs periodically to recovery tasks where the agent hasn't updated its heartbeat in 30 minutes
   */
  async runHealthCheck(): Promise<void> {
    logger.info('[Supervisor] Executing active agent fleet health audit…')
    try {
      const stalledTime = '30 minutes'
      const stalledAgents = await query(`
        SELECT h.agent_id, h.current_task_id, a.name 
        FROM agent_heartbeats h
        JOIN workflow_agents a ON h.agent_id = a.id
        WHERE h.status = 'running' 
          AND h.last_seen < NOW() - INTERVAL '${stalledTime}'
      `)

      if (stalledAgents.length > 0) {
        console.warn(`[Supervisor] Found ${stalledAgents.length} stalled agent tasks. Triggering automated recoveries…`)
        for (const agent of stalledAgents) {
          logger.info(`[Supervisor] Recovering stalled agent ${agent.name} (${agent.agent_id}) for task run ${agent.current_task_id}`)
          
          await query(`
            UPDATE agent_heartbeats 
            SET status = 'failed', updated_at = NOW() 
            WHERE agent_id = $1
          `, [agent.agent_id])

          // If task_id (workflow_run id) exists, mark it as FAILED or queue for retry
          if (agent.current_task_id) {
            await query(`
              INSERT INTO workflow_events (run_id, event_type, payload)
              VALUES ($1, 'AGENT_STALLED_RECOVERY', $2)
            `, [
              agent.current_task_id, 
              JSON.stringify({ 
                agent_id: agent.agent_id, 
                message: 'Task stalled: Automatic supervisor recovery triggered.' 
              })
            ])
          }
        }
      } else {
        logger.info('[Supervisor] Fleet audit complete. All asynchronous agents are operational.')
      }
    } catch (err: any) {
      console.error('[Supervisor] Fleet health check failed:', err.message)
    }
  }
}

export const supervisorService = new SupervisorService()
