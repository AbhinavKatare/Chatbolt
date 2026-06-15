import { logger } from './logger.service';
import { db, query, queryOne } from '../db'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from './sse.service'
import { runResearcher } from '../agents/researcher.agent'
import { runWriter } from '../agents/writer.agent'
import { runScraper } from '../agents/scraper.agent'
import { runReporter } from '../agents/reporter.agent'
import { runCodeAgent } from '../agents/code.agent'
import { runAPIAgent } from '../agents/api-caller.agent'
import { runDataProcessor } from '../agents/data-processor.agent'
import { runEmailAgent } from '../agents/email.agent'
import { runCalendarAgent } from '../agents/calendar.agent'
import { runMessagingAgent } from '../agents/slack.agent'
import { runCloudStorageAgent } from '../agents/drive.agent'
import { runNotionAgent } from '../agents/notion.agent'
import { runSpreadsheetAgent } from '../agents/spreadsheet.agent'
import { runBrowserAgent } from '../agents/browser.agent'
import { runEnrichmentAgent } from '../agents/enrichment.agent'
import { runCicdAgent } from '../agents/ci-cd.agent'
import { runWebhookAgent } from '../agents/webhook.agent'
import { runSeoAgent } from '../agents/seo.agent'
import { runSocialAgent } from '../agents/social.agent'
import { runCroAgent } from '../agents/cro.agent'
import { runSecurityAgent } from '../agents/security.agent'
import { runCloudOpsAgent } from '../agents/cloudops.agent'
import { runLegalAgent } from '../agents/legal.agent'
import { runDatabaseArchitectAgent } from '../agents/database-architect.agent'
import { runSmartContractAgent } from '../agents/smart-contract.agent'
import { runMultimediaAgent } from '../agents/multimedia.agent'
import { runMeetingAgent } from '../agents/meeting.agent'
import { runSlideAgent } from '../agents/slide.agent'
import { supervisorService } from './supervisor.service'
import { transitionWorkflowRun } from './workflow-state'
import { traceService } from './trace.service'
import { runValidator, runRecoveryAgent, getModelForPlan } from '../agents'
import { compressShortTermMemory } from './memory.service'
import { outcomeEngineService } from './outcome-engine.service'
import { executiveSwarmService } from './executive-swarm.service'
import { agentGovernanceService } from './agent-governance.service'
import { costIntelligenceService } from './cost-intelligence.service'
import { optimizationEngineService } from './optimization-engine.service'
import { linearAgent } from '../agents/linear.agent'
import { githubAgent } from '../agents/github.agent'
import { hubspotAgent } from '../agents/hubspot.agent'
import { runStripeAgent } from '../agents/stripe.agent'

// Thin wrappers to match (ctx) => AgentOutput signature
const runLinearAgent = async (ctx: any) => {
  const result = await linearAgent.execute(ctx)
  return { output: result.output, metadata: result.metadata }
}
const runGitHubAgent = async (ctx: any) => {
  const result = await githubAgent.execute(ctx)
  return { output: result.output, metadata: result.metadata }
}
const runHubSpotAgent = async (ctx: any) => {
  const result = await hubspotAgent.execute(ctx)
  return { output: result.output, metadata: result.metadata }
}

export const AGENT_EXECUTORS: Record<string, any> = {
  'researcher': runResearcher,
  'writer': runWriter,
  'scraper': runScraper,
  'reporter': runReporter,
  'code': runCodeAgent,
  'api-caller': runAPIAgent,
  'data-processor': runDataProcessor,
  'email-sender': runEmailAgent,
  'email': runEmailAgent,
  'calendar': runCalendarAgent,
  'messaging': runMessagingAgent,
  'cloud-storage': runCloudStorageAgent,
  'notion': runNotionAgent,
  'spreadsheet': runSpreadsheetAgent,
  'browser': runBrowserAgent,
  'enricher': runEnrichmentAgent,
  enrichment: runEnrichmentAgent,
  'ci-cd': runCicdAgent,
  webhook: runWebhookAgent,
  seo: runSeoAgent,
  social: runSocialAgent,
  cro: runCroAgent,
  security: runSecurityAgent,
  cloudops: runCloudOpsAgent,
  legal: runLegalAgent,
  database: runDatabaseArchitectAgent,
  smartcontract: runSmartContractAgent,
  multimedia: runMultimediaAgent,
  meeting: runMeetingAgent,
  slides: runSlideAgent,
  presentation: runSlideAgent,
  linear: runLinearAgent,
  github: runGitHubAgent,
  hubspot: runHubSpotAgent,
  crm: runHubSpotAgent,
  stripe: runStripeAgent,
}

