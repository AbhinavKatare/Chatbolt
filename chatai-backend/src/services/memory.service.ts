import { db } from '../db'
import { embedText, callLLM, safeParseJSON } from '../agents/base.agent'
import { logger } from './logger.service'

// ── Short-Term Memory ──────────────────────────────────────────

export async function getShortTermMemory(runId: string, agentId: string) {
  const { rows } = await db.query(
    'SELECT input_data, output_data FROM workflow_steps WHERE run_id = $1 AND agent_id = $2 ORDER BY step_number DESC LIMIT 10',
    [runId, agentId]
  )
  return rows
}

/**
 * Compresses recent step outputs into a dense structural JSON checkpoint to prevent context explosion.
 */
export async function compressShortTermMemory(runId: string, agentId: string, tenantId = '00000000-0000-0000-0000-000000000000'): Promise<string> {
  logger.info(`[Memory] Compressing short-term memory logs for Agent ID: ${agentId} / Run ID: ${runId}`)

  // 1. Fetch recent steps
  const steps = await getShortTermMemory(runId, agentId)
  if (steps.length === 0) {
    return JSON.stringify({ key_facts: [], completed_actions: [], state_summary: 'No prior outputs available for compression.' })
  }

  // 2. Format step logs
  const logsText = steps.map((s, idx) => {
    let output: any = s.output_data
    if (typeof output === 'string') {
      try { output = safeParseJSON(output) } catch { output = { summary: output } }
    }
    return `Step ${idx + 1}:\n- Output Summary: ${output?.summary || ''}\n- Output Data: ${JSON.stringify(output?.data || {})}`
  }).join('\n\n')

  // 3. Prompt LLM to produce compressed context summary
  const systemPrompt = `You are a Cognitive Context Compression Engine. Your role is to take a detailed stream of recent agent step execution logs and compress them into a highly concise, dense, structural JSON checkpoint containing key facts, findings, and completed actions.
Your output must be very concise to minimize token footprint while retaining all critical data.`

  const userMsg = `Logs to compress:\n${logsText}\n\nProduce a dense structural summary. Return ONLY a single valid JSON object containing {"key_facts": ["...", "..."], "completed_actions": ["...", "..."], "state_summary": "..."}`

  try {
    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content: compressedJSON } = await callLLM(modelToUse, systemPrompt, userMsg, 1000)

    // Save this compressed representation in long-term memory for future reference
    await saveMemory(agentId, tenantId, `run_${runId}_compressed`, compressedJSON, 'compression')

    return compressedJSON
  } catch (err: any) {
    console.error(`[Memory] Compression failed: ${err.message}`)
    return JSON.stringify({ key_facts: [], completed_actions: [], state_summary: 'Compression failed' })
  }
}

// ── Long-Term Memory (Episodic Facts & Preferences) ───────────────────────────

