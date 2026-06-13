import { query, queryOne } from '../db'
import { embedText } from '../agents/base.agent'

export interface VectorRecord {
  id?: string
  agentId?: string
  projectId?: string
  workspaceId?: string
  artifactId?: string
  content: string
  metadata?: any
}

export interface SearchResult {
  content: string
  metadata: any
  similarity: number
  projectId?: string
  artifactId?: string
}

class VectorStoreProvider {
  private activeProvider: 'postgres_pgvector' | 'qdrant' | 'pinecone' | 'weaviate' = 'postgres_pgvector'

  /**
   * Semantic embedding insert
   */
  async upsert(record: VectorRecord): Promise<void> {
    if (this.activeProvider === 'postgres_pgvector') {
      const embedding = await embedText(record.content)
      const embeddingStr = `[${embedding.join(',')}]`
      
      await query(`
        INSERT INTO agent_chunks (agent_id, content, metadata, embedding)
        VALUES ($1, $2, $3, $4)
      `, [
        record.agentId || null,
        record.content,
        JSON.stringify({
          ...record.metadata,
          project_id: record.projectId || null,
          workspace_id: record.workspaceId || null,
          artifact_id: record.artifactId || null,
        }),
        embeddingStr
      ])
      return
    }

    // Provider abstractions (e.g. Qdrant / Pinecone / Weaviate placeholders)
    throw new Error(`Provider ${this.activeProvider} not yet configured. pgvector active.`)
  }

  /**
   * Semantic similarity search with strict metadata filtering for Project and Workspace isolation
   */
  async search(params: {
    queryText: string
    agentId?: string
    projectId?: string
    workspaceId?: string
    artifactId?: string
    limit?: number
    minSimilarity?: number
  }): Promise<SearchResult[]> {
    const limit = params.limit || 5
    const minSimilarity = params.minSimilarity || 0.28
    
    if (this.activeProvider === 'postgres_pgvector') {
      const embedding = await embedText(params.queryText)
      const embeddingStr = `[${embedding.join(',')}]`
      
      // Scoped filters
      const conditions: string[] = []
      const sqlParams: any[] = [embeddingStr, limit]
      let paramIdx = 3
      
      if (params.agentId) {
        conditions.push(`agent_id = $${paramIdx++}`)
        sqlParams.push(params.agentId)
      }
      
      const rows = await query(`
        SELECT content, metadata,
               COALESCE(1 - (embedding <=> $1::vector), 0)::float AS similarity
        FROM agent_chunks
        WHERE COALESCE(1 - (embedding <=> $1::vector), 0) > ${minSimilarity}
        ${conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''}
        ORDER BY similarity DESC
        LIMIT $2
      `, sqlParams)
      
      // Filter results in-memory based on metadata keys for robust hierarchy scoping
      return rows
        .map(r => ({
          content: r.content,
          metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
          similarity: r.similarity
        }))
        .filter(r => {
          const meta = r.metadata || {}
          if (params.projectId && meta.project_id !== params.projectId) return false
          if (params.workspaceId && meta.workspace_id !== params.workspaceId) return false
          if (params.artifactId && meta.artifact_id !== params.artifactId) return false
          return true
        })
    }

    throw new Error(`Provider ${this.activeProvider} not yet configured. pgvector active.`)
  }

  /**
   * Delete memories by filter
   */
  async delete(params: {
    agentId?: string
    projectId?: string
    artifactId?: string
  }): Promise<void> {
    if (this.activeProvider === 'postgres_pgvector') {
      if (params.agentId) {
        await query('DELETE FROM agent_chunks WHERE agent_id = $1', [params.agentId])
      }
      return
    }
    throw new Error(`Provider ${this.activeProvider} not yet configured. pgvector active.`)
  }
}

export const vectorStoreProvider = new VectorStoreProvider()
