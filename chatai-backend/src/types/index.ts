export interface Tenant {
  id: string
  name: string
  email: string
  plan: 'hobby' | 'standard' | 'pro' | 'enterprise'
  credits_remaining: number
  credits_monthly: number
  stripe_customer_id?: string
  stripe_subscription_id?: string
  is_active: boolean
  created_at: Date
}

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
