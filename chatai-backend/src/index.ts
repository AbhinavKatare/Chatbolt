import { logger } from './services/logger.service';
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import cron from 'node-cron'
import { errorHandler } from './middleware/error.middleware'
import { db } from './db'

dotenv.config()

// Self-healing database schema migrations
async function runMigrations() {
  try {
    logger.info('🔄 Checking and applying database schema migrations...')
    
    // 1. Base Schema Migrations
    await db.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      -- Attempt to create vector extension, catch if unsupported
      DO $$
      BEGIN
        BEGIN
          CREATE EXTENSION IF NOT EXISTS vector;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE 'Vector extension not supported';
        END;
      END $$;
    `)

    await db.query(`
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
        source_type TEXT NOT NULL,
        source_url TEXT,
        file_path TEXT,
        file_size INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        chunk_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Conversations
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'web',
        visitor_id TEXT,
        metadata JSONB DEFAULT '{}',
        escalated BOOLEAN DEFAULT false,
        escalated_at TIMESTAMPTZ,
        resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Messages
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        confidence_score FLOAT,
        sources JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Workflows
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
    `)

    // Attempt to create vector-dependent tables, catch if pgvector is missing
    try {
      await db.query(`
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
        CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
        
        CREATE TABLE IF NOT EXISTS agent_chunks (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          agent_id UUID REFERENCES workflow_agents(id) ON DELETE CASCADE,
          document_id TEXT,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          embedding vector(1536), 
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS embedding vector(1536);
      `)
    } catch (e: any) {
      console.warn('⚠️ Vector/Chunks tables skipped or already present (pgvector might be disabled):', e.message)
    }

    // 2. Incremental & Workspace Schema Migrations
    await db.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS user_details TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS user_purpose TEXT;
      
      -- Streak and active date tracking
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_active_date DATE;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_reengagement_sent TIMESTAMPTZ;

      -- Workspace enterprise readiness
      ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS sso_domain TEXT;
      ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS workos_org_id TEXT;
      ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS custom_instructions TEXT;
      ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS data_region TEXT DEFAULT 'us';
    `)

    // Contacts / CRM table
    await db.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(300),
        phone VARCHAR(50),
        company VARCHAR(200),
        title VARCHAR(200),
        source VARCHAR(50) DEFAULT 'manual',
        status VARCHAR(50) DEFAULT 'lead',
        notes TEXT,
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, email)
      );
      CREATE INDEX IF NOT EXISTS contacts_tenant_idx ON contacts(tenant_id);
      CREATE INDEX IF NOT EXISTS contacts_status_idx ON contacts(tenant_id, status);
    `)

    // Contact interactions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS contact_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL,
        summary TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS contact_interactions_contact_idx ON contact_interactions(contact_id);
    `)

    // Custom tools table
    await db.query(`
      CREATE TABLE IF NOT EXISTS custom_tools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        endpoint_url TEXT NOT NULL,
        method VARCHAR(10) DEFAULT 'POST',
        auth_type VARCHAR(50) DEFAULT 'none',
        auth_value TEXT,
        auth_header VARCHAR(200),
        request_schema JSONB DEFAULT '{}',
        response_schema JSONB DEFAULT '{}',
        timeout_ms INTEGER DEFAULT 10000,
        is_active BOOLEAN DEFAULT true,
        call_count INTEGER DEFAULT 0,
        last_called_at TIMESTAMPTZ,
        avg_latency_ms FLOAT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS custom_tools_tenant_idx ON custom_tools(tenant_id);
    `)

    // Tool execution logs
    await db.query(`
      CREATE TABLE IF NOT EXISTS tool_execution_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tool_id UUID NOT NULL REFERENCES custom_tools(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL,
        payload JSONB DEFAULT '{}',
        response JSONB,
        status_code INTEGER,
        latency_ms INTEGER,
        error TEXT,
        success BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS tool_execution_logs_tool_idx ON tool_execution_logs(tool_id);
    `)

    // Workflow events table (for safety gate approvals)
    await db.query(`
      CREATE TABLE IF NOT EXISTS workflow_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS workflow_events_run_idx ON workflow_events(run_id);
    `)

    // Enrichment results table
    await db.query(`
      CREATE TABLE IF NOT EXISTS enrichment_results (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID        NOT NULL,
        company_name VARCHAR(500),
        domain      VARCHAR(500),
        result      JSONB       DEFAULT '{}',
        success     BOOLEAN     DEFAULT false,
        duration_ms INTEGER     DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS enrichment_results_tenant_idx
        ON enrichment_results(tenant_id, created_at DESC);
    `)

    // Phase 11-15 Enterprise Operating System Schema Additions
    await db.query(`
      -- Workspaces Table
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(200) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS workspaces_tenant_idx ON workspaces(tenant_id);

      -- Projects Table
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects(workspace_id);

      -- Hierarchy Alterations
      ALTER TABLE workflows ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
      ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
      ALTER TABLE custom_tools ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

      -- Agent Heartbeats & Budgets
      CREATE TABLE IF NOT EXISTS agent_heartbeats (
        agent_id UUID PRIMARY KEY REFERENCES workflow_agents(id) ON DELETE CASCADE,
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        status VARCHAR(50) DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'waiting', 'paused', 'blocked', 'failed', 'completed')),
        budget_allocated NUMERIC(10,4) DEFAULT 10.0000,
        budget_spent NUMERIC(10,4) DEFAULT 0.0000,
        current_task_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- First-Class Artifacts Table
      CREATE TABLE IF NOT EXISTS artifacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        artifact_type VARCHAR(50) NOT NULL CHECK (artifact_type IN ('pdf', 'spreadsheet', 'presentation', 'dataset', 'brief', 'website')),
        file_path TEXT,
        locked_by_user_id TEXT,
        locked_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{"linked_agents": [], "linked_memory": [], "source_tasks": []}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS artifacts_project_idx ON artifacts(project_id);
      CREATE INDEX IF NOT EXISTS artifacts_tenant_idx ON artifacts(tenant_id);

      -- Artifact Versions Table
      CREATE TABLE IF NOT EXISTS artifact_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        change_description TEXT DEFAULT '',
        created_by VARCHAR(100) NOT NULL DEFAULT 'agent',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS artifact_versions_artifact_idx ON artifact_versions(artifact_id);
    `)

    // Chatbolt Project SIGMA 4.0 Integrations & reliability migrations
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_integrations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        service TEXT NOT NULL,
        access_token_encrypted TEXT NOT NULL,
        refresh_token_encrypted TEXT,
        expires_at TIMESTAMPTZ,
        scopes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, service)
      );

      CREATE TABLE IF NOT EXISTS task_checkpoints (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        run_id UUID REFERENCES workflow_runs(id) ON DELETE CASCADE,
        step_index INTEGER,
        step_name TEXT,
        step_output JSONB DEFAULT '{}',
        status TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS action_journal (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        run_id TEXT,
        action_type TEXT NOT NULL,
        action_metadata JSONB DEFAULT '{}',
        is_reversible BOOLEAN DEFAULT true,
        reversed BOOLEAN DEFAULT false,
        undo_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE action_journal ADD COLUMN IF NOT EXISTS user_id UUID;
      ALTER TABLE action_journal ADD COLUMN IF NOT EXISTS action_payload JSONB DEFAULT '{}';
      ALTER TABLE action_journal ADD COLUMN IF NOT EXISTS reverse_payload JSONB DEFAULT '{}';
      ALTER TABLE action_journal ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
      ALTER TABLE action_journal ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ;
      ALTER TABLE action_journal ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

      ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS task_receipt JSONB;

      CREATE TABLE IF NOT EXISTS execution_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        user_id UUID NOT NULL,
        task_type TEXT,
        steps_total INTEGER,
        steps_completed INTEGER,
        retry_count INTEGER DEFAULT 0,
        outcome TEXT CHECK (outcome IN ('success', 'partial', 'failed')),
        duration_ms INTEGER
      );

      CREATE TABLE IF NOT EXISTS quality_gate_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        artifact_type TEXT NOT NULL,
        criterion TEXT NOT NULL,
        passed BOOLEAN NOT NULL
      );
    `);

    // Track 7: Task quality feedback table
    await db.query(`
      CREATE TABLE IF NOT EXISTS task_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        run_id UUID NOT NULL,
        rating INTEGER CHECK (rating IN (-1, 1)),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, run_id)
      );
      CREATE INDEX IF NOT EXISTS task_feedback_tenant_idx ON task_feedback(tenant_id);
    `).catch((e: any) => logger.warn('[Migration] task_feedback: ' + e.message));

    // Track 1: Team Workspaces migrations
    await db.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        plan VARCHAR(50) DEFAULT 'team',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS teams_owner_idx ON teams(owner_tenant_id);

      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(team_id, tenant_id)
      );
      CREATE INDEX IF NOT EXISTS team_members_team_idx ON team_members(team_id);
      CREATE INDEX IF NOT EXISTS team_members_tenant_idx ON team_members(tenant_id);

      CREATE TABLE IF NOT EXISTS team_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        invited_email VARCHAR(300) NOT NULL,
        invited_by UUID NOT NULL REFERENCES tenants(id),
        token VARCHAR(100) NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
        role VARCHAR(50) DEFAULT 'member',
        accepted BOOLEAN DEFAULT false,
        expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES tenants(id);
      ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
    `).catch((e: any) => logger.warn('[Migration] Teams tables: ' + e.message));

    await db.query(`
      CREATE TABLE IF NOT EXISTS event_trigger_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        trigger_type VARCHAR(100) NOT NULL,
        workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
        filter_config JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        last_fired_at TIMESTAMPTZ,
        fire_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS event_trigger_rules_tenant_idx ON event_trigger_rules(tenant_id);
    `).catch((e: any) => logger.warn('[Migration] event_trigger_rules: ' + e.message));

    // Track 4: Advanced memory columns
    await db.query(`ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'`).catch(() => null);
    await db.query(`ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS source TEXT`).catch(() => null);
    await db.query(`ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0.8`).catch(() => null);
    await db.query(`ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`).catch(() => null);

    // Production Hardening: DB schema bootstrap
    await db.query(`
      CREATE TABLE IF NOT EXISTS workspace_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        service VARCHAR(100) NOT NULL,
        access_token_encrypted TEXT NOT NULL,
        refresh_token_encrypted TEXT,
        expires_at TIMESTAMPTZ,
        scopes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(workspace_id, service)
      );

      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
        workflow_name VARCHAR(200) NOT NULL,
        cron_expression VARCHAR(100) NOT NULL,
        description TEXT DEFAULT '',
        task_prompt TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        last_triggered TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
        name VARCHAR(200) NOT NULL,
        key_hash VARCHAR(100) NOT NULL UNIQUE,
        key_prefix VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_artifacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        pinned_by UUID REFERENCES tenants(id) ON DELETE SET NULL,
        pinned_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_id, artifact_id)
      );

      CREATE TABLE IF NOT EXISTS user_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        prompt TEXT NOT NULL,
        task_type VARCHAR(100) DEFAULT 'other',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS task_type VARCHAR(100);
      ALTER TABLE event_trigger_rules ADD COLUMN IF NOT EXISTS task_prompt TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_preferences VARCHAR(100) DEFAULT 'in_app';
      ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS template_candidate BOOLEAN DEFAULT false;
    `).catch((e: any) => logger.warn('[Migration] Production Hardening bootstrap error: ' + e.message));

    // Launch & Growth Sprint Schema Additions
    await db.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        workspace_id UUID,
        plan VARCHAR(50) NOT NULL DEFAULT 'free',
        stripe_subscription_id TEXT,
        stripe_customer_id TEXT,
        status VARCHAR(50) DEFAULT 'active',
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS usage_counters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        workspace_id UUID,
        month VARCHAR(7) NOT NULL,
        tasks_run INTEGER DEFAULT 0,
        api_calls INTEGER DEFAULT 0,
        automations_active INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS usage_counters_user_month_idx ON usage_counters(user_id, month);

      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        referrer_user_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        code VARCHAR(8) UNIQUE NOT NULL,
        referred_user_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
        converted_at TIMESTAMPTZ,
        reward_granted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS task_shares (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        share_token VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        view_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE execution_metrics ADD COLUMN IF NOT EXISTS run_id UUID;
      ALTER TABLE execution_metrics ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
      ALTER TABLE execution_metrics ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
      ALTER TABLE execution_metrics ADD COLUMN IF NOT EXISTS step_count INTEGER;
      ALTER TABLE execution_metrics ADD COLUMN IF NOT EXISTS error_code TEXT;
      ALTER TABLE execution_metrics ADD COLUMN IF NOT EXISTS agent_types_used TEXT[];
      ALTER TABLE execution_metrics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
    `).catch((e: any) => logger.warn('[Migration] Launch & Growth Sprint bootstrap error: ' + e.message));

    // Subscription overages & nudges (must run AFTER subscriptions table is created above)
    await db.query(`
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS overage_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS overage_tasks_this_month INTEGER DEFAULT 0;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS annual_nudge_sent TIMESTAMPTZ;
    `).catch((e: any) => logger.warn('[Migration] Subscription columns error (safe to ignore if columns already exist): ' + e.message));

    logger.info('✅ Database schema checks complete.')

    // Check Supabase connectivity health
    try {
      const { supabase } = await import('./lib/supabase')
      await Promise.race([
        supabase.auth.getUser('dummy-token'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 3000))
      ])
    } catch (err: any) {
      logger.warn("WARNING: Supabase unreachable — running in offline mode. Auth will use local DB fallback. All features that require live Supabase (real-time, storage) will be unavailable.")
    }

    // Start jobs and watchers only after migrations complete successfully
    try {
      const { initDailyReports } = await import('./jobs/daily-report')
      const { initScheduler } = await import('./jobs/scheduler')
      const { startKeepAlive } = await import('./jobs/keep-alive')
      const { triggerWatcher } = await import('./services/trigger-watcher.service')
      const { fileCleanupService } = await import('./services/file-cleanup.service')
      const { actionJournalService } = await import('./services/action-journal.service')
      const { queueService } = await import('./services/queue.service')
      
      initDailyReports()
      initScheduler()
      startKeepAlive()
      triggerWatcher.start()
      fileCleanupService.start()
      
      // Daily activity digest email cron at 18:00
      cron.schedule('0 18 * * *', async () => {
        try {
          const { notificationService } = await import('./services/notification.service')
          await notificationService.sendDailyDigest()
        } catch (err: any) {
          logger.error('[Cron] Failed to run daily digest:', err.message)
        }
      })

      // Sunday value digest email cron at 18:00
      cron.schedule('0 18 * * 0', async () => {
        try {
          logger.info('[Cron] Starting Sunday weekly value digest run...')
          const { digestService } = await import('./services/digest.service')
          await digestService.sendWeeklyValueDigest()
        } catch (err: any) {
          logger.error('[Cron] Failed to run Sunday weekly digest:', err.message)
        }
      })

      // Daily re-engagement check cron at 10:00
      cron.schedule('0 10 * * *', async () => {
        try {
          logger.info('[Cron] Starting daily re-engagement check run...')
          const { digestService } = await import('./services/digest.service')
          await digestService.checkAndSendReengagement()
        } catch (err: any) {
          logger.error('[Cron] Failed to run daily re-engagement check:', err.message)
        }
      })
      
      actionJournalService.ensureTable().catch((err: any) => {
        console.warn('[Startup] Action journal table init skipped:', err.message)
      })
      
      queueService.initialize().catch(err => {
        console.error('[Startup] Failed to initialize queue service:', err)
      })
      
      // Start supervisor health audits every 60 seconds
      setInterval(async () => {
        try {
          const { supervisorService } = await import('./services/supervisor.service')
          await supervisorService.runHealthCheck()
        } catch (err: any) {
          console.error('[Supervisor Audit] Periodic check error:', err.message)
        }
      }, 60000)
      
      // ── Dev user seed (development only) ─────────────────────────────
      if (process.env.NODE_ENV !== 'production') {
        try {
          const bcrypt = await import('bcryptjs')
          const devEmail = 'test_user_1@chatbolt.ai'
          const devPassword = 'password123'
          const existing = await db.query('SELECT password_hash FROM tenants WHERE email = $1', [devEmail])
          const needsHash = existing.rows.length === 0 || !existing.rows[0].password_hash || existing.rows[0].password_hash === 'mock_hash'
          if (needsHash) {
            const hash = await bcrypt.default.hash(devPassword, 10)
            await db.query(`
              INSERT INTO tenants (name, email, password_hash, plan, credits_remaining, credits_monthly, is_active)
              VALUES ('Test User', $1, $2, 'pro', 10000, 10000, true)
              ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true
            `, [devEmail, hash])
            logger.info(`[Dev] Seeded dev user: ${devEmail} / ${devPassword}`)
          }
        } catch (seedErr: any) {
          console.warn('[Dev] Dev user seed skipped:', seedErr.message)
        }
      }

      logger.info('🚀 Backend services fully initialized after successful database migration.')
    } catch (startupErr: any) {
      console.error('❌ Error initializing services after migrations:', startupErr.message)
    }

  } catch (err: any) {
    console.error('❌ Failed to run database schema migrations:', err.message)
  }
}
runMigrations()


import authRoutes from './routes/auth'
import agentRoutes from './routes/agents'
import documentRoutes from './routes/documents'
import chatRoutes from './routes/chat'
import billingRoutes from './routes/billing'
import analyticsRoutes from './routes/analytics'
import apiKeyRoutes from './routes/apikeys'
import widgetRoutes from './routes/widget'
import autopilotRoutes from './routes/autopilot'
import webhookRoutes from './routes/webhooks'
import calendarRoutes from './routes/calendar'
import workflowRoutes from './routes/workflows'
import reportsRoutes from './routes/reports'
import pluginRoutes from './routes/plugins'
import contactRoutes from './routes/contacts'
import customToolRoutes from './routes/custom-tools'
import enrichmentRoutes from './routes/enrichment'
import workspaceRoutes from './routes/workspace'
import artifactRoutes from './routes/artifact'
import integrationsRoutes from './routes/integrations'
import actionRoutes from './routes/actions'
import taskRoutes from './routes/tasks'
import teamRoutes from './routes/teams'
import automationRoutes from './routes/automations'
import memoryRoutes from './routes/memory'
import publicApiRoutes from './routes/public-api'
import multimodalRoutes from './routes/multimodal'
import templatesRoutes from './routes/templates'
import referralsRoutes from './routes/referrals'
import sharesRoutes from './routes/shares'
import { authMiddleware } from './middleware/auth.middleware'


import { initDailyReports } from './jobs/daily-report'
import { initScheduler } from './jobs/scheduler'
import { startKeepAlive } from './jobs/keep-alive'
import { queueService } from './services/queue.service'

import { createServer } from 'http'
import { initSocketServer } from './services/socket.service'

const app = express()
const PORT = process.env.PORT || 4000
const server = createServer(app)
initSocketServer(server)

// Startup services are now deferred and launched after migrations finish in runMigrations().

// ── Stripe webhook needs raw body ─────────────────────────────────
app.use('/billing/webhook', express.raw({ type: 'application/json' }))

// ── Global middleware ─────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    /\.yourdomain\.com$/,  // allow all subdomains — update this
  ],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-api-key'],
}))

app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Rate limiting ─────────────────────────────────────────────────
const globalLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  message: { error: 'Too many requests, please slow down.' },
})

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts.' },
})

const chatLimit = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  message: { error: 'Too many messages. Please slow down.' },
})

app.use(globalLimit)

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
})

app.get('/api/health', async (_, res) => {
  try {
    await db.query('SELECT 1 FROM tenants LIMIT 1')
    res.json({ status: 'ok', db: 'connected', uptime: process.uptime() })
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'error' })
  }
})


// ── Routes ────────────────────────────────────────────────────────
app.use('/auth', authLimit, authRoutes)
app.use('/agents', agentRoutes)
app.use('/agents', documentRoutes)          // /agents/:agentId/documents/...
app.use('/chat', chatLimit, chatRoutes)
app.use('/billing', billingRoutes)
app.use('/analytics', analyticsRoutes)
app.use('/api-keys', apiKeyRoutes)
app.use('/autopilot', autopilotRoutes)
app.use('/webhooks', webhookRoutes)
app.use('/calendar', calendarRoutes)
app.use('/workflows', workflowRoutes)
app.use('/reports', reportsRoutes)
app.use('/plugins', pluginRoutes)
app.use('/contacts', contactRoutes)
app.use('/custom-tools', customToolRoutes)
app.use('/enrich', enrichmentRoutes)
app.use('/workspaces', workspaceRoutes)
app.use('/artifacts', artifactRoutes)
app.use('/integrations', integrationsRoutes)
app.use('/api/integrations', integrationsRoutes)
app.use('/api/actions', actionRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/templates', templatesRoutes)

app.post('/api/runs/:runId/actions/:actionId/approve', authMiddleware, async (req, res) => {
  const { runId, actionId } = req.params
  try {
    const { resumeStep } = await import('./services/workflow-engine.service')
    const success = await resumeStep(runId, actionId, 'approved')
    if (success) {
      return res.json({ success: true, message: 'Resumed step successfully' })
    } else {
      return res.status(400).json({ error: 'Failed to resume step' })
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// GET /api/invites/:token — Accept invitation and redirect
app.get('/api/invites/:token', async (req, res) => {
  try {
    const { token } = req.params
    const inviteRes = await db.query(
      `SELECT ti.*, t.name as team_name 
       FROM team_invites ti 
       JOIN teams t ON ti.team_id = t.id
       WHERE ti.token = $1`,
      [token]
    )
    const invite = inviteRes.rows[0]
    if (!invite) {
      return res.status(404).send('<h1>Invitation link is invalid or has expired</h1>')
    }

    if (invite.accepted) {
      return res.redirect((process.env.FRONTEND_URL || 'http://localhost:3000') + '/dashboard')
    }

    // Check if tenant exists matching invited_email
    const tenantRes = await db.query(
      'SELECT id FROM tenants WHERE LOWER(email) = LOWER($1)',
      [invite.invited_email]
    )
    const tenant = tenantRes.rows[0]

    if (tenant) {
      // Add user to team_members
      await db.query(
        `INSERT INTO team_members (team_id, tenant_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (team_id, tenant_id) DO NOTHING`,
        [invite.team_id, tenant.id, invite.role || 'member']
      )

      // Mark invite as accepted
      await db.query(
        'UPDATE team_invites SET accepted = true WHERE id = $1',
        [invite.id]
      )

      logger.info(`[Invites] Auto-accepted invite: team ${invite.team_id} for tenant ${tenant.id}`)
      return res.redirect((process.env.FRONTEND_URL || 'http://localhost:3000') + '/dashboard')
    } else {
      // Redirect to signup with email and token
      const emailEnc = encodeURIComponent(invite.invited_email)
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/signup?email=${emailEnc}&inviteToken=${token}`
      )
    }
  } catch (err: any) {
    logger.error('[Invites] Error accepting invite token: ' + err.message)
    return res.status(500).send('<h1>Server error processing invitation</h1>')
  }
})

