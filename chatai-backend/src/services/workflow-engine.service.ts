import { db } from '../db'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from './sse.service'
import { runResearcher } from '../agents/researcher.agent'
import { runWriter } from '../agents/writer.agent'
import { runScraper } from '../agents/scraper.agent'
import { runReporter } from '../agents/reporter.agent'
import { runCodeAgent } from '../agents/code.agent'
import { runAPIAgent } from '../agents/api-caller.agent'
import { runDataProcessor } from '../agents/data-processor.agent'
import { runEmailSender } from '../agents/email-sender.agent'
import { runSpreadsheetAgent } from '../agents/spreadsheet.agent'

export const AGENT_EXECUTORS: Record<string, any> = {
  researcher: runResearcher,
  writer: runWriter,
  scraper: runScraper,
  reporter: runReporter,
  code: runCodeAgent,
  'api-caller': runAPIAgent,
  'data-processor': runDataProcessor,
  'email-sender': runEmailSender,
  spreadsheet: runSpreadsheetAgent
}

export async function executeWorkflow(
  workflowId: string,
  tenantId: string,
  userInputs: any
): Promise<{ run_id: string }> {
  
  console.log(`🚀 Starting workflow ${workflowId} for tenant ${tenantId}`)

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

  // 2. Create workflow run BEFORE background task
  const { rows: runs } = await db.query(
    `INSERT INTO workflow_runs 
     (workflow_id, tenant_id, input_data, status, started_at) 
     VALUES ($1, $2, $3, 'running', NOW()) 
     RETURNING id`,
    [workflowId, tenantId, JSON.stringify(userInputs)]
  )
  const runId = runs[0].id

  // 3. Run execution in background (fire and forget)
  setImmediate(async () => {
    runEmitter.emitEvent(runId, 'workflow_start', {
      workflowId,
      name: workflow.name,
      total_agents: agents.length,
    })

    const previousOutputs: Record<string, AgentOutput> = {}
    const startTime = Date.now()
    let totalCredits = 0

    try {
      for (const agent of agents as WorkflowAgent[]) {
        const stepStartTime = Date.now()

        runEmitter.emitEvent(runId, 'agent_start', {
          agentId: agent.id,
          agent_name: agent.name,
          agent_role: agent.role,
          step: agent.position,
          total: agents.length,
          message: `${agent.name} is starting...`,
        })

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
        const stepId = steps[0].id

        // Get executor
        const role = agent.role.toLowerCase()
        const executor = AGENT_EXECUTORS[role]
        if (!executor) {
          throw new Error(
            `No executor for role: "${agent.role}". ` +
            `Available: ${Object.keys(AGENT_EXECUTORS).join(', ')}`
          )
        }

        // Execute with retries
        let agentOutput: AgentOutput | null = null
        let lastError = ''
        const maxRetries = 2

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            agentOutput = await executor(
              agent,
              {
                task: agent.description || workflow.original_prompt,
                user_inputs: userInputs,
                previous_outputs: previousOutputs,
                context: { workflow_name: workflow.name, run_id: runId },
              },
              runId
            )

            if (agentOutput && agentOutput.success) break

            lastError = agentOutput?.error || 'Agent returned failure'
            if (attempt < maxRetries) {
              runEmitter.emitEvent(runId, 'agent_retry', {
                agent_name: agent.name,
                attempt: attempt + 1,
                reason: lastError,
              })
              await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
            }

          } catch (execErr: any) {
            lastError = execErr.message
            console.error(
              `[Engine] Agent "${agent.name}" attempt ${attempt + 1} threw:`,
              execErr.stack || execErr.message
            )
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
            }
          }
        }

        if (!agentOutput) {
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

        const duration = Date.now() - stepStartTime

        // Save step result
        await db.query(
          `UPDATE workflow_steps 
           SET status = $1, output_data = $2, 
               duration_ms = $3, completed_at = NOW()
           WHERE id = $4`,
          [
            agentOutput.success ? 'completed' : 'failed',
            JSON.stringify(agentOutput),
            duration,
            stepId,
          ]
        )

        // Update agent last_output
        await db.query(
          `UPDATE workflow_agents 
           SET last_output = $1, status = 'idle'
           WHERE id = $2`,
          [JSON.stringify(agentOutput), agent.id]
        )

        // Emit result
        runEmitter.emitEvent(runId, 'agent_done', {
          agentId: agent.id,
          agent_name: agent.name,
          step: agent.position,
          total: agents.length,
          duration_ms: duration,
          success: agentOutput.success,
          output_summary: agentOutput.summary,
          message: agentOutput.success
            ? `✓ ${agent.name}: ${agentOutput.summary}`
            : `⚠ ${agent.name}: ${agentOutput.error}`,
        })

        previousOutputs[agent.name] = agentOutput
        previousOutputs[`agent_${agent.position}`] = agentOutput
        previousOutputs[agent.role] = agentOutput
        totalCredits += 1
      }

      const totalDuration = Date.now() - startTime

      await db.query(
        `UPDATE workflow_runs 
         SET status = 'completed', output_data = $1,
             duration_ms = $2, credits_used = $3,
             completed_at = NOW()
         WHERE id = $4`,
        [JSON.stringify(previousOutputs), totalDuration, totalCredits, runId]
      )

      await db.query(
        `UPDATE workflows 
         SET last_run_at = NOW(), run_count = run_count + 1
         WHERE id = $1`,
        [workflowId]
      )

      await db.query(
        `UPDATE tenants 
         SET credits_remaining = GREATEST(credits_remaining - $1, 0)
         WHERE id = $2`,
        [totalCredits, tenantId]
      )

      runEmitter.emitEvent(runId, 'workflow_done', {
        runId,
        outputs: previousOutputs,
        duration_ms: totalDuration,
        credits_used: totalCredits,
        agents_run: agents.length,
        message: `✅ Workflow complete in ${(totalDuration / 1000).toFixed(1)}s`,
      })

    } catch (err: any) {
      console.error('[Engine] Workflow failed:', err.stack || err.message)

      await db.query(
        `UPDATE workflow_runs 
         SET status = 'failed', error_message = $1,
             duration_ms = $2, completed_at = NOW()
         WHERE id = $3`,
        [err.message, Date.now() - startTime, runId]
      )

      runEmitter.emitEvent(runId, 'workflow_error', {
        runId,
        error: err.message,
        message: `✗ Workflow failed: ${err.message}`,
      })
    }
  })

  return { run_id: runId }
}
