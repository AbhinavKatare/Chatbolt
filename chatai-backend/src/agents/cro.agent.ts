import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'
import { scrapeUrl } from '../tools/scraper.tool'

export async function runCroAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['scraper']
  
  logger.info(`[Agent: ${agent.name}] Starting CRO A/B Testing analysis...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const targetUrl = input.user_inputs?.url || agent.description.match(/https?:\/\/[^\s]+/)?.[0]
    
    if (!targetUrl) {
      throw new Error('No target URL provided for CRO analysis.')
    }

    // 1. Scrape the current webpage
    runEmitter.emitEvent(runId, 'agent_progress', { message: `Scraping current UI from ${targetUrl}...` })
    const scrapeStart = Date.now()
    await traceService.traceToolStart(runId, agent.name, 'scraper', { url: targetUrl })
    const scrapeResult = await scrapeUrl({ url: targetUrl })
    await traceService.traceToolComplete(runId, agent.name, 'scraper', { success: true }, Date.now() - scrapeStart)

    // 2. Generate CRO variants
    runEmitter.emitEvent(runId, 'agent_progress', { message: `Analyzing UI/UX and generating React variants...` })
    const prompt = `You are an elite Conversion Rate Optimization (CRO) expert and Frontend Developer.
Task: Analyze the following scraped website content. Identify 2 UI/UX bottlenecks that might be hurting conversions, and write the React (Tailwind CSS) code for an A/B test variant that fixes them.

Target URL: ${targetUrl}

Scraped Content:
${scrapeResult.text.substring(0, 15000)}

Your output MUST be a JSON object with this structure:
{
  "analysis": "Explanation of the UX bottlenecks and why the variants will improve conversions.",
  "variants": [
    {
      "name": "Variant A - High Contrast CTA",
      "code": "export default function VariantA() { return (<div className=\\"...\\">...</div>) }"
    }
  ]
}

Return ONLY valid JSON.`

    const toolStart = Date.now()
    const { content: generatedContent, confidence } = await callLLM(
      agent.config?.model || '',
      'You are a CRO & UI/UX Expert.',
      prompt,
      4000,
      1,
      runId,
      agent.name
    )

    await traceService.traceToolComplete(runId, agent.name, 'cro_generation', {}, Date.now() - toolStart)

    let parsedData = generatedContent
    try {
      parsedData = JSON.parse(generatedContent.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Failed to parse CRO JSON', e)
    }

    const output: AgentOutput = {
      success: true,
      data: parsedData,
      summary: `Successfully generated CRO A/B test variants for ${targetUrl}.`,
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
      summary: 'CRO analysis failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
