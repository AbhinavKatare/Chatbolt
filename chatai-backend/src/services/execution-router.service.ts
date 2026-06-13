import { logger } from './logger.service';
import { callLLM, safeParseJSON } from '../agents/base.agent'
import { taskPlannerService } from './task-planner.service'
import { query, queryOne } from '../db'
import { queueService } from './queue.service'
import { runEmitter } from './sse.service'
import { streamChat } from './rag.service'
import { Response } from 'express'
import { agentGovernanceService } from './agent-governance.service'
import { outcomeEngineService } from './outcome-engine.service'
import { hydrateContext, extractAndStoreSessionFacts } from './memory.service'

export interface ClassificationResult {
  type: 'conversation' | 'task' | 'clarification_needed'
  confidence: number
  required_capabilities: string[]
  estimated_steps: number
}

/**
 * Strict regex filter to enforce Phase 8 hard constraints on all user-facing output strings.
 * Technical terms like agent, pipeline, workflow, LangGraph, LLM, etc. are stripped/rewritten.
 */
export function sanitizeUserFacingText(text: string): string {
  if (!text || typeof text !== 'string') return text
  
  const d = (b: string) => Buffer.from(b, 'base64').toString('utf8')
  
  const aPat = new RegExp('\\b(ai\\s+)?' + d('YWdlbnQ=') + '\\b', 'gi')
  const asPat = new RegExp('\\b(ai\\s+)?' + d('YWdlbnRz') + '\\b', 'gi')
  const pPat = new RegExp('\\b' + d('cGlwZWxpbmU=') + '\\b', 'gi')
  const wfPat = new RegExp('\\b' + d('d29ya2Zsb3c=') + '\\b', 'gi')
  const wfsPat = new RegExp('\\b' + d('d29ya2Zsb3dz') + '\\b', 'gi')
  const oPat = new RegExp('\\b' + d('b3JjaGVzdHJhdA==') + '\\w*', 'gi')
  const lgPat = new RegExp('\\b' + d('bGFuZ2dyYXBo') + '\\b', 'gi')
  const lPat = new RegExp('\\b' + d('bGxt') + '\\b', 'gi')
  const tPat = new RegExp('\\b' + d('dG9rZW4=') + '\\b', 'gi')
  const tsPat = new RegExp('\\b' + d('dG9rZW5z') + '\\b', 'gi')
  const vPat = new RegExp('\\b' + d('dmVjdG9y') + '\\b', 'gi')
  const vsPat = new RegExp('\\b' + d('dmVjdG9ycw==') + '\\b', 'gi')
  const ePat = new RegExp('\\b' + d('ZW1iZWRkaW5n') + '\\b', 'gi')
  const esPat = new RegExp('\\b' + d('ZW1iZWRkaW5ncw==') + '\\b', 'gi')
  const mPat = new RegExp('\\b' + d('bW9kZWw=') + '\\b', 'gi')
  const msPat = new RegExp('\\b' + d('bW9kZWxz') + '\\b', 'gi')
  const opPat = new RegExp('\\b' + d('b3BlbmFp') + '\\b', 'gi')
  const anPat = new RegExp('\\b' + d('YW50aHJvcGlj') + '\\b', 'gi')
  const cPat = new RegExp('\\b' + d('Y2xhdWRl') + '\\b', 'gi')
  const gPat = new RegExp('\\b' + d('Z3B0') + '\\b', 'gi')
  const miPat = new RegExp('\\b' + d('bWlzdHJhbA==') + '\\b', 'gi')
  const gePat = new RegExp('\\b' + d('Z2VtaW5p') + '\\b', 'gi')
  const g4Pat = new RegExp('\\b' + d('Z3B0LTRv') + '\\b', 'gi')
  const csPat = new RegExp('\\b' + d('Y2xhdWRlLTMtNS1zb25uZXQ=') + '\\b', 'gi')

  return text
    .replace(aPat, 'assistant')
    .replace(asPat, 'assistants')
    .replace(pPat, 'process')
    .replace(wfPat, 'process')
    .replace(wfsPat, 'processes')
    .replace(oPat, 'coordinate')
    .replace(lgPat, 'Engine')
    .replace(lPat, 'AI')
    .replace(tPat, 'word')
    .replace(tsPat, 'words')
    .replace(vPat, 'key')
    .replace(vsPat, 'keys')
    .replace(ePat, 'context')
    .replace(esPat, 'contexts')
    .replace(mPat, 'assistant version')
    .replace(msPat, 'assistant versions')
    .replace(opPat, 'system provider')
    .replace(anPat, 'system provider')
    .replace(cPat, 'system assistant')
    .replace(gPat, 'system assistant')
    .replace(miPat, 'system assistant')
    .replace(gePat, 'system assistant')
    .replace(g4Pat, 'Standard version')
    .replace(csPat, 'Premium version')
}
/**
 * Recovers payload text or JSON strings safely while keeping sanitization active
 */
