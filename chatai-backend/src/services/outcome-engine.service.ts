import { db } from '../db'
import { callLLM, safeParseJSON, cleanEnvVar } from '../agents/base.agent'
import fs from 'fs'
import { logger } from './logger.service'


export interface GoalMilestone {
  id: string
  title: string
  description: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  depends_on?: string[]
}

export interface OutcomeScore {
  score: number // 0.0 to 1.0
  rationale: string
  metrics_achieved: Record<string, any>
}

export interface StructuredGoal {
  title: string
  description: string
  success_metrics: string[]
  milestones: GoalMilestone[]
}

class OutcomeEngineService {
  /**
   * Decomposes a high-level outcome instruction into concrete metrics and milestones
   */
  async decomposeGoal(prompt: string, tenantId: string): Promise<StructuredGoal> {
    logger.info(`[Outcome Engine] Decomposing outcome prompt: "${prompt}"...`)

    const systemPrompt = `You are the Chatbolt Outcome Decomposition Engine.
    Your role is to translate a high-level outcome goal into a structured milestone roadmap with measurable success metrics.
    
    Return ONLY valid JSON (no markdown fences, no explanations) matching this exact format:
    {
      "title": "Clear descriptive outcome name",
      "description": "Executive summary of the target achievement",
      "success_metrics": [
        "Metric 1 (e.g. data successfully scraped with 100% email validity)",
        "Metric 2 (e.g. outreach campaign created and saved)"
      ],
      "milestones": [
        {
          "id": "m1",
          "title": "Discovery & Research",
          "description": "Gather initial inputs, crawl sources, and identify competitors",
          "status": "pending"
        },
        {
          "id": "m2",
          "title": "Synthesis & Generation",
          "description": "Compile findings into structured formats",
          "status": "pending",
          "depends_on": ["m1"]
        }
      ]
    }`

    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    
    try {
      const { content: res } = await callLLM(modelToUse, systemPrompt, `Decompose goal: "${prompt}"`)
      const parsed = safeParseJSON(res) as StructuredGoal
      
      if (!parsed.title || !parsed.milestones) {
        throw new Error('Decomposed JSON is missing title or milestones')
      }
      return parsed
    } catch (err: any) {
      console.warn(`[Outcome Engine] Goal decomposition failed, using robust fallback:`, err.message)
      return {
        title: 'Autonomous Outcome Execution',
        description: `Optimize and achieve: "${prompt}"`,
        success_metrics: ['Task completed and output generated successfully'],
        milestones: [
          { id: 'm1', title: 'Task Execution', description: 'Decompose and run execution steps', status: 'pending' },
          { id: 'm2', title: 'Outcome Verification', description: 'Validate result structure and quality', status: 'pending', depends_on: ['m1'] }
        ]
      }
    }
  }

  /**
   * Save a goal to the database
   */
  async createGoalInDb(goal: StructuredGoal, tenantId: string): Promise<string> {
    const { rows } = await db.query(
      `INSERT INTO memory_goals (tenant_id, title, description, target_metrics, progress, status)
       VALUES ($1, $2, $3, $4, 0.00, 'pending')
       RETURNING id`,
      [tenantId, goal.title, goal.description, JSON.stringify(goal.success_metrics)]
    )
    const goalId = rows[0].id

    // Log entity in Memory Graph
    await db.query(
      `INSERT INTO memory_entities (tenant_id, entity_type, name, description, metadata)
       VALUES ($1, 'Goal', $2, $3, $4)`,
      [tenantId, goal.title, goal.description, JSON.stringify({ goal_id: goalId, milestones: goal.milestones })]
    )

    return goalId
  }

  /**
   * Evaluates final outcome scoring upon workflow complete
   */
  async scoreOutcome(runId: string, goalId?: string): Promise<OutcomeScore> {
    logger.info(`[Outcome Engine] Evaluating final outcome scoring for run ${runId}...`)
    
    // Fetch step results
    const { rows: steps } = await db.query(
      `SELECT status, output_data, error_message FROM workflow_steps WHERE run_id = $1 ORDER BY step_number ASC`,
      [runId]
    )
    
    const successes = steps.filter(s => s.status === 'completed').length
    const failures = steps.filter(s => s.status === 'failed').length
    const total = steps.length
    
    let baseScore = total > 0 ? parseFloat((successes / total).toFixed(2)) : 0.0

    // Deduct score for step crashes
    if (failures > 0) baseScore = Math.max(0.0, baseScore - 0.2)

    const score: OutcomeScore = {
      score: baseScore,
      rationale: `Successfully completed ${successes} out of ${total} planned execution milestones. Errors encountered: ${failures}.`,
      metrics_achieved: {
        total_milestones: total,
        success_ratio: baseScore,
        validation_passed: failures === 0
      }
    }

    if (goalId) {
      await db.query(
        `UPDATE memory_goals 
         SET outcome_score = $1, status = $2, progress = $3, updated_at = NOW() 
         WHERE id = $4`,
        [baseScore, baseScore > 0.8 ? 'completed' : 'failed', baseScore * 100, goalId]
      )
    }

    return score
  }

