import { EventEmitter } from 'events'
import { logger } from '../services/logger.service'

export interface AgentBusMessage {
  id: string
  fromAgentId: string
  toAgentId?: string // undefined for broadcast
  channel: string
  teamId?: string
  messageType: 'task_assignment' | 'task_result' | 'tool_request' | 'peer_query' | 'supervisor_alert' | 'system'
  payload: any
  timestamp: string
}

export type AgentBusHandler = (message: AgentBusMessage) => Promise<void> | void

export class AgentBusService {
  private emitter: EventEmitter
  private messageHistory: Map<string, AgentBusMessage[]> = new Map()
  private MAX_HISTORY_PER_CHANNEL = 200

  constructor() {
    this.emitter = new EventEmitter()
    this.emitter.setMaxListeners(200) // Support 20+ concurrent agents with multiple subscriptions
  }

  /**
   * Publishes a message to a channel
   */
  async publish(channel: string, message: Omit<AgentBusMessage, 'id' | 'timestamp' | 'channel'>): Promise<AgentBusMessage> {
    const fullMessage: AgentBusMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      channel,
      ...message
    }

    // Save in in-memory channel history
    if (!this.messageHistory.has(channel)) {
      this.messageHistory.set(channel, [])
    }
    const history = this.messageHistory.get(channel)!
    history.push(fullMessage)
    if (history.length > this.MAX_HISTORY_PER_CHANNEL) {
      history.shift()
    }

    // Emit event for channel and targeted direct message
    this.emitter.emit(channel, fullMessage)
    if (fullMessage.toAgentId && channel !== `agent:${fullMessage.toAgentId}`) {
      this.emitter.emit(`agent:${fullMessage.toAgentId}`, fullMessage)
    }

    // Also emit to team channel if teamId present
    if (fullMessage.teamId && channel !== `team:${fullMessage.teamId}`) {
      this.emitter.emit(`team:${fullMessage.teamId}`, fullMessage)
    }

    return fullMessage
  }

  /**
   * Subscribes an agent or listener to a channel
   */
  subscribe(channel: string, handler: AgentBusHandler): () => void {
    this.emitter.on(channel, handler)
    return () => {
      this.emitter.off(channel, handler)
    }
  }

  /**
   * Sends a direct peer-to-peer message between two agents
   */
  async sendDirect(fromAgentId: string, toAgentId: string, payload: any, teamId?: string): Promise<AgentBusMessage> {
    return this.publish(`agent:${toAgentId}`, {
      fromAgentId,
      toAgentId,
      teamId,
      messageType: 'peer_query',
      payload
    })
  }

  /**
   * Broadcasts a message to an entire team channel
   */
  async broadcastToTeam(teamId: string, fromAgentId: string, payload: any, messageType: AgentBusMessage['messageType'] = 'task_assignment'): Promise<AgentBusMessage> {
    return this.publish(`team:${teamId}`, {
      fromAgentId,
      teamId,
      messageType,
      payload
    })
  }

  /**
   * Alerts the supervisor / TeamLead
   */
  async alertSupervisor(teamId: string, fromAgentId: string, alert: any): Promise<AgentBusMessage> {
    logger.warn(`[AgentBus] Supervisor Alert from '${fromAgentId}' (team: ${teamId}): ${JSON.stringify(alert)}`)
    return this.publish(`team:${teamId}:supervisor`, {
      fromAgentId,
      teamId,
      messageType: 'supervisor_alert',
      payload: alert
    })
  }

  /**
   * Retrieves message history for a channel
   */
  getChannelHistory(channel: string, limit = 50): AgentBusMessage[] {
    const history = this.messageHistory.get(channel) || []
    return history.slice(-limit)
  }

  /**
   * Clears channel history (for tests / cleanup)
   */
  clearHistory(): void {
    this.messageHistory.clear()
    this.emitter.removeAllListeners()
  }
}

export const agentBus = new AgentBusService()
