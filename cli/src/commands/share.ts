import { ChatboltClient } from '../client'

export interface ShareOptions {
  runId: string
  expiresInDays?: number
  revoke?: boolean
  json?: boolean
}

export async function shareCommand(options: ShareOptions, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { runId, expiresInDays, revoke, json } = options

  if (!runId) {
    if (json) {
      console.log(JSON.stringify({ error: 'Run ID is required' }))
    } else {
      console.error('Error: Run ID is required. Example: chatbolt share run_123')
    }
    process.exitCode = 1
    return { error: 'Run ID is required' }
  }

  try {
    if (revoke) {
      const res = await client.request('DELETE', `/api/sessions/${runId}/share`)
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }
      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
      } else {
        console.log(`\n🔒 Revoked public share link for run ${runId}\n`)
      }
      return res.data
    }

    const res = await client.request('POST', `/api/sessions/${runId}/share`, {
      expiresInDays: expiresInDays || 7
    })

    if (res.status >= 400 || !res.data.success) {
      throw new Error(res.data.error || `HTTP ${res.status}`)
    }

    if (json) {
      console.log(JSON.stringify(res.data, null, 2))
      return res.data
    }

    const { shareUrl, shareToken, expiresAt } = res.data
    console.log(`\n🔗 Shareable Session Replay Created`)
    console.log(`───────────────────────────────────────────────────────────────────────────`)
    console.log(`  Public Link:    ${shareUrl}`)
    console.log(`  Share Token:    ${shareToken}`)
    console.log(`  Expires At:     ${expiresAt || 'Never'}`)
    console.log(`  Privacy Guard:  All PII (emails, tokens, API keys) scrubbed automatically.`)
    console.log(`───────────────────────────────────────────────────────────────────────────`)
    console.log(`💡 To revoke at any time: chatbolt share ${runId} --revoke\n`)

    return res.data
  } catch (err: any) {
    if (json) {
      console.log(JSON.stringify({ error: err.message }))
    } else {
      console.error(`Share link operation failed: ${err.message}`)
    }
    process.exitCode = 1
    return { error: err.message }
  }
}
