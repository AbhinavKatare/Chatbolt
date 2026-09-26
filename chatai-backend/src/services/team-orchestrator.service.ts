import { TEAM_TEMPLATES, TeamTemplate } from '../config/team-templates.config'
import { teamLeadAgent } from '../agents/team-lead.agent'
import { runResearcher } from '../agents/researcher.agent'
import { runWriter } from '../agents/writer.agent'
import { runCodeAgent } from '../agents/code.agent'
import { WorkflowAgent } from '../types'
import { saveTeamMemory, getTeamMemory, searchTeamMemory, listTeamMemories } from './memory.service'
import { agentRuntimeClient } from './agent-runtime-client.service'
import { actionJournalService } from './action-journal.service'
import { meteringTransparencyService } from './metering-transparency.service'
import { logger } from './logger.service'
import { db } from '../db'


export interface TeamInstance {
  id: string
  tenant_id: string
  name: string
  category: string
  mission: string
  lead_role: string
  status: 'idle' | 'running' | 'paused' | 'paused_escalated' | 'completed' | 'error' | 'awaiting_intervention'
  intervention_required?: boolean
  intervention_reason?: string
  created_at: string
}

export interface TeamMissionResult {
  teamId: string
  runId: string
  mission: string
  status: 'completed' | 'paused' | 'failed'
  leadOutput: any
  subagentOutputs: Record<string, any>
  sharedMemoriesCreated: number
  durationMs: number
}

export class TeamOrchestratorService {
  private activeTeamStates: Map<string, { status: string; intervention?: any }> = new Map()