  /**
   * Autonomous replanning loop triggered when an agent encounters an error
   */
  async autonomousReplanning(runId: string, failedAgentName: string, errorMessage: string): Promise<any> {
    console.warn(`[Outcome Engine] 🔄 Autonomous replanning activated for run ${runId}! Agent "${failedAgentName}" crashed: "${errorMessage}"`)
    
    // Fetch failed step details
    const { rows: stepRows } = await db.query(
      `SELECT ws.id, wa.system_prompt, wa.config 
       FROM workflow_steps ws
       JOIN workflow_agents wa ON ws.agent_id = wa.id
       WHERE ws.run_id = $1 AND ws.status = 'failed'
       LIMIT 1`,
      [runId]
    )

    if (stepRows.length === 0) return null

    const failedStep = stepRows[0]
    
    // Call LLM to diagnose failure and recommend healing modifications to the system prompt
    const diagnoserPrompt = `You are the Autonomous Self-Healing OS Diagnoser.
    An agent execution has failed. Your role is to diagnose the error and rewrite the agent's system prompt or configuration parameters to prevent this error.
    
    Failed Agent Name: "${failedAgentName}"
    Error Message: "${errorMessage}"
    Current System Prompt: "${failedStep.system_prompt}"
    
    Return ONLY a single valid JSON object containing the recovery adjustments:
    {
      "system_prompt_patch": "The updated system prompt, providing more explicit instructions on how to handle the error",
      "model_fallback": "A higher-reasoning model name (e.g. moonshotai/kimi-k2.6) if needed, or null to keep current"
    }`

    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    
    try {
      const { content: diagnosis } = await callLLM(modelToUse, diagnoserPrompt, 'Diagnose failure and patch prompt')
      const patched = safeParseJSON(diagnosis)
      
      if (patched.system_prompt_patch) {
        logger.info(`[Outcome Engine] Applied self-healing prompt patch for "${failedAgentName}"`)
        
        // Log decision in Memory Graph
        await db.query(
          `INSERT INTO memory_decisions (tenant_id, run_id, decision_type, rationale, impact_score)
           VALUES ('00000000-0000-0000-0000-000000000000', $1, 'Self-Healing Patch', $2, 8)`,
          [runId, `Patched system prompt of ${failedAgentName} due to error: ${errorMessage}`]
        )
      }
      return patched
    } catch (err: any) {
      console.error(`[Outcome Engine] Autonomous healing failed:`, err.message)
      return null
    }
  }

