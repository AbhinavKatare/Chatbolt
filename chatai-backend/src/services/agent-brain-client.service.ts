import axios from 'axios'
import { logger } from './logger.service'

export interface BrainToolDefinition {
  name: str
  description: string
  parameters?: Record<string, any>
}

export interface BrainToolCall {
  call_id: string
  tool_name: string
  arguments: Record<string, any>
}

export interface BrainMessageItem {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'observation'
  content: string
  tool_calls?: BrainToolCall[]
  tool_call_id?: string
}

export interface BrainProviderConfig {
  provider?: 'openai' | 'anthropic' | 'nvidia' | 'nim' | 'google' | 'gemini' | 'custom' | 'openai_compatible' | 'ollama' | 'groq' | 'openrouter'
  model?: string
  api_key?: string // Decrypted, short-lived ephemeral key passed per request
  base_url?: string
  temperature?: number
  max_tokens?: number
}

export interface BrainStepRequest {
  run_id: string
  step_id?: string
  agent_id?: string
  agent_role: string
  agent_name?: string
  system_prompt?: string
  task: string
  context?: string
  history?: BrainMessageItem[]
  available_tools?: BrainToolDefinition[]
  provider_config?: BrainProviderConfig
  max_steps?: number
  step_number?: number
}

export interface BrainStepResponse {
  run_id: string
  step_id?: string
  status: 'tool_call_required' | 'completed' | 'failed' | 'max_steps_reached'
  thought?: string
  tool_calls: BrainToolCall[]
  final_output?: string
  error?: string
  duration_ms: number
  tokens_used: number
}

type str = string

class AgentBrainClient {
  private baseUrl: string
  private isEnabled: boolean
  private migratedRoles: Set<string>
  private lastHealthCheck: { healthy: boolean; timestamp: number } = { healthy: false, timestamp: 0 }
  private readonly HEALTH_CACHE_TTL_MS = 5000

  constructor() {
    this.baseUrl = process.env.AGENT_BRAIN_URL || 'http://localhost:8082'
    this.isEnabled = process.env.USE_PYTHON_AGENT_BRAIN !== 'false'
    
    // Migrated roles enabled for Python LangGraph reasoning loop
    const rolesStr = process.env.AGENT_BRAIN_ROLES || 'researcher,writer,code,analyst,planner'
    this.migratedRoles = new Set(rolesStr.split(',').map(r => r.trim().toLowerCase()))
  }

  /**
   * Checks if an agent role is configured to run through the Python Agent-Brain
   */
  isRoleMigrated(role: string): boolean {
    if (!this.isEnabled) return false
    return this.migratedRoles.has(role.toLowerCase())
  }

  /**
   * Health check with caching
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
   * Executes a single ReAct reasoning step via the Python agent-brain service
   */
  async executeStep(request: BrainStepRequest): Promise<BrainStepResponse> {
    const url = `${this.baseUrl}/agent/step`
    logger.info(`[AgentBrain] Sending ReAct step for role '${request.agent_role}' (run: ${request.run_id})`)

    const res = await axios.post<BrainStepResponse>(url, request, {
      timeout: 60000,
    })

    return res.data
  }
}

export const agentBrainClient = new AgentBrainClient()
