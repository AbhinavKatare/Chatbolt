import { AgentOutput, WorkflowAgent } from '../types'
import { agentBrainClient, BrainToolDefinition } from '../services/agent-brain-client.service'
import { agentRuntimeClient } from '../services/agent-runtime-client.service'
import { saveTeamMemory, searchTeamMemory } from '../services/memory.service'
import { logger } from '../services/logger.service'

export interface TeamLeadGoalInput {
  teamId: string
  tenantId?: string
  teamName?: string
  teamCategory?: string
  mission: string
  task?: string
  availableRoles: string[]
  maxIterations?: number
  context?: Record<string, any>
  llm_config?: Record<string, any>
}

export interface AgentTool {
  name: string
  description: string
  parameters?: Record<string, any>
  execute: (args: any, context?: any) => Promise<any>
}

export class TeamLeadAgent {
  public role = 'team_lead'
  public name = 'TeamLeadAgent'
  public description = 'Strategic orchestrator that decomposes high-level missions, delegates to specialized agents via AgentBus, monitors team memory, and synthesizes final deliverables.'

  private tools: AgentTool[] = [
    {
      name: 'delegate_task',
      description: 'Delegate a concrete subtask to a team member (e.g. researcher, writer, code, analyst)',
      parameters: {
        target_role: 'string (e.g. researcher, writer, code, analyst, qa, ops)',
        task_description: 'string detailing exact task and expected output',
        priority: 'high | medium | low'
      },
      execute: async (args: any, context?: any) => {
        const { target_role, task_description, priority = 'high' } = args
        const teamId = context?.teamId || 'default-team'
        const runId = context?.runId || `team-run-${Date.now()}`
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

        logger.info(`[TeamLead] Delegating task '${taskId}' to role '${target_role}' for team '${teamId}'`)

        // Broadcast task assignment to Go AgentBus
        try {
          await agentRuntimeClient.publishToAgentBus({
            run_id: runId,
            sender_agent_id: context?.agentId || 'team-lead',
            sender_role: 'team_lead',
            target_topic: `team.${teamId}.${target_role}`,
            event_type: 'task_assigned',
            payload_json: JSON.stringify({
              taskId,
              teamId,
              targetRole: target_role,
              taskDescription: task_description,
              priority,
              assignedAt: new Date().toISOString()
            })
          })
        } catch (busErr: any) {
          logger.warn(`[TeamLead] AgentBus notification note: ${busErr.message}`)
        }

        // Save delegated task record to shared team memory
        await saveTeamMemory(
          teamId,
          context?.tenantId || '00000000-0000-0000-0000-000000000000',
          `task:${taskId}`,
          JSON.stringify({
            taskId,
            targetRole: target_role,
            taskDescription: task_description,
            status: 'assigned',
            assignedAt: new Date().toISOString()
          }),
          'team_task',
          6
        )

        return {
          delegated: true,
          taskId,
          targetRole: target_role,
          taskDescription: task_description,
          message: `Task successfully assigned to ${target_role} and broadcast to AgentBus topic 'team.${teamId}.${target_role}'.`
        }
      }
    },
    {
      name: 'query_team_memory',
      description: 'Retrieve verified team facts, findings, and completed task outputs from shared team memory',
      parameters: {
        query: 'search keyword or phrase',
        limit: 'optional number of results'
      },
      execute: async (args: any, context?: any) => {
        const teamId = context?.teamId || 'default-team'
        const results = await searchTeamMemory(teamId, args.query || '', args.limit || 10)
        return {
          count: results.length,
          memories: results
        }
      }
    },
    {
      name: 'save_team_memory',
      description: 'Record an important decision, verified finding, or synthesis note into shared team memory',
      parameters: {
        key: 'unique memory identifier key',
        value: 'content or JSON data to store',
        category: 'optional category (e.g. market_insight, brand_voice, code_architecture, campaign_strategy)'
      },
      execute: async (args: any, context?: any) => {
        const teamId = context?.teamId || 'default-team'
        const tenantId = context?.tenantId || '00000000-0000-0000-0000-000000000000'
        await saveTeamMemory(
          teamId,
          tenantId,
          args.key,
          typeof args.value === 'string' ? args.value : JSON.stringify(args.value),
          args.category || 'team_fact',
          args.importance || 5
        )
        return { success: true, key: args.key, message: 'Saved to team memory' }
      }
    },
    {
      name: 'request_human_guidance',
      description: 'Request guidance, clarification, or human approval for a high-impact action',
      parameters: {
        question: 'question or proposal for human user',
        reason: 'why human intervention is required'
      },
      execute: async (args: any, context?: any) => {
        const teamId = context?.teamId || 'default-team'
        logger.info(`[TeamLead] Human intervention requested for team '${teamId}': ${args.question}`)
        return {
          status: 'awaiting_human_feedback',
          question: args.question,
          reason: args.reason
        }
      }
    },
    {
      name: 'reassign_failed_subtask',
      description: 'Handle a failed role subtask by reassigning to an alternative role or requesting human intervention',
      parameters: {
        failed_role: 'string',
        failed_task_id: 'string',
        error_message: 'string',
        alternative_role: 'string (or none if escalating)',
        action: 'reassign | escalate_to_human'
      },
      execute: async (args: any, context?: any) => {
        const { failed_role, failed_task_id, error_message, alternative_role, action = 'reassign' } = args
        const teamId = context?.teamId || 'default-team'
        const tenantId = context?.tenantId || '00000000-0000-0000-0000-000000000000'
        const runId = context?.runId || `team-run-${Date.now()}`

        logger.warn(`[TeamLead] Handling failed subtask '${failed_task_id}' for role '${failed_role}': ${error_message}`)

        if (action === 'reassign' && alternative_role && alternative_role !== 'none') {
          const newTaskId = `task_reassigned_${Date.now()}`
          await saveTeamMemory(
            teamId,
            tenantId,
            `task:${newTaskId}`,
            JSON.stringify({
              taskId: newTaskId,
              reassignedFrom: failed_role,
              targetRole: alternative_role,
              reason: error_message,
              status: 'reassigned',
              at: new Date().toISOString()
            }),
            'team_task',
            7
          )

          try {
            await agentRuntimeClient.publishToAgentBus({
              run_id: runId,
              sender_agent_id: 'team-lead',
              sender_role: 'team_lead',
              target_topic: `team.${teamId}.${alternative_role}`,
              event_type: 'task_reassigned',
              payload_json: JSON.stringify({
                taskId: newTaskId,
                teamId,
                failedRole: failed_role,
                targetRole: alternative_role,
                errorMessage: error_message,
              })
            })
          } catch {}

          return {
            status: 'reassigned',
            reassignedTo: alternative_role,
            newTaskId,
            message: `Subtask ${failed_task_id} reassigned from ${failed_role} to ${alternative_role}.`
          }
        }

        // Otherwise, escalate to human
        await saveTeamMemory(
          teamId,
          tenantId,
          'intervention:state',
          'paused_escalated',
          'escalation',
          10
        )
        return {
          status: 'escalated_to_human',
          failedRole: failed_role,
          errorMessage: error_message,
          message: `Subtask ${failed_task_id} escalated to dashboard for human guidance.`
        }
      }
    },
    {
      name: 'synthesize_final_report',
      description: 'Aggregate and synthesize all team member outputs and shared memory into a finalized deliverable',
      parameters: {
        executive_summary: 'high level overview',
        key_deliverables: 'array or markdown of deliverables',
        next_steps: 'recommended follow-up actions'
      },
      execute: async (args: any, context?: any) => {
        return {
          status: 'ready_for_review',
          summary: args.executive_summary,
          deliverables: args.key_deliverables,
          nextSteps: args.next_steps,
          timestamp: new Date().toISOString()
        }
      }
    }
  ]

