import { ChatboltClient } from '../client'

export interface ReplayOptions {
  runId: string
  format?: 'text' | 'json'
  json?: boolean
}

export async function replayCommand(options: ReplayOptions, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { runId, format, json } = options

  if (!runId) {
    if (json) {
      console.log(JSON.stringify({ error: 'Run ID is required' }))
    } else {
      console.error('Error: Run ID is required. Example: chatbolt replay run_123')
    }
    process.exitCode = 1
    return { error: 'Run ID is required' }
  }

  try {
    const res = await client.request('GET', `/api/sessions/${runId}/replay`)

    if (res.status >= 400 || !res.data.success) {
      const errorMsg = res.data.error || `HTTP ${res.status}`
      if (json) {
        console.log(JSON.stringify({ error: errorMsg }))
      } else {
        console.error(`Replay retrieval failed: ${errorMsg}`)
      }
      process.exitCode = 1
      return { error: errorMsg }
    }

    if (json || format === 'json') {
      console.log(JSON.stringify(res.data, null, 2))
      return res.data
    }

    const { replay } = res.data
    const goal = replay.missionGoal || replay.goal || 'Autonomous Task'
    const durationMs = replay.durationMs || 0
    const totalCost = replay.costSummary?.totalSessionCostUSD ?? replay.totalCostUsd ?? 0
    const totalTokens = replay.costSummary?.totalTokens ?? replay.totalTokens ?? 0
    const timeline = replay.timeline || replay.steps || []
    const itemized = replay.costSummary?.modelItemizedCosts || replay.costBreakdown || []

    console.log(`\n🎞️  Session Replay: ${replay.runId}`)
    console.log(`═══════════════════════════════════════════════════════════════════════════`)
    console.log(`  Goal:           ${goal}`)
    console.log(`  Status:         ${(replay.status || 'completed').toUpperCase()}`)
    console.log(`  Duration:       ${(durationMs / 1000).toFixed(1)}s`)
    console.log(`  Total Spend:    $${Number(totalCost).toFixed(4)} USD (${totalTokens} tokens)`)
    console.log(`═══════════════════════════════════════════════════════════════════════════\n`)

    if (itemized.length > 0) {
      console.log(`💰 Itemized Spend by Model:`)
      for (const item of itemized) {
        console.log(`  • ${item.model}: $${(item.costUSD ?? item.costUsd ?? 0).toFixed(5)} USD (${item.promptTokens + item.completionTokens || item.tokens || 0} tokens)`)
      }
      console.log('')
    }

    console.log(`⏱️  Execution Timeline:`)
    console.log(`───────────────────────────────────────────────────────────────────────────`)
    for (const step of timeline) {
      const idx = step.stepIndex ?? step.stepNumber ?? 1
      const action = step.actionType ?? step.action ?? 'Executed step'
      const cost = step.stepCostUSD ?? step.costUsd ?? 0
      const tokens = (step.promptTokens + step.completionTokens) || step.tokens || 0
      console.log(`[Step ${idx}] ${(step.agentRole || 'agent').toUpperCase()} -> ${action}`)
      if (step.rationale) {
        console.log(`  🧠 Rationale: ${step.rationale}`)
      }
      if (step.toolName) {
        console.log(`  🔧 Tool:      ${step.toolName} (${step.outputSummary || 'executed'})`)
      }
      if (step.approvalStatus || step.permissionStatus) {
        console.log(`  🛡️  Security:  ${step.approvalStatus || step.permissionStatus}`)
      }
      console.log(`  💵 Step Cost: $${Number(cost).toFixed(5)} (${tokens} tokens)\n`)
    }

    return res.data
  } catch (err: any) {
    if (json) {
      console.log(JSON.stringify({ error: err.message }))
    } else {
      console.error(`Error querying session replay: ${err.message}`)
    }
    process.exitCode = 1
    return { error: err.message }
  }
}
