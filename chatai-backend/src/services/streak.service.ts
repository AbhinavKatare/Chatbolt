import { query, queryOne } from '../db'
import { runEmitter } from './sse.service'
import { logger } from './logger.service'

class StreakService {
  /**
   * Tracks consecutive days with at least one task.
   * Updates user records and emits milestone alerts.
   */
  async updateStreak(tenantId: string, runId: string): Promise<void> {
    try {
      const tenant = await queryOne(
        'SELECT last_active_date, current_streak, longest_streak, metadata FROM tenants WHERE id = $1',
        [tenantId]
      )
      if (!tenant) return

      const today = new Date()
      // format as YYYY-MM-DD
      const todayStr = today.toISOString().split('T')[0]
      
      let lastActiveStr: string | null = null
      if (tenant.last_active_date) {
        lastActiveStr = new Date(tenant.last_active_date).toISOString().split('T')[0]
      }

      if (lastActiveStr === todayStr) {
        // Already active today, nothing to change. But update last_active_date just in case
        await query('UPDATE tenants SET last_active_date = $1 WHERE id = $2', [todayStr, tenantId])
        return
      }

      const yesterday = new Date(Date.now() - 86400000)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      let newStreak = 1
      if (lastActiveStr === yesterdayStr) {
        newStreak = (tenant.current_streak || 0) + 1
      }

      const newLongest = Math.max(tenant.longest_streak || 0, newStreak)
      const metadata = tenant.metadata || {}

      let themeUnlocked = false
      if (newStreak >= 30 && !metadata.theme_unlocked_midnight) {
        metadata.theme_unlocked_midnight = true
        themeUnlocked = true
        logger.info(`[Streak] Tenant ${tenantId} unlocked the Midnight Theme!`)
      }

      await query(
        'UPDATE tenants SET current_streak = $1, longest_streak = $2, last_active_date = $3, metadata = $4 WHERE id = $5',
        [newStreak, newLongest, todayStr, JSON.stringify(metadata), tenantId]
      )

      logger.info(`[Streak] Tenant ${tenantId} streak updated: ${newStreak} days. Longest: ${newLongest}`)

      // Handle milestones
      if (newStreak === 7) {
        // Day 7 Milestone: inline terminal message with time-saved summary
        const totalCompletedQuery = await queryOne(
          "SELECT COUNT(*)::integer as count FROM workflow_runs WHERE tenant_id = $1 AND status = 'success'",
          [tenantId]
        )
        const totalCompleted = totalCompletedQuery?.count || 7
        const totalSavedMin = totalCompleted * 10
        const totalSavedStr = totalSavedMin >= 60 
          ? `${Math.floor(totalSavedMin / 60)}h ${totalSavedMin % 60}m` 
          : `${totalSavedMin} minutes`

        runEmitter.emitEvent(runId, 'agent_progress', {
          message: `🔥 Streak Milestone: You've reached a 7-day streak! You have automated ${totalCompleted} tasks, saving you an estimated ${totalSavedStr} of busywork. Keep it up!`
        })
      } else if (newStreak === 30) {
        runEmitter.emitEvent(runId, 'agent_progress', {
          message: `🔥 Streak Milestone: 30 days active! You have unlocked the exclusive Midnight Theme (deep navy + gold). Head to Settings to apply it.`
        })
      }
    } catch (err: any) {
      logger.error(`[Streak] Failed to update streak: ${err.message}`)
    }
  }
}

export const streakService = new StreakService()
