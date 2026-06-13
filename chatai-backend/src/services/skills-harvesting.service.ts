import { logger } from './logger.service';
import { db } from '../db'
import { callLLM, safeParseJSON } from '../agents/base.agent'

export interface SkillRecipe {
  id: string
  tenant_id: string | null
  prompt_trigger: string
  dag_topology: {
    workflow_name: string
    workflow_type: string
    agents: any[]
  }
  success_count: number
}

export const HARVESTING_POLICY = {
  global_learning: true,
  share_customer_data: false,
  share_memory: false,
  share_documents: false,
  share_knowledge_graphs: false,
  share_execution_patterns: true,
  share_optimization_patterns: true
}

class SkillsHarvestingService {
  /**
   * Harvests a highly optimized run outcome DAG as a reusable platform skill
   */
  async harvestSkill(runId: string, tenantId: string): Promise<void> {
    try {
      logger.info(`[Skills Harvesting] Analyzing completed run ${runId} to harvest optimized skill...`)

      // 1. Fetch the run prompt and config
      const runRes = await db.query(
        `SELECT r.workflow_id, w.name, w.original_prompt, w.type 
         FROM workflow_runs r
         JOIN workflows w ON r.workflow_id = w.id
         WHERE r.id = $1`,
        [runId]
      )

      if (runRes.rows.length === 0) return
      const runData = runRes.rows[0]

      if (!runData.original_prompt) {
        logger.info('[Skills Harvesting] No original prompt trigger found, skipping harvest.')
        return
      }

      // 2. Fetch the topological agents involved in this success path
      const { rows: agents } = await db.query(
        `SELECT position, name, role, description, system_prompt, config, inputs_from_user, inputs_from_previous, output_type, output_description 
         FROM workflow_agents 
         WHERE workflow_id = $1 
         ORDER BY position ASC`,
        [runData.workflow_id]
      )

      if (agents.length === 0) return

      const dagTopology = {
        workflow_name: runData.name,
        workflow_type: runData.type || 'sequential',
        agents: agents.map(a => ({
          position: a.position,
          name: a.name,
          role: a.role,
          description: a.description,
          system_prompt: a.system_prompt,
          config: a.config,
          inputs_from_user: a.inputs_from_user,
          inputs_from_previous: a.inputs_from_previous,
          output_type: a.output_type,
          output_description: a.output_description
        }))
      }

      // 3. Save to memory_skills table
      // In production, we generate and save vector embeddings. For local emulation, we write PGVector mock arrays
      const mockVectorString = `[${Array(1536).fill(0).map(() => Math.random().toFixed(4)).join(',')}]`

      // Determine if this is safe to share globally under our hybrid learning policy
      const shareGlobally = 
        HARVESTING_POLICY.global_learning && 
        HARVESTING_POLICY.share_execution_patterns && 
        !HARVESTING_POLICY.share_customer_data

      await db.query(
        `INSERT INTO memory_skills (tenant_id, prompt_trigger, dag_topology, success_count, embedding, is_public)
         VALUES ($1, $2, $3, 1, $4::vector, $5)
         ON CONFLICT DO NOTHING`,
        [tenantId, runData.original_prompt, JSON.stringify(dagTopology), mockVectorString, shareGlobally]
      )

      // Also log decision in the Universal Memory Graph
      await db.query(
        `INSERT INTO memory_decisions (tenant_id, run_id, decision_type, rationale, impact_score)
         VALUES ($1, $2, 'Skill Harvesting', $3, 7)`,
        [tenantId, runId, `Harvested successful execution path for "${runData.name}" as an autonomous skill template.`]
      )

      logger.info(`[Skills Harvesting] ✅ Successfully harvested and indexed skill: "${runData.name}"`)
    } catch (err: any) {
      console.error('[Skills Harvesting] Failed to harvest skill:', err.message)
    }
  }

  /**
   * Dynamically matches a user goal against the harvested skill base
   */
  async matchHarvestedSkill(prompt: string, tenantId: string): Promise<any | null> {
    try {
      logger.info(`[Skills Harvesting] Checking skill base for semantic trigger matching: "${prompt}"...`)

      // Search matching triggers in local SQLite fallback or PostgreSQL
      // Local fallback checks for exact match or trigger substring similarity
      const { rows } = await db.query(
        `SELECT * FROM memory_skills 
         WHERE (tenant_id = $1 OR is_public = true)
         ORDER BY success_count DESC LIMIT 20`,
        [tenantId]
      )

      if (rows.length === 0) return null

      // Emulate semantic cosine matching using simple string proximity
      const promptNorm = prompt.toLowerCase().trim()
      for (const row of rows) {
        const triggerNorm = row.prompt_trigger.toLowerCase().trim()
        
        // Exact or strong substring overlap match emulating >0.85 vector similarity
        if (promptNorm.includes(triggerNorm) || triggerNorm.includes(promptNorm)) {
          logger.info(`[Skills Harvesting] 🎯 Semantic match found! Re-using optimal skill topology: "${row.dag_topology.workflow_name}"`)
          
          // Increment success usage metrics
          await db.query(`UPDATE memory_skills SET success_count = success_count + 1 WHERE id = $1`, [row.id])
          return row.dag_topology
        }
      }

      return null
    } catch (err: any) {
      console.error('[Skills Harvesting] Trigger matching failed:', err.message)
      return null
    }
  }

  /**
   * Checks if a user has completed 3+ successful tasks of a particular type.
   * If so, and no template exists, flags the run as a candidate for a personal template.
   */
  async checkTemplateCandidate(userId: string, taskPrompt: string, taskType: string, runId: string): Promise<void> {
    try {
      if (!taskType || taskType === 'other') return

      // Check if there is already a user_template for this task_type and user
      const existingTemplate = await db.query(
        `SELECT id FROM user_templates WHERE tenant_id = $1 AND task_type = $2 LIMIT 1`,
        [userId, taskType]
      )
      if (existingTemplate.rows.length > 0) return

      // Count successful runs of this task_type
      const runsCount = await db.query(
        `SELECT COUNT(*)::integer as count FROM workflow_runs 
         WHERE tenant_id = $1 AND task_type = $2 AND status = 'completed'`,
         [userId, taskType]
      )
      const count = runsCount.rows[0]?.count || 0

      if (count >= 3) {
        // Set template_candidate = true on the current run
        await db.query(
          `UPDATE workflow_runs SET template_candidate = true WHERE id = $1`,
          [runId]
        )
        logger.info(`[Skills Harvesting] Run ${runId} flagged as template candidate for type: ${taskType}`)
      }
    } catch (err: any) {
      console.error('[Skills Harvesting] checkTemplateCandidate failed:', err.message)
    }
  }
}

export const skillsHarvestingService = new SkillsHarvestingService()
