import { db } from './index'
import dotenv from 'dotenv'
dotenv.config()

const migration = `
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'hobby',
  credits_remaining INTEGER NOT NULL DEFAULT 500,
  credits_monthly INTEGER NOT NULL DEFAULT 500,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL DEFAULT 'You are a helpful customer support assistant. Answer questions based only on the provided knowledge base.',
  persona JSONB DEFAULT '{"tone": "professional", "language": "en"}',
  escalation_rules JSONB DEFAULT '{"keywords": ["human", "agent", "manager"], "low_confidence_threshold": 0.4}',
  config JSONB DEFAULT '{"model": "gpt-4o", "temperature": 0.3, "max_tokens": 800}',
  widget_config JSONB DEFAULT '{"primaryColor": "#B8FF00", "position": "bottom-right", "welcomeMessage": "Hi! How can I help you today?"}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf','url','text','csv','docx')),
  source_url TEXT,
  file_path TEXT,
  file_size INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed')),
  error_message TEXT,
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunks + vectors
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  chunk_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat index for fast similarity search
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS chunks_agent_id_idx ON chunks (agent_id);
CREATE INDEX IF NOT EXISTS chunks_tenant_id_idx ON chunks (tenant_id);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web','whatsapp','slack','email','api')),
  visitor_id TEXT,
  metadata JSONB DEFAULT '{}',
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_agent_id_idx ON conversations (agent_id);
CREATE INDEX IF NOT EXISTS conversations_session_id_idx ON conversations (session_id);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  confidence_score FLOAT,
  sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages (conversation_id);

-- Credit transactions log
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('usage','recharge','plan_change','bonus')),
  description TEXT,
  conversation_id UUID REFERENCES conversations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys (for widget + external API)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics aggregates (populated by cron)
CREATE TABLE IF NOT EXISTS analytics_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  resolved_conversations INTEGER DEFAULT 0,
  escalated_conversations INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  UNIQUE(agent_id, date)
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Leads captured by agents
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id UUID UNIQUE REFERENCES conversations(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  qualification_score INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  is_synced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_agent_id_idx ON leads (agent_id);

-- Updated Workflows (Orchestrated Pipelines)
DROP TABLE IF EXISTS workflows CASCADE;
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  original_prompt TEXT,
  type TEXT,
  status TEXT DEFAULT 'active',
  complexity TEXT,
  agent_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  total_api_calls INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflows_tenant_id_idx ON workflows (tenant_id);
CREATE OR REPLACE TRIGGER workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Workflow Agents
CREATE TABLE IF NOT EXISTS workflow_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  config JSONB DEFAULT '{"model": "qwen/qwen3-235b-a22b:free", "temperature": 0.3, "max_tokens": 2000, "tools_needed": []}',
  inputs_from_user JSONB DEFAULT '[]',
  inputs_from_previous JSONB DEFAULT '[]',
  output_type TEXT DEFAULT 'text',
  output_description TEXT,
  status TEXT DEFAULT 'idle',
  last_output JSONB,
  run_count INTEGER DEFAULT 0,
  avg_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Memory (Persistent Facts)
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES workflow_agents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  category TEXT DEFAULT 'fact',
  importance INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Runs
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'running',
  trigger TEXT DEFAULT 'manual',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_message TEXT,
  api_calls_used INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Steps
CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES workflow_agents(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  api_calls INTEGER DEFAULT 0
);

-- User API Vault
CREATE TABLE IF NOT EXISTS user_api_vault (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_encrypted TEXT NOT NULL,
  is_valid BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Schedules
CREATE TABLE IF NOT EXISTS workflow_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  cron_expression TEXT NOT NULL,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  is_active BOOLEAN DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ
);

-- Daily Reports
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  workflows_run INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  api_calls_used INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  highlights JSONB DEFAULT '[]',
  full_report_html TEXT,
  summary TEXT,
  metrics JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ
);

-- Agent Memory (Block 2.2)
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES workflow_agents(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  category TEXT DEFAULT 'fact',
  importance INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW()
);

-- Semantic Memory / Chunks (Block 2.3)
CREATE TABLE IF NOT EXISTS agent_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES workflow_agents(id) ON DELETE CASCADE,
  document_id TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536), 
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_memory_agent_id_idx ON agent_memory (agent_id);
CREATE INDEX IF NOT EXISTS agent_chunks_agent_id_idx ON agent_chunks (agent_id);
`

async function migrate() {
  console.log('🚀 Running migrations...')
  try {
    await db.query(migration)
    console.log('✅ Migrations complete')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    await db.end()
  }
}

migrate()
