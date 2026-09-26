import { ChatboltClient } from '../client'

export interface RunOptions {
  prompt: string
  team?: string
  model?: string
  role?: string
  watch?: boolean
  json?: boolean
  timeout?: number
}

export async function runCommand(options: RunOptions, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { prompt, team, model, role, watch, json } = options

  if (!prompt || !prompt.trim()) {
    if (json) {
      console.log(JSON.stringify({ error: 'Prompt is required' }))
    } else {
      console.error('Error: Prompt is required. Example: chatbolt run "Analyze market trends"')
    }
    process.exitCode = 1
    return { error: 'Prompt is required' }
  }

  // 1. Submit task to Node Gateway
  let res: { status: number; data: any }
  try {
    res = await client.request('POST', '/api/tasks/cli-run', {
      prompt,
      teamId: team,
      model: model || 'openai/gpt-4o',
      role: role || 'team_lead',
      source: 'cli'
    })
  } catch (err: any) {
    if (json) {
      console.log(JSON.stringify({ error: err.message }))
    } else {
      console.error(`Failed to submit task: ${err.message}`)
    }
    process.exitCode = 1
    return { error: err.message }
  }

  if (res.status >= 400 || !res.data.success) {
    const errorMsg = res.data.error || `HTTP ${res.status}`
    if (json) {
      console.log(JSON.stringify({ error: errorMsg }))
    } else {
      console.error(`Task submission rejected: ${errorMsg}`)
    }
    process.exitCode = 1
    return { error: errorMsg }
  }

  const { runId, teamId, status, estimatedCostUsd, createdAt, dashboardUrl } = res.data

  // 2. If JSON mode and NOT watching, return JSON output immediately
  if (json && !watch) {
    console.log(JSON.stringify({
      success: true,
      runId,
      teamId,
      status,
      estimatedCostUsd,
      createdAt,
      dashboardUrl: dashboardUrl || `http://localhost:3000/dashboard/activity`
    }, null, 2))
    return res.data
  }

  // 3. Human-readable standard UNIX output (No terminal takeover)
  if (!watch) {
    console.log(`\n⚡ Task Dispatched Successfully`)
    console.log(`────────────────────────────────────────────────────`)
    console.log(`  Run ID:         ${runId}`)
    console.log(`  Team:           ${teamId || 'Default Autonomous Squad'}`)
    console.log(`  Status:         ${status}`)
    console.log(`  Estimated Cost: $${estimatedCostUsd ? estimatedCostUsd.toFixed(4) : '0.0050'} USD`)
    console.log(`  Dashboard:      ${dashboardUrl || 'http://localhost:3000/dashboard/activity'}`)
    console.log(`────────────────────────────────────────────────────`)
    console.log(`💡 Tip: Run 'chatbolt status ${runId}' or attach with 'chatbolt run --watch ...'\n`)
    return res.data
  }

  // 4. Live streaming with --watch / --attach
  if (!json) {
    console.log(`\n📡 Attached to live execution stream for Run ID: ${runId}`)
    console.log(`(Press Ctrl+C at any time to detach; task continues in background)\n`)
  }

  return new Promise((resolve) => {
    let completed = false

    client.streamSSE(
      `/api/tasks/${runId}/stream`,
      (event) => {
        if (json) {
          console.log(JSON.stringify({ streamEvent: event.event, payload: event.data }))
        } else {
          switch (event.event) {
            case 'agent_start':
              console.log(`🤖 [${event.data.role || 'agent'}] Started task...`)
              break
            case 'agent_progress':
              console.log(`  ⚙️  [${event.data.role || 'agent'}] ${event.data.message || event.data.step || 'Processing...'}`)
              break
            case 'tool_executing':
              console.log(`  🔧 Executing tool: ${event.data.tool || 'sandbox'}...`)
              break
            case 'accountability:logged':
              console.log(`  📝 Rationale: ${event.data.why || 'Executing planned task'}`)
              break
            case 'metering:step_cost':
              console.log(`  💰 Step Cost: $${Number(event.data.costUsd || 0).toFixed(5)} (${event.data.tokens || 0} tokens)`)
              break
            case 'agent_done':
            case 'task_complete':
            case 'task:completed':
              completed = true
              console.log(`\n✅ Task Completed: ${event.data.summary || 'All agents finished successfully'}`)
              if (event.data.totalCostUsd !== undefined) {
                console.log(`💵 Total Spend: $${Number(event.data.totalCostUsd).toFixed(5)} USD`)
              }
              resolve({ success: true, runId, status: 'completed', data: event.data })
              break
            case 'agent_error':
            case 'task:failed':
              completed = true
              console.error(`\n❌ Task Failed: ${event.data.error || 'Execution encountered an error'}`)
              resolve({ success: false, runId, status: 'failed', error: event.data.error })
              break
          }
        }

        if (event.event === 'task:completed' || event.event === 'task_complete' || event.event === 'agent_done') {
          if (!completed) {
            completed = true
            resolve({ success: true, runId, status: 'completed' })
          }
        }
      },
      (err) => {
        if (!completed) {
          if (!json) console.log(`[Stream Closed] Task continuing in background. Check with 'chatbolt status ${runId}'`)
          resolve({ success: true, runId, streamClosed: true })
        }
      },
      () => {
        if (!completed) {
          resolve({ success: true, runId, streamClosed: true })
        }
      }
    )
  })
}
