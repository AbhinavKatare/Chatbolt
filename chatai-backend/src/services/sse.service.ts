import { logger } from './logger.service';
import { EventEmitter } from 'events'

export type SSEEvent = 
  | 'workflow_start'
  | 'thinking_delta'
  | 'agent_start'
  | 'agent_progress'
  | 'agent_screenshot'
  | 'browser:screenshot'
  | 'tool_call'
  | 'tool_result'
  | 'agent_done'
  | 'agent_error'
  | 'agent_retry'
  | 'workflow_done'
  | 'workflow_error'
  | 'agent_waiting'
  | 'workflow_progress'
  | 'artifact:created'
  | 'action:journaled'



export interface SSEMessage {
  type: SSEEvent
  runId: string
  workflowId?: string
  agentId?: string
  data?: any
  timestamp: string
  seqId: number
}

function sanitizeUserFacingText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\b(ai\s+)?agent\b/gi, 'assistant')
    .replace(/\b(ai\s+)?agents\b/gi, 'assistants')
    .replace(/\bpipeline\b/gi, 'process')
    .replace(/\bworkflow\b/gi, 'process')
    .replace(/\bworkflows\b/gi, 'processes')
    .replace(/\borchestrat\w*/gi, 'coordinate')
    .replace(/\blanggraph\b/gi, 'Engine')
    .replace(/\bllm\b/gi, 'AI')
    .replace(/\btoken\b/gi, 'word')
    .replace(/\btokens\b/gi, 'words')
    .replace(/\bvector\b/gi, 'key')
    .replace(/\bvectors\b/gi, 'keys')
    .replace(/\bembedding\b/gi, 'context')
    .replace(/\bembeddings\b/gi, 'contexts')
    .replace(/\bmodel\b/gi, 'assistant version')
    .replace(/\bmodels\b/gi, 'assistant versions')
    .replace(/\bopenai\b/gi, 'system provider')
    .replace(/\banthropic\b/gi, 'system provider')
    .replace(/\bclaude\b/gi, 'system assistant')
    .replace(/\bgpt\b/gi, 'system assistant')
    .replace(/\bmistral\b/gi, 'system assistant')
    .replace(/\bgemini\b/gi, 'system assistant')
    .replace(/\bgpt-4o\b/gi, 'Standard Model')
    .replace(/\bclaude-3-5-sonnet\b/gi, 'Premium Model');
}

function sanitizePayload(payload: any): any {
  if (!payload) return payload;
  if (typeof payload === 'string') {
    return sanitizeUserFacingText(payload);
  }
  if (Array.isArray(payload)) {
    return payload.map(item => sanitizePayload(item));
  }
  if (typeof payload === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(payload)) {
      cleaned[key] = sanitizePayload(payload[key]);
    }
    return cleaned;
  }
  return payload;
}

class SSEEmitter extends EventEmitter {
  private seqMap: Map<string, number> = new Map()
  private cache: SSEMessage[] = []
  private readonly MAX_CACHE_SIZE = 200

  emitEvent(runId: string, type: SSEEvent, data?: any, workflowId?: string, agentId?: string) {
    const currentSeq = (this.seqMap.get(runId) || 0) + 1
    this.seqMap.set(runId, currentSeq)

    const message: SSEMessage = {
      type,
      runId,
      workflowId,
      agentId,
      data: sanitizePayload(data),
      timestamp: new Date().toISOString(),
      seqId: currentSeq
    }

    // Add to cache and prune if exceeds max size
    this.cache.push(message)
    if (this.cache.length > this.MAX_CACHE_SIZE) {
      this.cache.shift()
    }

    this.emit(`run:${runId}`, message)
    logger.info(`[SSE] ${type} for run ${runId} (Seq: ${currentSeq})`)

    // Broadcast to Socket.IO clients dynamically to avoid circular dependencies
    import('./socket.service').then(({ broadcastRunEvent }) => {
      const payload = {
        runId,
        workflowId,
        agentId,
        data: message.data,
        timestamp: message.timestamp,
        seqId: currentSeq
      }
      
      // Emit generic event type
      broadcastRunEvent(runId, type, payload)

      // Map SSE event types to custom WebSocket event names required by the client:
      // Required event names: task:start, task:step, task:progress, task:completed, task:failed, permission:required, artifact:created, action:journaled
      if (type === 'workflow_start') {
        broadcastRunEvent(runId, 'task:start', payload)
      } else if (type === 'agent_start' || type === 'agent_progress' || type === 'agent_done') {
        broadcastRunEvent(runId, 'task:step', payload)
      } else if (type === 'workflow_progress') {
        broadcastRunEvent(runId, 'task:progress', payload)
      } else if (type === 'workflow_done') {
        broadcastRunEvent(runId, 'task:completed', payload)
      } else if (type === 'workflow_error') {
        broadcastRunEvent(runId, 'task:failed', payload)
      } else if (type === 'agent_waiting') {
        broadcastRunEvent(runId, 'permission:required', payload)
      } else if (type === 'browser:screenshot') {
        broadcastRunEvent(runId, 'browser:screenshot', payload)
      } else if (type === 'artifact:created') {
        broadcastRunEvent(runId, 'artifact:created', payload)
      } else if (type === 'action:journaled') {
        broadcastRunEvent(runId, 'action:journaled', payload)
      }
    }).catch((err) => {
      logger.warn(`[Socket.IO Broadcast] Failed to import socket service: ${err.message}`)
    })
  }

  getEventsForRun(runId: string, sinceSeqId: number = 0): SSEMessage[] {
    return this.cache.filter(msg => msg.runId === runId && msg.seqId > sinceSeqId)
  }

  clearRun(runId: string) {
    this.seqMap.delete(runId)
    this.cache = this.cache.filter(msg => msg.runId !== runId)
  }
}

export const runEmitter = new SSEEmitter()
