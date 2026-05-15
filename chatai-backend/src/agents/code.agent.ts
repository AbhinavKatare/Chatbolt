import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'

export async function runCodeAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  console.log(`[Agent: ${agent.name}] Starting code task...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const taskType = input.user_inputs?.task_type || 'write'
    const language = input.user_inputs?.language || 'typescript'
    const codeContext = input.user_inputs?.code || ''
    
    let prompt = ''
    if (taskType === 'write') {
      prompt = `Write high-quality ${language} code for: ${agent.description}. Context: ${codeContext}`
    } else if (taskType === 'debug') {
      const error = input.user_inputs?.error || 'Unknown error'
      prompt = `Debug this ${language} code: ${codeContext}\n\nError: ${error}`
    } else if (taskType === 'review') {
      prompt = `Review this ${language} code for best practices, performance, and security: ${codeContext}`
    } else if (taskType === 'test') {
      prompt = `Write unit tests for this ${language} code: ${codeContext}`
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Executing code ${taskType}...` })
    
    const model = agent.config?.model || ''
    const { content: result, confidence } = await callLLM(
      model,
      agent.system_prompt || 'You are an elite software engineer. Write clean, efficient, and well-documented code.',
      prompt
    )

    const output: AgentOutput = {
      success: true,
      data: {
        result,
        task_type: taskType,
        language
      },
      summary: `Code ${taskType} task completed successfully.`,
      output_type: 'code',
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
      summary: 'Code task failed',
      output_type: 'code',
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
