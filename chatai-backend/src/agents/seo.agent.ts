import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

export async function runSeoAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  logger.info(`[Agent: ${agent.name}] Starting SEO generation...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const keywords = input.user_inputs?.keywords || input.user_inputs?.topic || agent.description
    const contentType = input.user_inputs?.content_type || 'landing_page' // landing_page, blog_post, etc.
    const context = input.previous_outputs ? JSON.stringify(input.previous_outputs) : ''

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Analyzing keywords for ${contentType}...` })

    const prompt = `You are an elite SEO expert and copywriter.
Task: Generate a highly optimized, high-converting ${contentType} targeting the following keywords/topic:
${keywords}

Context / Research Data (if any):
${context}

Your generated content MUST include:
1. An engaging SEO Title and Meta Description (at the very top).
2. Proper heading structure (H1, H2, H3).
3. Semantic HTML or Markdown formatting.
4. LSI (Latent Semantic Indexing) keywords woven naturally into the text.
5. High-converting Call-to-Action (CTA) sections.

Return the generated content.`

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Generating SEO optimized content...` })
    const toolStart = Date.now()

    const { content: generatedContent, confidence } = await callLLM(
      agent.config?.model || '',
      'You are a Programmatic SEO content generator.',
      prompt,
      4000,
      1,
      runId,
      agent.name
    )

    await traceService.traceToolComplete(runId, agent.name, 'seo_generation', { length: generatedContent.length }, Date.now() - toolStart)

    const output: AgentOutput = {
      success: true,
      data: {
        seo_content: generatedContent,
        content_type: contentType
      },
      summary: `Successfully generated SEO optimized ${contentType}.`,
      output_type: 'text',
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
      summary: 'SEO generation failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
