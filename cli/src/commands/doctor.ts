import { ChatboltClient } from '../client'

export async function doctorCommand(json?: boolean, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const checks: any[] = []

  // 1. Node Gateway Check
  try {
    const res = await client.request('GET', '/health')
    checks.push({
      component: 'Node.js Gateway Backend',
      url: client.getConfig().apiUrl,
      status: res.status === 200 ? 'healthy' : 'unhealthy',
      details: res.data
    })
  } catch (err: any) {
    checks.push({
      component: 'Node.js Gateway Backend',
      url: client.getConfig().apiUrl,
      status: 'unreachable',
      error: err.message
    })
  }

  // 2. Pricing & Metering Check
  try {
    const res = await client.request('GET', '/api/metering/pricing-catalog')
    checks.push({
      component: 'Metering & Pricing Engine',
      status: res.status === 200 ? 'healthy' : 'unhealthy',
      modelsAvailable: res.data?.models?.length || 0
    })
  } catch (err: any) {
    checks.push({
      component: 'Metering & Pricing Engine',
      status: 'unreachable',
      error: err.message
    })
  }

  // 3. Tripartite Architecture Matrix
  const architecture = {
    dashboard: {
      role: 'Primary Command Center (Next.js Web UI)',
      features: ['Visual Team Workforce Builder', 'Session Replay Decision Trails', 'Cost & Metering Intelligence', 'Standing Permission Matrix', 'Cross-Session Memory Curation']
    },
    cli: {
      role: 'Developer Thin Client (@chatbolt/cli)',
      features: ['Non-blocking UNIX commands (no terminal hijacking)', 'Optional live --watch SSE stream', 'Scriptable / Pipeable JSON output', 'Instant bidirectional sync with Dashboard']
    },
    extension: {
      role: 'Browser Sensor & Execution Bridge (chatai-extension)',
      features: ['DOM inspection & tree extraction', 'Web automation & form handling', 'Contextual page scraping to Node Gateway']
    }
  }

  if (json) {
    console.log(JSON.stringify({ success: true, checks, architecture }, null, 2))
    return { checks, architecture }
  }

  console.log(`\n🏥 Chatbolt System Health & Tripartite Architecture`)
  console.log(`═══════════════════════════════════════════════════════════════════════════`)
  for (const c of checks) {
    const icon = c.status === 'healthy' ? '✅' : '❌'
    console.log(`  ${icon} ${c.component.padEnd(30)}: ${c.status.toUpperCase()}`)
  }
  console.log(`───────────────────────────────────────────────────────────────────────────`)
  console.log(`📐 Architecture Role Delineation:`)
  console.log(`  1. Next.js Dashboard:    ${architecture.dashboard.role}`)
  console.log(`  2. Chatbolt CLI:         ${architecture.cli.role}`)
  console.log(`  3. Chrome Extension:     ${architecture.extension.role}`)
  console.log(`═══════════════════════════════════════════════════════════════════════════\n`)

  return { checks, architecture }
}