// Helper function to topologically group agents by input dependencies
function groupAgentsTopologically(agents: WorkflowAgent[]): WorkflowAgent[][] {
  const batches: WorkflowAgent[][] = []
  const pending = [...agents]
  const completedAgentNames = new Set<string>()

  // Helper to extract the base agent name from dependency string (e.g. "Research Analyst.report" -> "Research Analyst")
  const getDepName = (dep: string) => {
    const dotIndex = dep.indexOf('.')
    return dotIndex === -1 ? dep.trim() : dep.substring(0, dotIndex).trim()
  }

  while (pending.length > 0) {
    const currentBatch: WorkflowAgent[] = []
    
    for (let i = 0; i < pending.length; i++) {
      const agent = pending[i]
      const deps = agent.inputs_from_previous || []
      
      // If all dependencies are satisfied by completed agents, it's ready to run in the current batch
      const ready = deps.every((dep: string) => completedAgentNames.has(getDepName(dep)))
      if (ready) {
        currentBatch.push(agent)
      }
    }

    if (currentBatch.length === 0) {
      console.warn('[Engine] Circular dependency or unresolved inputs detected. Falling back to sequential execution.')
      batches.push([...pending])
      break
    }

    batches.push(currentBatch)
    currentBatch.forEach(agent => completedAgentNames.add(agent.name))
    currentBatch.forEach(agent => {
      const idx = pending.indexOf(agent)
      if (idx !== -1) pending.splice(idx, 1)
    })
  }

  return batches
}

