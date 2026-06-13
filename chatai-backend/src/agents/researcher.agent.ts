import { logger } from '../services/logger.service';
import { callLLM, safeParseJSON } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runWebSearch } from '../tools/web-search.tool'
import { scrapeUrl } from '../tools/scraper.tool'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

export async function runResearcher(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  try {
    logger.info(`[Agent: ${agent.name}] Starting research...`)
    runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

    const model = (agent.config as any)?.model || ''
    let queries: string[] = []
    const isSimpleBypass = (agent.config as any)?.workflow_type === 'simple' || 
                           agent.description.toLowerCase().includes('restaurants') || 
                           agent.description.toLowerCase().includes('weather') || 
                           agent.description.toLowerCase().includes('youtube') ||
                           agent.description.toLowerCase().includes('google') ||
                           agent.description.toLowerCase().includes('channel')

    if (isSimpleBypass) {
      logger.info(`[Agent: ${agent.name}] ⚡ Fast Simple Bypass active. Bypassing query generation.`)
      queries = [agent.description]
    } else {
      // Step 1: Generate search queries
      runEmitter.emitEvent(runId, 'agent_progress', { message: 'Generating search queries...' })
      
      const { content: queriesRaw } = await callLLM(
        model,
        'You are a research query generator. Generate 3-5 specific search queries for the task. Return ONLY a JSON array of strings.',
        `Task: ${agent.description}\nUser Inputs: ${JSON.stringify(input.user_inputs)}`,
        2000,
        1,
        runId,
        agent.name
      )
      
      try {
        queries = safeParseJSON(queriesRaw)
      } catch {
        queries = [agent.description]
      }
    }

    // Step 2: Search web
    runEmitter.emitEvent(runId, 'agent_progress', { message: `Searching web for ${queries.length} queries...` })
    toolsUsed.push('web_search')
    const searchStart = Date.now()
    await traceService.traceToolStart(runId, agent.name, 'web_search', { queries: queries.slice(0, 3) })
    
    const searchResults = await Promise.all(
      queries.slice(0, 3).map(q => runWebSearch({ query: q }))
    )
    
    await traceService.traceToolComplete(
      runId,
      agent.name,
      'web_search',
      searchResults,
      Date.now() - searchStart
    )

    // Step 3: Scrape top results
    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Scraping and analyzing content...' })
    toolsUsed.push('scraper')
    const allText = searchResults
      .flatMap(res => res.results)
      .map(r => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.fullContent || r.snippet}`)
      .join('\n\n---\n\n')

    // Step 4: Synthesize
    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Synthesizing findings...' })
    const { content: report, confidence } = await callLLM(
      model,
      agent.system_prompt,
      `Task: ${agent.description}\n\nResearch Data:\n${allText.slice(0, 15000)}\n\nProvide a comprehensive report with sources and key facts.`,
      2000,
      1,
      runId,
      agent.name
    )

    // Formatter pass to ensure structural layout & executive summary (Phase 6)
    let formattedReport = report
    try {
      const { reportFormatterService } = await import('../services/report-formatter.service')
      const formatted = await reportFormatterService.formatResearchReport(report, agent.description, agent.tenant_id)
      formattedReport = formatted.markdown
    } catch (fmtErr: any) {
      console.warn('[Researcher] Report formatting pass failed:', fmtErr.message)
    }

    let keyFacts: any[] = []
    try {
      const allUrls = searchResults.flatMap(res => res.results.map(r => r.url))
      if (allUrls.length > 0) {
        const factsPrompt = `You are a Fact Extractor.
Extract 3-5 key facts from the report, mapping each fact to its source URL from the provided list.
For each fact, extract the URL and the domain name of the source.

Research sources:
${allUrls.join('\n')}

Report:
${report}

Return ONLY a JSON array of objects matching this format:
[{"fact": "Short fact", "url": "http...", "domain": "example.com"}]`

        const { content: factsRaw } = await callLLM(
          model,
          'You are a source and fact mapper. Return ONLY valid JSON.',
          factsPrompt,
          1000,
          1,
          runId,
          agent.name
        )
        keyFacts = safeParseJSON(factsRaw) || []
      }
    } catch (factsErr: any) {
      console.warn('[Researcher] Facts extraction failed:', factsErr.message)
    }

    const output: AgentOutput = {
      success: true,
      data: {
        report: formattedReport,
        sources: searchResults.flatMap(res => res.results.map(r => r.url)),
        key_facts: keyFacts
      },
      summary: `Research complete. Analyzed ${searchResults.length} queries and generated report.`,
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
    console.error(`[Agent: ${agent?.name || 'Unknown'}] Fatal Error:`, err.stack)
    const errorOutput: AgentOutput = {
      success: false,
      data: null,
      summary: 'Research failed',
      output_type: 'text',
      confidence: 0,
      error: err.message,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent?.id, error: err.message })
    return errorOutput
  }
}
