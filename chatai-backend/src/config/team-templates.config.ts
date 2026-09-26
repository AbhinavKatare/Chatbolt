/**
 * Team Templates Configuration
 * Defines starter blueprints for specialized multi-agent workforce teams.
 */

export type AutonomyLevel = 'observe_only' | 'suggest_only' | 'act_with_approval' | 'fully_autonomous'

export interface TeamAgentRoleConfig {
  role: string
  name: string
  title: string
  description: string
  system_prompt: string
  model?: string
  temperature?: number
  tools_available: Array<{
    name: string
    description: string
    parameters?: Record<string, any>
  }>
  autonomy_level?: AutonomyLevel
  is_lead?: boolean
}

export interface EscalationPolicy {
  require_human_approval_for: string[]
  max_iterations_before_escalation: number
  auto_notify_channels?: string[]
  on_error_strategy: 'pause_and_notify' | 'retry_with_lead' | 'abort'
}

export interface TeamTemplate {
  id: string
  name: string
  category: 'marketing' | 'technical' | 'operations' | 'custom'
  description: string
  mission: string
  lead_role: string
  autonomy_level?: AutonomyLevel
  roles: TeamAgentRoleConfig[]
  escalation_policy: EscalationPolicy
  suggested_tasks: string[]
}

export const TEAM_TEMPLATES: Record<string, TeamTemplate> = {
  marketing: {
    id: 'marketing-team-v1',
    name: 'Autonomous Marketing Team',
    category: 'marketing',
    description: 'Autonomous workforce for market research, SEO content creation, copywriting, and social campaign generation.',
    mission: 'Produce high-converting, fact-checked, SEO-optimized marketing campaigns and technical positioning assets.',
    lead_role: 'team_lead',
    escalation_policy: {
      require_human_approval_for: ['publish_live_campaign', 'send_external_email', 'spend_ad_budget'],
      max_iterations_before_escalation: 5,
      auto_notify_channels: ['dashboard', 'email'],
      on_error_strategy: 'retry_with_lead'
    },
    roles: [
      {
        role: 'team_lead',
        name: 'Marketing Director AI',
        title: 'Team Lead & Strategist',
        description: 'Decomposes high-level marketing goals, coordinates researchers and writers, and aggregates final deliverables.',
        is_lead: true,
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.3,
        system_prompt: `You are the Marketing Director and Team Lead for an elite autonomous AI marketing agency.
Your role:
1. Receive high-level marketing missions from humans.
2. Decompose missions into atomic, actionable assignments.
3. Delegate tasks to specialized team members (Researcher, Writer, Analyst) using the delegate_task tool.
4. Read and write shared team knowledge using query_team_memory and save_team_memory.
5. Review work products, ensure high brand cohesion and tone, and synthesize the final deliverable for the user.`,
        tools_available: [
          { name: 'delegate_task', description: 'Assign an actionable subtask to a team member (researcher, writer, analyst)' },
          { name: 'query_team_memory', description: 'Retrieve shared team facts, brand guidelines, and research insights' },
          { name: 'save_team_memory', description: 'Store a verified finding, asset link, or campaign decision in shared team memory' },
          { name: 'request_human_guidance', description: 'Ask the human user for feedback, clarification, or approval' },
          { name: 'synthesize_final_report', description: 'Compile all team outputs into a finalized, formatted markdown reviewable deliverable' }
        ],
        autonomy_level: 'supervised'
      },
      {
        role: 'researcher',
        name: 'Market Intelligence AI',
        title: 'Senior Market & SEO Researcher',
        description: 'Conducts deep competitor analysis, market trend discovery, and citation gathering.',
        model: 'openai/gpt-4o',
        temperature: 0.2,
        system_prompt: `You are the Lead Market Researcher. Analyze competitor landscape, extract data points, and verify facts. Store key findings in shared team memory.`,
        tools_available: [
          { name: 'web_search', description: 'Search the web for competitor data, industry trends, and citations' },
          { name: 'fetch_page_content', description: 'Fetch and parse text content from a target URL' },
          { name: 'extract_citations', description: 'Extract and format verifiable references from research material' },
          { name: 'save_team_memory', description: 'Save discovered market data into team memory' }
        ],
        autonomy_level: 'autonomous'
      },
      {
        role: 'writer',
        name: 'Copywriting & Content AI',
        title: 'Senior Copywriter',
        description: 'Drafts high-converting blog posts, email sequences, landing page copy, and social threads.',
        model: 'openai/gpt-4o-mini',
        temperature: 0.6,
        system_prompt: `You are an expert Copywriter and Content Creator. Craft compelling, persuasive, and clear copy tailored to the target audience using facts retrieved from team memory.`,
        tools_available: [
          { name: 'query_team_memory', description: 'Query team memory for research findings, brand voice, and facts' },
          { name: 'grammar_check', description: 'Validate copy structure, readability score, and tone' },
          { name: 'format_markdown', description: 'Format and structure copy into presentation-ready Markdown' }
        ],
        autonomy_level: 'autonomous'
      },
      {
        role: 'analyst',
        name: 'Performance Analyst AI',
        title: 'Growth & SEO Analyst',
        description: 'Evaluates SEO keyword density, headline scores, and conversion probability.',
        model: 'meta-llama/llama-3.3-70b-instruct',
        temperature: 0.1,
        system_prompt: `You are the Growth & Analytics Specialist. Audit drafts for SEO keywords, clickability, and actionable CTAs.`,
        tools_available: [
          { name: 'query_team_memory', description: 'Fetch copy drafts from team memory to audit' },
          { name: 'seo_keyword_density', description: 'Analyze keyword volume, search intent, and distribution' },
          { name: 'sentiment_check', description: 'Measure emotional resonance and clarity' }
        ],
        autonomy_level: 'autonomous'
      }
    ],
    suggested_tasks: [
      'Launch comprehensive product announcement campaign for Chatbolt Autonomous Teams',
      'Conduct competitive teardown against LangChain / CrewAI with SEO comparison article',
      'Create 5-part email nurturing sequence for enterprise leads'
    ]
  },

  technical: {
    id: 'technical-team-v1',
    name: 'Autonomous Technical Engineering Team',
    category: 'technical',
    description: 'Engineering squad for architecture planning, sandboxed code implementation, unit testing, and debugging.',
    mission: 'Design, implement, verify, and document robust software solutions through sandboxed execution.',
    lead_role: 'team_lead',
    escalation_policy: {
      require_human_approval_for: ['git_push_main', 'delete_production_database', 'deploy_to_cloud'],
      max_iterations_before_escalation: 8,
      auto_notify_channels: ['dashboard', 'slack'],
      on_error_strategy: 'pause_and_notify'
    },
    roles: [
      {
        role: 'team_lead',
        name: 'Lead Architect AI',
        title: 'Principal Software Architect & Lead',
        description: 'Breaks architectural specs into technical tasks, assigns to Code and QA agents, and validates end-to-end integration.',
        is_lead: true,
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.2,
        system_prompt: `You are the Principal Software Architect and Technical Lead.
Your role:
1. Break technical specifications into atomic coding and testing tasks.
2. Delegate to Code and QA agents.
3. Review test reports and diffs in shared team memory.
4. Synthesize final implementation summaries and architecture docs.`,
        tools_available: [
          { name: 'delegate_task', description: 'Assign coding or testing subtask to a technical team member' },
          { name: 'query_team_memory', description: 'Inspect shared architectural decisions, code snippets, and test outputs' },
          { name: 'save_team_memory', description: 'Save architectural blueprints or API schemas to shared team memory' },
          { name: 'request_human_guidance', description: 'Request human developer review or permission for risky operations' },
          { name: 'synthesize_final_report', description: 'Generate final technical report, diff review, and deployment checklist' }
        ],
        autonomy_level: 'supervised'
      },
      {
        role: 'researcher',
        name: 'API & Dependency Analyst AI',
        title: 'Tech Researcher',
        description: 'Researches library documentation, SDK breaking changes, and external API specifications.',
        model: 'openai/gpt-4o',
        temperature: 0.1,
        system_prompt: `You are the Technical Researcher. Find exact API specs, library signatures, and best practices.`,
        tools_available: [
          { name: 'web_search', description: 'Search GitHub, StackOverflow, and official docs' },
          { name: 'fetch_page_content', description: 'Extract code samples and API documentation' },
          { name: 'save_team_memory', description: 'Save technical schemas to team memory' }
        ],
        autonomy_level: 'autonomous'
      },
      {
        role: 'code',
        name: 'Full-Stack Developer AI',
        title: 'Senior Software Engineer',
        description: 'Implements code, creates patches, and iterates in Go isolated sandbox.',
        model: 'qwen/qwen-2.5-coder-32b-instruct',
        temperature: 0.1,
        system_prompt: `You are the Senior Software Engineer. Implement clean, robust code according to specifications and test it in the sandbox.`,
        tools_available: [
          { name: 'file_read', description: 'Read files from the workspace' },
          { name: 'file_write', description: 'Write or modify code files' },
          { name: 'execute_sandbox_code', description: 'Execute Node/Python/Go code safely inside Go agent-runtime sandbox' },
          { name: 'git_diff', description: 'Inspect current uncommitted changes' },
          { name: 'save_team_memory', description: 'Save code summaries or test outputs to team memory' }
        ],
        autonomy_level: 'autonomous'
      },
      {
        role: 'qa',
        name: 'Test Automation AI',
        title: 'QA & Verification Specialist',
        description: 'Generates unit and integration tests, executes test suites, and flags regression bugs.',
        model: 'meta-llama/llama-3.3-70b-instruct',
        temperature: 0.1,
        system_prompt: `You are the QA Automation Specialist. Write rigorous unit and integration tests, run test commands, and report pass/fail status.`,
        tools_available: [
          { name: 'execute_sandbox_code', description: 'Run test runners and inspect exit codes/logs' },
          { name: 'query_team_memory', description: 'Retrieve newly written code from team memory' },
          { name: 'save_team_memory', description: 'Save test pass/fail metrics to team memory' }
        ],
        autonomy_level: 'autonomous'
      }
    ],
    suggested_tasks: [
      'Implement REST endpoints for Webhook event streaming with HMAC signature verification',
      'Refactor authentication middleware to fail closed on malformed JWT tokens with unit tests',
      'Optimize database queries for multi-tenant memory lookup with composite indexing'
    ]
  },

  operations: {
    id: 'ops-team-v1',
    name: 'Autonomous Operations & SRE Team',
    category: 'operations',
    description: 'Site reliability and operations squad for incident triage, log auditing, resource monitoring, and automated runbooks.',
    mission: 'Maintain system reliability, diagnose performance anomalies, and triage operational incidents.',
    lead_role: 'team_lead',
    escalation_policy: {
      require_human_approval_for: ['restart_production_cluster', 'revoke_api_credentials', 'flush_redis_cache'],
      max_iterations_before_escalation: 5,
      auto_notify_channels: ['dashboard', 'pagerduty', 'slack'],
      on_error_strategy: 'pause_and_notify'
    },
    roles: [
      {
        role: 'team_lead',
        name: 'Incident Commander AI',
        title: 'Lead SRE & Incident Commander',
        description: 'Coordinates triage across logs and metrics, decides incident severity, and coordinates recovery actions.',
        is_lead: true,
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.2,
        system_prompt: `You are the Incident Commander and Lead SRE. Coordinate log analysis, system metrics inspection, and execute operational runbooks.`,
        tools_available: [
          { name: 'delegate_task', description: 'Assign diagnostics or log analysis to Ops team members' },
          { name: 'query_team_memory', description: 'Query team memory for active incidents, metric baselines, and root causes' },
          { name: 'save_team_memory', description: 'Save incident postmortem notes and metric anomalies' },
          { name: 'request_human_guidance', description: 'Escalate to human on-call engineer' },
          { name: 'synthesize_final_report', description: 'Generate incident postmortem and remediation report' }
        ],
        autonomy_level: 'supervised'
      },
      {
        role: 'analyst',
        name: 'Log & Metrics Auditor AI',
        title: 'Observability & Telemetry Analyst',
        description: 'Parses error spikes, memory saturation, and anomalous request traffic.',
        model: 'openai/gpt-4o-mini',
        temperature: 0.1,
        system_prompt: `You are the Observability Analyst. Parse error logs and telemetry to locate error patterns and bottlenecks.`,
        tools_available: [
          { name: 'inspect_runtime_metrics', description: 'Fetch live CPU, RAM, and active worker count from Go runtime' },
          { name: 'query_team_memory', description: 'Read incident details' },
          { name: 'save_team_memory', description: 'Save metric audit findings' }
        ],
        autonomy_level: 'autonomous'
      },
      {
        role: 'ops',
        name: 'Runbook Automation AI',
        title: 'Operations Engineer',
        description: 'Executes automated health checks, cleans stale temporary files, and validates service restarts.',
        model: 'meta-llama/llama-3.3-70b-instruct',
        temperature: 0.1,
        system_prompt: `You are the Operations Automation Engineer. Run verified health checks and safe diagnostic commands.`,
        tools_available: [
          { name: 'execute_sandbox_code', description: 'Run health check scripts and verify port connectivity' },
          { name: 'save_team_memory', description: 'Log runbook execution output to team memory' }
        ],
        autonomy_level: 'autonomous'
      }
    ],
    suggested_tasks: [
      'Investigate memory spike anomaly on worker pool nodes and recommend GC tuning',
      'Audit log streams for unhandled promise rejections over the last 24 hours',
      'Execute pre-deployment readiness check on database connection pools'
    ]
  }
}
