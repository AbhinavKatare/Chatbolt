import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'

export async function runReporter(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  
  console.log(`[Agent: ${agent.name}] Generating final report...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const allPreviousOutputs = JSON.stringify(input.previous_outputs || {})
    
    const model = agent.config?.model || ''
    
    const { content: report, confidence } = await callLLM(
      model,
      agent.system_prompt || 'You are a professional business reporter. Summarize all findings into a polished executive report.',
      `Full Workflow Results: ${allPreviousOutputs}\n\nTask: ${agent.description}`
    )

    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Formatting report...' })
    const { content: reportHtml } = await callLLM(
      model,
      'Convert the following markdown report into clean, professional HTML. Return ONLY the HTML code.',
      report
    )

    const output: AgentOutput = {
      success: true,
      data: {
        report_markdown: report,
        report_html: reportHtml,
        key_metrics: [] // Extracted metrics
      },
      summary: 'Executive report generated successfully.',
      output_type: 'report',
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
      summary: 'Report generation failed',
      output_type: 'report',
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