// Helper function to execute a single agent step
async function executeSingleStep(
  agent: WorkflowAgent,
  runId: string,
  workflowId: string,
  tenantId: string,
  tenant: any,
  userInputs: any,
  previousOutputs: Record<string, AgentOutput>,
  agentsLength: number
): Promise<{ success: boolean; output: AgentOutput; halted?: boolean }> {
  const stepStartTime = Date.now()

  // Resolve model dynamically based on plan
  const resolvedModel = getModelForPlan(tenant || { plan: 'hobby' }, agent.config?.model)
  if (agent.config) {
    agent.config.model = resolvedModel
  } else {
    agent.config = { model: resolvedModel } as any
  }

  // Check if step is already completed (checkpoint resume)
  const stepCheck = await db.query(
    "SELECT id, status, output_data FROM workflow_steps WHERE run_id = $1 AND agent_id = $2",
    [runId, agent.id]
  )
  if (stepCheck.rows.length > 0 && stepCheck.rows[0].status === 'completed') {
    logger.info(`[Engine] Resuming run ${runId}: Skipping completed step ${agent.position} (${agent.name})`)
    const stepOutput = stepCheck.rows[0].output_data as AgentOutput
    return { success: true, output: stepOutput }
  }

  const checkpointCheck = await db.query(
    "SELECT step_output FROM task_checkpoints WHERE run_id = $1 AND step_index = $2 AND status = 'completed'",
    [runId, agent.position]
  )
  if (checkpointCheck.rows.length > 0) {
    logger.info(`[Engine] Resuming run ${runId} from checkpoint: Skipping step ${agent.position} (${agent.name})`)
    const stepOutput = checkpointCheck.rows[0].step_output as AgentOutput
    return { success: true, output: stepOutput }
  }

  // Cancellation checkpoint
  const checkRun = await db.query('SELECT status FROM workflow_runs WHERE id = $1', [runId])
  const currentStatus = (checkRun.rows[0]?.status || 'executing').toLowerCase()
  if (currentStatus === 'cancelled') {
    logger.info(`[Engine] Run ${runId} was cancelled by user. Aborting step ${agent.position}.`)
    await db.query(
      "UPDATE workflow_steps SET status = 'cancelled', completed_at = NOW() WHERE run_id = $1 AND status = 'running'",
      [runId]
    )
    return { success: false, output: {} as any, halted: true }
  }

  // Register heartbeat and check budget with Supervisor Agent
  const isSupervisorAllowed = await supervisorService.registerHeartbeat(agent.id, 'running', runId)
  if (!isSupervisorAllowed) {
    throw new Error(`Execution blocked by Supervisor: Agent "${agent.name}" has depleted its compute budget.`)
  }

  // ── Agent Governance Policy & Safety Risk Gate (Phase 1.3) ──
  const toolsNeeded = agent.config?.tools_needed || []
  const isAllowed = await agentGovernanceService.verifyAgentPolicy(tenantId, agent.role, toolsNeeded[0] || 'general')
  if (!isAllowed) {
    throw new Error(`Governance Policy block: Agent role "${agent.role}" does not have authorized permission to run action "${toolsNeeded[0]}".`)
  }

  const riskScore = await agentGovernanceService.assessWorkflowRisk(runId, agent.name, toolsNeeded)
  if (riskScore > 0.7 && !(agent.config as any)?.require_approval) {
    logger.info(`[Governance] Dynamically elevating "${agent.name}" to require human verification. Risk score: ${riskScore}`)
    agent.config = { ...agent.config, require_approval: true } as any
  }

  runEmitter.emitEvent(runId, 'agent_start', {
    agentId: agent.id,
    agent_name: agent.name,
    agent_role: agent.role,
    step: agent.position,
    total: agentsLength,
    message: `${agent.name} is starting...`,
  })

  const progressVal = Math.round((agent.position / (agentsLength + 1)) * 90)
  runEmitter.emitEvent(runId, 'workflow_progress', { progress: progressVal }, workflowId)

  let stepId: string
  if (stepCheck.rows.length > 0) {
    stepId = stepCheck.rows[0].id
    await db.query(
      "UPDATE workflow_steps SET status = 'running', started_at = NOW() WHERE id = $1",
      [stepId]
    )
  } else {
    // Create step record
    const { rows: steps } = await db.query(
      `INSERT INTO workflow_steps 
       (run_id, agent_id, step_number, status, input_data, started_at)
       VALUES ($1, $2, $3, 'running', $4, NOW())
       RETURNING id`,
      [
        runId,
        agent.id,
        agent.position,
        JSON.stringify({
          user_inputs: userInputs,
          previous_outputs: previousOutputs,
        }),
      ]
    )
    stepId = steps[0].id
  }

  // CHECK APPROVAL GATE (User Safety Permission Lock)
  const agentConfig = agent.config as any
  const requireApproval = agentConfig?.require_approval === true
  const agentRoleLower = agent.role.toLowerCase()
  const isDestructive = agentConfig?.tools_needed?.some((t: string) => 
    ['send_email', 'api_caller', 'send_slack_message', 'post_slack_message', 'create_calendar_event', 'upload_drive_file', 'notion_create_page', 'form_submit'].includes(t)
  ) || ['email-sender', 'email', 'messaging', 'calendar', 'notion', 'cloud-storage'].includes(agentRoleLower)
  const isDryRun = process.env.DRY_RUN === 'true' || agentConfig?.dryRun === true

  const isStripeWrite = agentRoleLower === 'stripe' && (
    (agent.description || '').toLowerCase().includes('link') ||
    (agent.description || '').toLowerCase().includes('payment') ||
    (agent.description || '').toLowerCase().includes('charge') ||
    (userInputs.prompt || '').toLowerCase().includes('link') ||
    (userInputs.prompt || '').toLowerCase().includes('payment') ||
    (userInputs.prompt || '').toLowerCase().includes('charge')
  )
  const actionType = isStripeWrite ? 'stripe_write' : (isDestructive ? 'destructive' : 'general')

  if (requireApproval || (isDestructive && !isDryRun) || isStripeWrite) {
    // Check if approval has already been logged in event store
    const approvalCheck = await db.query(
      "SELECT id FROM workflow_events WHERE run_id = $1 AND event_type = 'STEP_APPROVED' AND payload->>'agent_id' = $2",
      [runId, agent.id]
    )
    const count = approvalCheck.rows.length
    
    let alreadyApproved = false
    let safetyMessage = `🔐 SAFETY GATE: ${agent.name} requires your permission to execute critical operations.`
    
    if (actionType === 'stripe_write') {
      if (count === 0) {
        alreadyApproved = false
        safetyMessage = `🔐 STRIPE INTENT CHECK: Confirm you want ${agent.name} to generate a payment link.`
      } else if (count === 1) {
        alreadyApproved = false
        const amountStr = userInputs.prompt?.match(/(?:\$|usd\s*)(\d+(?:\.\d{2})?)/i)?.[1] || 'specified amount'
        const desc = userInputs.prompt?.match(/(?:for|desc)[:\s]+["']?([^"'\n]+)/i)?.[1] || 'Payment Link'
        safetyMessage = `🔐 STRIPE PAYLOAD CONFIRMATION: Confirm creation of $${amountStr} payment link for "${desc}".`
      } else if (count >= 2) {
        alreadyApproved = true
      }
    } else {
      alreadyApproved = count > 0
    }

    if (!alreadyApproved) {
      logger.info(`[Engine] Safety Gate triggered: Step ${agent.position} (${agent.name}) requires human permission. Pausing run...`)
      await transitionWorkflowRun(runId, 'WAITING', { workflowId })
      
      await db.query(
        "UPDATE workflow_steps SET status = 'waiting' WHERE id = $1",
        [stepId]
      )

      runEmitter.emitEvent(runId, 'agent_waiting', {
        agentId: agent.id,
        agent_name: agent.name,
        step: agent.position,
        message: safetyMessage,
      })

      return { success: false, output: {} as any, halted: true }
    }
  }

  // Get executor
  const role = agent.role.toLowerCase()
  const executor = AGENT_EXECUTORS[role]
  if (!executor) {
    throw new Error(
      `No executor for role: "${agent.role}". ` +
      `Available: ${Object.keys(AGENT_EXECUTORS).join(', ')}`
    )
  }

  let agentOutput: any = null
  let lastError = ''
  const maxRetries = agent.config?.retry_policy?.max_retries ?? 2

  await traceService.logTrace(runId, 'NODE_STARTED', {
    agentName: agent.name,
    agentRole: agent.role,
    stepNumber: agent.position,
    message: `Started step ${agent.position}: ${agent.name}`
  })

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const timeoutSec = agent.config?.timeout_policy?.timeout_sec ?? 180
    try {
      const innerCheck = await db.query('SELECT status FROM workflow_runs WHERE id = $1', [runId])
      if ((innerCheck.rows[0]?.status || '').toLowerCase() === 'cancelled') {
        throw new Error('Workflow cancelled by user')
      }

      if (attempt > 0) {
        logger.info(`[Engine] Initiating recovery healing for "${agent.name}" (Attempt ${attempt}/${maxRetries})...`)
        try {
          await traceService.logTrace(runId, 'RECOVERY_TRIGGERED', {
            agentName: agent.name,
            agentRole: agent.role,
            errorMessage: lastError,
            attempt: attempt
          })

          const replanPatch = await outcomeEngineService.autonomousReplanning(runId, agent.name, lastError)
          if (replanPatch && replanPatch.system_prompt_patch) {
            agent.system_prompt = `${agent.system_prompt}\n\n[SELF-HEALING HEAL]: ${replanPatch.system_prompt_patch}`
            if (replanPatch.model_fallback) {
              agent.config = { ...agent.config, model: replanPatch.model_fallback } as any
            }
          }

          const recoveryPatch = await runRecoveryAgent(agent, lastError, runId)
          if (recoveryPatch.system_prompt) agent.system_prompt = recoveryPatch.system_prompt
          if (recoveryPatch.description) agent.description = recoveryPatch.description
          if (recoveryPatch.config) {
            agent.config = {
              ...agent.config,
              ...recoveryPatch.config
            }
          }
        } catch (recErr: any) {
          console.error(`[Engine] Recovery healing failed for "${agent.name}":`, recErr.message)
        }

        const delay = Math.round(1500 * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4))
        await transitionWorkflowRun(runId, 'RETRYING', {
          workflowId,
          payload: { agent_name: agent.name, attempt: attempt, error: lastError }
        })

        runEmitter.emitEvent(runId, 'agent_retry', {
          agent_name: agent.name,
          attempt: attempt,
          reason: lastError,
          next_delay_ms: delay,
        })

        await new Promise(r => setTimeout(r, delay))
      }

      const runCheck = await db.query('SELECT status FROM workflow_runs WHERE id = $1', [runId])
      const currentRunStatus = (runCheck.rows[0]?.status || '').toUpperCase()
      if (currentRunStatus === 'RETRYING') {
        await transitionWorkflowRun(runId, 'EXECUTING', { workflowId })
      }
      await transitionWorkflowRun(runId, 'TOOL_RUNNING', { workflowId })

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: Agent ${agent.name} exceeded safety budget of ${timeoutSec}s`)), timeoutSec * 1000)
      )

      let customSystemPrompt = agent.system_prompt || ''
      if (tenant?.user_details || tenant?.user_purpose) {
        customSystemPrompt = `${customSystemPrompt}\n\n[USER CONTEXT RAG]\n`
        if (tenant.user_details) customSystemPrompt += `- User/Business Details: ${tenant.user_details}\n`
        if (tenant.user_purpose) customSystemPrompt += `- User Primary Purpose/Goals: ${tenant.user_purpose}\n`
        customSystemPrompt += `\nPlease adapt your tone, vocabulary, formatting constraints, and execution strategy to align perfectly with the user context.`
      }

      const executionAgent = { ...agent, system_prompt: customSystemPrompt }

      let watchdogSent = false
      let lastProgressEmittedAt = Date.now()

      const progressHook = (event: any) => {
        if (event?.type === 'agent_progress' || event?.type === 'agent_start' || event?.type === 'agent_retry') {
          lastProgressEmittedAt = Date.now()
        }
      }
      runEmitter.on(`run:${runId}`, progressHook)

      const watchdogInterval = setInterval(() => {
        const elapsed = Date.now() - lastProgressEmittedAt
        if (elapsed >= 45000 && !watchdogSent) {
          watchdogSent = true
          runEmitter.emitEvent(runId, 'agent_progress', {
            message: `Still working on this — executing operations for ${agent.name}. Thanks for your patience.`
          })
        }
      }, 5000)

      try {
        agentOutput = await Promise.race([
          executor(
            executionAgent,
            {
              task: agent.description || userInputs.prompt || 'Execute task',
              user_inputs: userInputs,
              previous_outputs: previousOutputs,
              context: { workflow_name: workflowId, run_id: runId },
            },
            runId
          ),
          timeoutPromise
        ])
      } finally {
        clearInterval(watchdogInterval)
        runEmitter.removeListener(`run:${runId}`, progressHook)
      }


      await transitionWorkflowRun(runId, 'EXECUTING', { workflowId })

      if (agentOutput && agentOutput.success) {
        await traceService.logTrace(runId, 'TOOL_EXECUTED', {
          agentName: agent.name,
          toolName: executor.name || agent.role,
          latencyMs: Date.now() - stepStartTime
        })

        let validationResult = await runValidator(executionAgent, agentOutput, runId)
        if (!validationResult.success) {
          logger.info(`[Engine] Quality validation failed: ${validationResult.error}. Running one silent retry...`)
          
          const retryAgent = {
            ...executionAgent,
            system_prompt: `${executionAgent.system_prompt}\n\n[QUALITY CRITERIA NOTIFICATION]:\nYour previous output failed validation due to: ${validationResult.error}. Please regenerate your output, making sure to resolve this issue.`
          }

          try {
            const retryOutput = await Promise.race([
              executor(
                retryAgent,
                {
                  task: agent.description || userInputs.prompt || 'Execute task',
                  user_inputs: userInputs,
                  previous_outputs: previousOutputs,
                  context: { workflow_name: workflowId, run_id: runId },
                },
                runId
              ),
              timeoutPromise
            ])

            const retryValResult = await runValidator(retryAgent, retryOutput, runId)
            if (retryValResult.success) {
              agentOutput = retryOutput
              validationResult = retryValResult
            } else {
              logger.info(`[Engine] Silent retry still failed validation. Delivering with notice.`)
              agentOutput = retryOutput || agentOutput || { success: true, summary: '' }
              agentOutput.success = true
              const plainReason = retryValResult.error || 'some quality metrics were not met'
              const plainNote = `Here's what I produced — note that ${plainReason}.`
              agentOutput.summary = `${plainNote}\n\n${agentOutput.summary || ''}`
              validationResult = { success: true }
            }
          } catch (retryErr: any) {
            console.warn(`[Engine] Silent retry execution failed: ${retryErr.message}. Delivering previous output with note.`)
            if (!agentOutput) {
              agentOutput = { success: true, summary: '' }
            }
            agentOutput.success = true
            const plainNote = `Here's what I produced — note that execution encountered errors: ${retryErr.message}.`
            agentOutput.summary = `${plainNote}\n\n${agentOutput.summary || ''}`
            validationResult = { success: true }
          }
        }

        if (validationResult.success) {
          try {
            await compressShortTermMemory(runId, agent.id, tenantId)
          } catch (memErr: any) {
            console.warn(`[Engine] Memory compression failed (non-fatal): ${memErr.message}`)
          }
          break
        }

      } else {
        lastError = agentOutput?.error || 'Agent returned failure status'
      }
    } catch (execErr: any) {
      lastError = execErr.message
      console.error(`[Engine] Agent "${agent.name}" attempt ${attempt} threw:`, execErr.stack || execErr.message)
      if (execErr.message === 'Workflow cancelled by user') {
        throw execErr
      }
      await traceService.logTrace(runId, 'RETRY_TRIGGERED', {
        agentName: agent.name,
        attempt: attempt + 1,
        errorMessage: lastError
      })
    }
  }

  if (!agentOutput || !agentOutput.success) {
    agentOutput = {
      success: false,
      data: null,
      summary: `Failed after ${maxRetries + 1} attempts`,
      output_type: 'error',
      confidence: 0,
      error: lastError,
      metadata: { duration_ms: Date.now() - stepStartTime, tokens_used: 0, tools_used: [], retries: maxRetries }
    }
  }

  if (agentOutput.success) {
    await traceService.logTrace(runId, 'NODE_COMPLETED', {
      agentName: agent.name,
      agentRole: agent.role,
      stepNumber: agent.position,
      message: `Completed step ${agent.position}: ${agent.name}`
    })
  } else {
    await traceService.logTrace(runId, 'STEP_FAILED', {
      agentName: agent.name,
      agentRole: agent.role,
      stepNumber: agent.position,
      errorMessage: agentOutput.error
    })
  }

  const duration = Date.now() - stepStartTime
  const promptTokens = (agentOutput?.metadata as any)?.prompt_tokens || 850
  const completionTokens = (agentOutput?.metadata as any)?.completion_tokens || 350
  const stepCost = await costIntelligenceService.logStepCost(
    runId,
    agent.id,
    agent.config?.model || 'Qwen/WebWorld-8B:featherless-ai',
    promptTokens,
    completionTokens,
    duration
  )

  await agentGovernanceService.logAuditRecord(
    tenantId,
    agent.id,
    agentOutput.success ? 'AGENT_STEP_SUCCESS' : 'AGENT_STEP_FAILED',
    `Step ${agent.position} (${agent.name}) executed. Cost: $${stepCost.toFixed(4)}.`
  )
  await supervisorService.logComputeUsage(agent.id, stepCost)
  await supervisorService.registerHeartbeat(agent.id, agentOutput.success ? 'idle' : 'failed', runId)

  await db.query(
    `UPDATE workflow_steps 
     SET status = $1, output_data = $2, 
         duration_ms = $3, completed_at = NOW()
     WHERE id = $4`,
    [agentOutput.success ? 'completed' : 'failed', JSON.stringify(agentOutput), duration, stepId]
  )

  if (agentOutput.success) {
    try {
      await db.query(
        `INSERT INTO task_checkpoints (run_id, step_index, step_name, step_output, status)
         VALUES ($1, $2, $3, $4, 'completed')`,
        [runId, agent.position, agent.name, JSON.stringify(agentOutput)]
      )
    } catch (checkpointErr: any) {
      console.warn(`[Engine] Checkpoint write failed (non-fatal): ${checkpointErr.message}`)
    }
  }

  await db.query(
    `UPDATE workflow_agents 
     SET last_output = $1, status = 'idle'
     WHERE id = $2`,
    [JSON.stringify(agentOutput), agent.id]
  )

  runEmitter.emitEvent(runId, 'agent_done', {
    agentId: agent.id,
    agent_name: agent.name,
    step: agent.position,
    total: agentsLength,
    duration_ms: duration,
    success: agentOutput.success,
    output_summary: agentOutput.summary,
    message: agentOutput.success
      ? `✓ ${agent.name}: ${agentOutput.summary}`
      : `⚠ ${agent.name}: ${agentOutput.error}`,
  })

  return { success: agentOutput.success, output: agentOutput }
}

