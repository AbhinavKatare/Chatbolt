import { logger } from './logger.service';
import { query, queryOne } from '../db'
import { vectorStoreProvider } from './vector-store.provider'
import { callLLM } from '../agents/base.agent'

export interface CachedArtifactContext {
  artifactId: string
  name: string
  artifactType: string
  latestVersion: number
  summary: string
  metadata: any
}

class ArtifactMemoryService {
  /**
   * Generates and stores a cached summary of an artifact version to populate Artifact Memory.
   * This allows agents to understand its contents without re-reading.
   */
  async cacheArtifactVersion(
    artifactId: string,
    versionNumber: number,
    rawContents: string,
    changeDescription = ''
  ): Promise<string> {
    try {
      // 1. Fetch artifact details
      const artifact = await queryOne('SELECT name, artifact_type, project_id, tenant_id FROM artifacts WHERE id = $1', [artifactId])
      if (!artifact) throw new Error(`Artifact ${artifactId} not found`)

      logger.info(`[Artifact Memory] Generating semantic summary for "${artifact.name}" (v${versionNumber})…`)

      // 2. Prompt LLM to synthesize a dense, high-fidelity caching summary
      const systemPrompt = `You are an Expert Artifact Indexing Engine.
Your job is to analyze the raw contents of a generated resource (${artifact.artifact_type} named "${artifact.name}") and produce a dense, structured, semantic summary that an AI agent can read to fully understand the facts, data columns, structures, and findings inside this artifact without re-reading the raw file.`
      
      const userMsg = `Artifact Contents:\n${rawContents.slice(0, 15000)}`
      
      const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
      const { content: summary } = await callLLM(modelToUse, systemPrompt, userMsg, 1200)

      // 3. Upsert into artifact_versions
      await query(`
        INSERT INTO artifact_versions (artifact_id, version_number, file_path, summary, change_description)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        artifactId,
        versionNumber,
        `artifacts/${artifactId}_v${versionNumber}.${artifact.artifact_type === 'spreadsheet' ? 'csv' : 'txt'}`,
        summary,
        changeDescription
      ])

      // 4. Index the summary semantically in Vector Store
      await vectorStoreProvider.upsert({
        artifactId,
        projectId: artifact.project_id,
        content: `Artifact Memory cache for "${artifact.name}" (v${versionNumber}): ${summary}`,
        metadata: {
          version: versionNumber,
          artifact_type: artifact.artifact_type
        }
      })

      return summary
    } catch (err: any) {
      console.error('[Artifact Memory] Failed to cache artifact version:', err.message)
      return 'Cache generation failed.'
    }
  }

  /**
   * Retrieves the cached summaries and structures of all artifacts in a project or workspace.
   * Feeds this directly into the Supervisor or Planner Agent prompt contexts.
   */
  async getProjectArtifactsContext(projectId: string): Promise<string> {
    try {
      const rows = await query(`
        SELECT a.id, a.name, a.artifact_type, v.version_number, v.summary, a.metadata
        FROM artifacts a
        JOIN artifact_versions v ON a.id = v.artifact_id
        WHERE a.project_id = $1
          AND v.version_number = (
            SELECT MAX(version_number) 
            FROM artifact_versions 
            WHERE artifact_id = a.id
          )
      `, [projectId])

      if (rows.length === 0) return 'No artifacts generated yet in this project.'

      return rows.map(r => {
        return `[Artifact "${r.name}" (Type: ${r.artifact_type}, ID: ${r.id}, v${r.version_number})]
- Summary: ${r.summary}
- Metadata: ${JSON.stringify(r.metadata)}`
      }).join('\n\n')
    } catch (err: any) {
      console.error('[Artifact Memory] Failed to fetch project artifacts context:', err.message)
      return 'Failed to load artifact memory.'
    }
  }
}

export const artifactMemoryService = new ArtifactMemoryService()
