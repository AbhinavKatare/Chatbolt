import axios from 'axios'
import { logger } from './logger.service'
import { actionJournalService } from './action-journal.service'

export interface GoSandboxExecOptions {
  execution_id?: string
  language: string
  code: string
  timeout_seconds?: number
  max_memory_mb?: number
  allow_network?: boolean
  custom_env?: Record<string, string>
  max_retries?: number
  tenant_id?: string
  run_id?: string
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
  retries_attempted?: number
  recovered?: boolean
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

  private getAuthHeaders(): Record<string, string> {
    const secret = process.env.INTERNAL_SERVICE_SECRET
    return secret ? { 'X-Internal-Service-Key': secret } : {}
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
      const res = await axios.get(`${this.baseUrl}/health`, { 
        timeout: 1500,
        headers: this.getAuthHeaders()
      })
      const healthy = res.status === 200 && res.data?.status === 'healthy'
      this.lastHealthCheck = { healthy, timestamp: now }
      return healthy
    } catch {
      this.lastHealthCheck = { healthy: false, timestamp: now }
      return false
    }
  }

  /**
   * Executes sandboxed code via the Go agent-runtime service with automated retry on failure
   */
  async executeSandboxCode(options: GoSandboxExecOptions): Promise<GoSandboxExecResult> {
    const url = `${this.baseUrl}/api/sandbox/exec`
    const maxRetries = options.max_retries ?? 2
    const tenantId = options.tenant_id || '00000000-0000-0000-0000-000000000000'
    const runId = options.run_id || options.execution_id || `run-sandbox-${Date.now()}`
    let lastResult: GoSandboxExecResult | null = null
    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const currentExecId = attempt === 1
        ? (options.execution_id || `node-req-${Date.now()}`)
        : `${options.execution_id || 'node-req'}-retry-${attempt}-${Date.now()}`

      logger.info(`[AgentRuntime] Dispatching sandbox execution (attempt ${attempt}/${maxRetries}): ${options.language} (id: ${currentExecId})`)

      try {
        const res = await axios.post<GoSandboxExecResult>(url, {
          execution_id: currentExecId,
          language: options.language,
          code: options.code,
          timeout_seconds: options.timeout_seconds || 30,
          max_memory_mb: options.max_memory_mb || 256,
          allow_network: options.allow_network ?? false,
          custom_env: options.custom_env || {},
        }, {
          timeout: ((options.timeout_seconds || 30) + 5) * 1000,
          headers: this.getAuthHeaders()
        })

        const result = res.data

        // If circuit breaker is open on Go side
        if (result.isolation_mode === 'circuit_broken') {
          await actionJournalService.logFailureRecovery({
            tenantId,
            runId,
            failureClass: 'go_runtime',
            errorMessage: result.stderr || 'Sandbox circuit breaker is OPEN',
            attemptNumber: attempt,
            recoveryAction: 'circuit_breaker_escalation',
            outcome: 'escalated',
            details: { execution_id: currentExecId, language: options.language },
          })
          return result
        }

        // If execution succeeded
        if (result.success) {
          if (attempt > 1) {
            result.retries_attempted = attempt - 1
            result.recovered = true
            await actionJournalService.logFailureRecovery({
              tenantId,
              runId,
              failureClass: 'go_runtime',
              errorMessage: `Execution recovered on attempt ${attempt}`,
              attemptNumber: attempt,
              recoveryAction: 'fresh_sandbox_retry',
              outcome: 'recovered',
              details: { execution_id: currentExecId, language: options.language },
            })
          }
          return result
        }

        // Failure within execution (timeout or crash)
        lastResult = result
        await actionJournalService.logFailureRecovery({
          tenantId,
          runId,
          failureClass: 'go_runtime',
          errorMessage: result.timed_out ? `Sandbox execution timed out after ${options.timeout_seconds || 30}s` : (result.stderr || `Process exited with code ${result.exit_code}`),
          attemptNumber: attempt,
          recoveryAction: attempt < maxRetries ? 'fresh_sandbox_retry' : 'escalate_to_caller',
          outcome: attempt < maxRetries ? 'failed' : 'escalated',
          details: { execution_id: currentExecId, timed_out: result.timed_out, exit_code: result.exit_code },
        })

      } catch (err: any) {
        lastError = err
        logger.warn(`[AgentRuntime] Sandbox HTTP error on attempt ${attempt}: ${err.message}`)
        await actionJournalService.logFailureRecovery({
          tenantId,
          runId,
          failureClass: 'go_runtime',
          errorMessage: err.message,
          attemptNumber: attempt,
          recoveryAction: attempt < maxRetries ? 'fresh_sandbox_retry' : 'escalate_to_caller',
          outcome: attempt < maxRetries ? 'failed' : 'escalated',
          details: { language: options.language },
        })
      }

      // Short delay before retry
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 100 * attempt))
      }
    }

    if (lastResult) {
      lastResult.retries_attempted = maxRetries - 1
      lastResult.recovered = false
      return lastResult
    }

    return {
      execution_id: options.execution_id || 'failed-exec',
      success: false,
      exit_code: 500,
      stdout: '',
      stderr: lastError ? lastError.message : 'Sandbox execution failed after retries',
      duration_ms: 0,
      peak_memory_bytes: 0,
      timed_out: false,
      isolation_mode: 'none',
      retries_attempted: maxRetries - 1,
      recovered: false,
    }
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
      headers: this.getAuthHeaders()
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
    const res = await axios.post(url, message, { 
      timeout: 3000,
      headers: this.getAuthHeaders()
    })
    return res.data
  }

  /**
   * Retrieves real-time CPU, RAM, active workers, and queue depth metrics from Go runtime
   */
  async getSystemMetrics(): Promise<GoSystemMetrics | null> {
    try {
      const res = await axios.get<GoSystemMetrics>(`${this.baseUrl}/metrics`, { 
        timeout: 2000,
        headers: this.getAuthHeaders()
      })
      return res.data
    } catch (err: any) {
      logger.warn(`[AgentRuntime] Failed to fetch Go metrics: ${err.message}`)
      return null
    }
  }

  /**
   * Applies targeted diff hunks to a sandboxed file in the Go runtime
   */
  async applyFileDiff(req: {
    filePath: string
    originalContent?: string
    hunks?: Array<{
      start_line: number
      end_line: number
      target_content: string
      replacement_content: string
      allow_multiple?: boolean
    }>
    unifiedDiff?: string
    fallbackToFull?: boolean
  }): Promise<{
    success: boolean
    file_path: string
    hunks_applied: number
    total_hunks: number
    patched_content?: string
    error?: string
    retry_with_context?: boolean
    stage?: string
  }> {
    try {
      const res = await axios.post(`${this.baseUrl}/api/sandbox/apply_diff`, {
        file_path: req.filePath,
        original_content: req.originalContent,
        hunks: req.hunks || [],
        unified_diff: req.unifiedDiff,
        fallback_to_full: req.fallbackToFull
      }, {
        timeout: 5000,
        headers: this.getAuthHeaders()
      })
      return res.data
    } catch (err: any) {
      if (err.response?.data) {
        return err.response.data
      }
      logger.warn(`[AgentRuntime] Failed to apply diff via Go service: ${err.message}`)
      return {
        success: false,
        file_path: req.filePath,
        hunks_applied: 0,
        total_hunks: (req.hunks || []).length,
        error: err.message,
        retry_with_context: true
      }
    }
  }

  /**
   * Retrieves circuit breaker states for agent roles and sandbox
   */
  async getCircuitBreakerStatus(): Promise<Record<string, GoCircuitBreakerState> | null> {
    try {
      const res = await axios.get<{ states: Record<string, GoCircuitBreakerState> }>(`${this.baseUrl}/api/circuit-breaker`, { 
        timeout: 2000,
        headers: this.getAuthHeaders()
      })
      return res.data?.states || null
    } catch (err: any) {
      logger.warn(`[AgentRuntime] Failed to fetch circuit breaker status: ${err.message}`)
      return null
    }
  }
}

export const agentRuntimeClient = new AgentRuntimeClient()

