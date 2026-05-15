import cron from 'node-cron'
import { db } from '../db'
import { generateDailyReport } from '../services/daily-reporter.service'

export async function initDailyReports() {
  console.log('📊 Initializing daily reporting job...')
  
  // Run at 8:00 AM every day
  cron.schedule('0 8 * * *', async () => {
    console.log('[DailyReportJob] Running scheduled reporting...')
    const { rows: tenants } = await db.query('SELECT id FROM tenants WHERE is_active = true')
    for (const tenant of tenants) {
      try {
        await generateDailyReport(tenant.id)
      } catch (err: any) {
        console.error(`[DailyReportJob] Failed for tenant ${tenant.id}:`, err.message)
      }
    }
  }, {
    timezone: 'Asia/Kolkata'
  })
}