export async function executeWorkflow(
  workflowId: string,
  tenantId: string,
  userInputs: any,
  resumeRunId?: string
): Promise<{ run_id: string }> {
  
  logger.info(`🚀 Starting workflow ${workflowId} for tenant ${tenantId} (Resume: ${resumeRunId || 'no'})`)

  // 1. Load workflow and agents
  const { rows: workflows } = await db.query(
    'SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2',
    [workflowId, tenantId]
  )
  const workflow = workflows[0]
  if (!workflow) throw new Error('Workflow not found')

  const { rows: agents } = await db.query(
    'SELECT * FROM workflow_agents WHERE workflow_id = $1 ORDER BY position ASC',
    [workflowId]
  )
  if (agents.length === 0) throw new Error('No agents found in workflow')

  // Load tenant details for plan resolution
  const { rows: tenants } = await db.query(
    'SELECT * FROM tenants WHERE id = $1',
    [tenantId]
  )
  const tenant = tenants[0]

  let runId: string
  let finalInputs = userInputs

  if (resumeRunId) {
    runId = resumeRunId
    const { rows: runs } = await db.query('SELECT input_data FROM workflow_runs WHERE id = $1', [resumeRunId])
    if (runs.length === 0) throw new Error(`Run ${resumeRunId} to resume not found`)
    if (runs[0].input_data) {
      finalInputs = typeof runs[0].input_data === 'string' ? JSON.parse(runs[0].input_data) : runs[0].input_data
    }
  } else {
    // 2. Create workflow run BEFORE background task
    const { rows: runs } = await db.query(
      `INSERT INTO workflow_runs 
       (workflow_id, tenant_id, input_data, status, started_at) 
       VALUES ($1, $2, $3, 'pending', NOW()) 
       RETURNING id`,
      [workflowId, tenantId, JSON.stringify(userInputs)]
    )
    runId = runs[0].id
  }

  // 3. Run execution in background (fire and forget)
  setImmediate(async () => {
    const previousOutputs: Record<string, AgentOutput> = {}
    const startTime = Date.now()
    let totalCredits = 0

    try {
      // 1. Transition to PLANNING stage
      await transitionWorkflowRun(runId, 'PLANNING', { workflowId })
      
      let goalStr = workflow.original_prompt || 'Autonomous Outcome Task'
      
      if (workflow.project_id) {
        try {
          const pinnedArtifacts = await db.query(
            `SELECT a.name, a.file_path, av.summary
             FROM project_artifacts pa
             JOIN artifacts a ON pa.artifact_id = a.id
             LEFT JOIN LATERAL (
               SELECT summary FROM artifact_versions
               WHERE artifact_id = a.id
               ORDER BY version_number DESC LIMIT 1
             ) av ON true
             WHERE pa.project_id = $1`,
            [workflow.project_id]
          )
          if (pinnedArtifacts.rows.length > 0) {
            let contextBlock = '\nPinned project files:\n'
            for (const art of pinnedArtifacts.rows) {
              const summary = (art.summary || art.file_path || '').substring(0, 2000)
              contextBlock += `[filename: ${art.name}]: ${summary}\n`
            }
            goalStr = `${goalStr}\n\n${contextBlock}`
          }
        } catch (projErr: any) {
          console.warn('[Engine] Failed to load project artifacts context:', projErr.message)
        }
      }

      const swarmApproval = await executiveSwarmService.coordinateExecutiveSwarm(goalStr, tenantId)
      
      const structuredGoal = await outcomeEngineService.decomposeGoal(goalStr, tenantId)
      const goalId = await outcomeEngineService.createGoalInDb(structuredGoal, tenantId)
      
      logger.info(`[Engine] Goal ${goalId} and milestones established for outcome execution.`)
      await new Promise(r => setTimeout(r, 800)) // Short delay for planning trace

      // Hydrate previousOutputs from task_checkpoints if resuming a run
      if (resumeRunId) {
        try {
          const { rows: checkpoints } = await db.query(
            "SELECT step_index, step_name, step_output FROM task_checkpoints WHERE run_id = $1 AND status = 'completed' ORDER BY step_index ASC",
            [runId]
          )
          for (const cp of checkpoints) {
            const stepOut = cp.step_output as AgentOutput
            const stepNum = cp.step_index
            const stepName = cp.step_name
            const ag = agents.find(a => a.name === stepName || a.position === stepNum)
            const role = ag ? ag.role.toLowerCase() : ''
            
            previousOutputs[stepName] = stepOut
            previousOutputs[`agent_${stepNum}`] = stepOut
            if (role) {
              previousOutputs[role] = stepOut
            }
          }
          logger.info(`[Engine] Hydrated ${checkpoints.length} checkpoints for resumed run ${runId}`)
        } catch (cpErr: any) {
          console.warn(`[Engine] Failed to hydrate checkpoints: ${cpErr.message}`)
        }
      }

      // 2. Transition to EXECUTING stage
      await transitionWorkflowRun(runId, 'EXECUTING', { workflowId })

      // Topologically group agents to execute independent steps in parallel
      const batches = groupAgentsTopologically(agents as WorkflowAgent[])
      logger.info(`[Engine] Divided workflow into ${batches.length} parallel batches.`)

      for (const batch of batches) {
        // Run all agent steps in the current batch in parallel
        const results = await Promise.all(
          batch.map(agent =>
            executeSingleStep(
              agent,
              runId,
              workflowId,
              tenantId,
              tenant,
              finalInputs,
              previousOutputs,
              agents.length
            )
          )
        )

        // Check if any step in the batch halted (waiting for approval or cancelled)
        const haltedStep = results.find(r => r.halted)
        if (haltedStep) {
          logger.info(`[Engine] Execution halted in current batch. Awaiting action.`)
          return // Exit execution thread (will be resumed on approval)
        }

        // Check if any step in the batch failed
        const failedStep = results.find(r => !r.success)
        if (failedStep) {
          throw new Error(failedStep.output.error || 'Agent failed to complete successfully.')
        }

        // Store outputs of all successful steps in the batch
        for (let j = 0; j < batch.length; j++) {
          const agent = batch[j]
          const res = results[j]
          previousOutputs[agent.name] = res.output
          previousOutputs[`agent_${agent.position}`] = res.output
          previousOutputs[agent.role] = res.output
          totalCredits += 1
        }
      }

      // 3. Transition to VALIDATING stage
      await transitionWorkflowRun(runId, 'VALIDATING', { workflowId })
      await new Promise(r => setTimeout(r, 600)) // Small delay for validation trace

      const finalOutcomeScore = await outcomeEngineService.scoreOutcome(runId, goalId)
      
      try {
        for (const ag of agents) {
          await optimizationEngineService.triggerSelfImprovementTuning(ag.id, runId)
        }
      } catch (err: any) {
        console.warn('[Engine] Optimization tuning failed:', err.message)
      }

      try {
        const { skillsHarvestingService } = await import('./skills-harvesting.service')
        await skillsHarvestingService.harvestSkill(runId, tenantId)
      } catch (harvestErr: any) {
        console.warn('[Engine] Skills harvesting failed:', harvestErr.message)
      }

      let taskReceipt = ''
      try {
        const { generateTaskReceipt } = await import('./execution-router.service')
        const runData = await db.query(
          `SELECT w.original_prompt, w.name, wr.started_at 
           FROM workflow_runs wr 
           JOIN workflows w ON wr.workflow_id = w.id 
           WHERE wr.id = $1`, 
          [runId]
        )
        const promptText = runData.rows[0]?.original_prompt || ''
        const nameText = runData.rows[0]?.name || ''
        const startedAt = runData.rows[0]?.started_at ? new Date(runData.rows[0].started_at).getTime() : Date.now()
        const duration = Date.now() - startedAt

        taskReceipt = await generateTaskReceipt(promptText, nameText, agents.length, duration)
      } catch (receiptErr: any) {
        console.warn('[Engine] Failed to generate task receipt:', receiptErr.message)
      }

      // 4. Final transition: COMPLETED
      await transitionWorkflowRun(runId, 'COMPLETED', {
        workflowId,
        outputData: {
          ...previousOutputs,
          outcome_score: finalOutcomeScore
        },
        creditsUsed: totalCredits,
        taskReceipt
      })

      await db.query(
        `UPDATE workflows 
         SET last_run_at = NOW(), run_count = run_count + 1
         WHERE id = $1`,
         [workflowId]
      )

      // Episodic memory auto-tagging & template candidate checking are handled centrally in transitionWorkflowRun inside workflow-state.ts.

    } catch (err: any) {
      console.error('[Engine] Workflow failed:', err.stack || err.message)

      const checkRunFinal = await db.query('SELECT status FROM workflow_runs WHERE id = $1', [runId])
      const finalStatus = checkRunFinal.rows[0]?.status || 'running'
      
      if (finalStatus !== 'cancelled') {
        await transitionWorkflowRun(runId, 'FAILED', {
          workflowId,
          errorMessage: err.message,
          creditsUsed: totalCredits,
        })
      }
    }
  })

  return { run_id: runId }
}

