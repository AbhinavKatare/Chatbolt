import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'
import { runWebSearch } from '../tools/web-search.tool'

export async function runSocialAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['web_search']
  
  logger.info(`[Agent: ${agent.name}] Starting Social & Trend analysis...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const brandOrTopic = input.user_inputs?.brand || input.user_inputs?.topic || agent.description
    const platforms = input.user_inputs?.platforms || ['Twitter', 'LinkedIn']

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Searching social trends for ${brandOrTopic}...` })
    
    // 1. Search recent trends
    const searchStart = Date.now()
    await traceService.traceToolStart(runId, agent.name, 'web_search', { query: `site:twitter.com OR site:linkedin.com latest trends "${brandOrTopic}"` })
    const searchResult = await runWebSearch({ query: `site:twitter.com OR site:linkedin.com latest trends "${brandOrTopic}"` })
    await traceService.traceToolComplete(runId, agent.name, 'web_search', { results: searchResult.results.length }, Date.now() - searchStart)

    const trendsContext = searchResult.results.map(r => r.snippet).join('\n')

    // 2. Draft content
    runEmitter.emitEvent(runId, 'agent_progress', { message: `Drafting viral content for ${platforms.join(', ')}...` })
    const prompt = `You are a viral Social Media Manager and Growth Hacker.
Task: Analyze the current sentiment and trends for "${brandOrTopic}" and generate viral, highly engaging social media posts.

Platforms required: ${platforms.join(', ')}

Recent Web/Social Context:
${trendsContext}

Your output MUST be a JSON object with this structure:
{
  "sentiment_analysis": "A brief analysis of the current trend/sentiment.",
  "posts": [
    {
      "platform": "Twitter",
      "content": "The actual post text...",
      "hashtags": ["#trend", "#viral"]
    }
  ]
}

Return ONLY valid JSON.`

    const toolStart = Date.now()
    const { content: generatedContent, confidence } = await callLLM(
      agent.config?.model || '',
      'You are a Social Media & Trend analysis agent.',
      prompt,
      3000,
      1,
      runId,
      agent.name
    )

    await traceService.traceToolComplete(runId, agent.name, 'social_generation', {}, Date.now() - toolStart)

    let parsedData = generatedContent
    try {
      parsedData = JSON.parse(generatedContent.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Failed to parse social JSON', e)
    }

    const output: AgentOutput = {
      success: true,
      data: parsedData,
      summary: `Successfully generated social media content for ${brandOrTopic}.`,
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
      summary: 'Social generation failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
