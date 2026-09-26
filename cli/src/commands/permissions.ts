import { ChatboltClient } from '../client'

export interface PermissionsOptions {
  action: 'list' | 'approve' | 'deny'
  runId?: string
  toolId?: string
  reason?: string
  json?: boolean
}

export async function permissionsCommand(options: PermissionsOptions, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { action, runId, toolId, reason, json } = options

  try {
    if (action === 'list') {
      const res = await client.request('GET', '/api/permissions/rules')

      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      const rules = res.data.rules || []
      console.log(`\n🛡️  Standing Permissions & Trust Matrix (${rules.length} active rules)`)
      console.log(`───────────────────────────────────────────────────────────────────────────`)
      if (rules.length === 0) {
        console.log(`  No standing rules defined. Default cautious approval prompt mode active.`)
      } else {
        for (const r of rules) {
          console.log(`[${r.id}] Scope: ${r.scope || '*'} | Category: ${r.category} | Created: ${r.createdAt}`)
        }
      }

      if (res.data.promotions && res.data.promotions.length > 0) {
        console.log(`\n⭐ Suggested Trust Promotions:`)
        for (const p of res.data.promotions) {
          console.log(`  • Agent '${p.agentRole}' has achieved ${p.approvedCount} approvals! Suggested: ${p.suggestedScope}`)
        }
      }
      console.log('')
      return res.data
    }

    if (action === 'approve') {
      if (!runId) throw new Error('Run ID is required to approve permission')
      const res = await client.request('POST', `/api/permissions/approve`, {
        runId,
        toolId,
        approved: true
      })

      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
      } else {
        console.log(`\n✅ Approved tool execution for task run ${runId}\n`)
      }
      return res.data
    }

    if (action === 'deny') {
      if (!runId) throw new Error('Run ID is required to deny permission')
      const res = await client.request('POST', `/api/permissions/approve`, {
        runId,
        toolId,
        approved: false,
        reason: reason || 'Denied via developer CLI'
      })

      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
      } else {
        console.log(`\n🛑 Denied tool execution for task run ${runId}\n`)
      }
      return res.data
    }

    throw new Error(`Unknown permissions action: ${action}`)
  } catch (err: any) {
    if (json) {
      console.log(JSON.stringify({ error: err.message }))
    } else {
      console.error(`Permission operation failed: ${err.message}`)
    }
    process.exitCode = 1
    return { error: err.message }
  }
}