export async function resumeStep(runId: string, actionId: string, status: string): Promise<boolean> {
  logger.info(`[Engine] resumeStep called for run ${runId}, action ${actionId}, status ${status}`)
  const run = await queryOne<{ workflow_id: string; tenant_id: string }>(
    'SELECT workflow_id, tenant_id FROM workflow_runs WHERE id = $1',
    [runId]
  )
  if (!run) {
    logger.error(`[Engine] Cannot resume run ${runId}: Run not found`)
    return false
  }

  const step = await queryOne<{ id: string; agent_id: string }>(
    'SELECT id, agent_id FROM workflow_steps WHERE run_id = $1 AND (id = $2 OR agent_id = $2) ORDER BY step_number DESC LIMIT 1',
    [runId, actionId]
  )
  if (!step) {
    logger.error(`[Engine] Cannot resume run ${runId}: Step ${actionId} not found`)
    return false
  }

  if (status === 'approved') {
    await query(
      `INSERT INTO workflow_events (run_id, event_type, payload) VALUES ($1, $2, $3)`,
      [
        runId,
        'STEP_APPROVED',
        JSON.stringify({
          agent_id: step.agent_id,
          approved_at: new Date().toISOString(),
          approved_by: run.tenant_id
        })
      ]
    )

    const { transitionWorkflowRun } = await import('./workflow-state')
    await transitionWorkflowRun(runId, 'EXECUTING', { workflowId: run.workflow_id })

    await query("UPDATE workflow_steps SET status = 'running' WHERE id = $1", [step.id])

    executeWorkflow(run.workflow_id, run.tenant_id, {}, runId).catch(err => {
      console.error('[Engine] Background resume failed:', err)
    })
    
    return true
  }
  
  return false
}
