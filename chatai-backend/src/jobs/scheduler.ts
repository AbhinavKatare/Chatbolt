import cron from 'node-cron'
import { db } from '../db'
import { executeWorkflow } from '../services/workflow-engine.service'

const activeJobs: Record<string, cron.ScheduledTask> = {}

export async function initScheduler() {
  console.log('⏰ Initializing workflow scheduler...')
  
  const { rows: schedules } = await db.query(
    `SELECT s.*, w.tenant_id 
     FROM workflow_schedules s
     JOIN workflows w ON s.workflow_id = w.id
     WHERE s.is_active = true AND w.status = 'active'`
  )

  for (const schedule of schedules) {
    scheduleWorkflow(schedule.workflow_id, schedule.tenant_id, schedule.cron_expression, schedule.timezone)
  }
}

export function scheduleWorkflow(workflowId: string, tenantId: string, cronExpression: string, timezone = 'Asia/Kolkata') {
  // Cancel existing job if any
  if (activeJobs[workflowId]) {
    activeJobs[workflowId].stop()
  }

  const job = cron.schedule(cronExpression, async () => {
    console.log(`[Scheduler] Triggering workflow ${workflowId}`)
    try {
      await executeWorkflow(workflowId, tenantId, { trigger: 'schedule' })
    } catch (err: any) {
      console.error(`[Scheduler] Error running scheduled workflow ${workflowId}:`, err.message)
    }
  }, {
    timezone
  })

  activeJobs[workflowId] = job
  console.log(`[Scheduler] Scheduled workflow ${workflowId} with cron: ${cronExpression}`)
}

export function stopScheduledWorkflow(workflowId: string) {
  if (activeJobs[workflowId]) {
    activeJobs[workflowId].stop()
    delete activeJobs[workflowId]
    console.log(`[Scheduler] Stopped workflow ${workflowId}`)
  }
}
