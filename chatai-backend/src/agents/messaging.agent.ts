import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'
import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'
import { callLLM } from './base.agent'
import axios from 'axios'

export async function runMessagingAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['slack_operations']
  const tenantId = agent.tenant_id
  
  logger.info(`[Agent: ${agent.name}] Initializing messaging operations...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const hasIntegration = await integrationRegistryService.hasIntegration(tenantId, 'slack')
    if (!hasIntegration) {
      throw new Error(`Integration "Slack" is required for messaging actions. Please connect it first on the Workspace Connections page.`)
    }

    const token = await integrationRegistryService.getToken(tenantId, 'slack')
    const prompt = input.user_inputs?.prompt || input.original_prompt || agent.description || ''
    
    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Determining channel destination and messaging context...' })

    // Router
    const systemPrompt = `You are a Slack/Teams Message Router.
    Analyze the user instruction and return JSON:
    {
      "action": "post_message" | "read_history",
      "channel": "channel name (e.g. #general or empty)",
      "message": "message text to send (with summaries formatted cleanly)",
      "user": "username or recipient DM target"
    }`

    const modelToUse = 'meta/llama-3.1-8b-instruct'
    const { content: routerJson } = await callLLM(modelToUse, systemPrompt, `Prompt: ${prompt}`, 250, 1, runId, agent.name)
    const decision = JSON.parse(routerJson.replace(/```json/gi, '').replace(/```/g, '').trim())

    // If message body is empty, check previous outputs
    if (decision.action === 'post_message' && !decision.message) {
      const outputs = Object.values(input.previous_outputs || {}) as any[]
      const prevText = outputs.find(o => o?.data?.content || o?.summary)?.summary || 'Task update completed.'
      decision.message = `Chatbolt Update: ${prevText}`
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Dispatching action to ${decision.channel || decision.user || 'chat'}...` })

    let resultData: any = {}
    const isMock = !token || token.startsWith('mock-token-')

    if (isMock) {
      resultData = {
        mode: 'mock',
        status: 'posted',
        destination: decision.channel || decision.user || '#general',
        message: decision.message,
        timestamp: new Date().toISOString()
      }
    } else {
      // Real Slack API Call
      // Slack chat.postMessage API expects Authorization: Bearer token
      if (decision.action === 'post_message') {
        const response = await axios.post(
          'https://slack.com/api/chat.postMessage',
          {
            channel: decision.channel || '#general',
            text: decision.message
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        )
        resultData = { mode: 'real', response: response.data }
      } else {
        resultData = { mode: 'real', status: 'simulated_action', action: decision.action }
      }
    }

    const output: AgentOutput = {
      success: true,
      data: resultData,
      summary: `Slack message successfully dispatched to ${decision.channel || decision.user || '#general'}.`,
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
    logger.error(`[Agent: ${agent.name}] Error:`, err.message)
    const errorOutput: AgentOutput = {
      success: false,
      data: null,
      summary: `Slack messaging failed: ${err.message}`,
      output_type: 'error',
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
