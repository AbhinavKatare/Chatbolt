import { logger } from './logger.service';
import { db } from '../db'
import { callLLM, safeParseJSON } from '../agents/base.agent'

export interface ExecutiveApproval {
  approved: boolean
  budgetAllocated: number
  cto_approval_required: boolean
  coo_priority: 'low' | 'medium' | 'high'
  reasoning: string
}

class ExecutiveSwarmService {
  /**
   * Coordinates the C-Suite leadership layer to plan, budget, and approve an outcome workflow
   */
  async coordinateExecutiveSwarm(goal: string, tenantId: string): Promise<ExecutiveApproval> {
    logger.info(`[Executive Swarm] Activating C-Suite leadership swarm for goal: "${goal}"...`)

    const systemPrompt = `You are the Chatbolt Executive Swarm Leader (Chief of Staff).
    You coordinate the leadership layer:
    - CEO Agent: Evaluates the strategic value.
    - CTO Agent: Identifies technical tools risk (detects if destructive tools like email, scrapers, api call are needed).
    - CFO Agent: Allocates token budget in USD (usually between $0.50 and $10.00).
    - COO Agent: Assigns workflow priority level.
    
    Return ONLY valid JSON containing the aggregated approvals and executive directives:
    {
      "approved": true,
      "budgetAllocated": 5.0000,
      "cto_approval_required": false,
      "coo_priority": "medium",
      "reasoning": "Aggregated CEO strategic alignment, CFO budget checks, and CTO technical review."
    }`

    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'

    try {
      const { content: res } = await callLLM(modelToUse, systemPrompt, `Goal to evaluate: "${goal}"`)
      const parsed = safeParseJSON(res) as ExecutiveApproval

      // Ensure valid boundaries
      parsed.approved = parsed.approved ?? true
      parsed.budgetAllocated = parsed.budgetAllocated || 2.0000
      parsed.coo_priority = parsed.coo_priority || 'medium'
      parsed.reasoning = parsed.reasoning || 'Approved by C-Suite Swarm Orchestrator.'

      // Log decision in the Memory Graph Decisions table
      await db.query(
        `INSERT INTO memory_decisions (tenant_id, decision_type, rationale, impact_score)
         VALUES ($1, 'C-Suite Workflow Approval', $2, 9)`,
        [tenantId, `CEO aligned on goal. CFO allocated budget: $${parsed.budgetAllocated.toFixed(2)}. CTO set approval requirement: ${parsed.cto_approval_required}.`]
      )

      logger.info(`[Executive Swarm] ✅ C-Suite Swarm Approved: Budget allocated: $${parsed.budgetAllocated.toFixed(2)}`)
      return parsed
    } catch (err: any) {
      console.warn(`[Executive Swarm] Swarm coordination failed, using default alignment:`, err.message)
      return {
        approved: true,
        budgetAllocated: 3.5000,
        cto_approval_required: false,
        coo_priority: 'medium',
        reasoning: 'Fallback swarm approval authorized.'
      }
    }
  }

  /**
   * CFO compute spend accounting check
   */
  async checkCfoThreshold(agentId: string, currentSpent: number, limit: number): Promise<boolean> {
    if (currentSpent >= limit) {
      console.warn(`[CFO Agent] Budget block! Agent ${agentId} spent $${currentSpent.toFixed(4)} of allocated $${limit.toFixed(4)}.`)
      return false
    }
    return true
  }
}

export const executiveSwarmService = new ExecutiveSwarmService()
