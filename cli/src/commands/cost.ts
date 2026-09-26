import { ChatboltClient } from '../client'

export interface CostOptions {
  teamId?: string
  json?: boolean
}

export async function costCommand(options: CostOptions, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { teamId, json } = options

  try {
    const params = new URLSearchParams()
    if (teamId) params.set('teamId', teamId)
    const queryString = params.toString() ? `?${params.toString()}` : ''

    const res = await client.request('GET', `/api/metering/summary${queryString}`)

    if (res.status >= 400 || !res.data.success) {
      throw new Error(res.data.error || `HTTP ${res.status}`)
    }

    if (json) {
      console.log(JSON.stringify(res.data, null, 2))
      return res.data
    }

    const { summary } = res.data
    console.log(`\n💵 Chatbolt Financial & Token Spend Summary`)
    console.log(`───────────────────────────────────────────────────────────────────────────`)
    console.log(`  Total Cost:         $${Number(summary.totalCostUsd || 0).toFixed(4)} USD`)
    console.log(`  Total Tokens:       ${(summary.totalTokens || 0).toLocaleString()}`)
    console.log(`  Prompt Tokens:      ${(summary.promptTokens || 0).toLocaleString()}`)
    console.log(`  Completion Tokens:  ${(summary.completionTokens || 0).toLocaleString()}`)
    console.log(`  Cached Tokens:      ${(summary.cachedTokens || 0).toLocaleString()}`)
    console.log(`  Compute Time:       ${((summary.computeDurationMs || 0) / 1000).toFixed(2)}s`)
    console.log(`  Total Executions:   ${summary.totalSteps || 0}`)
    console.log(`───────────────────────────────────────────────────────────────────────────\n`)

    return res.data
  } catch (err: any) {
    if (json) {
      console.log(JSON.stringify({ error: err.message }))
    } else {
      console.error(`Cost summary query failed: ${err.message}`)
    }
    process.exitCode = 1
    return { error: err.message }
  }
}

export async function modelsCommand(json?: boolean, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  try {
    const res = await client.request('GET', '/api/metering/pricing-catalog')

    if (res.status >= 400 || (res.data && res.data.success === false)) {
      throw new Error(res.data?.error || `HTTP ${res.status}`)
    }

    const payload = { success: true, ...res.data }

    if (json) {
      console.log(JSON.stringify(payload, null, 2))
      return payload
    }

    const catalog = res.data.models || []
    console.log(`\n📋 Authoritative Non-Marked-Up Model Pricing Catalog ($/1M Tokens)`)
    console.log(`───────────────────────────────────────────────────────────────────────────`)
    for (const m of catalog) {
      const isBYOK = m.inputCostPer1M === 0 && m.outputCostPer1M === 0
      const tag = isBYOK ? ' (BYOK Local / $0)' : ''
      console.log(`  • ${m.model.padEnd(36)} Input: $${m.inputCostPer1M.toFixed(2)} | Output: $${m.outputCostPer1M.toFixed(2)}${tag}`)
    }
    console.log(`───────────────────────────────────────────────────────────────────────────\n`)
    return res.data
  } catch (err: any) {
    if (json) {
      console.log(JSON.stringify({ error: err.message }))
    } else {
      console.error(`Models catalog query failed: ${err.message}`)
    }
    process.exitCode = 1
    return { error: err.message }
  }
}
