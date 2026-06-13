import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'

export async function runWriter(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  
  logger.info(`[Agent: ${agent.name}] Starting writing...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const previousOutputs = JSON.stringify(input.previous_outputs || {})
    const userStyle = input.user_inputs?.style || 'professional'
    
    const model = agent.config?.model || ''
    
    const { content, confidence } = await callLLM(
      model,
      agent.system_prompt,
      `Previous Research/Data: ${previousOutputs}\n\nStyle Preference: ${userStyle}\n\nTask: ${agent.description}`,
      2000,
      1,
      runId,
      agent.name
    )

    let subjectLine = ''
    if (agent.output_type === 'email' || agent.description.toLowerCase().includes('email')) {
      runEmitter.emitEvent(runId, 'agent_progress', { message: 'Generating subject line...' })
      const { content: sub } = await callLLM(
        model,
        'Generate a catchy and relevant email subject line for the following content. Return ONLY the subject text.',
        content,
        2000,
        1,
        runId,
        agent.name
      )
      subjectLine = sub
    }

    const output: AgentOutput = {
      success: true,
      data: {
        content,
        subject_line: subjectLine,
        word_count: content.split(' ').length
      },
      summary: `Content generated successfully (${content.split(' ').length} words).`,
      output_type: 'text',
      confidence,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: [],
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
      summary: 'Writing failed',
      output_type: 'text',
      confidence: 0,
      error: err.message,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: [],
        retries: 0
      }
    }
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return errorOutput
  }
}
