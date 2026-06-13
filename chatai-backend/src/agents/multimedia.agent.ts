import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

export async function runMultimediaAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  logger.info(`[Agent: ${agent.name}] Starting Multimedia Processing...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const fileUrl = input.user_inputs?.file_url || input.previous_outputs?.file_url
    const promptInstructions = input.user_inputs?.instructions || agent.description
    
    if (!fileUrl) {
      throw new Error('No multimedia file URL provided for analysis.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Processing multimedia file: ${fileUrl}...` })
    
    // In a production environment, this would download the file (audio, video, image)
    // and pass it to a multimodal API like GPT-4-Vision or Whisper.
    // For this implementation, we will simulate the extraction via LLM if it's text/base64,
    // or just assume the model handles the URL if it supports it natively.

    const prompt = `You are a Multimodal AI Expert.
Task: Analyze the following multimedia file (provided as a URL or base64 data) and extract the requested information.

File: ${fileUrl}
Instructions: ${promptInstructions}

Your output MUST be a JSON object with this structure:
{
  "file_type": "image/audio/video",
  "summary": "Detailed summary of the media content",
  "extracted_text": "Any transcribed text or OCR data",
  "key_elements": ["List of objects, themes, or timestamps identified"]
}

Return ONLY valid JSON.`

    const toolStart = Date.now()
    const { content: generatedContent, confidence } = await callLLM(
      agent.config?.model || '',
      'You are a Multimodal Processing AI.',
      prompt,
      4000,
      1,
      runId,
      agent.name
    )

    await traceService.traceToolComplete(runId, agent.name, 'multimedia_processing', { length: generatedContent.length }, Date.now() - toolStart)

    let parsedData = generatedContent
    try {
      parsedData = JSON.parse(generatedContent.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Failed to parse Multimedia JSON', e)
    }

    const output: AgentOutput = {
      success: true,
      data: parsedData,
      summary: `Completed multimedia processing for ${fileUrl}.`,
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
      summary: 'Multimedia processing failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
