import { logger } from './logger.service';
import { db } from '../db'
import { executeWorkflow } from './workflow-engine.service'
import { executeWorkflowLangGraph } from './langgraph-engine.service'
import { transitionWorkflowRun } from './workflow-state'
import crypto from 'crypto'

// Dynamic imports for BullMQ to prevent startup crashes if not installed
let Queue: any = null
let Worker: any = null
let ioredis: any = null

try {
  // Try importing bullmq and ioredis dynamically
  Queue = require('bullmq').Queue
  Worker = require('bullmq').Worker
  ioredis = require('ioredis')
} catch (e) {
  logger.info('[Queue] Redis / BullMQ not installed. Gracefully using PostgreSQL Queue.')
}

export interface Job {
  id: string
  run_id: string
  job_type: string
  payload: any
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  max_attempts: number
  error_message?: string
  run_at: Date
}

class QueueService {
  private redisConnection: any = null
  private bullQueue: any = null
  private pgIntervalId: NodeJS.Timeout | null = null
  private recentRequests = new Map<string, { runId: string; timestamp: number }>()
  private DEDUPLICATION_WINDOW_MS = 10000 // 10 seconds (Decision D1)
  private isProcessing = false
  private isRunning = false

  async initialize() {
    this.isRunning = true
    const redisHost = process.env.REDIS_HOST || '127.0.0.1'
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10)

    if (Queue && ioredis && process.env.USE_REDIS === 'true') {
      try {
        logger.info(`[Queue] Connecting to Redis at ${redisHost}:${redisPort}...`)
        this.redisConnection = new ioredis({
          host: redisHost,
          port: redisPort,
          maxRetriesPerRequest: null,
          connectTimeout: 2000
        })

        this.redisConnection.on('error', (err: any) => {
          console.error('[Queue] Redis Connection Error:', err.message)
        })

        this.bullQueue = new Queue('workflow-runs', {
          connection: this.redisConnection
        })
        logger.info('[Queue] BullMQ initialized successfully')
      } catch (err: any) {
        console.warn('[Queue] BullMQ failed to connect, falling back to PostgreSQL queue:', err.message)
        this.bullQueue = null
      }
    } else {
      logger.info('[Queue] Using PostgreSQL transactional queue as primary durable store.')
    }

    // Run self-healing recovery bootstrap upon startup
    await this.recoverCrashedWorkflows()

