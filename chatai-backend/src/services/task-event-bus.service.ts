import { EventEmitter } from 'events'
import { logger } from './logger.service'

export interface TaskStreamEvent {
  runId: string
  event: string
  data: any
  timestamp: string
}

class TaskEventBus extends EventEmitter {
  private runHistory: Map<string, TaskStreamEvent[]> = new Map()

  constructor() {
    super()
    this.setMaxListeners(100)
  }

  emitTaskEvent(runId: string, event: string, data: any) {
    const payload: TaskStreamEvent = {
      runId,
      event,
      data,
      timestamp: new Date().toISOString()
    }

    if (!this.runHistory.has(runId)) {
      this.runHistory.set(runId, [])
    }
    const history = this.runHistory.get(runId)!
    history.push(payload)
    if (history.length > 500) history.shift()

    logger.info(`[TaskEventBus] ${runId} -> ${event}: ${JSON.stringify(data).slice(0, 120)}`)
    this.emit(`run:${runId}`, payload)
    this.emit('global:task_event', payload)
  }

  getRunHistory(runId: string): TaskStreamEvent[] {
    return this.runHistory.get(runId) || []
  }

  subscribeRun(runId: string, listener: (event: TaskStreamEvent) => void): () => void {
    const channel = `run:${runId}`
    this.on(channel, listener)
    return () => {
      this.off(channel, listener)
    }
  }
}

export const taskEventBus = new TaskEventBus()
