-- Track 1: Team Workspaces Migration
-- Run this against your PostgreSQL database to add team collaboration tables.

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