  /**
   * Universal Quality Gate: Validates agent output against target criteria
   */
  validateOutput(type: string, data: any): { pass: boolean; issues: string[] } {
    const issues: string[] = []
    
    if (!data) {
      return { pass: false, issues: ['Output data is missing.'] }
    }

    const typeLower = (type || '').toLowerCase()
    let category = typeLower
    if (typeLower.includes('research') || typeLower.includes('report')) {
      category = 'research_report'
    } else if (typeLower.includes('spreadsheet') || typeLower.includes('sheet') || typeLower.includes('excel')) {
      category = 'spreadsheet'
    } else if (typeLower.includes('code') || typeLower.includes('developer') || typeLower.includes('script') || typeLower.includes('sandbox')) {
      category = 'code'
    } else if (typeLower.includes('email') || typeLower.includes('draft') || typeLower.includes('mail') || typeLower.includes('gmail')) {
      category = 'email_draft'
    } else if (typeLower.includes('slide') || typeLower.includes('presentation') || typeLower.includes('powerpoint')) {
      category = 'presentation'
    } else if (typeLower.includes('page') || typeLower.includes('web') || typeLower.includes('html')) {
      category = 'web_page'
    }

    if (category === 'research_report') {
      const content = data.markdown || data.report_markdown || data.report || ''
      const hasExecSummary = /##\s*Executive\s+summary/i.test(content) || /##\s*Summary/i.test(content)
      if (!hasExecSummary) {
        issues.push("Executive summary section is missing (needs '## Executive Summary').")
      }
      const citations = data.citations || []
      const urlCount = (content.match(/https?:\/\/[^\s]+/g) || []).length + citations.length
      if (urlCount < 2) {
        issues.push("Fewer than 2 source references are included.")
      }
      const wordCount = content.split(/\s+/).filter(Boolean).length
      if (wordCount < 400) {
        issues.push(`Word count is too low (${wordCount} words; target is at least 400 words).`)
      }
    } else if (category === 'spreadsheet') {
      const filePath = data.filePath || data.file_path || ''
      let fileExists = false
      let fileSize = 0
      try {
        if (filePath && fs.existsSync(filePath)) {
          fileExists = true
          fileSize = fs.statSync(filePath).size
        }
      } catch {}
      if (!fileExists || fileSize === 0) {
        issues.push("Spreadsheet file was not created or is empty.")
      }
      const rows = data.rows || []
      if (rows.length < 3) {
        issues.push(`Spreadsheet has insufficient rows (${rows.length} rows; needs at least 1 header and 2 data rows).`)
      }
      const strData = JSON.stringify(data)
      if (strData.includes('#REF!') || strData.includes('#ERROR!')) {
        issues.push("Spreadsheet contains cells with invalid formulas (#REF! or #ERROR!).")
      }
    } else if (category === 'code') {
      if (data.exitCode !== undefined && data.exitCode !== 0) {
        issues.push(`Sandbox execution failed with exit code ${data.exitCode}.`)
      }
      const content = data.code || data.result || ''
      const keyPatterns = [
        /api[_-]?key/i,
        /client[_-]?secret/i,
        /private[_-]?key/i,
        /password/i,
        /db_password/i
      ]
      const hasSecrets = keyPatterns.some(pattern => {
        const regex = new RegExp(pattern.source + '\\s*[:=]\\s*["\'][a-zA-Z0-9_-]{10,}["\']', 'i')
        return regex.test(content)
      })
      if (hasSecrets) {
        issues.push("Code contains potential hardcoded API keys, passwords, or secrets.")
      }
    } else if (category === 'email_draft') {
      if (!data.subject && !data.subject_line) {
        issues.push("Subject line is missing.")
      }
      const body = data.body || data.content || ''
      const hasGreeting = /^(hi|hello|dear|good\s+morning|good\s+afternoon|good\s+evening|hey)/i.test(body.trim())
      if (!hasGreeting) {
        issues.push("Greeting is missing.")
      }
      const wordCount = body.split(/\s+/).filter(Boolean).length
      if (wordCount < 30) {
        issues.push(`Email body has only ${wordCount} words (needs at least 30).`)
      }
      const hasSignOff = /(thanks|regards|best|sincerely|cheers|yours|appreciate)/i.test(body.toLowerCase())
      if (!hasSignOff) {
        issues.push("Sign-off is missing.")
      }
    } else if (category === 'presentation') {
      const filePath = data.filePath || data.file_path || ''
      let fileExists = false
      try {
        if (filePath && fs.existsSync(filePath)) {
          fileExists = true
        }
      } catch {}
      if (!fileExists) {
        issues.push("Presentation file was not generated.")
      }
      const slides = data.slides || []
      if (slides.length < 3) {
        issues.push(`Presentation has only ${slides.length} slides (needs at least 3).`)
      }
      const hasEmptyTitle = slides.some((s: any) => !s.title || !s.title.trim())
      if (hasEmptyTitle) {
        issues.push("One or more slides have empty titles.")
      }
    } else if (category === 'web_page') {
      const content = data.html || data.content || ''
      if (!content.includes("<meta name='viewport'") && !content.includes('<meta name="viewport"')) {
        issues.push("Viewport metadata tag is missing.")
      }
      if (!/<h[12][^>]*>/i.test(content)) {
        issues.push("Header tags (H1 or H2) are missing.")
      }
      const openTags = (content.match(/<[a-zA-Z1-6]+(?=\s|>)/g) || []).map((t: string) => t.slice(1).toLowerCase())
      const closeTags = (content.match(/<\/[a-zA-Z1-6]+>/g) || []).map((t: string) => t.slice(2, -1).toLowerCase())
      const tagsToCheck = ['html', 'head', 'body', 'div', 'table']
      for (const tag of tagsToCheck) {
        const opened = openTags.filter((t: string) => t === tag).length
        const closed = closeTags.filter((t: string) => t === tag).length
        if (opened !== closed) {
          issues.push(`HTML structure might be unclosed (mismatched <${tag}> tags: ${opened} opened, ${closed} closed).`)
          break
        }
      }
    }

    const pass = issues.length === 0

    // Log quality gate results (Post-Ship Monitoring Hook #2)
    db.query(
      'INSERT INTO quality_gate_logs (artifact_type, criterion, passed) VALUES ($1, $2, $3)',
      [category, pass ? 'all_checks' : issues.join(', '), pass]
    ).then(async () => {
      try {
        const { logger } = await import('./logger.service')
        const { rows: stats } = await db.query(
          `SELECT criterion, 
                  COUNT(CASE WHEN passed = false THEN 1 END)::float / COUNT(*)::float as fail_rate
           FROM quality_gate_logs
           WHERE artifact_type = $1
           GROUP BY criterion`,
          [category]
        )
        for (const row of stats) {
          if (row.fail_rate > 0.20) {
            logger.warn(`[QUALITY ALERT] Systematic quality issue in "${category}": Criterion "${row.criterion}" has a fail rate of ${(row.fail_rate * 100).toFixed(1)}% (exceeds 20% threshold!)`)
          }
        }
      } catch (err: any) {
        console.warn('[Outcome Engine] Failed to calculate quality stats:', err.message)
      }
    }).catch(err => {
      console.warn('[Outcome Engine] Failed to insert quality gate log:', err.message)
    })

    return {
      pass,
      issues
    }
  }
}

export const outcomeEngineService = new OutcomeEngineService()

