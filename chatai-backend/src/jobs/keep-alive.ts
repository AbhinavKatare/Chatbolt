import { logger } from '../services/logger.service';
import cron from 'node-cron'

export function startKeepAlive() {
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Keep-alive: Not in production, skipping.')
    return
  }
  
  // Pings every 10 minutes to prevent Render from sleeping
  cron.schedule('*/10 * * * *', async () => {
    try {
      const url = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001'
      const response = await fetch(`${url}/health`)
      logger.info(`Keep-alive ping sent to ${url}/health. Status: ${response.status}`)
    } catch (err) {
      logger.info('Keep-alive ping failed:', err)
    }
  })
}
