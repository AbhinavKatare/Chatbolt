import { db } from '../db'
import { runEmitter, SSEEvent } from './sse.service'
import { logger } from './logger.service'

export type WorkflowState =
  | 'PENDING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'TOOL_RUNNING'
  | 'WAITING'
  | 'VALIDATING'
  | 'RETRYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export const VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  PENDING: ['PLANNING', 'CANCELLED', 'FAILED', 'RETRYING'],
  PLANNING: ['EXECUTING', 'CANCELLED', 'FAILED', 'RETRYING'],
  EXECUTING: ['TOOL_RUNNING', 'VALIDATING', 'RETRYING', 'COMPLETED', 'FAILED', 'CANCELLED', 'WAITING'],
  TOOL_RUNNING: ['EXECUTING', 'RETRYING', 'FAILED', 'CANCELLED'],
  VALIDATING: ['COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING'],
  WAITING: ['EXECUTING', 'CANCELLED', 'FAILED'],
  RETRYING: ['EXECUTING', 'FAILED', 'CANCELLED'],
  COMPLETED: [], // Terminal
  FAILED: [],    // Terminal
  CANCELLED: [], // Terminal
}

/**
 * Validates whether a state transition is permitted.
 */
export function isValidTransition(from: WorkflowState, to: WorkflowState): boolean {
  // If the target state is the same as the current, it is idempotent and allowed
  if (from === to) return true
  const allowed = VALID_TRANSITIONS[from]
  return allowed ? allowed.includes(to) : false
}

/**
 * Atomic state transition with Event Sourcing & Real-time Broadcasting
 */
