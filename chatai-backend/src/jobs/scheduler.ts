import { logger } from '../services/logger.service';
import cron from 'node-cron'
import { query } from '../db'
import { executeWorkflow } from '../services/workflow-engine.service'

const activeJobs: Record<string, cron.ScheduledTask> = {}

export async function initScheduler() {
  logger.info('⏰ Initializing workflow scheduler...')
  
  // 1. Load active workflow-based schedules
  try {
    const schedulesRes = await query<any>(
      `SELECT s.*, w.tenant_id 
       FROM workflow_schedules s
       JOIN workflows w ON s.workflow_id = w.id
       WHERE s.is_active = true AND w.status = 'active'`
    )
    const schedules = schedulesRes || []
    for (const schedule of schedules) {
      scheduleWorkflow(schedule.workflow_id, schedule.tenant_id, schedule.cron_expression, schedule.timezone)
    }
  } catch (err: any) {
    logger.error('[Scheduler] Failed to load workflow schedules: ' + err.message)
  }

  // 2. Load active scheduled_tasks (NLP and Template based)
  try {
    const tasksRes = await query<any>(
      `SELECT * FROM scheduled_tasks WHERE is_active = true`
    )
    const tasks = tasksRes || []
    for (const task of tasks) {
      addTask(task)
    }
  } catch (err: any) {
    logger.error('[Scheduler] Failed to load scheduled tasks: ' + err.message)
  }
}

export function scheduleWorkflow(workflowId: string, tenantId: string, cronExpression: string, timezone = 'Asia/Kolkata') {
  if (activeJobs[workflowId]) {
    activeJobs[workflowId].stop()
  }

  const job = cron.schedule(cronExpression, async () => {
    logger.info(`[Scheduler] Triggering workflow ${workflowId}`)
    try {
      await executeWorkflow(workflowId, tenantId, { trigger: 'schedule' })
    } catch (err: any) {
      console.error(`[Scheduler] Error running scheduled workflow ${workflowId}:`, err.message)
    }
  }, {
    timezone
  })

  activeJobs[workflowId] = job
  logger.info(`[Scheduler] Scheduled workflow ${workflowId} with cron: ${cronExpression}`)
}

export function stopScheduledWorkflow(workflowId: string) {
  if (activeJobs[workflowId]) {
    activeJobs[workflowId].stop()
    delete activeJobs[workflowId]
    logger.info(`[Scheduler] Stopped workflow ${workflowId}`)
  }
}

export function addTask(task: any) {
  const taskId = task.id
  if (activeJobs[taskId]) {
    activeJobs[taskId].stop()
  }

  if (!task.is_active) return

  const job = cron.schedule(task.cron_expression, async () => {
    logger.info(`[Scheduler] Triggering scheduled task ${task.id} (${task.workflow_name})`)
    try {
      // Update last triggered
      await query('UPDATE scheduled_tasks SET last_triggered = NOW() WHERE id = $1', [task.id])

      const { handleExecuteV2 } = await import('../services/execution-router.service')

      if (task.team_id) {
        // Query active team members to run for each member individually
        const membersRes = await query(
          `SELECT tenant_id FROM team_members WHERE team_id = $1`,
          [task.team_id]
        )
        const members = membersRes || []
        for (const m of members) {
          logger.info(`[Scheduler] Running team schedule for member ${m.tenant_id}`)
          const mockRes: any = {
            write: (data: any) => {},
            end: () => {},
            status: (code: any) => mockRes,
            json: (data: any) => {}
          }
          await handleExecuteV2({
            prompt: task.task_prompt,
            tenantId: m.tenant_id,
            sessionId: `scheduled-${task.id}-${m.tenant_id}`,
            res: mockRes
          }).catch(err => {
            console.error(`[Scheduler] Error running team schedule for member ${m.tenant_id}:`, err.message)
          })
        }
      } else {
        const mockRes: any = {
          write: (data: any) => {},
          end: () => {},
          status: (code: any) => mockRes,
          json: (data: any) => {}
        }
        await handleExecuteV2({
          prompt: task.task_prompt,
          tenantId: task.tenant_id,
          sessionId: `scheduled-${task.id}`,
          res: mockRes
        })
      }
    } catch (err: any) {
      console.error(`[Scheduler] Error running scheduled task ${task.id}:`, err.message)
    }
  })

  activeJobs[taskId] = job
  logger.info(`[Scheduler] Scheduled task ${task.id} (${task.workflow_name}) with cron: ${task.cron_expression}`)
}

export function removeTask(taskId: string) {
  if (activeJobs[taskId]) {
    activeJobs[taskId].stop()
    delete activeJobs[taskId]
    logger.info(`[Scheduler] Stopped scheduled task ${taskId}`)
  }
}