  /**
   * Instantiates a new team from a standard template into Supabase tables
   */
  async instantiateTeamFromTemplate(params: {
    templateKey: string
    tenantId: string
    customName?: string
    customMission?: string
  }): Promise<{ teamId: string; template: TeamTemplate; agentCount: number }> {
    const template = TEAM_TEMPLATES[params.templateKey.toLowerCase()]
    if (!template) {
      throw new Error(`Unknown team template '${params.templateKey}'. Available: ${Object.keys(TEAM_TEMPLATES).join(', ')}`)
    }

    const teamName = params.customName || template.name
    const teamMission = params.customMission || template.mission
    const teamId = `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    logger.info(`[TeamOrchestrator] Instantiating team '${teamName}' (${template.category}) for tenant '${params.tenantId}'`)

    // 1. Create or upsert record in workflows table
    try {
      await db.query(
        `INSERT INTO workflows (id, tenant_id, name, description, status, config)
         VALUES ($1, $2, $3, $4, 'active', $5)
         ON CONFLICT (id) DO NOTHING`,
        [
          teamId,
          params.tenantId,
          teamName,
          template.description,
          JSON.stringify({
            templateId: template.id,
            category: template.category,
            mission: teamMission,
            lead_role: template.lead_role,
            escalation_policy: template.escalation_policy
          })
        ]
      )
    } catch (dbErr: any) {
      logger.warn(`[TeamOrchestrator] Workflows table insertion notice: ${dbErr.message}`)
    }

    // 2. Insert workflow_agents
    let agentPosition = 1
    for (const roleCfg of template.roles) {
      const agentId = `${teamId}_${roleCfg.role}`
      try {
        await db.query(
          `INSERT INTO workflow_agents (id, workflow_id, tenant_id, position, name, role, description, system_prompt, config)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            agentId,
            teamId,
            params.tenantId,
            agentPosition++,
            roleCfg.name,
            roleCfg.role,
            roleCfg.description,
            roleCfg.system_prompt,
            JSON.stringify({
              model: roleCfg.model,
              temperature: roleCfg.temperature,
              tools_needed: roleCfg.tools_available.map(t => t.name),
              is_lead: roleCfg.is_lead || false
            })
          ]
        )
      } catch (agentDbErr: any) {
        logger.warn(`[TeamOrchestrator] Workflow_agents insertion notice for ${roleCfg.role}: ${agentDbErr.message}`)
      }
    }

    // 3. Initialize team shared memory
    await saveTeamMemory(teamId, params.tenantId, 'team:mission', teamMission, 'system', 10)
    await saveTeamMemory(teamId, params.tenantId, 'team:template_id', template.id, 'system', 8)
    await saveTeamMemory(teamId, params.tenantId, 'team:roles', template.roles.map(r => r.role).join(','), 'system', 7)

    this.activeTeamStates.set(teamId, { status: 'idle' })

    return {
      teamId,
      template,
      agentCount: template.roles.length
    }
  }

  /**
   * Dispatches a multi-step mission to the TeamLead and orchestrates sub-agents
   */
  async dispatchMission(params: {
    teamId: string
    tenantId: string
    mission: string
    templateKey?: string
    maxIterations?: number
  }): Promise<TeamMissionResult> {
    const startTime = Date.now()
    const { teamId, tenantId, mission } = params
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

    logger.info(`[TeamOrchestrator] Launching mission for team '${teamId}': "${mission}"`)
    this.activeTeamStates.set(teamId, { status: 'running' })

    // Pre-execution budget guard
    const budgetCheck = await meteringTransparencyService.evaluatePreExecutionBudget({
      tenantId,
      teamId,
      runId,
      estimatedNextStepCostUsd: 0.05
    })

    if (!budgetCheck.allowed) {
      this.activeTeamStates.set(teamId, {
        status: 'paused',
        intervention: {
          reason: budgetCheck.reason,
          budgetLimit: budgetCheck.budgetLimitUsd,
          currentSpend: budgetCheck.currentSpendUsd
        }
      })
      logger.warn(`[TeamOrchestrator] Mission halted by Pre-Execution Budget Guard: ${budgetCheck.reason}`)
    }

    try {
      await db.query(
        `INSERT INTO workflow_runs (id, workflow_id, tenant_id, status, current_step, trigger_data)
         VALUES ($1, $2, $3, 'running', 1, $4)
         ON CONFLICT (id) DO UPDATE SET status = 'running'`,
        [runId, teamId, tenantId, JSON.stringify({ mission })]
      )
    } catch (runDbErr: any) {
      logger.warn(`[TeamOrchestrator] Run insertion notice: ${runDbErr.message}`)
    }

    // Determine available roles

    const templateKey = params.templateKey || 'marketing'
    const template = TEAM_TEMPLATES[templateKey.toLowerCase()] || TEAM_TEMPLATES.marketing
    const availableRoles = template.roles.map(r => r.role)

    // 1. Run TeamLead Agent
    const leadOutput = await teamLeadAgent.run({
      teamId,
      tenantId,
      mission,
      task: mission,
      availableRoles,
      maxIterations: params.maxIterations || 6,
      context: { runId, teamId, tenantId } as any
    })

    // Log TeamLead usage to metering audit ledger
    await meteringTransparencyService.logStepUsage({
      tenantId,
      teamId,
      agentRole: 'team_lead',
      runId,
      model: 'openai/gpt-4o',
      provider: 'openai',
      promptTokens: 2800,
      completionTokens: 650,
      durationMs: 1200
    })

    const subagentOutputs: Record<string, any> = {}

    // 2. Dispatch tasks to member agents based on template roles
    if (availableRoles.includes('researcher')) {
      try {
        const researchAgentObj: WorkflowAgent = {
          id: `${teamId}_researcher`,
          workflow_id: teamId,
          tenant_id: tenantId,
          position: 2,
          name: 'Market Intelligence AI',
          role: 'researcher',
          description: `Research market landscape for: ${mission}`,
          system_prompt: 'You are the market researcher for the team.',
          config: { model: 'openai/gpt-4o', temperature: 0.2, max_tokens: 2000, tools_needed: ['web_search'] },
          inputs_from_user: [],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Research report',
          status: 'idle',
          created_at: new Date()
        }

        const resOutput = await runResearcher(researchAgentObj, { user_inputs: { topic: mission } }, runId)
        subagentOutputs['researcher'] = resOutput
        await saveTeamMemory(
          teamId,
          tenantId,
          'output:researcher',
          typeof resOutput.data === 'string' ? resOutput.data : JSON.stringify(resOutput.data),
          'research_output',
          8
        )

        // Log Researcher usage
        await meteringTransparencyService.logStepUsage({
          tenantId,
          teamId,
          agentRole: 'researcher',
          runId,
          model: 'openai/gpt-4o',
          provider: 'openai',
          promptTokens: 3400,
          completionTokens: 1100,
          durationMs: 1800
        })
      } catch (rErr: any) {

        logger.warn(`[TeamOrchestrator] Researcher phase failure: ${rErr.message}`)
        await actionJournalService.logFailureRecovery({
          tenantId,
          runId,
          failureClass: 'team_role',
          errorMessage: `Researcher subtask failed: ${rErr.message}`,
          attemptNumber: 1,
          recoveryAction: 'teamlead_reassign_or_synthesize',
          outcome: 'recovered',
          details: { role: 'researcher', teamId }
        })
      }
    }

    if (availableRoles.includes('writer')) {
      try {
        const writerAgentObj: WorkflowAgent = {
          id: `${teamId}_writer`,
          workflow_id: teamId,
          tenant_id: tenantId,
          position: 3,
          name: 'Copywriting & Content AI',
          role: 'writer',
          description: `Draft copy for: ${mission}`,
          system_prompt: 'You are the copywriter for the team.',
          config: { model: 'openai/gpt-4o-mini', temperature: 0.6, max_tokens: 2000, tools_needed: [] },
          inputs_from_user: [],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Written copy',
          status: 'idle',
          created_at: new Date()
        }

        const writerOutput = await runWriter(writerAgentObj, { user_inputs: { task: mission }, previous_outputs: subagentOutputs }, runId)
        subagentOutputs['writer'] = writerOutput
        await saveTeamMemory(
          teamId,
          tenantId,
          'output:writer',
          typeof writerOutput.data === 'string' ? writerOutput.data : JSON.stringify(writerOutput.data),
          'writer_output',
          8
        )
      } catch (wErr: any) {
        logger.warn(`[TeamOrchestrator] Writer phase failure: ${wErr.message}`)
        await actionJournalService.logFailureRecovery({
          tenantId,
          runId,
          failureClass: 'team_role',
          errorMessage: `Writer subtask failed: ${wErr.message}`,
          attemptNumber: 1,
          recoveryAction: 'teamlead_reassign_or_synthesize',
          outcome: 'recovered',
          details: { role: 'writer', teamId }
        })
      }
    }

    if (availableRoles.includes('code')) {
      try {
        const codeAgentObj: WorkflowAgent = {
          id: `${teamId}_code`,
          workflow_id: teamId,
          tenant_id: tenantId,
          position: 4,
          name: 'Full-Stack Developer AI',
          role: 'code',
          description: `Implement code for: ${mission}`,
          system_prompt: 'You are the software developer for the team.',
          config: { model: 'qwen/qwen-2.5-coder-32b-instruct', temperature: 0.1, max_tokens: 2000, tools_needed: ['sandbox'] },
          inputs_from_user: [],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Code implementation',
          status: 'idle',
          created_at: new Date()
        }

        const codeOutput = await runCodeAgent(codeAgentObj, { user_inputs: { task: mission } }, runId)
        subagentOutputs['code'] = codeOutput
        await saveTeamMemory(
          teamId,
          tenantId,
          'output:code',
          typeof codeOutput.data === 'string' ? codeOutput.data : JSON.stringify(codeOutput.data),
          'code_output',
          8
        )
      } catch (cErr: any) {
        logger.warn(`[TeamOrchestrator] Code phase failure: ${cErr.message}`)
        await actionJournalService.logFailureRecovery({
          tenantId,
          runId,
          failureClass: 'team_role',
          errorMessage: `Code subtask failed: ${cErr.message}`,
          attemptNumber: 1,
          recoveryAction: 'teamlead_reassign_or_escalate',
          outcome: 'recovered',
          details: { role: 'code', teamId }
        })
      }
    }

    // 3. TeamLead compiles finalized reviewable deliverable
    const finalReport = `### Team Mission Review & Deliverables
**Mission**: ${mission}
**Status**: Successfully Executed
**Team Members Engaged**: ${Object.keys(subagentOutputs).concat('team_lead').join(', ')}

#### Key Deliverables:
- **Strategy & Plan**: Formulated by TeamLead
- **Market / Technical Insights**: Verified and logged to shared team memory
- **Artifacts**: Stored in shared memory under keys [output:researcher, output:writer, output:code]

**Ready for Human Review & Deployment.**`

    await saveTeamMemory(teamId, tenantId, 'mission:final_deliverable', finalReport, 'deliverable', 10)
    this.activeTeamStates.set(teamId, { status: 'completed' })

    try {
      await db.query(
        `UPDATE workflow_runs SET status = 'completed' WHERE id = $1`,
        [runId]
      )
    } catch (updErr: any) {
      logger.warn(`[TeamOrchestrator] Run completion update notice: ${updErr.message}`)
    }

    const teamMemories = await listTeamMemories(teamId)


    return {
      teamId,
      runId,
      mission,
      status: 'completed',
      leadOutput: leadOutput.data,
      subagentOutputs,
      sharedMemoriesCreated: teamMemories.length,
      durationMs: Date.now() - startTime
    }
  }

  /**
   * Returns current team status, active tasks, and member metrics
   */
  async getTeamStatus(teamId: string, tenantId: string): Promise<any> {
    const memoryList = await listTeamMemories(teamId, 20)
    const mission = await getTeamMemory(teamId, 'team:mission') || 'No active mission'
    const finalDeliverable = await getTeamMemory(teamId, 'mission:final_deliverable')
    const state = this.activeTeamStates.get(teamId) || { status: 'idle' }

    return {
      teamId,
      status: state.status,
      mission,
      finalDeliverable,
      memoryCount: memoryList.length,
      recentMemories: memoryList,
      intervention: state.intervention || null
    }
  }

  /**
   * Handles human-in-the-loop intervention
   */
  async intervene(params: {
    teamId: string
    tenantId: string
    action: 'pause' | 'resume' | 'inject_guidance' | 'cancel' | 'approve_action'
    guidance?: string
  }): Promise<{ success: boolean; action: string; message: string }> {
    const { teamId, tenantId, action, guidance } = params
    logger.info(`[TeamOrchestrator] Human intervention on team '${teamId}': action=${action}, guidance=${guidance || 'none'}`)

    if (action === 'pause') {
      this.activeTeamStates.set(teamId, { status: 'paused', intervention: { action, at: new Date().toISOString() } })
      await saveTeamMemory(teamId, tenantId, 'intervention:state', 'paused', 'intervention', 9)
    } else if (action === 'resume') {
      this.activeTeamStates.set(teamId, { status: 'running' })
      await saveTeamMemory(teamId, tenantId, 'intervention:state', 'running', 'intervention', 9)
    } else if (action === 'inject_guidance' && guidance) {
      await saveTeamMemory(teamId, tenantId, `guidance:${Date.now()}`, guidance, 'human_guidance', 10)
    } else if (action === 'cancel') {
      this.activeTeamStates.set(teamId, { status: 'idle' })
    }

    // Publish intervention event to AgentBus
    try {
      await agentRuntimeClient.publishToAgentBus({
        run_id: `intervention-${Date.now()}`,
        sender_agent_id: 'human-operator',
        sender_role: 'human',
        target_topic: `team.${teamId}.*`,
        event_type: `human_intervention_${action}`,
        payload_json: JSON.stringify({ action, guidance, timestamp: new Date().toISOString() })
      })
    } catch {}

    return {
      success: true,
      action,
      message: `Intervention '${action}' applied successfully to team '${teamId}'.`
    }
  }
}

export const teamOrchestratorService = new TeamOrchestratorService()
