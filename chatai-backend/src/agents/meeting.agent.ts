import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

export async function runMeetingAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  logger.info(`[Agent: ${agent.name}] Starting Meeting Minutes structuring...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const transcript = input.user_inputs?.transcript || input.previous_outputs?.transcript || agent.description
    
    if (!transcript) {
      throw new Error('No meeting transcript provided for analysis.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Analyzing raw transcript and extracting action items...' })
    
    const prompt = `You are an Executive Assistant and Technical Project Manager.
Task: Analyze the following raw meeting transcript. Extract the key decisions, summarize the discussion, and list clear action items assigned to specific people.

Transcript:
${typeof transcript === 'string' ? transcript.substring(0, 30000) : JSON.stringify(transcript)}

Your output MUST be a JSON object with this structure:
{
  "meeting_summary": "High-level summary of the meeting.",
  "key_decisions": ["Decision 1", "Decision 2"],
  "action_items": [
    {
      "task": "What needs to be done",
      "assignee": "Name of the person (if mentioned, else 'Unassigned')",
      "deadline": "Deadline (if mentioned, else 'Not specified')"
    }
  ],
  "sentiment": "Overall tone of the meeting (e.g., Positive, Tense, Productive)"
}

Return ONLY valid JSON.`

    const toolStart = Date.now()
    const { content: generatedContent, confidence } = await callLLM(
      agent.config?.model || '',
      'You are a Meeting Analysis AI.',
      prompt,
      4000,
      1,
      runId,
      agent.name
    )

    await traceService.traceToolComplete(runId, agent.name, 'meeting_analysis', { length: generatedContent.length }, Date.now() - toolStart)

    let parsedData = generatedContent
    try {
      parsedData = JSON.parse(generatedContent.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Failed to parse Meeting JSON', e)
    }

    const output: AgentOutput = {
      success: true,
      data: parsedData,
      summary: `Completed meeting analysis. Found ${(parsedData as any).action_items?.length || 0} action items.`,
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
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return {
      success: false,
      data: null,
      summary: 'Meeting analysis failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
