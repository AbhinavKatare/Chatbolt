import { logger } from '../services/logger.service';
import cron from 'node-cron'
import { db } from '../db'
import { generateDailyReport } from '../services/daily-reporter.service'

export async function initDailyReports() {
  logger.info('📊 Initializing daily reporting job...')
  
  // Run at 8:00 AM every day
  cron.schedule('0 8 * * *', async () => {
    logger.info('[DailyReportJob] Running scheduled reporting...')
    const { rows: tenants } = await db.query('SELECT id FROM tenants WHERE is_active = true')
    for (const tenant of tenants) {
      try {
        await generateDailyReport(tenant.id)
      } catch (err: any) {
        console.error(`[DailyReportJob] Failed for tenant ${tenant.id}:`, err.message)
      }
    }
  }, {
    timezone: 'Asia/Kolkata'                // its has an proper planning of implementing the system on 8 in the morning daily for anytype od cronning job and its very very importnat to mention this also its uses hook 3 for monitoring
  })

  // Proactive integration token refresh daily cron (Post-Ship Monitoring Hook #3)
  cron.schedule('0 3 * * *', async () => {
    logger.info('[TokenRefreshJob] Running proactive integration token refresh check...')
    try {
      const { integrationRegistryService } = await import('../services/integration-registry.service')
      await integrationRegistryService.refreshExpiringTokens()
    } catch (err: any) {
      console.error('[TokenRefreshJob] Proactive token refresh job failed:', err.message)
    }
  }, {
    timezone: 'Asia/Kolkata'
  })
}
