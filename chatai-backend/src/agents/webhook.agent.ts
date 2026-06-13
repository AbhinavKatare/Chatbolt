import { logger } from '../services/logger.service';
import { triggerWebhook } from '../tools/webhook.tool'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

export async function runWebhookAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['webhook']
  
  logger.info(`[Agent: ${agent.name}] Starting Webhook trigger...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const url = input.user_inputs?.webhook_url || agent.description.match(/https?:\/\/[^\s]+/)?.[0]
    
    if (!url) {
      throw new Error('No webhook URL provided in user_inputs.webhook_url or description.')
    }

    // Default to passing along the entire previous outputs as the payload
    const payload = input.user_inputs?.payload || input.previous_outputs || { message: 'Triggered by Chatbolt' }
    const headers = input.user_inputs?.headers || {}
    
    runEmitter.emitEvent(runId, 'agent_progress', { message: `Triggering webhook: ${url}...` })
    
    const toolStart = Date.now()
    await traceService.traceToolStart(runId, agent.name, 'webhook', { url })
    
    const response = await triggerWebhook({ url, payload, headers })
    
    await traceService.traceToolComplete(runId, agent.name, 'webhook', { status: response.status }, Date.now() - toolStart)

    if (!response.success) {
      throw new Error(`Webhook failed with status ${response.status}: ${response.error}`)
    }

    const output: AgentOutput = {
      success: true,
      data: {
        response_data: response.data,
        status: response.status
      },
      summary: `Webhook triggered successfully.`,
      output_type: 'data',
      confidence: 1.0,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }

    runEmitter.emitEvent(runId, 'agent_done', { agentId: agent.id, summary: output.summary })
    return output

  } catch (err: any) {
    console.error(`[Agent: ${agent.name}] Error:`, err.message)
    const errorOutput: AgentOutput = {
      success: false,
      data: null,
      summary: 'Webhook trigger failed',
      output_type: 'data',
      confidence: 0,
      error: err.message,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return errorOutput
  }
}