export async function saveMemory(
  agentId: string | null,
  tenantId: string,
  key: string,
  value: string,
  category = 'fact',
  importance = 5
) {
  let embeddingStr: string | null = null
  try {
    const emb = await embedText(`${key}: ${value}`)
    embeddingStr = `[${emb.join(',')}]`
  } catch (err: any) {
    console.warn('[Memory] Failed to generate embedding for key:', key, err.message)
  }

  // Check if a record already exists with this key
  let check
  if (agentId) {
    check = await db.query(
      'SELECT id FROM agent_memory WHERE agent_id = $1 AND key = $2',
      [agentId, key]
    )
  } else {
    check = await db.query(
      'SELECT id FROM agent_memory WHERE tenant_id = $1 AND agent_id IS NULL AND key = $2',
      [tenantId, key]
    )
  }

  if (check.rows.length > 0) {
    if (agentId) {
      await db.query(
        `UPDATE agent_memory 
         SET value = $1, last_accessed = NOW(), category = $2, importance = $3, embedding = COALESCE($4, embedding)
         WHERE agent_id = $5 AND key = $6`,
        [value, category, importance, embeddingStr, agentId, key]
      )
    } else {
      await db.query(
        `UPDATE agent_memory 
         SET value = $1, last_accessed = NOW(), category = $2, importance = $3, embedding = COALESCE($4, embedding)
         WHERE tenant_id = $5 AND agent_id IS NULL AND key = $6`,
        [value, category, importance, embeddingStr, tenantId, key]
      )
    }
  } else {
    await db.query(
      `INSERT INTO agent_memory (agent_id, tenant_id, key, value, category, importance, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [agentId || null, tenantId, key, value, category, importance, embeddingStr]
    )
  }
}

export async function getMemory(agentId: string, key: string) {
  const { rows } = await db.query(
    'SELECT value FROM agent_memory WHERE agent_id = $1 AND key = $2',
    [agentId, key]
  )
  return rows[0]?.value
}

export async function searchMemory(agentId: string, query: string) {
  const { rows } = await db.query(
    `SELECT key, value FROM agent_memory 
     WHERE agent_id = $1 
     AND (key ILIKE $2 OR value ILIKE $2) 
     ORDER BY importance DESC LIMIT 5`,
     [agentId, `%${query}%`]
  )
  return rows
}

/**
 * Parses user messages to detect and harvest persistent preferences or facts, enlisting them in long-term memory.
 */
export async function extractAndSaveUserFacts(tenantId: string, agentId: string, userMessage: string): Promise<void> {
  const detectPrompt = `You are a Long-Term Episodic Memory and Preference Harvester.
Your role is to analyze the user's message and determine if it contains any persistent personal preferences, facts, or instructions (e.g. "I prefer dark mode", "My company is Slack", "Use Mistral models", "Always copy my manager abhinav@example.com").

User Message: "${userMessage}"

If there are persistent facts/preferences, extract them.
Return a valid JSON array of objects, each containing:
{ "key": "unique_semantic_key", "value": "the extracted value", "importance": 1 to 10 }
If no facts/preferences are present, return an empty array: []

Return ONLY valid JSON. No explanations, no markdown fences.`

  try {
    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content: res } = await callLLM(modelToUse, detectPrompt, 'Extract facts from user message.', 800)

    // Extract JSON array — handle both array-only and object-wrapped responses
    let parsed: any[] = []
    const trimmed = res.trim()
    const arrStart = trimmed.indexOf('[')
    const arrEnd = trimmed.lastIndexOf(']')
    if (arrStart !== -1 && arrEnd !== -1) {
      try { parsed = safeParseJSON(trimmed.substring(arrStart, arrEnd + 1)) } catch {}
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.key && item.value) {
          logger.info(`[Memory] Harvesting preference: ${item.key} = ${item.value}`)
          await saveMemory(agentId, tenantId, item.key, item.value, 'preference', item.importance || 5)
        }
      }
    }
  } catch (err: any) {
    console.warn(`[Memory] Fact harvesting failed: ${err.message}`)
  }
}

// ── Vector Memory ──────────────────────────────────────────────

export async function storeVectorMemory(
  agentId: string,
  text: string,
  metadata = {}
) {
  const embedding = await embedText(text)
  
  await db.query(
    `INSERT INTO agent_chunks (agent_id, content, metadata, embedding)
     VALUES ($1, $2, $3, $4)`,
    [agentId, text, JSON.stringify(metadata), `[${embedding.join(',')}]`]
  )
}

export async function searchVectorMemory(
  agentId: string,
  query: string,
  limit = 5
) {
  const embedding = await embedText(query)
  const embeddingStr = `[${embedding.join(',')}]`
  
  const { rows } = await db.query(
    `SELECT content, metadata,
            COALESCE(1 - (embedding <=> $2::vector), 0)::float AS similarity
     FROM agent_chunks
     WHERE agent_id = $1
     AND COALESCE(1 - (embedding <=> $2::vector), 0) > 0.28
     ORDER BY similarity DESC
     LIMIT $3`,
    [agentId, embeddingStr, limit]
  )
  
  return rows
}

/**
 * Hydrates context by retrieving persistent preferences and facts from long-term memory for a tenant.
 */
export async function hydrateContext(tenantId: string, conversationId: string, queryText?: string): Promise<string> {
  try {
    let rows: any[] = []
    
    if (queryText) {
      try {
        const emb = await embedText(queryText)
        const embeddingStr = `[${emb.join(',')}]`
        const { rows: matchedRows } = await db.query(
          `SELECT key, value, category,
                  COALESCE(1 - (embedding <=> $2::vector), 0)::float AS similarity
           FROM agent_memory
           WHERE tenant_id = $1
           ORDER BY similarity DESC, importance DESC
           LIMIT 5`,
          [tenantId, embeddingStr]
        )
        rows = matchedRows
      } catch (err: any) {
        console.warn('[Memory] Vector similarity context hydration failed, using fallback:', err.message)
      }
    }
    
    if (rows.length === 0) {
      const { rows: fallbackRows } = await db.query(
        'SELECT key, value FROM agent_memory WHERE tenant_id = $1 ORDER BY importance DESC LIMIT 10',
        [tenantId]
      )
      rows = fallbackRows
    }
    
    if (rows.length === 0) return ''
    return `\n\n[RECALLED SESSION FACTS & PREFERENCES]\n` + rows.map(r => `- ${r.key}: ${r.value}`).join('\n')
  } catch (err: any) {
    console.error('[Memory] Failed to hydrate context:', err.message)
    return ''
  }
}

/**
 * After task completion, parses the task result for durable facts worth storing.
 * Automatically saves names, company references, recurring preferences, and settings.
 */
export async function extractAndStoreSessionFacts(
  conversationId: string,
  tenantId: string,
  taskResult: { prompt: string; output?: string; workflow_name?: string }
): Promise<void> {
  const { logger } = await import('./logger.service')
  const text = `User request: ${taskResult.prompt}\n${taskResult.output ? 'Result: ' + taskResult.output.slice(0, 500) : ''}`

  const detectPrompt = `You are a Persistent Fact Extractor.
Analyze this task interaction and extract any durable user facts worth remembering long-term:
- Names of people the user mentions regularly (category: "person")
- Company/project names, tools, or services (category: "entity")
- Recurring preferences (communication style, format preferences, tools) (category: "preference")
- Recurring tasks, routines, or timing patterns (category: "pattern")

Interaction:
${text}

Return a JSON array of extracted facts:
[{ "key": "unique_key", "value": "fact_value", "category": "preference" | "person" | "entity" | "pattern", "importance": 1-10 }]
Return [] if no durable facts found. Return ONLY valid JSON.`

  try {
    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content } = await callLLM(modelToUse, detectPrompt, 'Extract durable facts.', 600)
    const trimmed = content.trim()
    const arrStart = trimmed.indexOf('[')
    const arrEnd = trimmed.lastIndexOf(']')
    if (arrStart === -1 || arrEnd === -1) return

    const parsed: Array<{ key: string; value: string; category: string; importance: number }> = safeParseJSON(trimmed.substring(arrStart, arrEnd + 1))
    if (!Array.isArray(parsed)) return

    for (const item of parsed) {
      if (item.key && item.value) {
        logger.info(`[Memory] Auto-tagging session fact: ${item.key} (category: ${item.category || 'fact'})`)
        await saveMemory(null, tenantId, `session_fact_${item.key}`, item.value, item.category || 'fact', item.importance || 5)
      }
    }
    // Trigger memory size guard consolidation
    await consolidateIfNeeded(tenantId)
  } catch (err: any) {
    // Silent fail — fact extraction is best-effort
  }
}

/**
 * Consolidates user memory facts if they exceed 1000 items, merging duplicates and resolving conflicts using LLM.
 */
export async function consolidateIfNeeded(tenantId: string): Promise<void> {
  const { logger } = await import('./logger.service')
  try {
    const { rows: countRows } = await db.query(
      'SELECT COUNT(*)::integer FROM agent_memory WHERE tenant_id = $1',
      [tenantId]
    )
    const totalCount = countRows[0]?.count || 0
    if (totalCount < 1000) return

    logger.info(`[Memory] Consolidating memories for tenant ${tenantId}. Total: ${totalCount}`)
    
    // Fetch all memories
    const { rows: memories } = await db.query(
      'SELECT id, key, value, category, importance FROM agent_memory WHERE tenant_id = $1 ORDER BY importance DESC',
      [tenantId]
    )

    // Batch compile facts
    const factsList = memories.map(m => `- [${m.category}] ${m.key}: ${m.value} (importance: ${m.importance})`).join('\n')

    const consolidationPrompt = `You are a Cognitive Memory Consolidator.
Analyze this list of user facts and preferences. Some facts may be redundant, duplicate, contradictory, or outdated.
Consolidate the list into a clean, concise, high-value set of facts (target: maximum 100 total facts, preserving the most important preferences).
Remove any facts that contradict newer/more important facts.

List of facts:
${factsList}

Return a JSON array matching this format (maximum 100 entries):
[{ "key": "semantic_key", "value": "consolidated_value", "category": "preference" | "person" | "entity" | "pattern", "importance": 1-10 }]`

    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content } = await callLLM(modelToUse, consolidationPrompt, 'Consolidate memory.', 2000)
    const trimmed = content.trim()
    const arrStart = trimmed.indexOf('[')
    const arrEnd = trimmed.lastIndexOf(']')
    if (arrStart === -1 || arrEnd === -1) return

    const parsed: Array<{ key: string; value: string; category: string; importance: number }> = safeParseJSON(trimmed.substring(arrStart, arrEnd + 1))
    if (!Array.isArray(parsed) || parsed.length === 0) return

    // Clean up current memories and replace
    await db.query('DELETE FROM agent_memory WHERE tenant_id = $1', [tenantId])
    for (const item of parsed) {
      if (item.key && item.value) {
        await saveMemory(null, tenantId, item.key, item.value, item.category || 'fact', item.importance || 5)
      }
    }
    logger.info(`[Memory] Memory consolidation completed successfully. Consolidated to ${parsed.length} facts.`)
  } catch (err: any) {
    logger.warn('[Memory] Consolidation failed: ' + err.message)
  }
}

// ── Track 4: Advanced Personalization ─────────────────────────────

/**
 * Implicit user profile learning from free-text using lightweight regex patterns.
 * No LLM call — zero latency. Called on every user message in chat routes.
 */
export async function learnUserProfile(tenantId: string, messageText: string): Promise<void> {
  const patterns = [
    { regex: /my name is ([\w\s]+)/i, key: 'user_name', label: 'name' },
    { regex: /i work at ([\w\s]+)/i, key: 'company', label: 'company' },
    { regex: /i('m| am) ([\w\s]+) at/i, key: 'role', label: 'role', groupIndex: 2 },
    { regex: /i prefer ([\w\s]+)/i, key: 'preference', label: 'preference' },
    { regex: /i use ([\w]+) for/i, key: 'tool_preference', label: 'tool' },
    { regex: /i like ([\w\s]+) style/i, key: 'style_preference', label: 'style preference' },
    { regex: /my email is ([\S]+@[\S]+)/i, key: 'email', label: 'email address' },
    { regex: /i('m based| am based| live) in ([\w\s,]+)/i, key: 'location', label: 'location', groupIndex: 2 },
  ]

  for (const pattern of patterns) {
    const match = messageText.match(pattern.regex)
    if (match) {
      const value = match[(pattern as any).groupIndex || 1]?.trim()
      if (value && value.length > 1 && value.length < 100) {
        try {
          await db.query(
            `INSERT INTO agent_memory (tenant_id, category, key, value, source, confidence)
             VALUES ($1, 'preference', $2, $3, 'auto-learned', 0.9)
             ON CONFLICT (tenant_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
            [tenantId, pattern.key, value]
          ).catch(() => null)
        } catch {}
      }
    }
  }
}

