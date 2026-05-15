import { executeApiRequest } from '../tools/api-caller.tool'
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'

export async function runAPIAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['api_caller']
  
  console.log(`[Agent: ${agent.name}] Starting API call...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const method = input.user_inputs?.method || 'GET'
    const url = input.user_inputs?.url || agent.config?.api_vault_ids?.[0] // Simplified
    const headers = input.user_inputs?.headers || {}
    const body = input.user_inputs?.body || null
    
    runEmitter.emitEvent(runId, 'agent_progress', { message: `Calling API: ${method} ${url}...` })
    
    const response = await executeApiRequest({ 
      method, 
      url, 
      headers, 
      body 
    })

    let parsedData = response.data
    let confidence = 1.0
    if (typeof response.data === 'string' || agent.description.includes('parse')) {
      runEmitter.emitEvent(runId, 'agent_progress', { message: 'Parsing API response with AI...' })
      const model = agent.config?.model || ''
      const { content: extraction, confidence: aiConfidence } = await callLLM(
        model,
        `Extract relevant information from this API response based on: ${agent.description}. Return as JSON.`,
        typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
      )
      confidence = aiConfidence
      try {
        parsedData = JSON.parse(extraction.replace(/```json/g, '').replace(/```/g, '').trim())
      } catch {
        parsedData = { extraction }
      }
    }

    const output: AgentOutput = {
      success: response.status < 400,
      data: {
        response_data: parsedData,
        status: response.status
      },
      summary: `API call ${method} to ${url} completed with status ${response.status}.`,
      output_type: 'data',
      confidence,
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
      summary: 'API call failed',
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
