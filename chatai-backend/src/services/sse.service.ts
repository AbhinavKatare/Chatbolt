import { EventEmitter } from 'events'

export type SSEEvent = 
  | 'workflow_start'
  | 'thinking_delta'
  | 'agent_start'
  | 'agent_progress'
  | 'tool_call'
  | 'tool_result'
  | 'agent_done'
  | 'agent_error'
  | 'agent_retry'
  | 'workflow_done'
  | 'workflow_error'

export interface SSEMessage {
  type: SSEEvent
  runId: string
  workflowId?: string
  agentId?: string
  data?: any
  timestamp: string
}

class SSEEmitter extends EventEmitter {
  emitEvent(runId: string, type: SSEEvent, data?: any, workflowId?: string, agentId?: string) {
    const message: SSEMessage = {
      type,
      runId,
      workflowId,
      agentId,
      data,
      timestamp: new Date().toISOString()
    }
    this.emit(`run:${runId}`, message)
    console.log(`[SSE] ${type} for run ${runId}`)
  }
}

export const runEmitter = new SSEEmitter()
