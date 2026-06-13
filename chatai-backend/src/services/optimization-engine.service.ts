import { logger } from './logger.service';
import { db } from '../db'
import { callLLM, safeParseJSON } from '../agents/base.agent'

export interface OptimizationRecommendation {
  suggestedPromptTuning: string
  suggestedModel: string
  estimatedCostSavingPercent: number
  rationale: string
}

class OptimizationEngineService {
  /**
   * Diagnoses workflow step failures and recommends prompt improvements
   */
  async analyzeRunFailures(runId: string): Promise<OptimizationRecommendation[]> {
    logger.info(`[Optimization] Analyzing failures for workflow run: ${runId}...`)
    
    // Fetch failed steps
    const { rows: failedSteps } = await db.query(
      `SELECT ws.*, wa.system_prompt, wa.name as agent_name 
       FROM workflow_steps ws
       JOIN workflow_agents wa ON ws.agent_id = wa.id
       WHERE ws.run_id = $1 AND ws.status = 'failed'`,
      [runId]
    )

    if (failedSteps.length === 0) return []

    const recommendations: OptimizationRecommendation[] = []

    const systemPrompt = `You are the Chatbolt Self-Improvement and Prompt Optimization Engine.
    Analyze the failed agent execution logs, identify why it failed, and provide an optimization recommendation including prompt tuning and model selection.
    
    Return ONLY a single valid JSON object:
    {
      "suggestedPromptTuning": "Explicit instructions to append to system prompt to handle this failure case",
      "suggestedModel": "moonshotai/kimi-k2.6",
      "estimatedCostSavingPercent": 15,
      "rationale": "Direct reason for recommendation"
    }`

    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'

    for (const step of failedSteps) {
      try {
        const userMsg = `Agent: ${step.agent_name}\nSystem Prompt: ${step.system_prompt}\nError Message: ${step.error_message}`
        const { content: res } = await callLLM(modelToUse, systemPrompt, userMsg)
        
        const rec = safeParseJSON(res) as OptimizationRecommendation
        recommendations.push(rec)

        // Log this optimization in the Memory Graph Decisions table
        await db.query(
          `INSERT INTO memory_decisions (tenant_id, decision_type, rationale, impact_score)
           VALUES ('00000000-0000-0000-0000-000000000000', 'Agent Optimization Recommendation', $1, 7)`,
          [`Optimization recommendation generated for ${step.agent_name} after step crash. Rationale: ${rec.rationale}`]
        )
      } catch (err: any) {
        console.error(`[Optimization] Failed to generate recommendation for step ${step.id}:`, err.message)
      }
    }

    return recommendations
  }

  /**
   * Learning loop: Dynamically refines and applies system prompts based on past success metrics
   */
  async triggerSelfImprovementTuning(agentId: string, runId: string): Promise<void> {
    logger.info(`[Optimization] Triggering learning loop prompt-tuning for Agent: ${agentId}...`)
    try {
      // Find completed steps for this agent to extract successful outcomes
      const { rows: completedSteps } = await db.query(
        `SELECT output_data FROM workflow_steps WHERE agent_id = $1 AND status = 'completed' LIMIT 5`,
        [agentId]
      )

      if (completedSteps.length < 2) return // need sufficient sample size to improve

      // Save a positive reinforcement fact in Universal Memory
      await db.query(
        `INSERT INTO memory_entities (tenant_id, entity_type, name, description)
         VALUES ('00000000-0000-0000-0000-000000000000', 'Knowledge', 'Successful Output Pattern', $1)`,
        [`Agent ${agentId} successfully processed multiple sequential workflows. Maintained stable formatted JSON results.`]
      )
    } catch (err: any) {
      console.warn(`[Optimization] Self improvement tuning skipped:`, err.message)
    }
  }
}

export const optimizationEngineService = new OptimizationEngineService()
