import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runWebSearch } from '../tools/web-search.tool'
import { scrapeUrl } from '../tools/scraper.tool'
import { runEmitter } from '../services/sse.service'

export async function runResearcher(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  try {
    console.log(`[Agent: ${agent.name}] Starting research...`)
    runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

    // Step 1: Generate search queries
    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Generating search queries...' })
    
    const model = agent.config?.model || ''
    
    const { content: queriesRaw } = await callLLM(
      model,
      'You are a research query generator. Generate 3-5 specific search queries for the task. Return ONLY a JSON array of strings.',
      `Task: ${agent.description}\nUser Inputs: ${JSON.stringify(input.user_inputs)}`
    )
    
    let queries: string[] = []
    try {
      queries = JSON.parse(queriesRaw.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch {
      queries = [agent.description]
    }

    // Step 2: Search web
    runEmitter.emitEvent(runId, 'agent_progress', { message: `Searching web for ${queries.length} queries...` })
    toolsUsed.push('web_search')
    const searchResults = await Promise.all(
      queries.slice(0, 3).map(q => runWebSearch({ query: q }))
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
      `Task: ${agent.description}\n\nResearch Data:\n${allText.slice(0, 15000)}\n\nProvide a comprehensive report with sources and key facts.`
    )

    const output: AgentOutput = {
      success: true,
      data: {
        report,
        sources: searchResults.flatMap(res => res.results.map(r => r.url)),
        key_facts: [] 
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
