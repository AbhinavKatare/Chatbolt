import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

export async function runLegalAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  logger.info(`[Agent: ${agent.name}] Starting Legal & Compliance review...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const documentText = input.user_inputs?.document || input.previous_outputs || agent.description
    const frameworks = input.user_inputs?.frameworks || ['GDPR', 'SOC2', 'General Contract Law']
    
    if (!documentText) {
      throw new Error('No document provided for legal analysis.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Analyzing document against ${frameworks.join(', ')}...` })
    
    const prompt = `You are a Senior Corporate Lawyer and Compliance Officer.
Task: Analyze the following document/contract/policy and identify compliance risks, loopholes, and missing clauses based on these frameworks: ${frameworks.join(', ')}

Document Text:
${typeof documentText === 'string' ? documentText.substring(0, 20000) : JSON.stringify(documentText).substring(0, 20000)}

Your output MUST be a JSON object with this structure:
{
  "compliance_status": "Pass/Fail/Needs Revision",
  "risks": [
    {
      "framework": "GDPR",
      "issue": "Missing data retention policy",
      "severity": "High/Medium/Low",
      "suggested_clause": "Insert standard text here..."
    }
  ],
  "summary": "Executive summary of the legal risks."
}

Return ONLY valid JSON.`

    const toolStart = Date.now()
    const { content: generatedContent, confidence } = await callLLM(
      agent.config?.model || '',
      'You are a Legal & Compliance AI.',
      prompt,
      4000,
      1,
      runId,
      agent.name
    )

    await traceService.traceToolComplete(runId, agent.name, 'legal_analysis', { length: generatedContent.length }, Date.now() - toolStart)

    let parsedData = generatedContent
    try {
      parsedData = JSON.parse(generatedContent.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Failed to parse Legal JSON', e)
    }

    const output: AgentOutput = {
      success: true,
      data: parsedData,
      summary: `Completed legal and compliance review. Status: ${(parsedData as any).compliance_status || 'Unknown'}.`,
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
      summary: 'Legal analysis failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
