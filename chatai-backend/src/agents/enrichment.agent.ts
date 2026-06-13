import { logger } from '../services/logger.service';
import { callLLM, safeParseJSON } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runWebSearch } from '../tools/web-search.tool'
import { scrapeUrl } from '../tools/scraper.tool'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

// ── Structured enrichment profile type ───────────────────────────────────────
export interface EnrichmentProfile {
  company_name: string | null
  domain: string | null
  description: string | null
  employee_count_estimate: string | null
  funding_stage: string | null
  tech_stack: string[]
  hiring_signals: string[]
  growth_signals: string[]
  competitors: string[]
  social_profiles: Record<string, string>
  founded_year: number | null
  location: string | null
  industry: string | null
}

// ── Helper: normalise domain from a raw string ────────────────────────────────
function normaliseDomain(raw: string): string {
  try {
    const withProto = raw.startsWith('http') ? raw : `https://${raw}`
    return new URL(withProto).hostname.replace(/^www\./, '')
  } catch {
    return raw.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
  }
}

// ── Core enrichment agent ─────────────────────────────────────────────────────
export async function runEnrichmentAgent(
  agent: WorkflowAgent,
  input: { user_inputs: Record<string, any>; previous_outputs: Record<string, any> },
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []

  try {
    logger.info(`[Agent: ${agent.name}] Starting enrichment...`)
    runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

    // ── Step 1: Resolve the target company/domain ─────────────────────────────
    const { user_inputs, previous_outputs } = input
    const companyRaw: string =
      user_inputs.company ||
      user_inputs.target ||
      previous_outputs.company ||
      previous_outputs.company_name ||
      ''

    const domainRaw: string =
      user_inputs.domain ||
      user_inputs.url ||
      previous_outputs.domain ||
      ''

    if (!companyRaw && !domainRaw) {
      throw new Error(
        'Enrichment agent requires at least one of: user_inputs.company, user_inputs.domain, or user_inputs.target'
      )
    }

    const companyName = companyRaw || domainRaw
    const domain = domainRaw ? normaliseDomain(domainRaw) : ''

    runEmitter.emitEvent(runId, 'agent_progress', {
      message: `Enriching company: ${companyName}${domain ? ` (${domain})` : ''}`,
    })

    // ── Step 2: Web search for company profile ────────────────────────────────
    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Searching web for company profile…' })
    toolsUsed.push('web_search')

    const searchQuery = `${companyName} company profile funding employees industry`
    await traceService.traceToolStart(runId, agent.name, 'web_search', { query: searchQuery })
    const searchStart = Date.now()

    const searchResult = await runWebSearch({ query: searchQuery })

    await traceService.traceToolComplete(
      runId,
      agent.name,
      'web_search',
      searchResult,
      Date.now() - searchStart
    )

    // Also search for funding/hiring signals
    const signaturesSearchResult = await runWebSearch({
      query: `${companyName} hiring jobs funding round tech stack`,
    }).catch(() => ({ query: '', results: [] }))

    // ── Step 3: Scrape company website if domain is known ─────────────────────
    let websiteText = ''
    if (domain) {
      runEmitter.emitEvent(runId, 'agent_progress', { message: `Scraping ${domain}…` })
      toolsUsed.push('scraper')

      const scrapeStart = Date.now()
      await traceService.traceToolStart(runId, agent.name, 'scraper', { url: `https://${domain}` })

      try {
        const scraped = await scrapeUrl({ url: `https://${domain}` })
        websiteText = `\n\n--- ${domain} website ---\n${scraped.text.slice(0, 6000)}`

        await traceService.traceToolComplete(
          runId,
          agent.name,
          'scraper',
          { title: scraped.title, chars: scraped.text.length },
          Date.now() - scrapeStart
        )
      } catch (scrapeErr: any) {
        console.warn(`[Enrichment] Website scrape failed for ${domain}:`, scrapeErr.message)
        await traceService.traceToolComplete(
          runId,
          agent.name,
          'scraper',
          { error: scrapeErr.message },
          Date.now() - scrapeStart
        )
      }
    } else {
      // Try to discover the homepage URL from search results and scrape it
      const firstUrl = searchResult.results.find(
        (r) =>
          r.url &&
          !r.url.includes('linkedin.com') &&
          !r.url.includes('crunchbase.com') &&
          !r.url.includes('wikipedia.org')
      )?.url

      if (firstUrl) {
        try {
          runEmitter.emitEvent(runId, 'agent_progress', { message: `Scraping discovered URL: ${firstUrl}` })
          toolsUsed.push('scraper')
          const scraped = await scrapeUrl({ url: firstUrl })
          websiteText = `\n\n--- Discovered page: ${firstUrl} ---\n${scraped.text.slice(0, 4000)}`
        } catch {
          // swallow — not critical
        }
      }
    }

    // ── Step 4: Build consolidated context for LLM ────────────────────────────
    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Synthesizing enrichment profile…' })

    const webSnippets = [
      ...searchResult.results,
      ...signaturesSearchResult.results,
    ]
      .map((r) => `Title: ${r.title}\nURL: ${r.url}\n${(r as any).fullContent || (r as any).snippet || ''}`)
      .join('\n\n---\n\n')
      .slice(0, 12000)

    const contextBlock = `${webSnippets}${websiteText}`

    const systemPrompt = `You are a B2B intelligence analyst. Your job is to extract and synthesise structured company data from raw web content.

Return ONLY a valid JSON object with exactly these fields (use null if unknown, empty arrays if none found):
{
  "company_name": string,
  "domain": string,
  "description": string (1–3 sentence summary),
  "employee_count_estimate": string (e.g. "50-200", "1000+", "~500"),
  "funding_stage": string (e.g. "Series B", "Bootstrapped", "Seed", "Public", "Unknown"),
  "tech_stack": array of strings,
  "hiring_signals": array of strings (job titles or departments currently hiring),
  "growth_signals": array of strings (e.g. "raised $10M Series A", "expanding to EU"),
  "competitors": array of strings,
  "social_profiles": object with keys like "linkedin", "twitter", "github" and URL values,
  "founded_year": number or null,
  "location": string (HQ city and country),
  "industry": string
}

Do not add any explanation outside the JSON.`

    const userMsg = `Company to enrich: ${companyName}${domain ? ` | Domain: ${domain}` : ''}

Raw web intelligence:
${contextBlock}`

    const model = (agent.config as any)?.model || ''
    const { content: rawJson, confidence } = await callLLM(
      model,
      systemPrompt,
      userMsg,
      3000,
      1,
      runId,
      agent.name
    )

    // ── Step 5: Parse and return ──────────────────────────────────────────────
    let profile: EnrichmentProfile
    try {
      profile = safeParseJSON(rawJson) as EnrichmentProfile
    } catch (parseErr: any) {
      // Best-effort fallback: return raw content and mark partial success
      console.warn('[Enrichment] JSON parse failed, returning partial data:', parseErr.message)
      profile = {
        company_name: companyName || null,
        domain: domain || null,
        description: rawJson.slice(0, 500),
        employee_count_estimate: null,
        funding_stage: null,
        tech_stack: [],
        hiring_signals: [],
        growth_signals: [],
        competitors: [],
        social_profiles: {},
        founded_year: null,
        location: null,
        industry: null,
      }
    }

    // Ensure arrays are actually arrays (LLM sometimes returns null for empty arrays)
    profile.tech_stack = Array.isArray(profile.tech_stack) ? profile.tech_stack : []
    profile.hiring_signals = Array.isArray(profile.hiring_signals) ? profile.hiring_signals : []
    profile.growth_signals = Array.isArray(profile.growth_signals) ? profile.growth_signals : []
    profile.competitors = Array.isArray(profile.competitors) ? profile.competitors : []
    profile.social_profiles =
      profile.social_profiles && typeof profile.social_profiles === 'object'
        ? profile.social_profiles
        : {}

    // Backfill domain from search if LLM left it null
    if (!profile.domain && domain) profile.domain = domain
    if (!profile.company_name && companyName) profile.company_name = companyName

    const output: AgentOutput = {
      success: true,
      data: profile,
      summary: `Enriched ${profile.company_name || companyName}: ${profile.industry || 'unknown industry'}, ${profile.employee_count_estimate || '?'} employees, ${profile.funding_stage || 'unknown'} stage.`,
      output_type: 'json',
      confidence,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0,
      },
    }

    runEmitter.emitEvent(runId, 'agent_done', { agentId: agent.id, summary: output.summary })
    return output
  } catch (err: any) {
    console.error(`[Agent: ${agent?.name || 'Enrichment'}] Fatal Error:`, err.stack)

    const errorOutput: AgentOutput = {
      success: false,
      data: null,
      summary: 'Enrichment failed',
      output_type: 'json',
      confidence: 0,
      error: err.message,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0,
      },
    }

    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent?.id, error: err.message })
    return errorOutput
  }
}
