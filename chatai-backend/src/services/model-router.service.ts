import { callLLM } from '../agents/base.agent'
import { db } from '../db'
import { logger } from './logger.service'

class ModelRouterService {
  private getModelCheap(): string {
    return process.env.MODEL_CHEAP || 'moonshotai/kimi-k2.0'
  }

  private getModelPowerful(): string {
    return process.env.MODEL_POWERFUL || 'moonshotai/kimi-k2.6'
  }

  /**
   * Dynamically selects a model based on the prompt content and the task category.
   * Cheap model handles low-complexity/classification tasks.
   * Powerful model handles research, coding, spreadsheet, and audit tasks.
   */
  selectModel(prompt: string, taskType?: string): string {
    const promptLower = prompt.toLowerCase()
    const typeLower = (taskType || '').toLowerCase()

    // High complexity keywords
    const complexKeywords = [
      'code', 'program', 'bug', 'test', 'refactor', 'develop',
      'research', 'analyse', 'analyze', 'audit', 'compare',
      'excel', 'spreadsheet', 'csv', 'chart', 'summary',
      'meeting', 'transcript', 'action items', 'minutes'
    ]

    const containsComplexKeywords = complexKeywords.some(kw => promptLower.includes(kw))

    const isComplexType = [
      'code', 'research', 'spreadsheet', 'audit', 'compare', 'meeting', 'presentation'
    ].includes(typeLower)

    // Route to powerful model if it has complex keywords, is a complex type, or is very long (> 300 chars)
    if (containsComplexKeywords || isComplexType || prompt.length > 300) {
      logger.info(`[Model Router] Selected powerful model for: ${taskType || 'complex task'}`)
      return this.getModelPowerful()
    }

    logger.info(`[Model Router] Selected cheap model for: ${taskType || 'low-complexity task'}`)
    return this.getModelCheap()
  }

  /**
   * Executes an LLM call using the selected model, with automatic fallback
   * to the powerful model if the cheap model's output fails validation.
   */
  async executeWithFallback(params: {
    systemPrompt: string
    userMsg: string
    maxTokens?: number
    validate?: (content: string) => boolean
    tenantId: string
    runId?: string
    agentName?: string
    taskType?: string
  }): Promise<{ content: string; confidence: number }> {
    const initialModel = this.selectModel(params.userMsg, params.taskType)
    const isInitialCheap = initialModel === this.getModelCheap()

    try {
      logger.info(`[Model Router] Attempting execution with initial model: ${initialModel}`)
      const result = await callLLM(
        initialModel,
        params.systemPrompt,
        params.userMsg,
        params.maxTokens || 2000,
        1,
        params.runId,
        params.agentName
      )

      // Validate output if validator function is present
      if (params.validate) {
        const isValid = params.validate(result.content)
        if (!isValid) {
          throw new Error('LLM output failed validation schema constraints.')
        }
      }

      return result
    } catch (err: any) {
      logger.warn(`[Model Router] Initial execution failed or output invalid: ${err.message}`)

      // If we initially used the cheap model, fall back to the powerful one
      if (isInitialCheap) {
        const powerfulModel = this.getModelPowerful()
        logger.info(`[Model Router] Falling back to powerful model: ${powerfulModel}`)

        // Transparently log fallback event in execution_metrics
        try {
          await db.query(
            `INSERT INTO execution_metrics (
              user_id, run_id, task_type, outcome, error_code, retry_count
             ) VALUES ($1, $2, $3, 'failed', 'validation_fallback', 1)`,
            [
              params.tenantId,
              params.runId || null,
              params.taskType || 'fallback_routing'
            ]
          )
        } catch (dbErr: any) {
          logger.warn(`[Model Router] Failed to write fallback metric: ${dbErr.message}`)
        }

        return await callLLM(
          powerfulModel,
          params.systemPrompt,
          params.userMsg,
          params.maxTokens || 2000,
          2, // Mark as second attempt
          params.runId,
          params.agentName
        )
      }

      // If already using powerful model or fallback failed, propagate error
      throw err
    }
  }
}

export const modelRouterService = new ModelRouterService()
