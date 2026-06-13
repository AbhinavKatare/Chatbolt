import { Request, Response, NextFunction } from 'express'
import { billingService } from '../services/billing.service'

interface WindowEntry {
  timestamps: number[]
}

const taskWindows = new Map<string, WindowEntry>()

export async function taskRateLimiter(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.tenantId
    if (!userId) {
      return next()
    }

    const planObj = await billingService.getUserPlan(userId)
    const plan = (planObj?.name || 'Free').toLowerCase()

    const now = Date.now()
    const key = `rate:tasks:${userId}`
    
    let entry = taskWindows.get(key)
    if (!entry) {
      entry = { timestamps: [] }
      taskWindows.set(key, entry)
    }

    // Filter out timestamps older than 24 hours
    const oneHourAgo = now - 60 * 60 * 1000
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    entry.timestamps = entry.timestamps.filter(t => t > oneDayAgo)

    const runsInLastHour = entry.timestamps.filter(t => t > oneHourAgo).length
    const runsInLastDay = entry.timestamps.length

    let limitHour = 50
    let limitDay = -1
    let message = 'You have exceeded the hourly execution limit. Please try again later.'

    if (plan === 'free') {
      limitHour = 5
      limitDay = 20
      message = 'Free accounts are limited to 5 tasks per hour and 20 per day. Please upgrade to Pro for higher limits.'
    } else if (plan === 'pro') {
      limitHour = 50
      message = 'Pro accounts are limited to 50 tasks per hour. Please upgrade to Team for higher limits.'
    } else if (plan === 'team') {
      limitHour = 100
      message = 'Team accounts are limited to 100 tasks per hour.'
    } else if (plan === 'enterprise') {
      limitHour = 200
      message = 'Enterprise accounts are limited to 200 tasks per hour.'
    }

    // Check limits
    if (runsInLastHour >= limitHour) {
      const oldestInHour = entry.timestamps.filter(t => t > oneHourAgo)[0]
      const retryAfter = Math.ceil((oldestInHour + 60 * 60 * 1000 - now) / 1000)
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message,
        retryAfter
      })
    }

    if (limitDay !== -1 && runsInLastDay >= limitDay) {
      const oldestInDay = entry.timestamps[0]
      const retryAfter = Math.ceil((oldestInDay + 24 * 60 * 60 * 1000 - now) / 1000)
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message,
        retryAfter
      })
    }

    // Add current timestamp
    entry.timestamps.push(now)
    next()
  } catch (err: any) {
    next()
  }
}
