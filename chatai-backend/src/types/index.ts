export interface Tenant {
  id: string
  name: string
  email: string
  plan: 'hobby' | 'standard' | 'pro' | 'enterprise'
  credits_remaining: number
  credits_monthly: number
  stripe_customer_id?: string
  stripe_subscription_id?: string
  supabase_user_id?: string
  is_active: boolean
  created_at: Date
}

// Workflow Orchestration
export interface Workflow {
  id: string
  tenant_id: string
  name: string
  description?: string
  original_prompt?: string
  type: 'sequential' | 'parallel' | 'conditional'
  status: 'draft' | 'configured' | 'active' | 'paused' | 'archived'
  config: {
    schedule?: string
    webhook_token?: string
    model_override?: string
    timezone?: string
  }
  run_count: number
  last_run_at?: Date
  next_run_at?: Date
  created_at: Date
  updated_at: Date
}

export interface WorkflowAgent {
  id: string
  workflow_id: string
  tenant_id: string
  position: number
  name: string
  role: string
  description: string
  system_prompt: string
  config: {
    model: string
    temperature: number
    max_tokens: number
    tools_needed: string[]
    knowledge_base_ids?: string[]
    api_vault_ids?: string[]
  }
  inputs_from_user: WorkflowInputDefinition[]
  inputs_from_previous: string[]
  output_type: string
  output_description: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  last_output?: any
  created_at: Date
}

export interface WorkflowInputDefinition {
  field: string
  question: string
  type: 'text' | 'email' | 'url' | 'file' | 'number' | 'boolean'
  required: boolean
}

export interface AgentOutput {
  success: boolean
  data: any
  summary: string
  output_type: string
  confidence: number
  error?: string
  metadata: {
    duration_ms: number
    tokens_used: number
    tools_used: string[]
    retries: number
  }
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  tenant_id: string
  status: 'running' | 'completed' | 'failed' | 'timeout'
  trigger: 'manual' | 'webhook' | 'schedule'
  input_data: Record<string, any>
  output_data?: any
  error_message?: string
  duration_ms: number
  credits_used: number
  created_at: Date
  completed_at?: Date
}

export interface WorkflowStep {
  id: string
  run_id: string
  agent_id: string
  step_number: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retry' | 'timeout'
  input_data: any
  output_data?: AgentOutput
  error_message?: string
  duration_ms: number
  started_at?: Date
  completed_at?: Date
}

export interface AgentMemory {
  id: string
  agent_id: string
  tenant_id: string
  key: string
  value: string
  category: string
  importance: number
  created_at: Date
  last_accessed: Date
}

export interface UserApiVault {
  id: string
  tenant_id: string
  service_name: string
  display_name: string
  key_hash: string
  key_encrypted: string
  is_valid: boolean
  last_verified_at?: Date
  last_used_at?: Date
  created_at: Date
}

// Chatbot (Legacy/Parallel System)
export interface Agent {
  id: string
  tenant_id: string
  name: string
  description?: string
  system_prompt: string
  persona: AgentPersona
  escalation_rules: EscalationRules
  config: AgentConfig
  widget_config: WidgetConfig
  is_active: boolean
  created_at: Date
}

export interface AgentPersona {
  tone: 'professional' | 'friendly' | 'casual' | 'formal'
  language: string
  name?: string
  avatar?: string
}

export interface EscalationRules {
  keywords: string[]
  low_confidence_threshold: number
  always_escalate_topics?: string[]
}

export interface AgentConfig {
  model: string
  temperature: number
  max_tokens: number
}

export interface WidgetConfig {
  primaryColor: string
  position: 'bottom-right' | 'bottom-left'
  welcomeMessage: string
  placeholder?: string
}

export interface Document {
  id: string
  agent_id: string
  tenant_id: string
  filename: string
  source_type: 'pdf' | 'url' | 'text' | 'csv' | 'docx'
  source_url?: string
  file_path?: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  error_message?: string
  chunk_count: number
  created_at: Date
}

export interface Chunk {
  id: string
  document_id: string
  agent_id: string
  tenant_id: string
  content: string
  embedding?: number[]
  metadata: Record<string, any>
  chunk_index: number
}

export interface Conversation {
  id: string
  agent_id: string
  tenant_id: string
  session_id: string
  channel: 'web' | 'whatsapp' | 'slack' | 'email' | 'api'
  escalated: boolean
  resolved: boolean
  created_at: Date
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tokens_used: number
  confidence_score?: number
  sources?: ChunkSource[]
  created_at: Date
}

export interface ChunkSource {
  chunk_id: string
  document_id: string
  filename: string
  similarity: number
  excerpt: string
}

export interface JwtPayload {
  tenantId: string
  email: string
  plan: string
  iat?: number
  exp?: number
}

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant
      tenantId?: string
    }
  }
}
