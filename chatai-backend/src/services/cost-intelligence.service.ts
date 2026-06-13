import { db } from '../db'

export interface CostRecord {
  prompt_tokens: number
  completion_tokens: number
  model_cost: number
  execution_cost: number
  total_cost: number
}

class CostIntelligenceService {
  // Define precise pricing sheets (per 1k tokens)
  private readonly MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'moonshotai/kimi-k2.6': { input: 0.0020, output: 0.0080 },
    'moonshotai/kimi-k2.0': { input: 0.0015, output: 0.0050 },
    'mistral-large-latest': { input: 0.0030, output: 0.0090 },
    'Qwen/WebWorld-8B:featherless-ai': { input: 0.0000, output: 0.0000 }, // free tier models
    'gpt-4o': { input: 0.0050, output: 0.0150 }
  }

  /**
   * Computes precise token usage cost based on input/output pricing structure
   */
  calculateTokenCost(model: string, promptTokens: number, completionTokens: number): number {
    const rate = this.MODEL_PRICING[model] || { input: 0.0002, output: 0.0006 } // safe fallback rate
    const inputCost = (promptTokens / 1000) * rate.input
    const outputCost = (completionTokens / 1000) * rate.output
    return parseFloat((inputCost + outputCost).toFixed(6))
  }

  /**
   * Logs execution costs for a workflow step, combining tokens and compute time
   */
  async logStepCost(
    runId: string,
    agentId: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    durationMs: number
  ): Promise<number> {
    const tokenCost = this.calculateTokenCost(model, promptTokens, completionTokens)
    const computeTimeCost = (durationMs / 1000) * 0.0001 // execution runtime flat fee ($0.0001 per second)
    const totalCost = parseFloat((tokenCost + computeTimeCost).toFixed(6))

    try {
      // Update step cost metadata in workflow_steps
      await db.query(
        `UPDATE workflow_steps 
         SET api_calls = api_calls + 1, 
             input_data = input_data || jsonb_build_object('cost', $1::numeric, 'prompt_tokens', $2::int, 'completion_tokens', $3::int)
         WHERE run_id = $4 AND agent_id = $5`,
        [totalCost, promptTokens, completionTokens, runId, agentId]
      )

      // Increment total credits used in the workflow run
      await db.query(
        `UPDATE workflow_runs 
         SET credits_used = credits_used + $1::numeric
         WHERE id = $2`,
        [totalCost, runId]
      )
    } catch (err: any) {
      console.error('[Cost Intelligence] Failed to log step cost:', err.message)
    }

    return totalCost
  }

  /**
   * Evaluates return-on-investment (ROI) comparing agent costs with estimated human labor savings
   */
  async getWorkflowRunRoi(runId: string): Promise<{ totalCost: number; manualTimeSavedHours: number; roiDollar: number }> {
    try {
      const { rows } = await db.query(
        `SELECT credits_used, duration_ms FROM workflow_runs WHERE id = $1`,
        [runId]
      )
      
      if (rows.length === 0) return { totalCost: 0, manualTimeSavedHours: 0, roiDollar: 0 }

      const totalCost = parseFloat(rows[0].credits_used || '0')
      const durationMs = parseInt(rows[0].duration_ms || '0')

      // 1 minute of agent execution is estimated to save 1 hour of manual human labor
      const manualTimeSavedHours = parseFloat(((durationMs / 1000) / 60).toFixed(2))
      const humanLaborRateHour = 30.00 // Standard enterprise blended rate
      
      const potentialHumanCost = manualTimeSavedHours * humanLaborRateHour
      const roiDollar = parseFloat((potentialHumanCost - totalCost).toFixed(2))

      return {
        totalCost,
        manualTimeSavedHours,
        roiDollar
      }
    } catch (err: any) {
      console.error('[Cost Intelligence] Failed to fetch ROI:', err.message)
      return { totalCost: 0, manualTimeSavedHours: 0, roiDollar: 0 }
    }
  }
}

export const costIntelligenceService = new CostIntelligenceService()
