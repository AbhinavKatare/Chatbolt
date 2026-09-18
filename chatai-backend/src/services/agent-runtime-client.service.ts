import axios from 'axios'
import { logger } from './logger.service'

export interface GoSandboxExecOptions {
  execution_id?: string
  language: string
  code: string
  timeout_seconds?: number
  max_memory_mb?: number
  allow_network?: boolean
  custom_env?: Record<string, string>
}

export interface GoSandboxExecResult {
  execution_id: string
  success: boolean
  exit_code: number
  stdout: string
  stderr: string
  duration_ms: number
  peak_memory_bytes: number
  timed_out: boolean
  isolation_mode: string
}

export interface GoSystemMetrics {
  cpu_percent: number
  memory_used_bytes: number
  memory_total_bytes: number
  memory_percent: number
  active_workers: number
  max_workers: number
  queued_tasks: number
  active_goroutines: number
  total_tasks_executed: number
  total_tasks_failed: number
  uptime_seconds: number
}

export interface GoCircuitBreakerState {
  target: string
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failure_count: number
  success_streak: number
  last_failure_ms: number
  cooldown_remaining_ms: number
}

class AgentRuntimeClient {
  private baseUrl: string
  private isEnabled: boolean
  private lastHealthCheck: { healthy: boolean; timestamp: number } = { healthy: false, timestamp: 0 }
  private readonly HEALTH_CACHE_TTL_MS = 5000

  constructor() {
    this.baseUrl = process.env.GO_RUNTIME_URL || 'http://localhost:8081'
    // Feature flag: enabled by default unless explicitly disabled
    this.isEnabled = process.env.USE_GO_RUNTIME !== 'false'
  }

  /**
   * Returns true if Go runtime feature flag is enabled and service is healthy
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isEnabled) return false

    const now = Date.now()
    if (now - this.lastHealthCheck.timestamp < this.HEALTH_CACHE_TTL_MS) {
      return this.lastHealthCheck.healthy
    }

    try {
      const res = await axios.get(`${this.baseUrl}/health`, { timeout: 1500 })
      const healthy = res.status === 200 && res.data?.status === 'healthy'
      this.lastHealthCheck = { healthy, timestamp: now }
      return healthy
    } catch {
      this.lastHealthCheck = { healthy: false, timestamp: now }
      return false
    }
  }

  /**
   * Executes sandboxed code via the Go agent-runtime service
   */
  async executeSandboxCode(options: GoSandboxExecOptions): Promise<GoSandboxExecResult> {
    const url = `${this.baseUrl}/api/sandbox/exec`
    logger.info(`[AgentRuntime] Dispatching sandbox execution to Go service: ${options.language} (id: ${options.execution_id || 'auto'})`)
    
    const res = await axios.post<GoSandboxExecResult>(url, {
      execution_id: options.execution_id || `node-req-${Date.now()}`,
      language: options.language,
      code: options.code,
      timeout_seconds: options.timeout_seconds || 30,
      max_memory_mb: options.max_memory_mb || 256,
      allow_network: options.allow_network ?? false,
      custom_env: options.custom_env || {},
    }, {
      timeout: ((options.timeout_seconds || 30) + 5) * 1000,
    })

    return res.data
  }

  /**
   * Executes an agent step and optionally streams status updates
   */
  async executeAgentStep(params: {
    run_id: string
    step_id: string
    tenant_id: string
    agent_id: string
    agent_role: string
    action_type: string
    payload_json: string
    timeout_seconds?: number
  }): Promise<any> {
    const url = `${this.baseUrl}/api/agent/step`
    const res = await axios.post(url, {
      ...params,
      timeout_seconds: params.timeout_seconds || 30,
    }, {
      timeout: ((params.timeout_seconds || 30) + 10) * 1000,
    })
    return res.data
  }

  /**
   * Publishes an event to the Go AgentBus pub/sub
   */
  async publishToAgentBus(message: {
    run_id: string
    sender_agent_id: string
    sender_role: string
    target_topic: string
    event_type: string
    payload_json: string
  }): Promise<{ message_id: string; delivered: boolean; subscriber_count: number }> {
    const url = `${this.baseUrl}/api/bus/publish`
    const res = await axios.post(url, message, { timeout: 3000 })
    return res.data
  }

  /**
   * Retrieves real-time CPU, RAM, active workers, and queue depth metrics from Go runtime
   */
  async getSystemMetrics(): Promise<GoSystemMetrics | null> {
    try {
      const res = await axios.get<GoSystemMetrics>(`${this.baseUrl}/metrics`, { timeout: 2000 })
      return res.data
    } catch (err: any) {
      logger.warn(`[AgentRuntime] Failed to fetch Go metrics: ${err.message}`)
      return null
    }
  }

  /**
   * Retrieves circuit breaker states for agent roles and sandbox
   */
  async getCircuitBreakerStatus(): Promise<Record<string, GoCircuitBreakerState> | null> {
    try {
      const res = await axios.get<{ states: Record<string, GoCircuitBreakerState> }>(`${this.baseUrl}/api/circuit-breaker`, { timeout: 2000 })
      return res.data?.states || null
    } catch (err: any) {
      logger.warn(`[AgentRuntime] Failed to fetch circuit breaker status: ${err.message}`)
      return null
    }
  }
}

export const agentRuntimeClient = new AgentRuntimeClient()
