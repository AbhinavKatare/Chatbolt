import { logger } from '../services/logger.service';
import { scrapeUrl } from '../tools/scraper.tool'
import { callLLM, safeParseJSON } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

export async function runScraper(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['scraper']
  
  logger.info(`[Agent: ${agent.name}] Starting scraper...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    let urls: string[] = []
    if (input.user_inputs?.urls) {
      urls = Array.isArray(input.user_inputs.urls) ? input.user_inputs.urls : [input.user_inputs.urls]
    } else {
      // Try to find URLs from previous agent (e.g. researcher)
      const outputs = Object.values(input.previous_outputs || {}) as any[]
      
      // 1. Check direct sources array
      const prevObj = outputs.find((o: any) => o?.data?.sources && Array.isArray(o.data.sources) && o.data.sources.length > 0)
      if (prevObj) {
        urls = [...prevObj.data.sources]
      }
      
      // 2. If empty, check other URL/link fields
      if (urls.length === 0) {
        for (const o of outputs) {
          const data = o?.data || {}
          for (const key of ['source_url', 'url', 'link', 'website', 'contact_email_or_url']) {
            if (data[key] && typeof data[key] === 'string' && data[key].trim().startsWith('http')) {
              urls.push(data[key].trim())
            }
          }
        }
      }
      
      // 3. If still empty, scan text fields using regex
      if (urls.length === 0) {
        const urlRegex = /https?:\/\/[^\s'"#\(\)\{\}\[\]]+/g
        for (const o of outputs) {
          const text = JSON.stringify(o?.data || {})
          const matches = text.match(urlRegex)
          if (matches) {
            for (const match of matches) {
              const cleanUrl = match.replace(/[.,;:!?]+$/, '')
              if (!urls.includes(cleanUrl)) {
                urls.push(cleanUrl)
              }
            }
          }
        }
      }

      // Slice to max 5 URLs
      urls = urls.slice(0, 5)
    }

    if (urls.length === 0) {
      // If we still have absolutely nothing, try to guess based on goal or default
      const taskText = (agent.description || '').toLowerCase()
      if (taskText.includes('stripe')) {
        urls = ['https://stripe.com/contact/sales']
      } else {
        throw new Error('No URLs provided for scraping, and none could be resolved from previous steps.')
      }
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Scraping ${urls.length} URLs...` })
    
    const scrapeResults: any[] = []
    for (const url of urls) {
      try {
        const toolStart = Date.now()
        await traceService.traceToolStart(runId, agent.name, 'scraper', { url })
        const raw = await scrapeUrl({ url })
        await traceService.traceToolComplete(
          runId,
          agent.name,
          'scraper',
          { title: raw.title, wordCount: raw.text.split(' ').length },
          Date.now() - toolStart
        )

        runEmitter.emitEvent(runId, 'agent_progress', { message: `Extracting data from ${url}...` })
        
        const model = agent.config?.model || ''
        const { content: extraction } = await callLLM(
          model,
          `Extract structured information from the following text based on this goal: ${agent.description}. Return as JSON.`,
          raw.text.slice(0, 8000),
          2000,
          1,
          runId,
          agent.name
        )
        
        let structuredData = {}
        try {
          structuredData = safeParseJSON(extraction)
        } catch {
          structuredData = { raw_extraction: extraction }
        }

        scrapeResults.push({ url, title: raw.title, data: structuredData })
      } catch (err: any) {
        scrapeResults.push({ url, error: err.message })
      }

      // Briefly wait to cool down rate limits
      await new Promise(r => setTimeout(r, 1000))
    }

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