  async run(input: TeamLeadGoalInput): Promise<AgentOutput> {
    const startTime = Date.now()
    const teamId = input.teamId || 'default-team'
    const tenantId = input.tenantId || '00000000-0000-0000-0000-000000000000'
    const runId = (input.context as any)?.runId || `team-run-${Date.now()}`
    const mission = input.mission || input.task || 'General Team Objective'

    logger.info(`[TeamLead] Received team mission: "${mission}" (team: ${teamId})`)

    // Save initial mission to team memory
    await saveTeamMemory(
      teamId,
      tenantId,
      'mission:goal',
      mission,
      'mission',
      10
    )

    // Check if Python Agent-Brain is available
    if (agentBrainClient.isRoleMigrated('team_lead') && await agentBrainClient.isAvailable()) {
      const brainTools: BrainToolDefinition[] = this.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))

      // Prepare ReAct execution state
      const history: any[] = []
      let stepNumber = 1
      const maxSteps = input.maxIterations || 6
      const executionLog: any[] = []

      while (stepNumber <= maxSteps) {
        const brainRes = await agentBrainClient.executeStep({
          run_id: runId,
          step_id: `step_${stepNumber}`,
          agent_role: 'team_lead',
          agent_name: this.name,
          system_prompt: `You are the specialized TeamLead agent. Decompose the mission "${mission}" into atomic assignments for roles [${input.availableRoles.join(', ')}]. Use delegate_task, query_team_memory, save_team_memory, and synthesize_final_report.`,
          task: mission,
          context: `Team ID: ${teamId}\nAvailable Roles: ${input.availableRoles.join(', ')}`,
          history,
          available_tools: brainTools,
          provider_config: input.llm_config as any,
          max_steps: maxSteps,
          step_number: stepNumber
        })

        executionLog.push({
          step: stepNumber,
          thought: brainRes.thought,
          status: brainRes.status,
          tool_calls: brainRes.tool_calls
        })

        if (brainRes.status === 'completed' || !brainRes.tool_calls || brainRes.tool_calls.length === 0) {
          // ReAct loop completed
          const finalReport = brainRes.final_output || brainRes.thought || 'TeamLead mission decomposed and coordinated successfully.'
          
          // Store final report in team memory
          await saveTeamMemory(
            teamId,
            tenantId,
            'mission:final_report',
            finalReport,
            'report',
            9
          )

          return {
            success: true,
            data: {
              teamId,
              mission,
              finalReport,
              executionLog,
              stepCount: stepNumber
            },
            summary: finalReport,
            output_type: 'team_plan',
            confidence: 0.95,
            metadata: {
              duration_ms: Date.now() - startTime,
              tokens_used: brainRes.tokens_used || 0,
              tools_used: this.tools.map(t => t.name),
              retries: 0
            }
          }
        }

        // Execute tool calls emitted by the brain
        for (const tc of brainRes.tool_calls) {
          const tool = this.tools.find(t => t.name === tc.tool_name)
          let toolResult: any = null

          if (tool) {
            try {
              toolResult = await tool.execute(tc.arguments, { teamId, tenantId, runId, agentId: 'team-lead' })
            } catch (err: any) {
              toolResult = { error: err.message }
            }
          } else {
            toolResult = { error: `Tool ${tc.tool_name} not recognized by TeamLead` }
          }

          history.push({
            role: 'assistant',
            content: brainRes.thought || `Calling tool ${tc.tool_name}`,
            tool_calls: [tc]
          })

          history.push({
            role: 'tool',
            content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
            tool_call_id: tc.call_id
          })
        }

        stepNumber++
      }

