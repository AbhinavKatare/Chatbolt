import { scrapeUrl } from '../tools/scraper.tool'
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'

export async function runScraper(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['scraper']
  
  console.log(`[Agent: ${agent.name}] Starting scraper...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    let urls: string[] = []
    if (input.user_inputs?.urls) {
      urls = Array.isArray(input.user_inputs.urls) ? input.user_inputs.urls : [input.user_inputs.urls]
    } else {
      // Try to find URLs from previous agent (e.g. researcher)
      const previous = (Object.values(input.previous_outputs || {}) as any[]).find((o: any) => o.data?.sources)?.data
      urls = (previous?.sources || []).slice(0, 5)
    }

    if (urls.length === 0) {
      throw new Error('No URLs provided for scraping.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Scraping ${urls.length} URLs...` })
    
    const scrapeResults = await Promise.all(
      urls.map(async (url) => {
        try {
          const raw = await scrapeUrl({ url })
          runEmitter.emitEvent(runId, 'agent_progress', { message: `Extracting data from ${url}...` })
          
          const model = agent.config?.model || ''
          const { content: extraction } = await callLLM(
            model,
            `Extract structured information from the following text based on this goal: ${agent.description}. Return as JSON.`,
            raw.text.slice(0, 8000)
          )
          
          let structuredData = {}
          try {
            structuredData = JSON.parse(extraction.replace(/```json/g, '').replace(/```/g, '').trim())
          } catch {
            structuredData = { raw_extraction: extraction }
          }

          return { url, title: raw.title, data: structuredData }
        } catch (err: any) {
          return { url, error: err.message }
        }
      })
    )

    const output: AgentOutput = {
      success: true,
      data: { results: scrapeResults },
      summary: `Scraped ${scrapeResults.length} URLs and extracted structured data.`,
      output_type: 'data',
      confidence: 0.85,
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
      summary: 'Scraping failed',
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
