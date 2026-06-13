import { query } from '../db'
import { sendEmail } from './email.service'
import { logger } from './logger.service'

class NotificationService {
  /**
   * Sends a notification when a task completes.
   * If email_immediate is selected and task ran > 2 mins, sends an email.
   */
  async notifyTaskComplete(
    userId: string,
    runId: string,
    receiptText: string,
    artifactUrl?: string
  ): Promise<void> {
    try {
      // 1. Query tenant info
      const tenantRes = await query(
        `SELECT email, notification_preferences FROM tenants WHERE id = $1`,
        [userId]
      )
      if (!tenantRes || tenantRes.length === 0) return
      
      const { email, notification_preferences } = tenantRes[0]
      
      // Default preference is in_app. If preference is email_immediate:
      if (notification_preferences === 'email_immediate') {
        // Query run details to check duration
        const runRes = await query(
          `SELECT duration_ms, status FROM workflow_runs WHERE id = $1`,
          [runId]
        )
        if (!runRes || runRes.length === 0) return
        const { duration_ms, status } = runRes[0]
        
        // Only notify if status is completed and duration > 2 minutes (120000ms)
        if (status === 'completed' && duration_ms && duration_ms > 120000) {
          logger.info(`[Notification] Sending immediate completion email to ${email} for run ${runId} (Duration: ${duration_ms}ms)`)
          
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
          const viewUrl = artifactUrl || `${frontendUrl}/dashboard/terminal?runId=${runId}`
          
          const subject = 'Your task is ready'
          const html = `
            <div style="font-family: sans-serif; color: #fff; background: #0a0a0a; padding: 20px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #222;">
              <h2 style="color: #00E599; margin-bottom: 16px;">Task Complete</h2>
              <p style="color: #ccc; line-height: 1.6;">${receiptText || 'Your scheduled task completed successfully.'}</p>
              <div style="margin-top: 24px;">
                <a href="${viewUrl}" style="background: #00E599; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Chatbolt to view it →</a>
              </div>
            </div>
          `
          await sendEmail({ to: email, subject, html })
        }
      }
    } catch (err: any) {
      logger.error(`[Notification] notifyTaskComplete failed: ${err.message}`)
    }
  }

  /**
   * Compiles daily completed tasks for users with email_digest preference and sends them a digest email.
   */
  async sendDailyDigest(): Promise<void> {
    try {
      logger.info(`[Notification] Running daily digest cron...`)
      
      // Find all users with daily digest preference
      const usersRes = await query(
        `SELECT id, email FROM tenants WHERE notification_preferences = 'email_digest'`
      )
      if (!usersRes || usersRes.length === 0) return
      
      for (const tenant of usersRes) {
        // Find tasks completed in the last 24 hours
        const runsRes = await query(
          `SELECT wr.id, wr.task_receipt, w.name, wr.completed_at 
           FROM workflow_runs wr
           JOIN workflows w ON wr.workflow_id = w.id
           WHERE wr.tenant_id = $1 
             AND wr.status = 'completed' 
             AND wr.completed_at > NOW() - INTERVAL '24 hours'
           ORDER BY wr.completed_at ASC`,
          [tenant.id]
        )
        
        if (runsRes && runsRes.length > 0) {
          logger.info(`[Notification] Sending daily digest to ${tenant.email} with ${runsRes.length} runs`)
          
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
          
          let listItemsHtml = ''
          for (const run of runsRes) {
            let receiptStr = 'No receipt provided.'
            if (run.task_receipt) {
              try {
                const parsed = typeof run.task_receipt === 'string' ? JSON.parse(run.task_receipt) : run.task_receipt
                receiptStr = parsed.text || parsed.summary || JSON.stringify(parsed)
              } catch {
                receiptStr = String(run.task_receipt)
              }
            }
            
            const runUrl = `${frontendUrl}/dashboard/terminal?runId=${run.id}`
            listItemsHtml += `
              <li style="margin-bottom: 20px; border-bottom: 1px solid #222; padding-bottom: 12px; list-style: none;">
                <strong style="color: #00E599; font-size: 16px;">${run.name}</strong>
                <p style="color: #ccc; margin: 6px 0 10px 0; font-size: 14px; line-height: 1.5;">${receiptStr}</p>
                <a href="${runUrl}" style="color: #00E599; font-size: 12px; text-decoration: none;">View details →</a>
              </li>
            `
          }
          
          const subject = "Here's what Chatbolt did for you today"
          const html = `
            <div style="font-family: sans-serif; color: #fff; background: #0a0a0a; padding: 24px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #222;">
              <h2 style="color: #00E599; margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 12px;">Daily Activity Digest</h2>
              <p style="color: #888; font-size: 14px; margin-bottom: 24px;">Here is a summary of the tasks completed for you in the last 24 hours:</p>
              <ul style="padding: 0; margin: 0;">
                ${listItemsHtml}
              </ul>
              <div style="margin-top: 30px; text-align: center;">
                <a href="${frontendUrl}/dashboard/terminal" style="background: #00E599; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Workspace Terminal →</a>
              </div>
            </div>
          `
          await sendEmail({ to: tenant.email, subject, html })
        }
      }
    } catch (err: any) {
      logger.error(`[Notification] sendDailyDigest failed: ${err.message}`)
    }
  }
}

export const notificationService = new NotificationService()
