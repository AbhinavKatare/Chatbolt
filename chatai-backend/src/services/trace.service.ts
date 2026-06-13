import { logger } from './logger.service';
import { db } from '../db'

export type EventType =
  | 'WORKFLOW_CREATED'
  | 'STEP_STARTED'
  | 'STEP_COMPLETED'
  | 'STEP_FAILED'
  | 'MODEL_CALL_STARTED'
  | 'MODEL_CALL_COMPLETED'
  | 'TOOL_CALL_STARTED'
  | 'TOOL_CALL_COMPLETED'
  | 'MEMORY_RETRIEVED'
  | 'RETRY_TRIGGERED'
  | 'SYSTEM_HEALED'
  | 'GRAPH_GENERATED'
  | 'NODE_STARTED'
  | 'NODE_COMPLETED'
  | 'TOOL_EXECUTED'
  | 'VALIDATION_FAILED'
  | 'RECOVERY_TRIGGERED'
  | 'BROWSER_ACTION_EXECUTED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED'

export interface TracePayload {
  agentName?: string
  agentRole?: string
  stepNumber?: number
  model?: string
  systemPrompt?: string
  userMessage?: string
  response?: string
  confidence?: number
  toolName?: string
  toolParams?: any
  toolResult?: any
  memoryKey?: string
  memoryCategory?: string
  memoryQuery?: string
  memoryResultsCount?: number
  latencyMs?: number
  promptTokens?: number
  completionTokens?: number
  errorMessage?: string
  attempt?: number
  delayMs?: number
  [key: string]: any
}

class TraceService {
  /**
   * Log an event sourcing trace into the database.
   */
  async logTrace(
    runId: string,
    eventType: EventType,
    payload: TracePayload
  ): Promise<string> {
    const timestamp = new Date().toISOString()
    const enrichedPayload = {
      ...payload,
      timestamp,
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO workflow_events (run_id, event_type, payload)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [runId, eventType, JSON.stringify(enrichedPayload)]
      )
      
      logger.info(`[Trace] Event ${eventType} logged for run ${runId}`)
      return rows[0].id
    } catch (err: any) {
      console.error(`[Trace] Failed to log trace event ${eventType}:`, err.message)
      return ''
    }
  }

  /**
   * Records the start of a model/LLM call.
   */
  async traceModelStart(
    runId: string,
    agentName: string,
    model: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<string> {
    return this.logTrace(runId, 'MODEL_CALL_STARTED', {
      agentName,
      model,
      systemPrompt,
      userMessage,
    })
  }

  /**
   * Records the completion of a model/LLM call.
   */
  async traceModelComplete(
    runId: string,
    agentName: string,
    model: string,
    response: string,
    confidence: number,
    latencyMs: number,
    promptTokens = 0,
    completionTokens = 0
  ): Promise<string> {
    return this.logTrace(runId, 'MODEL_CALL_COMPLETED', {
      agentName,
      model,
      response,
      confidence,
      latencyMs,
      promptTokens,
      completionTokens,
    })
  }

  /**
   * Records the start of a tool invocation.
   */
  async traceToolStart(
    runId: string,
    agentName: string,
    toolName: string,
    toolParams: any
  ): Promise<string> {
    return this.logTrace(runId, 'TOOL_CALL_STARTED', {
      agentName,
      toolName,
      toolParams,
    })
  }

  /**
   * Records the completion of a tool invocation.
   */
  async traceToolComplete(
    runId: string,
    agentName: string,
    toolName: string,
    toolResult: any,
    latencyMs: number,
    errorMessage?: string
  ): Promise<string> {
    return this.logTrace(runId, 'TOOL_CALL_COMPLETED', {
      agentName,
      toolName,
      toolResult,
      latencyMs,
      errorMessage,
    })
  }

  /**
   * Records memory retrieval event (semantic or facts).
   */
  async traceMemoryRetrieval(
    runId: string,
    agentName: string,
    query: string,
    resultsCount: number,
    category = 'semantic'
  ): Promise<string> {
    return this.logTrace(runId, 'MEMORY_RETRIEVED', {
      agentName,
      memoryQuery: query,
      memoryResultsCount: resultsCount,
      memoryCategory: category,
    })
  }

  /**
   * Fetch all traces for a specific workflow run to allow replayable visual timelines.
   */
  async getRunTimeline(runId: string) {
    const { rows } = await db.query(
      `SELECT id, event_type, payload, created_at
       FROM workflow_events
       WHERE run_id = $1
       ORDER BY created_at ASC`,
      [runId]
    )
    return rows
  }
}

export const traceService = new TraceService()
export default traceService