app.use('/teams', teamRoutes)
app.use('/automations', automationRoutes)
app.use('/memory', memoryRoutes)
app.use('/api/v1', publicApiRoutes)
app.use('/multimodal', multimodalRoutes)
app.use('/api/referrals', referralsRoutes)
app.use('/referrals', referralsRoutes)
app.use('/api/shares', sharesRoutes)
app.use('/shares', sharesRoutes)

app.get('/chatai-extension', (req, res) => {
  try {
    const { execSync } = require('child_process')
    const path = require('path')
    const fs = require('fs')

    const extDir = path.resolve(__dirname, '../../chatai-extension')
    const zipPath = path.resolve(__dirname, '../chatbolt-extension.zip')
    
    // Package using native Windows tar
    execSync(`tar -a -c -f "${zipPath}" -C "${extDir}" .`, { stdio: 'ignore' })
    
    res.download(zipPath, 'chatbolt-extension.zip', () => {
      try { fs.unlinkSync(zipPath) } catch {}
    })
  } catch (err: any) {
    res.status(500).send('Failed to package extension: ' + err.message)
  }
})

app.use('/', widgetRoutes)                  // /widget.js and /widget/:agentId

// ── 404 handler ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Global error handler ──────────────────────────────────────────
app.use(errorHandler);


// ── Initialize Jobs ───────────────────────────────────────────────
initDailyReports();

server.listen(PORT, () => {
  logger.info(`
🚀 Chatbolt Backend running on port ${PORT}
📊 Dashboard:  ${process.env.FRONTEND_URL}
🔧 Health:     http://localhost:${PORT}/health
🌍 Env:        ${process.env.NODE_ENV || 'development'}
  `)
})

export default app
