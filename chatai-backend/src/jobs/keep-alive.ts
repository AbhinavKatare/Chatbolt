import cron from 'node-cron'

export function startKeepAlive() {
  if (process.env.NODE_ENV !== 'production') return
  
  // Pings your own server every 10 minutes to prevent Render free tier from sleeping
  cron.schedule('*/10 * * * *', async () => {
    try {
      const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`
      await fetch(`${url}/health`)
      console.log('Keep-alive ping sent')
    } catch (err) {
      console.log('Keep-alive failed:', err)
    }
  })
}
