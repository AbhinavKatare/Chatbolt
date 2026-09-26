import { ChatboltClient } from '../client'

export interface MemoryOptions {
  action: 'list' | 'add' | 'delete'
  content?: string
  id?: string
  role?: string
  teamId?: string
  category?: 'fact' | 'decision' | 'preference' | 'architecture' | 'constraint'
  json?: boolean
}

export async function memoryCommand(options: MemoryOptions, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { action, content, id, role, teamId, category, json } = options

  try {
    if (action === 'list') {
      const params = new URLSearchParams()
      if (role) params.set('role', role)
      if (teamId) params.set('teamId', teamId)
      if (category) params.set('category', category)

      const queryString = params.toString() ? `?${params.toString()}` : ''
      const res = await client.request('GET', `/api/memory/cross-session${queryString}`)

      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      const memories = res.data.memories || []
      console.log(`\n🧠 Native Cross-Session Memory (${memories.length} items)`)
      console.log(`───────────────────────────────────────────────────────────────────────────`)
      if (memories.length === 0) {
        console.log(`  No remembered facts or constraints found for this scope.`)
      } else {
        for (const m of memories) {
          console.log(`[${m.id}] [${m.category.toUpperCase()}] Role: ${m.agentRole || 'any'} | Team: ${m.teamId || 'global'}`)
          console.log(`  Content: ${m.content}`)
          console.log(`  Updated: ${m.updatedAt || m.createdAt}\n`)
        }
      }
      return res.data
    }

    if (action === 'add') {
      if (!content) {
        throw new Error('Memory content is required. Example: chatbolt memory add "Always use TypeScript strict mode"')
      }

      const res = await client.request('POST', '/api/memory/cross-session', {
        content,
        category: category || 'fact',
        agentRole: role,
        teamId
      })

      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
      } else {
        console.log(`\n✅ Saved cross-session memory [${res.data.memory.id}] (${res.data.memory.category}): "${content}"\n`)
      }
      return res.data
    }

    if (action === 'delete') {
      if (!id) {
        throw new Error('Memory ID is required. Example: chatbolt memory delete mem_123')
      }

      const res = await client.request('DELETE', `/api/memory/cross-session/${id}`)

      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
      } else {
        console.log(`\n🗑️  Deleted cross-session memory [${id}]\n`)
      }
      return res.data
    }

    throw new Error(`Unknown memory action: ${action}`)
  } catch (err: any) {
    if (json) {
      console.log(JSON.stringify({ error: err.message }))
    } else {
      console.error(`Memory operation failed: ${err.message}`)
    }
    process.exitCode = 1
    return { error: err.message }
  }
}