      // Max steps reached
      const finalReport = `TeamLead completed ReAct decomposition across ${stepNumber - 1} steps.`
      await saveTeamMemory(teamId, tenantId, 'mission:final_report', finalReport, 'report', 9)

      return {
        success: true,
        data: {
          teamId,
          mission,
          finalReport,
          status: 'max_steps_reached',
          executionLog,
          stepCount: stepNumber - 1
        },
        summary: 'TeamLead reached max steps',
        output_type: 'team_plan',
        confidence: 0.8,
        metadata: {
          duration_ms: Date.now() - startTime,
          tokens_used: 0,
          tools_used: this.tools.map(t => t.name),
          retries: 0
        }
      }
    }

    // Fallback: Local deterministic decomposition
    logger.info(`[TeamLead] Using local fallback coordination for mission: "${mission}"`)
    const delegatedTasks: any[] = []

    for (const role of input.availableRoles) {
      if (role === 'team_lead') continue
      const taskDesc = `Execute phase for ${role} on mission: ${mission}`
      const delegateTool = this.tools.find(t => t.name === 'delegate_task')
      if (delegateTool) {
        const res = await delegateTool.execute({
          target_role: role,
          task_description: taskDesc,
          priority: 'high'
        }, { teamId, tenantId, runId })
        delegatedTasks.push(res)
      }
    }

    const finalReport = `TeamLead successfully decomposed mission into ${delegatedTasks.length} role assignments.`
    await saveTeamMemory(teamId, tenantId, 'mission:final_report', finalReport, 'report', 8)

    return {
      success: true,
      data: {
        teamId,
        mission,
        delegatedTasks,
        finalReport
      },
      summary: finalReport,
      output_type: 'team_plan',
      confidence: 0.9,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: ['delegate_task'],
        retries: 0
      }
    }
  }
}

export const teamLeadAgent = new TeamLeadAgent()

export async function runTeamLead(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  return teamLeadAgent.run({
    teamId: agent.workflow_id,
    tenantId: agent.tenant_id,
    mission: agent.description || input.mission || input.task,
    availableRoles: ['team_lead', 'researcher', 'writer', 'code', 'analyst'],
    context: { runId, ...input }
  })
}