export async function transitionWorkflowRun(
  runId: string,
  toState: WorkflowState,
  metadata: {
    workflowId?: string
    errorMessage?: string
    outputData?: any
    apiCallIncrement?: number
    creditsUsed?: number
    payload?: any
    taskReceipt?: string
  } = {}
): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // 1. Lock and retrieve current run state
    const runRes = await client.query(
      'SELECT status, tenant_id FROM workflow_runs WHERE id = $1 FOR UPDATE',
      [runId]
    )

    if (runRes.rows.length === 0) {
      throw new Error(`Workflow run ${runId} not found`)
    }

    const currentStatus = (runRes.rows[0].status || 'PENDING').toUpperCase() as WorkflowState
    const tenantId = runRes.rows[0].tenant_id

    // 2. Enforce transition guard
    if (!isValidTransition(currentStatus, toState)) {
      throw new Error(`Illegal state transition from ${currentStatus} to ${toState} for run ${runId}`)
    }

    logger.info(`[State Machine] Run ${runId}: Transitioning ${currentStatus} ──> ${toState}`)

    // 3. Build dynamic database updates
    const updates: string[] = []
    const params: any[] = []
    let index = 1

    updates.push(`status = $${index++}`)
    params.push(toState.toLowerCase()) // Keep lowercase in DB to match original schema patterns

    if (toState === 'COMPLETED' || toState === 'FAILED' || toState === 'CANCELLED') {
      updates.push(`completed_at = NOW()`)
      updates.push(`duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000`)

      // Log execution metrics (Post-Ship Monitoring Hook #1)
      try {
        const { logger } = await import('./logger.service')
        const stepsRes = await client.query(
          `SELECT COUNT(*)::integer as total,
                  COUNT(CASE WHEN status = 'completed' THEN 1 END)::integer as completed
           FROM workflow_steps WHERE run_id = $1`,
          [runId]
        )
        const stepsTotal = stepsRes.rows[0]?.total || 0
        const stepsCompleted = stepsRes.rows[0]?.completed || 0

        const retryRes = await client.query(
          `SELECT COUNT(*)::integer as count FROM workflow_events
           WHERE run_id = $1 AND event_type = 'RUN_RETRYING'`,
          [runId]
        )
        const retryCount = retryRes.rows[0]?.count || 0

        const durRes = await client.query(
          `SELECT EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 as duration FROM workflow_runs WHERE id = $1`,
          [runId]
        )
        const durationMs = Math.round(durRes.rows[0]?.duration || 0)

        const outcome = toState === 'COMPLETED' ? 'success' : (toState === 'CANCELLED' ? 'partial' : 'failed')

        await client.query(
          `INSERT INTO execution_metrics (user_id, task_type, steps_total, steps_completed, retry_count, outcome, duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tenantId, 'sequential', stepsTotal, stepsCompleted, retryCount, outcome, durationMs]
        )

        // Check success rate threshold (under 85% in last 1 hour)
        const rateRes = await client.query(
          `SELECT outcome FROM execution_metrics
           WHERE timestamp > NOW() - INTERVAL '1 hour'`
        )
        const recentRuns = rateRes.rows
        if (recentRuns.length >= 5) {
          const successCount = recentRuns.filter((r: any) => r.outcome === 'success').length
          const successRate = successCount / recentRuns.length
          if (successRate < 0.85) {
            logger.warn(`[METRICS ALERT] Success rate in the last 1 hour is ${(successRate * 100).toFixed(1)}% (under 85% threshold!)`)
          }
        }
      } catch (metricErr: any) {
        console.warn('[Metrics] Failed to record execution metric:', metricErr.message)
      }
    }

    if (metadata.errorMessage) {
      updates.push(`error_message = $${index++}`)
      params.push(metadata.errorMessage)
    }

    if (metadata.outputData) {
      updates.push(`output_data = $${index++}`)
      params.push(JSON.stringify(metadata.outputData))
    }

    if (metadata.apiCallIncrement) {
      updates.push(`api_calls_used = api_calls_used + $${index++}`)
      params.push(metadata.apiCallIncrement)
    }

    if (metadata.creditsUsed) {
      updates.push(`credits_used = credits_used + $${index++}`)
      params.push(metadata.creditsUsed)
    }

    if (metadata.taskReceipt) {
      updates.push(`task_receipt = $${index++}`)
      params.push(JSON.stringify({ text: metadata.taskReceipt }))
    }


    params.push(runId)
    const runIdIndex = index

    await client.query(
      `UPDATE workflow_runs SET ${updates.join(', ')} WHERE id = $${runIdIndex}`,
      params
    )

    // 4. Record event store history (Event Sourcing - Phase 4)
    await client.query(
      `INSERT INTO workflow_events (run_id, event_type, payload) VALUES ($1, $2, $3)`,
      [
        runId,
        `RUN_${toState}`,
        JSON.stringify({
          previous_state: currentStatus,
          new_state: toState,
          timestamp: new Date().toISOString(),
          ...metadata,
        }),
      ]
    )

    // Also record cryptographically chained SOC2 ledger event (Phase 2.2)
    try {
      const { agentGovernanceService } = await import('./agent-governance.service')
      await agentGovernanceService.logCryptographicEvent(
        tenantId,
        runId,
        `RUN_${toState}`,
        {
          previous_state: currentStatus,
          new_state: toState,
          timestamp: new Date().toISOString(),
          metadata
        },
        client
      )
    } catch (cryptoErr: any) {
      console.error('[State Machine] Failed to log cryptographic audit event:', cryptoErr.message)
    }

    // 5. Update tenant credit consumption if completed
    if (metadata.creditsUsed && metadata.creditsUsed > 0) {
      await client.query(
        `UPDATE tenants SET credits_remaining = GREATEST(credits_remaining - $1, 0) WHERE id = $2`,
        [metadata.creditsUsed, tenantId]
      )
    }

    await client.query('COMMIT')

    let isTemplateCandidate = false
    if (toState === 'COMPLETED') {
      try {
        const { billingService } = await import('./billing.service')
        await billingService.incrementUsage(tenantId, 'tasks')
      } catch (billErr: any) {
        logger.warn('[State Machine] Failed to increment usage on completion: ' + billErr.message)
      }

      try {
        const { extractAndStoreSessionFacts } = await import('./memory.service')
        
        const runQuery = await client.query(
          `SELECT r.task_type, w.original_prompt, w.name FROM workflow_runs r
           JOIN workflows w ON r.workflow_id = w.id
           WHERE r.id = $1`,
          [runId]
        )
        const promptText = runQuery.rows[0]?.original_prompt || ''
        const nameText = runQuery.rows[0]?.name || ''
        const taskType = runQuery.rows[0]?.task_type || 'other'

        // Extract facts
        await extractAndStoreSessionFacts(runId, tenantId, {
          prompt: promptText,
          workflow_name: nameText,
          output: JSON.stringify(metadata.outputData || {})
        })

        // Update streak (fire-and-forget)
        try {
          const { streakService } = await import('./streak.service')
          await streakService.updateStreak(tenantId, runId)
        } catch (e: any) {
          logger.warn(`[State Machine] Failed to update streak: ${e.message}`)
        }

        // Check if template candidate
        const { skillsHarvestingService } = await import('./skills-harvesting.service')
        await skillsHarvestingService.checkTemplateCandidate(tenantId, promptText, taskType, runId)

        // Query the run again to see if it is a template candidate
        const checkCandidate = await client.query(
          `SELECT template_candidate FROM workflow_runs WHERE id = $1`,
          [runId]
        )
        isTemplateCandidate = checkCandidate.rows[0]?.template_candidate || false

        // Notify user about task completion
        const { notificationService } = await import('./notification.service')
        let receiptText = ''
        if (metadata.taskReceipt) {
          receiptText = metadata.taskReceipt
        } else if (metadata.outputData) {
          receiptText = typeof metadata.outputData === 'string'
            ? metadata.outputData
            : (metadata.outputData.summary || metadata.outputData.text || '')
        }
        await notificationService.notifyTaskComplete(tenantId, runId, receiptText)
      } catch (err: any) {
        logger.error(`[State Machine] Post-completion hooks failed: ${err.message}`)
      }
    }

    // 6. Broadcast through SSE for frontend dashboard rendering
    const sseType: SSEEvent = toState === 'COMPLETED'
      ? 'workflow_done'
      : toState === 'FAILED'
      ? 'workflow_error'
      : 'agent_progress'

    runEmitter.emitEvent(runId, sseType, {
      status: toState,
      message: `Workflow state updated to ${toState}`,
      error: metadata.errorMessage,
      output: metadata.outputData,
      task_receipt: metadata.taskReceipt,
      template_candidate: isTemplateCandidate,
      timestamp: new Date().toISOString()
    }, metadata.workflowId)

    // Emit workflow_progress percentages on key state updates
    if (toState === 'PLANNING') {
      runEmitter.emitEvent(runId, 'workflow_progress', { progress: 5 }, metadata.workflowId)
    } else if (toState === 'VALIDATING') {
      runEmitter.emitEvent(runId, 'workflow_progress', { progress: 95 }, metadata.workflowId)
    } else if (toState === 'COMPLETED') {
      runEmitter.emitEvent(runId, 'workflow_progress', { progress: 100 }, metadata.workflowId)
    }


  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`[State Machine] Transition failed:`, err)
    throw err
  } finally {
    client.release()
  }
}