    // Start workers
    this.startQueueWorkers()
  }

  /**
   * Scans for runs stuck in active states due to crash/restart and re-enqueues them
   */
  async recoverCrashedWorkflows() {
    logger.info('[Queue] Running self-healing recovery bootstrap...')
    try {
      const stuckStates = ['planning', 'executing', 'tool_running', 'validating', 'retrying']
      const { rows: stuckRuns } = await db.query(
        `SELECT id, workflow_id, tenant_id, input_data, status 
         FROM workflow_runs 
         WHERE status = ANY($1) 
         ORDER BY started_at ASC`,
        [stuckStates]
      )

      if (stuckRuns.length > 0) {
        logger.info(`[Queue] Found ${stuckRuns.length} stuck runs to recover. Re-enqueueing...`)
        for (const run of stuckRuns) {
          logger.info(`[Queue] Self-healing run ${run.id} (stuck in state: ${run.status})`)
          
          // Re-transition run to RETRYING or EXECUTING state
          await transitionWorkflowRun(run.id, 'RETRYING', {
            workflowId: run.workflow_id,
            errorMessage: 'Automatic recovery from system crash/restart'
          })

          await this.enqueueWorkflowRun(
            run.workflow_id,
            run.tenant_id,
            run.input_data,
            run.id,
            true // assume langgraph as default route
          )
        }
      } else {
        logger.info('[Queue] No stuck runs found. System state is clean.')
      }
    } catch (err: any) {
      console.error('[Queue] Error during stuck workflow recovery:', err)
    }
  }

  async enqueueWorkflowRun(
    workflowId: string,
    tenantId: string,
    userInputs: any,
    runId?: string,
    isLangGraph: boolean = true
  ): Promise<string> {
    const now = Date.now()

    // Clean up expired items from the cache
    for (const [key, val] of this.recentRequests.entries()) {
      if (now - val.timestamp > this.DEDUPLICATION_WINDOW_MS) {
        this.recentRequests.delete(key)
      }
    }

    // Generate SHA-256 hash of the inputs scoped by tenantId
    const inputStr = JSON.stringify(userInputs || {})
    const hash = crypto.createHash('sha256').update(inputStr).digest('hex')
    const cacheKey = `${tenantId}:${workflowId}:${hash}`

    // Check for duplicate request within the window
    if (!runId && this.recentRequests.has(cacheKey)) {
      const existing = this.recentRequests.get(cacheKey)!
      logger.info(`[Queue] Deduplicated duplicate run request for tenant ${tenantId}. Returning existing runId: ${existing.runId}`)
      return existing.runId
    }

    // 1. Create or get runId
    let finalRunId: string
    if (runId) {
      finalRunId = runId
    } else {
      const wfRow = await db.query('SELECT project_id FROM workflows WHERE id = $1', [workflowId])
      const projectId = wfRow.rows[0]?.project_id || null

      const { rows } = await db.query(
        `INSERT INTO workflow_runs 
         (workflow_id, tenant_id, input_data, status, started_at, project_id) 
         VALUES ($1, $2, $3, 'pending', NOW(), $4) 
         RETURNING id`,
        [workflowId, tenantId, JSON.stringify(userInputs), projectId]
      )
      finalRunId = rows[0].id
    }

    // Store in the deduplication cache
    if (!runId) {
      this.recentRequests.set(cacheKey, { runId: finalRunId, timestamp: now })
    }

    const payload = {
      runId: finalRunId,
      workflowId,
      tenantId,
      userInputs,
      isLangGraph
    }

    // 2. Push to BullMQ if active
    if (this.bullQueue) {
      try {
        await this.bullQueue.add('execute-workflow', payload, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        })
        logger.info(`[Queue] Enqueued run ${finalRunId} on BullMQ`)
        return finalRunId
      } catch (err: any) {
        console.warn('[Queue] Failed to push to BullMQ, writing to PostgreSQL queue:', err.message)
      }
    }

    // 3. Fallback to PostgreSQL Queue
    await db.query(
      `INSERT INTO workflow_jobs (run_id, job_type, payload, status, run_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [finalRunId, 'workflow', JSON.stringify(payload), 'pending', new Date().toISOString(), new Date().toISOString()]
    )
    logger.info(`[Queue] Enqueued run ${finalRunId} on PostgreSQL Queue`)
    return finalRunId
  }

  startQueueWorkers() {
    if (this.bullQueue) {
      this.startBullMQWorker()
    }
    
    // Always start PostgreSQL queue fallback worker as double-durable system
    this.startPostgresWorker()
  }

  private startBullMQWorker() {
    if (!Worker || !this.redisConnection) return

    try {
      const worker = new Worker('workflow-runs', async (job: any) => {
        logger.info(`[BullMQ Worker] Processing job ${job.id} for run ${job.data.runId}`)
        await this.processJobPayload(job.data)
      }, {
        connection: this.redisConnection,
        concurrency: 5
      })

      worker.on('completed', (job: any) => {
        logger.info(`[BullMQ Worker] Job ${job.id} completed`)
      })

      worker.on('failed', (job: any, err: any) => {
        console.error(`[BullMQ Worker] Job ${job.id} failed:`, err.message)
      })

      logger.info('[Queue] BullMQ Worker started successfully')
    } catch (err: any) {
      console.error('[Queue] Failed to initialize BullMQ Worker:', err.message)
    }
  }

  private startPostgresWorker() {
    if (this.pgIntervalId) return

    logger.info('[Queue] PostgreSQL Fallback Polling Worker started')
    this.pgIntervalId = setInterval(async () => {
      if (this.isProcessing || !this.isRunning) return
      this.isProcessing = true

      try {
        await this.pollAndProcessPostgresJob()
      } catch (err) {
        console.error('[Queue Worker] Error during polling:', err)
      } finally {
        this.isProcessing = false
      }
    }, 1000)
  }

  private async pollAndProcessPostgresJob() {
    // Atomic lock and claim using SKIP LOCKED
    const { rows: claimedJobs } = await db.query(
      `UPDATE workflow_jobs 
       SET status = 'processing', locked_at = NOW(), attempts = attempts + 1
       WHERE id = (
         SELECT id FROM workflow_jobs 
         WHERE status = 'pending' AND run_at <= NOW()
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`
    )

    const job = claimedJobs[0] as Job
    if (!job) return

    logger.info(`[Queue Worker] Claimed PostgreSQL job ${job.id} for run ${job.run_id} (Attempt ${job.attempts})`)

    try {
      const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload
      await this.processJobPayload(payload)

      // Mark job completed in queue
      await db.query(
        "UPDATE workflow_jobs SET status = 'completed', updated_at = NOW() WHERE id = $1",
        [job.id]
      )
      logger.info(`[Queue Worker] Job ${job.id} processed successfully`)
    } catch (err: any) {
      console.error(`[Queue Worker] Job ${job.id} failed:`, err.message)

      if (job.attempts < job.max_attempts) {
        // Backoff and retry
        const retryDelaySec = Math.pow(2, job.attempts) * 10
        await db.query(
          `UPDATE workflow_jobs 
           SET status = 'pending', error_message = $1, 
               run_at = NOW() + INTERVAL '${retryDelaySec} seconds', 
               updated_at = NOW()
           WHERE id = $2`,
          [err.message, job.id]
        )
        logger.info(`[Queue Worker] Job ${job.id} rescheduled in ${retryDelaySec}s`)
      } else {
        await db.query(
          `UPDATE workflow_jobs 
           SET status = 'failed', error_message = $1, updated_at = NOW()
           WHERE id = $2`,
          [err.message, job.id]
        )
        console.error(`[Queue Worker] Job ${job.id} exceeded max retries. Moved to Dead-Letter state.`)
      }
    }
  }

  private async processJobPayload(payload: any) {
    const { runId, workflowId, tenantId, userInputs, isLangGraph } = payload

    if (isLangGraph) {
      await executeWorkflowLangGraph(workflowId, tenantId, userInputs, runId)
    } else {
      await executeWorkflow(workflowId, tenantId, userInputs, runId)
    }
  }

  stopQueueWorkers() {
    this.isRunning = false
    if (this.pgIntervalId) {
      clearInterval(this.pgIntervalId)
      this.pgIntervalId = null
      logger.info('[Queue] PostgreSQL Fallback Polling Worker stopped')
    }
  }
}

export const queueService = new QueueService()