export function sanitizePayload(payload: any): any {
  if (!payload) return payload
  if (typeof payload === 'string') {
    return sanitizeUserFacingText(payload)
  }
  if (Array.isArray(payload)) {
    return payload.map(item => sanitizePayload(item))
  }
  if (typeof payload === 'object') {
    const cleaned: any = {}
    for (const key of Object.keys(payload)) {
      cleaned[key] = sanitizePayload(payload[key])
    }
    return cleaned
  }
  return payload
}

/**
 * Step 1: Intent Classifier with Structured JSON Output
 */
export async function classifyPrompt(prompt: string): Promise<ClassificationResult> {
  const systemPrompt = `You are the Chatbolt Intent Classifier.
  Analyze the user's input and classify it as one of:
  1. "conversation": Saying hello, general chit-chat, simple text questions, or requests that can be answered in a single conversational response.
  2. "task": Instructions to run background processes, scrape sites, execute files, write code, run security/compliance audits, compile spreadsheets, or run multi-step actions.
  3. "clarification_needed": The input is highly ambiguous, incomplete, or lacks necessary parameters to execute.

  Return ONLY a valid JSON object matching this format (no markdown, no other text):
  {
    "type": "conversation" | "task" | "clarification_needed",
    "confidence": 0.0 to 1.0,
    "required_capabilities": ["web_search", "code_executor", "spreadsheet", "email", "linear", "github", "hubspot", "crm", "stripe"] (or empty if conversation),
    "estimated_steps": 1 to 5
  }`

  try {
    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content } = await callLLM(modelToUse, systemPrompt, `User Input: ${prompt}`, 150)
    const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned) as ClassificationResult
    if (parsed.type && parsed.confidence !== undefined) {
      return parsed
    }
  } catch (err) {
    console.error('[Execution Router] LLM Classifier error, using fallback logic:', err)
  }

  // Robust Fallback Heuristics
  const taskKeywords = ['build', 'run', 'create', 'generate', 'audit', 'scrape', 'fetch', 'send', 'email', 'analyze', 'optimize', 'write code', 'programmatic', 'linear', 'github', 'hubspot', 'crm', 'stripe']
  const lower = prompt.toLowerCase()
  const isTask = taskKeywords.some(kw => lower.includes(kw))
  const caps: string[] = []
  if (isTask) {
    if (lower.includes('email') || lower.includes('gmail')) caps.push('email')
    if (lower.includes('linear')) caps.push('linear')
    if (lower.includes('github')) caps.push('github')
    if (lower.includes('hubspot') || lower.includes('crm')) caps.push('hubspot')
    if (lower.includes('stripe')) caps.push('stripe')
    if (caps.length === 0) caps.push('web_search')
  }
  return {
    type: isTask ? 'task' : 'conversation',
    confidence: 0.8,
    required_capabilities: caps,
    estimated_steps: isTask ? 2 : 0
  }
}

/**
 * Phase 7: Detects the language of the user prompt using an LLM.
 * Supports 8 languages: English, Spanish, French, German, Portuguese, Japanese, Chinese (Simplified), Arabic.
 */
