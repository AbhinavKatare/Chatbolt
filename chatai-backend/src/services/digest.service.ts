import { query, queryOne } from '../db'
import { sendEmail } from './email.service'
import { callLLM } from '../agents/base.agent'
import { logger } from './logger.service'

class DigestService {
  /**
   * Runs weekly to compile task completion counts, estimated time saved,
   * top integrations, and personalized recommendations.
   */
  async sendWeeklyValueDigest(): Promise<void> {
    logger.info('[Digest] Starting weekly value digest processor...')
    try {
      const tenants = await query('SELECT * FROM tenants WHERE is_active = true')
      
      for (const tenant of tenants) {
        // Query tasks completed in the past 7 days
        const runs = await query(
          `SELECT name, created_at FROM workflow_runs 
           WHERE tenant_id = $1 
           AND created_at >= NOW() - INTERVAL '7 days'
           AND status = 'success'
           ORDER BY created_at DESC`,
          [tenant.id]
        )

        const taskCount = runs.length

        if (taskCount >= 3) {
          logger.info(`[Digest] Sending weekly value digest to ${tenant.email} with ${taskCount} tasks.`)
          
          // Estimate 10 minutes saved per task
          const timeSavedMin = taskCount * 10
          const timeSavedStr = timeSavedMin >= 60 
            ? `${Math.floor(timeSavedMin / 60)}h ${timeSavedMin % 60}m` 
            : `${timeSavedMin} mins`

          // Get top integration based on task names or defaults
          let topIntegration = 'Email Integration'
          const runsStr = runs.map(r => r.name.toLowerCase()).join(' ')
          if (runsStr.includes('slack')) {
            topIntegration = 'Slack Messenger'
          } else if (runsStr.includes('drive') || runsStr.includes('sheet') || runsStr.includes('csv')) {
            topIntegration = 'Google Workspace'
          } else if (runsStr.includes('outlook')) {
            topIntegration = 'Microsoft Outlook'
          } else if (runsStr.includes('notion')) {
            topIntegration = 'Notion Hub'
          }

          // Fetch some memory facts to personalize the suggestion
          let factsStr = ''
          try {
            const facts = await query(
              'SELECT key, value FROM agent_memory WHERE tenant_id = $1 LIMIT 3',
              [tenant.id]
            )
            factsStr = facts.map(f => `${f.key}: ${f.value}`).join(', ')
          } catch (e: any) {
            logger.warn(`[Digest] Failed to fetch facts: ${e.message}`)
          }

          // Call LLM (Kimi) to generate a personalized suggestion
          let suggestion = 'Try automating your weekly project status updates or competitor research.'
          try {
            const systemPrompt = `You are Chatbolt's growth coordinator.
Provide one personalized next-week automation recommendation based on the user's past tasks and facts.
Keep it extremely concise (10-15 words max).
DO NOT use technical jargon (e.g. agent, pipeline, LLM, prompt, system). Speak in plain business English.`
            
            const userMsg = `Past tasks: ${runs.slice(0, 3).map(r => r.name).join(', ')}.\nUser context: ${factsStr}`
            const modelToUse = process.env.MODEL_CHEAP || 'moonshotai/kimi-k2.0'
            const result = await callLLM(modelToUse, systemPrompt, userMsg, 150)
            if (result && result.content) {
              // Extract the text content and sanitize
              suggestion = result.content.replace(/CONFIDENCE:.*$/i, '').trim()
            }
          } catch (err: any) {
            logger.warn(`[Digest] LLM suggestion generation failed: ${err.message}. Using default.`)
          }

          // Top 3 task receipts
          const receiptsHtml = runs.slice(0, 3).map(r => {
            const dateStr = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return `<li style="margin-bottom: 8px; color: #ccc; font-size: 13px;">
              <strong>${r.name}</strong> - completed on ${dateStr}
            </li>`
          }).join('')

          // HTML Body
          const htmlContent = `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 30px; border-radius: 12px; border: 1px solid #222;">
              <h1 style="font-size: 20px; color: #fff; margin-bottom: 20px;">Your Chatbolt week — ${taskCount} tasks done</h1>
              <p style="color: #aaa; font-size: 14px; line-height: 1.6;">Hi ${tenant.name || 'there'}, here is a summary of what Chatbolt did for you this week:</p>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0;">
                <div style="background: #111; padding: 16px; border-radius: 8px; border: 1px solid #222;">
                  <div style="font-size: 12px; color: #666; text-transform: uppercase;">Tasks Run</div>
                  <div style="font-size: 20px; color: #00E599; font-weight: bold; margin-top: 4px;">${taskCount}</div>
                </div>
                <div style="background: #111; padding: 16px; border-radius: 8px; border: 1px solid #222;">
                  <div style="font-size: 12px; color: #666; text-transform: uppercase;">Est. Time Saved</div>
                  <div style="font-size: 20px; color: #00E599; font-weight: bold; margin-top: 4px;">${timeSavedStr}</div>
                </div>
              </div>

              <div style="background: #111; padding: 16px; border-radius: 8px; border: 1px solid #222; margin-bottom: 24px;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 8px;">Top Integration Used</div>
                <div style="font-size: 15px; color: #fff; font-weight: 600;">${topIntegration}</div>
              </div>

              <h2 style="font-size: 14px; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #222; padding-bottom: 8px; margin-bottom: 12px;">Recent Task Activity</h2>
              <ul style="padding-left: 20px; margin: 0 0 24px 0;">
                ${receiptsHtml}
              </ul>

              <div style="background: #00E599/10; border-left: 3px solid #00E599; padding: 16px; border-radius: 4px; margin-bottom: 24px; background-color: rgba(0, 229, 153, 0.05);">
                <strong style="color: #00E599; font-size: 13px; display: block; margin-bottom: 4px;">Next-Week Suggestion</strong>
                <p style="color: #ccc; margin: 0; font-size: 13px; line-height: 1.5;">${suggestion}</p>
              </div>

              <div style="text-align: center; margin-top: 28px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
                   style="display: inline-block; background: #00E599; color: #000; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px;">
                  Open Chatbolt Dashboard
                </a>
              </div>
            </div>
          `

          await sendEmail({
            to: tenant.email,
            subject: `Your Chatbolt week — ${taskCount} tasks done`,
            html: htmlContent
          })
        } else if (taskCount === 0) {
          // Zero activity users get the re-engagement email directly on Sunday if eligible
          await this.sendDirectReengagementEmail(tenant)
        }
      }
    } catch (err: any) {
      logger.error(`[Digest] Weekly value digest execution error: ${err.message}`)
    }
  }

