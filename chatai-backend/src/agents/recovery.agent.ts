import { logger } from '../services/logger.service';
import { WorkflowAgent } from '../types'
import { callLLM, safeParseJSON, cleanEnvVar } from './base.agent'
import { traceService } from '../services/trace.service'
import { db } from '../db'

export interface RecoveryPatch {
  system_prompt?: string
  description?: string
  config?: any
}

/**
 * Recovery Agent: Dynamically analyzes failures, mutates agent prompts,
 * adjusts tools/providers, and heals the agent runtime to recover from errors.
 */
export async function runRecoveryAgent(
  agent: WorkflowAgent,
  error: string,
  runId: string
): Promise<Partial<WorkflowAgent>> {
  logger.info(`[Recovery] Analyzing failure for Agent: "${agent.name}" (Role: ${agent.role})...`)
  
  await traceService.logTrace(runId, 'SYSTEM_HEALED', {
    agentName: agent.name,
    agentRole: agent.role,
    errorMessage: error,
    message: `Recovery Agent analyzing failure: ${error}`
  })

  // Load any previous steps output to give context to recovery
  let previousStepSummaries = ''
  try {
    const { rows: steps } = await db.query(
      `SELECT ws.step_number, wa.name, ws.status, ws.output_data 
       FROM workflow_steps ws
       JOIN workflow_agents wa ON ws.agent_id = wa.id
       WHERE ws.run_id = $1 AND ws.status = 'completed'
       ORDER BY ws.step_number ASC`,
      [runId]
    )
    previousStepSummaries = steps
      .map(s => `Step ${s.step_number} (${s.name}) output: ${JSON.stringify(s.output_data?.summary || '')}`)
      .join('\n')
  } catch (err: any) {
    console.warn(`[Recovery] Failed to load previous step context: ${err.message}`)
  }

  const recoverySystemPrompt = `You are a Senior Systems Diagnostics Engineer and Recovery Specialist.
An AI Agent inside Chatbolt's execution runtime has failed its execution or quality audit. Your task is to analyze the failure, inspect the previous step results, and dynamically heal the agent.

Failing Agent Profile:
- Name: "${agent.name}"
- Role: "${agent.role}"
- Current Task Description: "${agent.description}"
- Current System Prompt: "${agent.system_prompt}"
- Config: ${JSON.stringify(agent.config || {})}

Preceding Steps Context:
${previousStepSummaries || 'None'}

Encountered Failure / Quality Defect:
"${error}"

Your Goal:
1. Identify the root cause of the failure (e.g. missing required fields, bad output formatting, or API model error).
2. Dynamic Prompt Engineering: Revise the Agent's system_prompt or task description to strictly instruct the agent on how to avoid this exact failure. Add specific assertions, formatting guidelines, or warnings.
3. Configuration Adjustment: If appropriate, switch the provider model (e.g. switch to fallback Qwen if Mistral rate limit hit) or slightly adjust the temperature.

Return ONLY a valid JSON object matching the following patch structure:
{
  "system_prompt": "Revised system prompt incorporating specific guidelines to solve the validation failure.",
  "description": "Revised detailed task instruction addressing the error.",
  "config": {
    "model": "Revised model name or same model",
    "temperature": 0.2,
    "max_tokens": 2000,
    "tools_needed": ["list", "of", "tools"]
  }
}

Ensure all JSON brackets are matched, with no markdown fences, no trailing commas, and no explanation text outside the JSON block.`

  const isTimeout = error.toLowerCase().includes('timeout') || error.toLowerCase().includes('safety budget')
  let patch: RecoveryPatch = {}

  try {
    const kimiKey = cleanEnvVar('KIMI_K2_API_KEY') || cleanEnvVar('KIMI_API_KEY')
    const modelToUse = kimiKey ? 'moonshotai/kimi-k2.6' : (process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai')
    const { content: llmRes } = await callLLM(
      modelToUse,
      recoverySystemPrompt,
      'Diagnose agent failure and generate prompt repair patch.',
      1500,
      1,
      runId,
      'RecoveryAgent'
    )

    patch = safeParseJSON(llmRes)
  } catch (err: any) {
    console.error(`[Recovery] Healing loop failed to obtain/parse recovery patch: ${err.message}.`)
  }

  // Build the new agent updates, always merging timeout policies if timeout detected
  const newPatch: Partial<WorkflowAgent> = {}
  if (patch.system_prompt) {
    newPatch.system_prompt = patch.system_prompt
    logger.info(`[Recovery] Mutating agent "${agent.name}" system prompt.`)
  }
  if (patch.description) {
    newPatch.description = patch.description
    logger.info(`[Recovery] Mutating agent "${agent.name}" description.`)
  }

  // Handle configuration changes
  const newConfig = {
    ...agent.config,
    ...(patch.config || {})
  }

  if (isTimeout) {
    const currentTimeout = agent.config?.timeout_policy?.timeout_sec || 60
    const newTimeout = Math.max(180, currentTimeout * 2)
    newConfig.timeout_policy = {
      timeout_sec: newTimeout
    }
    logger.info(`[Recovery] Timeout detected. Increasing safety budget from ${currentTimeout}s to ${newTimeout}s.`)
  }

  if (Object.keys(patch.config || {}).length > 0 || isTimeout) {
    newPatch.config = newConfig
    logger.info(`[Recovery] Adjusting agent "${agent.name}" configuration.`)
  }

  // Persist healed agent state to the database
  if (Object.keys(newPatch).length > 0) {
    try {
      await db.query(
        `UPDATE workflow_agents 
         SET system_prompt = COALESCE($1, system_prompt),
             description = COALESCE($2, description),
             config = COALESCE($3, config)
         WHERE id = $4`,
        [
          newPatch.system_prompt || null,
          newPatch.description || null,
          newPatch.config ? JSON.stringify(newPatch.config) : null,
          agent.id
        ]
      )
      logger.info(`[Recovery] Durable agent repair written to database for Agent ID: ${agent.id}`)
    } catch (dbErr: any) {
      console.warn(`[Recovery] Failed to write durable repair to DB: ${dbErr.message}`)
    }
  }

  return newPatch
}