/**
 * Harvests successful task patterns into skill memory for future reference.
 * Confidence increases with each successful reinforcement.
 */
export async function harvestTaskSkill(
  tenantId: string,
  taskDescription: string,
  outputQuality: 'good' | 'excellent'
): Promise<void> {
  try {
    const key = `skill_${taskDescription.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50)}`
    const initialConfidence = outputQuality === 'excellent' ? 0.9 : 0.7
    await db.query(
      `INSERT INTO agent_memory (tenant_id, category, key, value, source, confidence)
       VALUES ($1, 'skill', $2, $3, 'task_harvest', $4)
       ON CONFLICT (tenant_id, key) DO UPDATE SET
         value = EXCLUDED.value,
         confidence = LEAST(1.0, agent_memory.confidence + 0.1),
         updated_at = NOW()`,
      [
        tenantId,
        key,
        JSON.stringify({ task: taskDescription, quality: outputQuality, learned_at: new Date().toISOString() }),
        initialConfidence,
      ]
    ).catch(() => null)
  } catch {}
}

/**
 * Returns a key→value map of all auto-learned preference facts for a tenant.
 */
export async function getUserProfile(tenantId: string): Promise<Record<string, string>> {
  try {
    const { rows } = await db.query(
      `SELECT key, value FROM agent_memory WHERE tenant_id = $1 AND category = 'preference' LIMIT 20`,
      [tenantId]
    ).catch(() => ({ rows: [] }))
    return (rows as any[]).reduce((acc: Record<string, string>, f: any) => {
      acc[f.key] = f.value
      return acc
    }, {})
  } catch {
    return {}
  }
}

/**
 * Returns top memory facts relevant to a given project keyword (searches key, value, and tags).
 */
export async function getProjectContext(tenantId: string, projectKeyword: string): Promise<string[]> {
  try {
    const { rows } = await db.query(
      `SELECT value FROM agent_memory
       WHERE tenant_id = $1
       AND (key ILIKE $2 OR value ILIKE $2)
       ORDER BY importance DESC LIMIT 10`,
      [tenantId, `%${projectKeyword}%`]
    ).catch(() => ({ rows: [] }))
    return (rows as any[]).map((f: any) => f.value)
  } catch {
    return []
  }
}