  /**
   * Daily check to send re-engagement emails to users who haven't run any tasks in 5 days.
   */
  async checkAndSendReengagement(): Promise<void> {
    logger.info('[Digest] Starting daily re-engagement check...')
    try {
      // Find tenants active more than 5 days ago, or created > 5 days ago with no tasks,
      // and who haven't received a re-engagement email in the last 30 days.
      const queryStr = `
        SELECT * FROM tenants
        WHERE is_active = true
        AND (
          last_active_date < NOW() - INTERVAL '5 days'
          OR (last_active_date IS NULL AND created_at < NOW() - INTERVAL '5 days')
        )
        AND (
          last_reengagement_sent IS NULL 
          OR last_reengagement_sent < NOW() - INTERVAL '30 days'
        )
      `
      const eligibleTenants = await query(queryStr)
      logger.info(`[Digest] Found ${eligibleTenants.length} tenants eligible for re-engagement.`)

      for (const tenant of eligibleTenants) {
        await this.sendDirectReengagementEmail(tenant)
      }
    } catch (err: any) {
      logger.error(`[Digest] Daily re-engagement execution error: ${err.message}`)
    }
  }

  /**
   * Helper function to construct and send a personalized re-engagement email.
   */
  private async sendDirectReengagementEmail(tenant: any): Promise<void> {
    try {
      // Find their last successful run to customize the suggestion
      const lastRun = await queryOne(
        `SELECT name, created_at FROM workflow_runs 
         WHERE tenant_id = $1 
         AND status = 'success' 
         ORDER BY created_at DESC LIMIT 1`,
        [tenant.id]
      )

      let lastTaskType = 'automation task'
      let actionSuggestion = 'Create a new automated task today to handle your repetitive work.'

      if (lastRun) {
        const nameLower = lastRun.name.toLowerCase()
        if (nameLower.includes('email') || nameLower.includes('gmail') || nameLower.includes('outlook')) {
          lastTaskType = 'email drafting and parsing'
          actionSuggestion = 'Try connecting Microsoft Outlook to sync and automate email replies.'
        } else if (nameLower.includes('slack')) {
          lastTaskType = 'Slack notification routing'
          actionSuggestion = 'Set up a rule to route spreadsheet row updates to your Slack channel.'
        } else if (nameLower.includes('spreadsheet') || nameLower.includes('csv') || nameLower.includes('sheet')) {
          lastTaskType = 'spreadsheet data processing'
          actionSuggestion = 'Upload a new CSV file to automatically generate custom Chart.js visualizations.'
        } else if (nameLower.includes('research') || nameLower.includes('web')) {
          lastTaskType = 'web and market research'
          actionSuggestion = 'Launch a competitor comparison report to scan what has changed this week.'
        }
      }

      logger.info(`[Digest] Sending re-engagement email to ${tenant.email} (last active was ${tenant.last_active_date || 'never'}).`)

      const htmlContent = `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 30px; border-radius: 12px; border: 1px solid #222;">
          <h1 style="font-size: 20px; color: #fff; margin-bottom: 16px;">Make this week productive with Chatbolt</h1>
          <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
            Hi ${tenant.name || 'there'}, we noticed you haven't run any tasks recently. 
            Automations help you save hours of busywork every single week.
          </p>

          <p style="color: #ccc; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
            Your last completed task was related to <strong style="color: #00E599;">${lastTaskType}</strong>. 
            Would you like to continue saving time on these workflows?
          </p>

          <div style="background: #111; padding: 16px; border-radius: 8px; border: 1px solid #222; margin-bottom: 24px;">
            <strong style="color: #fff; font-size: 13px; display: block; margin-bottom: 4px;">Recommended Action</strong>
            <p style="color: #aaa; margin: 0; font-size: 13px; line-height: 1.5;">${actionSuggestion}</p>
          </div>

          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
               style="display: inline-block; background: #00E599; color: #000; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px;">
              Get Back to Automating
            </a>
          </div>
        </div>
      `

      await sendEmail({
        to: tenant.email,
        subject: `Simplify your workload this week`,
        html: htmlContent
      })

      // Update the database to throttle future re-engagement emails for 30 days
      await query(
        'UPDATE tenants SET last_reengagement_sent = NOW() WHERE id = $1',
        [tenant.id]
      )
    } catch (err: any) {
      logger.error(`[Digest] Failed sending re-engagement email to ${tenant.email}: ${err.message}`)
    }
  }
}

export const digestService = new DigestService()
