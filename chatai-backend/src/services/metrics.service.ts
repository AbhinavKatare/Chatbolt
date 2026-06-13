import { query } from '../db'
import { logger } from './logger.service'

export interface MetricOptions {
  userId: string
  runId: string
  taskType?: string
  startedAt: Date
  completedAt?: Date
  durationMs?: number
  stepCount?: number
  retryCount?: number
  outcome: 'success' | 'partial' | 'failed' | 'user_rejected' | 'user_cancelled'
  errorCode?: string | null
  agentTypesUsed?: string[]
}

class MetricsService {
  /**
   * Non-blocking record call. Saves execution statistics to the DB and triggers alerts evaluations.
   */
  async record(options: MetricOptions): Promise<void> {
    try {
      const dbOutcome = (options.outcome === 'success' || options.outcome === 'partial') ? options.outcome : 'failed';
      const duration = options.durationMs || (options.completedAt ? options.completedAt.getTime() - options.startedAt.getTime() : 0);

      await query(
        `INSERT INTO execution_metrics (
          user_id, run_id, task_type, started_at, completed_at, duration_ms, 
          step_count, steps_total, steps_completed, retry_count, outcome, error_code, agent_types_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $7, $8, $9, $10, $11)`,
        [
          options.userId,
          options.runId,
          options.taskType || 'other',
          options.startedAt,
          options.completedAt || new Date(),
          duration,
          options.stepCount || 1,
          options.retryCount || 0,
          dbOutcome,
          options.errorCode || options.outcome,
          options.agentTypesUsed || []
        ]
      );

      // Perform background alerts check
      this.checkAlerts().catch(err => {
        logger.warn(`[Metrics Service] Alert check failed: ${err.message}`);
      });
    } catch (err: any) {
      logger.warn(`[Metrics Service] Failed to record metrics: ${err.message}`);
    }
  }

  /**
   * Background evaluations checking for rolling system error rates and agent failures.
   */
  async checkAlerts(): Promise<void> {
    try {
      // 1. Success rate in last 100 runs
      const lastRuns = await query(
        `SELECT outcome FROM execution_metrics ORDER BY timestamp DESC LIMIT 100`
      );
      if (lastRuns.length >= 20) {
        const successCount = lastRuns.filter(r => r.outcome === 'success' || r.outcome === 'partial').length;
        const successRate = successCount / lastRuns.length;
        if (successRate < 0.8) {
          logger.error(`ALERT: Task success rate dropped below 80% — last 100 runs: ${(successRate * 100).toFixed(1)}%`);
        }
      }

      // 2. Per-agent failure rate in last 50 calls
      const stepMetrics = await query(
        `SELECT agent_id, status, error_message FROM workflow_steps ORDER BY started_at DESC LIMIT 200`
      );
      
      const agentCalls: Record<string, { total: number; failed: number }> = {};
      for (const step of stepMetrics) {
        if (!step.agent_id) continue;
        const key = String(step.agent_id);
        agentCalls[key] = agentCalls[key] || { total: 0, failed: 0 };
        if (agentCalls[key].total < 50) {
          agentCalls[key].total++;
          if (step.status === 'failed' || step.error_message) {
            agentCalls[key].failed++;
          }
        }
      }

      for (const [agentId, stats] of Object.entries(agentCalls)) {
        if (stats.total >= 10) {
          const errorRate = stats.failed / stats.total;
          if (errorRate > 0.3) {
            logger.error(`ALERT: agent ${agentId} error rate is ${(errorRate * 100).toFixed(1)}%`);
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[Metrics Service] checkAlerts error: ${err.message}`);
    }
  }
}

export const metricsService = new MetricsService();