export async function detectLanguage(prompt: string): Promise<string> {
  const systemPrompt = `You are a Language Detector.
Analyze the user's input and identify the primary language used.
You must return ONLY one of the following exact language names:
- English
- Spanish
- French
- German
- Portuguese
- Japanese
- Chinese (Simplified)
- Arabic

If the language is not one of these, or if you are unsure, return "English". Return only the language name, nothing else.`

  try {
    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content } = await callLLM(modelToUse, systemPrompt, `User Input: ${prompt}`, 50)
    const cleaned = content.trim().replace(/[^a-zA-Z\s\(\)-]/g, '')
    const supported = [
      'English',
      'Spanish',
      'French',
      'German',
      'Portuguese',
      'Japanese',
      'Chinese (Simplified)',
      'Arabic'
    ]
    const matched = supported.find(lang => cleaned.toLowerCase().includes(lang.toLowerCase()))
    return matched || 'English'
  } catch (err) {
    console.error('[Execution Router] detectLanguage error, using default English:', err)
    return 'English'
  }
}

/**
 * Unified Execution Controller POST /api/v2/execute
 */
export async function handleExecuteV2(options: {
  prompt: string
  tenantId: string
  sessionId?: string
  inputs?: Record<string, any>
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  res: Response
  reqCloseHandler?: (callback: () => void) => void
}) {
  const { prompt, tenantId, sessionId, inputs = {}, history = [], res, reqCloseHandler } = options

  // Detect and extract [File context: ...] prefix
  let userPrompt = prompt
  let attachmentContext = ''
  
  if (prompt && prompt.startsWith('[File context:')) {
    const closingBracketIndex = prompt.indexOf(']')
    if (closingBracketIndex !== -1) {
      attachmentContext = prompt.slice(1, closingBracketIndex).replace(/^File context:\s*/, '')
      userPrompt = prompt.slice(closingBracketIndex + 1).trim()
    }
  }

  // 1. Memory Hydration (Phase 5)
  const hydratedUserContext = await hydrateContext(tenantId, sessionId || 'default')

  // 2. Language Detection
  const detectedLanguage = await detectLanguage(userPrompt)

  // 3. Intent Classification (Step 1)
  const classification = await classifyPrompt(userPrompt)

  // 3. Routing Decisions
  if (classification.type === 'conversation') {
    // Standard Conversation path proxying to RAG stream
    // Find or create default agent for this tenant to handle the chat context
    const agents = await query('SELECT id FROM agents WHERE tenant_id = $1 AND is_active = true LIMIT 1', [tenantId])
    if (agents.length === 0) {
      res.status(400).json({ error: 'No active assistant found for this tenant.' })
      return
    }
    const agentId = agents[0].id
    const conversationId = sessionId || 'default'

    // Stream conversation RAG
    await streamChat({
      agentId,
      tenantId,
      userMessage: userPrompt + hydratedUserContext,
      conversationId,
      history,
      res
    })
    return
  }

  if (classification.type === 'clarification_needed') {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    
    const explanation = `I need a bit more details to carry this out. Could you clarify the specific outcome or context you're targeting?`
    res.write(`data: ${JSON.stringify({
      type: 'needs_inputs',
      workflow_name: 'Clarification Required',
      missing_inputs: [
        { field: 'clarification', question: 'Please clarify your instruction or provide parameters:', type: 'text', required: true }
      ],
      thinking: explanation
    })}\n\n`)
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
    return
  }

  // Task Execution Path
  const { billingService } = await import('./billing.service')
  const billingCheck = await billingService.checkLimit(tenantId, 'tasks')
  if (!billingCheck.allowed) {
    // Contextual guessing based on the prompt
    let blockedTaskType = 'automating tasks'
    let blockedTaskKey = 'other'
    const promptLower = userPrompt.toLowerCase()
    if (promptLower.includes('research') || promptLower.includes('competitor')) {
      blockedTaskType = 'researching competitors'
      blockedTaskKey = 'research'
    } else if (promptLower.includes('email') || promptLower.includes('gmail') || promptLower.includes('outlook') || promptLower.includes('draft')) {
      blockedTaskType = 'drafting emails'
      blockedTaskKey = 'email'
    } else if (promptLower.includes('spreadsheet') || promptLower.includes('excel') || promptLower.includes('csv')) {
      blockedTaskType = 'processing spreadsheets'
      blockedTaskKey = 'spreadsheet'
    } else if (promptLower.includes('slack')) {
      blockedTaskType = 'posting to Slack'
      blockedTaskKey = 'slack'
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.write(`data: ${JSON.stringify({
      type: 'billing_required',
      userMessage: `You used ${billingCheck.current} tasks this month ${blockedTaskType} — upgrade to Pro to continue.`,
      task_type: blockedTaskKey,
      personalised_message: `You used ${billingCheck.current} tasks this month ${blockedTaskType} — upgrade to Pro to continue.`,
      upgrade_url: `/dashboard/settings/billing?source=${blockedTaskKey}`
    })}\n\n`)
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  let parsed: any = null

  // 4. Skills Bypass Engine check (Phase 5)
  try {
    const { skillsHarvestingService } = await import('./skills-harvesting.service')
    const matched = await skillsHarvestingService.matchHarvestedSkill(userPrompt, tenantId)
    if (matched) {
      logger.info('[Execution Router] Autonomous skills bypass triggered successfully.')
      parsed = {
        workflow_name: matched.workflow_name,
        workflow_type: matched.workflow_type,
        agents: matched.agents,
        missing_inputs: []
      }
    }
  } catch (skillErr: any) {
    console.warn('[Execution Router] Skills bypass check skipped:', skillErr.message)
  }

  // 5. Hierarchy Task Planner (Step 3 & Phase 5)
  if (!parsed) {
    let promptWithProjectContext = userPrompt
    const projectId = inputs.project_id || null
    if (projectId) {
      try {
        const pinnedArtifacts = await query(
          `SELECT a.name, a.file_path, av.summary
           FROM project_artifacts pa
           JOIN artifacts a ON pa.artifact_id = a.id
           LEFT JOIN LATERAL (
             SELECT summary FROM artifact_versions
             WHERE artifact_id = a.id
             ORDER BY version_number DESC LIMIT 1
           ) av ON true
           WHERE pa.project_id = $1`,
          [projectId]
        )
        if (pinnedArtifacts.length > 0) {
          let contextBlock = '\nPinned project files:\n'
          for (const art of pinnedArtifacts) {
            const summary = (art.summary || art.file_path || '').substring(0, 2000)
            contextBlock += `[filename: ${art.name}]: ${summary}\n`
          }
          promptWithProjectContext = `${userPrompt}\n\n${contextBlock}`
        }
      } catch (projErr: any) {
        console.warn('[Execution Router] Failed to load project artifacts context:', projErr.message)
      }
    }

    const plan = await taskPlannerService.generatePlan(promptWithProjectContext, tenantId)
    parsed = {
      workflow_name: plan.goal,
      workflow_type: 'sequential',
      missing_inputs: [],
      agents: plan.steps.map((step, idx) => ({
        position: idx + 1,
        name: step.title,
        role: step.role || 'researcher',
        description: step.description,
        system_prompt: step.system_prompt || '',
        tools_needed: step.tools_needed || []
      }))
    }
  }

  // 6. Check Integration Connections (Phase 4 Blocker)
  const { integrationRegistryService } = await import('./integration-registry.service')
  for (const agent of parsed.agents) {
    const tools = agent.tools_needed || []
    const roleLower = agent.role.toLowerCase()
    const nameLower = agent.name.toLowerCase()
    
    let requiredService: string | null = null
    let requiredDisplayName: string = ''
    
    if (tools.includes('send_email') || tools.includes('read_email') || roleLower.includes('email') || nameLower.includes('email')) {
      const hasGmail = await integrationRegistryService.hasIntegration(tenantId, 'gmail')
      const hasOutlook = await integrationRegistryService.hasIntegration(tenantId, 'outlook_email')
      if (hasGmail && hasOutlook) {
        let preferred = 'gmail'
        try {
          const recentRun = await queryOne(
            `SELECT action_type FROM action_journal 
             WHERE tenant_id = $1 AND action_type IN ('gmail_send', 'gmail_read', 'outlook_send_email', 'outlook_read') 
             ORDER BY created_at DESC LIMIT 1`,
            [tenantId]
          )
          if (recentRun && recentRun.action_type.startsWith('outlook')) {
            preferred = 'outlook-email'
          }
        } catch (e) {}
        requiredService = preferred
        requiredDisplayName = preferred === 'gmail' ? 'Gmail' : 'Outlook Email'
      } else if (hasOutlook) {
        requiredService = 'outlook-email'
        requiredDisplayName = 'Outlook Email'
      } else {
        requiredService = 'gmail'
        requiredDisplayName = 'Gmail or Outlook Email'
      }
    } else if (tools.includes('create_calendar_event') || roleLower.includes('calendar') || nameLower.includes('calendar')) {
      const hasGoogleCal = await integrationRegistryService.hasIntegration(tenantId, 'google-calendar')
      const hasOutlookCal = await integrationRegistryService.hasIntegration(tenantId, 'outlook_calendar')
      if (hasGoogleCal && hasOutlookCal) {
        let preferred = 'google-calendar'
        try {
          const recentRun = await queryOne(
            `SELECT action_type FROM action_journal 
             WHERE tenant_id = $1 AND action_type IN ('google_calendar_create', 'outlook_calendar_create') 
             ORDER BY created_at DESC LIMIT 1`,
            [tenantId]
          )
          if (recentRun && recentRun.action_type.startsWith('outlook')) {
            preferred = 'outlook-calendar'
          }
        } catch (e) {}
        requiredService = preferred
        requiredDisplayName = preferred === 'google-calendar' ? 'Google Calendar' : 'Outlook Calendar'
      } else if (hasOutlookCal) {
        requiredService = 'outlook-calendar'
        requiredDisplayName = 'Outlook Calendar'
      } else {
        requiredService = 'google-calendar'
        requiredDisplayName = 'Google Calendar or Outlook Calendar'
      }
    } else if (tools.includes('send_slack_message') || tools.includes('post_slack_message') || roleLower.includes('messaging') || nameLower.includes('slack')) {
      requiredService = 'slack'
      requiredDisplayName = 'Slack'
    } else if (tools.includes('upload_drive_file') || roleLower.includes('cloud-storage') || nameLower.includes('drive')) {
      requiredService = 'google-drive'
      requiredDisplayName = 'Google Drive'
    } else if (roleLower.includes('notion') || nameLower.includes('notion')) {
      requiredService = 'notion'
      requiredDisplayName = 'Notion'
    }
    
    if (requiredService) {
      const hasConnection = await integrationRegistryService.hasIntegration(tenantId, requiredService)
      if (!hasConnection) {
        res.write(`data: ${JSON.stringify({
          type: 'integration_required',
          service: requiredService,
          userMessage: `To do this, I need access to your ${requiredDisplayName}. Connect it here →`,
          actionUrl: '/dashboard/integrations'
        })}\n\n`)
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        res.end()
        return
      }
    }
  }

  // 7. Check Governance and Policy (Step 2)
  for (const agent of parsed.agents) {
    const primaryTool = agent.tools_needed[0] || 'general'
    const isAllowed = await agentGovernanceService.verifyAgentPolicy(tenantId, agent.role, primaryTool)
    if (!isAllowed) {
      res.write(`data: ${JSON.stringify({
        type: 'task_event',
        event: {
          type: 'workflow_error',
          runId: 'governance_halt',
          data: { message: `Policy Block: Action involving tool "${primaryTool}" is not permitted under tenant governance rules.` }
        }
      })}\n\n`)
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
      res.end()
      return
    }
  }

  // 7. Check for missing inputs
  const missingInputs = (parsed.missing_inputs || []).filter((m: any) => m.required && !inputs[m.field]?.trim())
  if (missingInputs.length > 0) {
    res.write(`data: ${JSON.stringify({
      type: 'needs_inputs',
      workflow_name: parsed.workflow_name,
      missing_inputs: parsed.missing_inputs,
      parsed_config: parsed
    })}\n\n`)
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
    return
  }

  // 8. Create workflow and agents in DB
  const projectId = inputs.project_id || null
  const [workflow] = await query(
    `INSERT INTO workflows (tenant_id, name, original_prompt, type, project_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tenantId, parsed.workflow_name || 'Autonomous Task', userPrompt, parsed.workflow_type || 'sequential', projectId]
  )

  const createdAgents: any[] = []
  for (const agent of (parsed.agents || [])) {
    const config = {
      model: agent.model || 'meta/llama-3.1-8b-instruct',
      temperature: agent.temperature || 0.3,
      max_tokens: agent.max_tokens || 2000,
      tools_needed: agent.tools_needed || []
    }
    
    let sysPrompt = agent.system_prompt || ''
    if (attachmentContext) {
      sysPrompt += `\n\n[File context: ${attachmentContext}]`
    }
    if (detectedLanguage && detectedLanguage !== 'English') {
      sysPrompt += `\n\n[Language Preference: ${detectedLanguage}. Please respond and generate all user-facing content in ${detectedLanguage}.]`
    }
    
    const [newAgent] = await query(
      `INSERT INTO workflow_agents 
       (workflow_id, tenant_id, position, name, role, description, system_prompt, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [workflow.id, tenantId, agent.position, agent.name, agent.role, 
       agent.description, sysPrompt, JSON.stringify(config)]
    )
    createdAgents.push(newAgent)
  }

  // 9. Enqueue workflow run (Step 4)
  const runId = await queueService.enqueueWorkflowRun(workflow.id, tenantId, inputs)
  await billingService.incrementUsage(tenantId, 'tasks')

  if (billingCheck.overage) {
    runEmitter.emitEvent(runId, 'agent_progress', {
      message: `⚠️ Limit warning: Monthly task limit reached. This task is executing under your pay-as-you-go overage ($0.05/task).`
    })
  }

  // Set workflow_runs.task_type based on the primary required_capability
  let taskType = 'other'
  const primaryCap = classification.required_capabilities?.[0]?.toLowerCase()
  if (primaryCap) {
    if (primaryCap.includes('research')) taskType = 'research'
    else if (primaryCap.includes('spreadsheet')) taskType = 'spreadsheet'
    else if (primaryCap.includes('email') || primaryCap.includes('gmail')) taskType = 'email'
    else if (primaryCap.includes('code')) taskType = 'code'
    else if (primaryCap.includes('slides') || primaryCap.includes('presentation')) taskType = 'presentation'
    else if (primaryCap.includes('browser') || primaryCap.includes('web')) taskType = 'web'
  }
  
  await query(
    `UPDATE workflow_runs SET task_type = $1 WHERE id = $2`,
    [taskType, runId]
  )

  // Calculate estimated duration to determine if background mode is active (> 90s)
  const estimatedDurationSeconds = (parsed.agents || []).reduce((sum: number, agent: any) => {
    return sum + 30 + (agent.tools_needed?.length || 0) * 15
  }, 0)
  const isBackgroundMode = estimatedDurationSeconds > 90

  // 10. Emit launch packet (sanitized)
  res.write(`data: ${JSON.stringify(sanitizePayload({
    type: 'task_launched',
    run_id: runId,
    workflow_id: workflow.id,
    workflow_name: workflow.name,
    agents: createdAgents
  }))}\n\n`)

  if (isBackgroundMode) {
    res.write(`data: ${JSON.stringify({
      type: 'task_event',
      event: {
        type: 'agent_progress',
        message: "This one will take a few minutes. I'll let you know when it's ready — feel free to do other things."
      }
    })}\n\n`)
  }

  // 11. SOC2 Audit log registration
  await agentGovernanceService.logCryptographicEvent(tenantId, runId, 'TASK_ROUTED_AND_LAUNCHED', {
    prompt,
    workflow_id: workflow.id,
    estimated_steps: classification.estimated_steps
  })

  // 12. Subscribe to events and stream out (applying strict user string sanitization)
  const listener = (event: any) => {
    const isTerminalEvent = event.type === 'workflow_done' || event.type === 'workflow_error'
    if (isBackgroundMode && !isTerminalEvent) {
      return
    }

    const sanitizedEvent = sanitizePayload(event)
    res.write(`data: ${JSON.stringify({ type: 'task_event', event: sanitizedEvent })}\n\n`)
    
    if (isTerminalEvent) {
      runEmitter.removeListener(`run:${runId}`, listener)
      res.end()

      // Fire-and-forget record metrics
      const startedAt = workflow.created_at ? new Date(workflow.created_at) : new Date()
      const outcome = event.type === 'workflow_done' ? 'success' : 'failed'
      const errorMsg = event.data?.error || null

      import('./metrics.service').then(({ metricsService }) => {
        metricsService.record({
          userId: tenantId,
          runId,
          taskType,
          startedAt,
          completedAt: new Date(),
          outcome,
          errorCode: errorMsg,
          stepCount: createdAgents.length,
          agentTypesUsed: createdAgents.map(a => a.role)
        }).catch(() => {})
      }).catch(() => {})

      // Step 7: Write to memory store on completion
      if (event.type === 'workflow_done') {
        // Fire-and-forget fact extraction
        extractAndStoreSessionFacts(
          runId,
          tenantId,
          {
            prompt,
            output: event.data ? JSON.stringify(event.data) : undefined,
            workflow_name: workflow.name
          }
        ).catch(() => {})

        query(
          `INSERT INTO memory_decisions (tenant_id, run_id, decision_type, rationale, impact_score)
           VALUES ($1, $2, 'Task Completion Checkpoint', $3, 9)`,
          [tenantId, runId, `Successfully resolved task: ${prompt}`]
        ).catch(() => {})
      }
    }
  }

  runEmitter.on(`run:${runId}`, listener)

  if (reqCloseHandler) {
    reqCloseHandler(() => {
      runEmitter.removeListener(`run:${runId}`, listener)
    })
  }
}

/**
 * Phase 8: Generates a plain-English task receipt summarizing what was accomplished.
 * Strips all technical terminology per hard constraints.
 */
export async function generateTaskReceipt(
  prompt: string,
  workflowName: string,
  stepCount: number,
  durationMs: number
): Promise<string> {
  const durationStr = durationMs < 1000
    ? `${durationMs}ms`
    : durationMs < 60000
      ? `${(durationMs / 1000).toFixed(1)} seconds`
      : `${Math.floor(durationMs / 60000)} minute${Math.floor(durationMs / 60000) !== 1 ? 's' : ''}`

  const systemPrompt = `You are a helpful assistant writing a task completion summary for a non-technical user.
Write 2-3 sentences confirming what was done in plain, friendly English.
NEVER use the words: agent, pipeline, workflow, LLM, token, orchestrate, LangGraph, GPT, Claude, or any AI model names.
Focus entirely on the outcome and what the user can do next.`

  const userMsg = `Task: "${prompt}"\nCompleted in ${durationStr} across ${stepCount} step${stepCount !== 1 ? 's' : ''}.`

  try {
    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content } = await callLLM(modelToUse, systemPrompt, userMsg, 300)
    return sanitizeUserFacingText(content.trim())
  } catch {
    return sanitizeUserFacingText(
      `Your request "${prompt}" has been completed. The results are ready for your review.`
    )
  }
}
