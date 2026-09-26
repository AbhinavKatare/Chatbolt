import { ChatboltClient } from '../client'

export interface StatusOptions {
  runId?: string
  json?: boolean
}

export async function statusCommand(options: StatusOptions, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { runId, json } = options

  try {
    const endpoint = runId ? `/api/tasks/${runId}/status` : `/api/tasks/active`
    const res = await client.request('GET', endpoint)

    if (res.status >= 400 || !res.data.success) {
      const errorMsg = res.data.error || `HTTP ${res.status}`
      if (json) {
        console.log(JSON.stringify({ error: errorMsg }))
      } else {
        console.error(`Status check failed: ${errorMsg}`)
      }
      process.exitCode = 1
      return { error: errorMsg }
    }

    if (json) {
      console.log(JSON.stringify(res.data, null, 2))
      return res.data
    }

    const { run, steps } = res.data

    if (!run) {
      console.log('\n✨ No active tasks running. System is idle.\n')
      return res.data
    }

    console.log(`\n📊 Task Status: ${run.id}`)
    console.log(`────────────────────────────────────────────────────`)
    console.log(`  Workflow / Prompt: ${run.prompt || run.workflow_name || 'Autonomous Task'}`)
    console.log(`  Current State:     ${run.status.toUpperCase()}`)
    console.log(`  Duration:          ${run.duration_ms ? (run.duration_ms / 1000).toFixed(1) + 's' : 'Active'}`)
    if (run.total_tokens) {
      console.log(`  Tokens Consumed:   ${run.total_tokens}`)
    }
    if (run.total_cost_usd) {
      console.log(`  Estimated Cost:    $${Number(run.total_cost_usd).toFixed(4)} USD`)
    }
    console.log(`────────────────────────────────────────────────────`)

    if (steps && steps.length > 0) {
      console.log(`\nAgent Steps:`)
      for (const step of steps) {
        const icon = step.status === 'completed' ? '✅' : step.status === 'in_progress' ? '⏳' : step.status === 'failed' ? '❌' : '⚪'
        console.log(`  ${icon} [${step.role || 'agent'}] ${step.name || step.id} -> ${step.status}`)
      }
      console.log('')
    }

    return res.data
  } catch (err: any) {
    if (json) {
      console.log(JSON.stringify({ error: err.message }))
    } else {
      console.error(`Error querying task status: ${err.message}`)
    }
    process.exitCode = 1
    return { error: err.message }
  }
}
