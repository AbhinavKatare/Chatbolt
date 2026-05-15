import { db } from '../db'
import { embedText } from '../agents/base.agent'

// ── Short-Term Memory (Block 2.1) ──────────────────────────────────────────
// Store in a simple 'workflow_steps' or a dedicated 'short_term_memory' table.
// For now, we'll use a dedicated table for cleaner access.

export async function getShortTermMemory(runId: string, agentId: string) {
  const { rows } = await db.query(
    'SELECT input_data, output_data FROM workflow_steps WHERE run_id = $1 AND agent_id = $2 ORDER BY step_number DESC LIMIT 10',
    [runId, agentId]
  )
  return rows
}

// ── Long-Term Memory (Block 2.2) ───────────────────────────────────────────

export async function saveMemory(
  agentId: string,
  tenantId: string,
  key: string,
  value: string,
  category = 'fact'
) {
  await db.query(
    `INSERT INTO agent_memory (agent_id, tenant_id, key, value, category)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET value = $4, last_accessed = NOW()`,
    [agentId, tenantId, key, value, category]
  )
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

// ── Vector Memory (Block 2.3) ──────────────────────────────────────────────

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
    `SELECT content, metadata, 1 - (embedding <=> $2) as similarity
     FROM agent_chunks
     WHERE agent_id = $1
     AND 1 - (embedding <=> $2) > 0.28
     ORDER BY similarity DESC
     LIMIT $3`,
    [agentId, embeddingStr, limit]
  )
  
  return rows
}
