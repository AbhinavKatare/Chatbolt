import { supabase } from './supabase'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

function withTimeout<T>(promise: Promise<T>, timeoutMs = 3000, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ])
}

async function getToken() {
  if (typeof window === 'undefined') return null
  try {
    const sessionPromise = supabase.auth.getSession()
      .then(res => {
        if (!res.data.session) return null
        return res.data.session.access_token
      })
      .catch(() => null)
    const supabaseToken = await withTimeout(sessionPromise, 3000, null)
    if (supabaseToken) return supabaseToken
  } catch {
    // ignore — fall through to local token
  }
  // Fall back to locally stored token (set during local/offline login)
  return localStorage.getItem('chatbolt_token') || null
}

async function req<T>(method: string, path: string, body?: any, raw = false): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    try {
      const refreshPromise = supabase.auth.refreshSession()
      const { data, error } = await withTimeout(refreshPromise, 3000, { data: { session: null }, error: new Error('timeout') } as any)
      if (error || !data.session) {
        throw new Error('session_expired')
      }
      const newToken = data.session.access_token
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (refreshErr) {
      try {
        await supabase.auth.signOut()
      } catch {}
      if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=session_expired'
      }
      throw new Error('Session expired. Please log in again.')
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }

  if (raw) return res as unknown as T
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────
export const api = {
  auth: {
    signup: (data: { name: string; email: string; password: string }) =>
      req<{ token: string; tenant: any }>('POST', '/auth/signup', data),
    login: (data: { email: string; password: string }) =>
      req<{ token: string; tenant: any }>('POST', '/auth/login', data),
    me: () => req<{ tenant: any }>('GET', '/auth/me'),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      req('POST', '/auth/change-password', data),
    updateProfile: (data: { name: string; user_details?: string; user_purpose?: string; notification_preferences?: string }) =>
      req<{ tenant: any }>('PUT', '/auth/profile', data),
  },

  agents: {
    list: () => req<{ agents: any[] }>('GET', '/agents'),
    get: (id: string) => req<{ agent: any }>('GET', `/agents/${id}`),
    create: (data: any) => req<{ agent: any }>('POST', '/agents', data),
    update: (id: string, data: any) => req<{ agent: any }>('PATCH', `/agents/${id}`, data),
    delete: (id: string) => req('DELETE', `/agents/${id}`),
    embedCode: (id: string) => req<{ embed_code: string; agent_id: string }>('GET', `/agents/${id}/embed-code`),
  },

  documents: {
    list: (agentId: string) => req<{ documents: any[] }>('GET', `/agents/${agentId}/documents`),
    addUrl: (agentId: string, url: string) =>
      req<{ document: any }>('POST', `/agents/${agentId}/documents/url`, { url }),
    addText: (agentId: string, name: string, content: string) =>
      req<{ document: any }>('POST', `/agents/${agentId}/documents/text`, { name, content }),
    upload: async (agentId: string, file: File) => {
      const token = await getToken()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE}/agents/${agentId}/documents/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    delete: (agentId: string, docId: string) =>
      req('DELETE', `/agents/${agentId}/documents/${docId}`),
    status: (agentId: string, docId: string) =>
      req<{ status: string; chunk_count: number }>('GET', `/agents/${agentId}/documents/${docId}/status`),
    reingest: (agentId: string, docId: string) =>
      req('POST', `/agents/${agentId}/documents/${docId}/reingest`),
  },

  chat: {
    conversations: (agentId: string, page = 1, escalated?: boolean) =>
      req<{ conversations: any[]; total: number }>('GET', `/chat/${agentId}/conversations?page=${page}${escalated ? '&escalated=true' : ''}`),
    messages: (agentId: string, convId: string) =>
      req<{ conversation: any; messages: any[] }>('GET', `/chat/${agentId}/conversations/${convId}/messages`),
    resolve: (agentId: string, convId: string) =>
      req('POST', `/chat/${agentId}/conversations/${convId}/resolve`),
    sendStream: async (agentId: string, message: string, sessionId: string, history: any[], inputs?: Record<string, any>) => {
      const token = await getToken()
      return fetch(`${BASE}/chat/${agentId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, session_id: sessionId, history, inputs }),
      })
    },
  },

  billing: {
    plans: () => req<{ plans: any[] }>('GET', '/billing/plans'),
    checkout: (plan: string, interval?: string) => req<{ url: string }>('POST', '/billing/checkout', { plan, interval }),
    portal: () => req<{ url: string }>('POST', '/billing/portal'),
    subscription: () => req<{ subscription: any; plan: string }>('GET', '/billing/subscription'),
    toggleOverage: (enabled: boolean) => req<{ success: boolean; overage_enabled: boolean }>('POST', '/billing/overage/toggle', { enabled }),
    checkAnnualNudge: () => req<{ eligible: boolean }>('GET', '/billing/annual-nudge-check'),
    dismissAnnualNudge: () => req<{ success: boolean }>('POST', '/billing/annual-nudge-dismiss'),
    credits: () => req<{ credits_remaining: number; credits_monthly: number; plan: string; history: any[] }>('GET', '/billing/credits'),
    usage: () => req<{
      tasks: { allowed: boolean; current: number; limit: number }
      api_calls: { allowed: boolean; current: number; limit: number }
      automations: { allowed: boolean; current: number; limit: number }
      integrations: { allowed: boolean; current: number; limit: number }
      team_members: { allowed: boolean; current: number; limit: number }
    }>('GET', '/billing/usage'),
  },

  analytics: {
    overview: (agentId?: string, days = 30) =>
      req<any>('GET', `/analytics/overview?days=${days}${agentId ? `&agentId=${agentId}` : ''}`),
    overTime: (days = 30) =>
      req<{ data: any[] }>('GET', `/analytics/conversations-over-time?days=${days}`),
    topQueries: (limit = 10) =>
      req<{ queries: any[] }>('GET', `/analytics/top-queries?limit=${limit}`),
    creditsUsage: () =>
      req<{ data: any[] }>('GET', '/analytics/credits-usage'),
    productivity: (days?: number) =>
      req<any>('GET', `/analytics/productivity?days=${days || 30}`),
    feedback: (runId: string, rating: number, comment?: string) =>
      req<{ success: boolean }>('POST', '/analytics/feedback', { run_id: runId, rating, comment }),
    automationPerformance: () =>
      req<{ automations: any[] }>('GET', '/analytics/automations'),
    adminStats: () =>
      req<{
        liveStats: {
          totalRuns: number
          totalConversations: number
          activeTenants: number
          successRate: number
        }
        failureLog: Array<{
          id: string
          error_message: string
          created_at: string
          workflow_name: string
          tenant_email: string
        }>
        integrationHealth: Array<{
          service: string
          count: number
          status: string
        }>
        topTasks: Array<{
          task_type: string
          count: number
        }>
      }>('GET', '/analytics/admin/stats'),
  },

  apiKeys: {
    list: () => req<{ keys: any[] }>('GET', '/api-keys'),
    create: (name: string, agentId?: string) =>
      req<any>('POST', '/api-keys', { name, agent_id: agentId }),
    delete: (id: string) => req('DELETE', `/api-keys/${id}`),
  },

  autopilot: {
    generate: (data: { company_type: string; description: string; goals: string }) =>
      req<{ agents: any[]; setup_complete: boolean }>('POST', '/autopilot/generate', data),
  },

  workflows: {
    list: () => req<{ workflows: any[] }>('GET', '/workflows'),
    get: (id: string) => req<{ workflow: any; agents: any[] }>('GET', `/workflows/${id}`),
    create: (data: any) => req<{ workflow: any; agents: any[] }>('POST', '/workflows/create', data),
    update: (id: string, data: any) => req<any>('PATCH', `/workflows/${id}`, data),
    delete: (id: string) => req('DELETE', `/workflows/${id}`),
    parse: (prompt: string) => req<{
      workflow_name: string;
      workflow_type: string;
      agents: any[];
      missing_inputs: any[];
      thinking: string;
    }>('POST', '/workflows/parse', { prompt }),
    run: (id: string, inputs: any) => req<{ run_id: string }>('POST', `/workflows/${id}/run`, { inputs }),
    getRun: (id: string, runId: string) => req<{ run: any; steps: any[] }>('GET', `/workflows/${id}/runs/${runId}`),
    updateRun: (id: string, runId: string, data: { template_candidate?: boolean }) => req<{ run: any }>('PATCH', `/workflows/${id}/runs/${runId}`, data),
    getObservatory: (id: string, runId: string) => req<{
      run: any;
      steps: any[];
      heartbeats: any[];
      roi: { totalCost: number; manualTimeSavedHours: number; roiDollar: number };
      memory_growth: any[];
      live_agents: number;
      decision_logs_count: number;
    }>('GET', `/workflows/${id}/runs/${runId}/observatory`),
    approveRun: (workflowId: string, runId: string) =>
      req<{ success: boolean; message: string }>('POST', `/workflows/${workflowId}/runs/${runId}/approve`),
    rejectRun: (workflowId: string, runId: string) =>
      req<{ success: boolean; message: string }>('POST', `/workflows/${workflowId}/runs/${runId}/reject`),
    cancelRun: (runId: string) =>
      req<{ success: boolean }>('POST', `/workflows/runs/${runId}/cancel`),
    listRuns: (params?: { limit?: number; status?: string }) => {
      const qs = new URLSearchParams()
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.status) qs.set('status', params.status)
      return req<{ runs: any[] }>('GET', `/workflows/runs/all?${qs}`)
    },
    saveAgentPosition: (workflowId: string, agentId: string, x: number, y: number) =>
      req('PATCH', `/workflows/${workflowId}/agents/${agentId}/position`, { x, y }),
    testAgent: (workflowId: string, agentId: string, inputs: any, task?: string) =>
      req<{ output: any; duration_ms: number }>('POST', `/workflows/${workflowId}/agents/${agentId}/test`, { inputs, task }),
    getAgentHistory: (workflowId: string, agentId: string) =>
      req<{ steps: any[] }>('GET', `/workflows/${workflowId}/agents/${agentId}/history`),
    updateAgent: (workflowId: string, agentId: string, data: any) =>
      req('PATCH', `/workflows/${workflowId}/agents/${agentId}`, data),
  },

  enrich: {
    company: (data: { company: string; domain?: string }) =>
      req<{ data: any; summary: string }>('POST', '/enrich/company', data),
    bulk: (companies: Array<{ company: string; domain?: string }>) =>
      req<{ results: any[] }>('POST', '/enrich/bulk', { companies }),
    history: () => req<{ results: any[] }>('GET', '/enrich/history'),
  },

  reports: {
    list: (limit = 10) => req<{ reports: any[] }>('GET', `/reports?limit=${limit}`),
    generate: () => req<{ success: boolean; report: any }>('POST', '/reports/generate'),
  },

  plugins: {
    list: () => req<{ plugins: any[] }>('GET', '/plugins'),
    install: (data: { service_name: string; key_value: string; display_name?: string }) =>
      req<any>('POST', '/plugins/install', data),
    toggle: (data: { service_name: string; enable: boolean }) =>
      req<any>('POST', '/plugins/toggle', data),
    uninstall: (data: { service_name: string }) =>
      req<any>('POST', '/plugins/uninstall', data),
  },

  contacts: {
    list: (params?: { search?: string; status?: string; source?: string; page?: number; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.search) qs.set('search', params.search)
      if (params?.status) qs.set('status', params.status)
      if (params?.source) qs.set('source', params.source)
      if (params?.page) qs.set('page', String(params.page))
      if (params?.limit) qs.set('limit', String(params.limit))
      return req<{ contacts: any[]; total: number; stats: any }>('GET', `/contacts?${qs}`)
    },
    get: (id: string) => req<{ contact: any; interactions: any[] }>('GET', `/contacts/${id}`),
    create: (data: any) => req<{ contact: any }>('POST', '/contacts', data),
    update: (id: string, data: any) => req<{ contact: any }>('PATCH', `/contacts/${id}`, data),
    delete: (id: string) => req('DELETE', `/contacts/${id}`),
    addInteraction: (id: string, data: { type: string; summary: string; metadata?: any }) =>
      req<{ interaction: any }>('POST', `/contacts/${id}/interactions`, data),
    bulkImport: (contacts: any[]) =>
      req<{ created: number; errors: number; contacts: any[] }>('POST', '/contacts/bulk-import', { contacts }),
    exportAll: () => req<{ contacts: any[] }>('GET', '/contacts/export/all'),
  },

  customTools: {
    list: () => req<{ tools: any[]; stats: any }>('GET', '/custom-tools'),
    get: (id: string) => req<{ tool: any; logs: any[] }>('GET', `/custom-tools/${id}`),
    create: (data: any) => req<{ tool: any }>('POST', '/custom-tools', data),
    update: (id: string, data: any) => req<{ tool: any }>('PATCH', `/custom-tools/${id}`, data),
    delete: (id: string) => req('DELETE', `/custom-tools/${id}`),
    invoke: (id: string, payload?: any) =>
      req<{ success: boolean; status_code: number; latency_ms: number; response: any; error: string | null }>('POST', `/custom-tools/${id}/invoke`, { payload }),
    toggle: (id: string) => req<{ tool: any }>('POST', `/custom-tools/${id}/toggle`),
  },

  workspaces: {
    list: () => req<{ workspaces: any[] }>('GET', '/workspaces'),
    create: (data: { name: string }) => req<{ workspace: any }>('POST', '/workspaces', data),
    update: (id: string, data: { name: string }) => req<{ workspace: any }>('PATCH', `/workspaces/${id}`, data),
    delete: (id: string) => req('DELETE', `/workspaces/${id}`),
    listProjects: (workspaceId: string) => req<{ projects: any[] }>('GET', `/workspaces/${workspaceId}/projects`),
    createProject: (workspaceId: string, data: { name: string; description?: string; status?: string }) =>
      req<{ project: any }>('POST', `/workspaces/${workspaceId}/projects`, data),
    updateProject: (projectId: string, data: any) =>
      req<{ project: any }>('PATCH', `/workspaces/projects/${projectId}`, data),
    deleteProject: (projectId: string) => req('DELETE', `/workspaces/projects/${projectId}`),
    listHeartbeats: () => req<{ heartbeats: any[] }>('GET', '/workspaces/heartbeats'),
  },

  artifacts: {
    list: (projectId: string) => req<{ artifacts: any[] }>('GET', `/artifacts/project/${projectId}`),
    create: (projectId: string, data: { name: string; artifact_type: string; metadata?: any }) =>
      req<{ artifact: any }>('POST', `/artifacts/project/${projectId}`, data),
    lock: (id: string) => req<{ success: boolean; locked_by: string }>('POST', `/artifacts/${id}/lock`),
    unlock: (id: string) => req<{ success: boolean }>('POST', `/artifacts/${id}/unlock`),
    saveVersion: (id: string, data: { version_number: number; raw_contents: string; change_description?: string }) =>
      req<{ success: boolean; version: number; summary: string }>('POST', `/artifacts/${id}/versions`, data),
    versions: (id: string) => req<{ versions: any[] }>('GET', `/artifacts/${id}/versions`),
  },

  integrations: {
    list: () => req<{ integrations: any[] }>('GET', '/integrations'),
    disconnect: (service: string) => req<any>('POST', `/integrations/disconnect/${service}`),
    briefing: () => req<{ briefing: any }>('GET', '/integrations/briefing'),
    undoableActions: () => req<{ actions: any[] }>('GET', '/integrations/undo'),
    undo: (actionId: string) => req<{ success: boolean; message: string }>('POST', `/integrations/undo/${actionId}`),
    authUrl: (service: string) => req<{ url: string }>('GET', `/integrations/${service}/auth-url`),
    revoke: (service: string) => req<any>('DELETE', `/integrations/${service}`),
  },

  memory: {
    facts: () => req<{ facts: any[]; grouped: any; total: number }>('GET', '/memory/facts'),
    profile: () => req<{ profile: any; facts: any[] }>('GET', '/memory/profile'),
    skills: () => req<{ skills: any[]; total: number }>('GET', '/memory/skills'),
    projectContext: (keyword: string) => req<{ facts: string[] }>('GET', `/memory/project-context?keyword=${encodeURIComponent(keyword)}`),
    setPreference: (key: string, value: string) => req<{ fact: any; success: boolean }>('POST', '/memory/preferences', { key, value }),
    deleteFact: (id: string) => req<any>('DELETE', `/memory/facts/${id}`),
    wipeAll: () => req<any>('DELETE', '/memory/facts?confirm=true'),
  },

  teams: {
    list: () => req<{ teams: any[] }>('GET', '/teams'),
    get: (id: string) => req<{ team: any; members: any[]; pending_invites: any[]; my_role: string }>('GET', `/teams/${id}`),
    create: (data: { name: string; description?: string }) => req<{ team: any }>('POST', '/teams', data),
    update: (id: string, data: { name?: string; description?: string }) => req<{ team: any }>('PATCH', `/teams/${id}`, data),
    delete: (id: string) => req<any>('DELETE', `/teams/${id}`),
    invite: (teamId: string, email: string, role = 'member') => req<{ invite: any; invite_url: string }>('POST', `/teams/${teamId}/invite`, { email, role }),
    acceptInvite: (token: string) => req<{ success: boolean; team: any }>('POST', `/teams/accept/${token}`),
    removeMember: (teamId: string, memberId: string) => req<any>('DELETE', `/teams/${teamId}/members/${memberId}`),
    activity: (teamId: string) => req<{ runs: any[] }>('GET', `/teams/${teamId}/activity`),
    delegate: (teamId: string, runId: string, assignedTo: string) => req<{ success: boolean }>('POST', `/teams/${teamId}/delegate`, { run_id: runId, assigned_to_tenant_id: assignedTo }),
  },

  automations: {
    templates: () => req<{ templates: any[] }>('GET', '/automations/templates'),
    fromTemplate: (templateId: string, workflowId: string, customName?: string) => req<{ task_id: string; schedule: string; humanized_schedule: string }>('POST', '/automations/from-template', { template_id: templateId, workflow_id: workflowId, custom_name: customName }),
    parseNaturalLanguage: (description: string) => req<{ cron: string; humanized: string; confidence: number; workflow_suggestion: string }>('POST', '/automations/natural-language', { description }),
    eventTriggerTypes: () => req<{ triggers: any[] }>('GET', '/automations/event-triggers'),
    activeEventTriggers: () => req<{ rules: any[] }>('GET', '/automations/event-triggers/active'),
    createEventTrigger: (data: { trigger_type: string; workflow_id: string; filter_config?: any }) => req<{ rule: any }>('POST', '/automations/event-triggers', data),
    deleteEventTrigger: (id: string) => req<any>('DELETE', `/automations/event-triggers/${id}`),
  },

  publicApi: {
    submitTask: (prompt: string, workflowId?: string) => req<{ task_id: string; status: string; estimated_seconds: number }>('POST', '/api/v1/tasks', { prompt, workflow_id: workflowId }),
    getTask: (taskId: string) => req<{ task_id: string; status: string; output: any; error: any }>('GET', `/api/v1/tasks/${taskId}`),
    listTasks: () => req<{ tasks: any[] }>('GET', '/api/v1/tasks'),
    sendMessage: (agentId: string, message: string, sessionId?: string) => req<{ response: string; session_id: string }>('POST', '/api/v1/message', { agent_id: agentId, message, session_id: sessionId }),
  },

  tasks: {
    active: () => req<{ run: any; steps: any[] }>('GET', '/api/tasks/active'),
    history: (limit?: number) => req<{ runs: any[] }>('GET', `/api/tasks/history?limit=${limit || 50}`),
  },

  schedules: {
    list: () => req<{ schedules: any[] }>('GET', '/automations/schedules'),
    create: (data: {
      workflow_id?: string
      workflow_name: string
      cron_expression: string
      description?: string
      task_prompt: string
      team_id?: string
    }) => req<{ schedule: any }>('POST', '/automations/schedules', data),
    toggle: (id: string, isActive: boolean) =>
      req<{ schedule: any }>('PATCH', `/automations/schedules/${id}`, { is_active: isActive }),
    delete: (id: string) => req<{ success: boolean }>('DELETE', `/automations/schedules/${id}`),
  },

  templates: {
    list: () => req<{ templates: any[] }>('GET', '/api/templates'),
    create: (data: {
      name: string
      description?: string
      prompt: string
      task_type?: string
    }) => req<{ template: any }>('POST', '/api/templates', data),
    delete: (id: string) => req<{ success: boolean }>('DELETE', `/api/templates/${id}`),
  },

  referrals: {
    myCode: () => req<{ code: string }>('GET', '/referrals/my-code'),
    stats: () => req<{ total: number; converted: number; rewarded: number }>('GET', '/referrals/stats'),
    apply: (code: string) => req<{ success: boolean }>('POST', '/referrals/apply', { code }),
  },
  shares: {
    get: (token: string) => req<any>('GET', `/shares/${token}`),
    create: (runId: string) => req<{ shareToken: string; expiresAt: string }>('POST', '/shares', { runId }),
  },
}

export async function logout() {
  try { await supabase.auth.signOut() } catch { /* ignore network errors */ }
  localStorage.removeItem('chatai_tenant')
  localStorage.removeItem('chatbolt_token')
  window.location.href = '/login'
}

export function saveSession(token: string, tenant: any) {
  // Store token for local/offline mode fallback
  localStorage.setItem('chatbolt_token', token)
  localStorage.setItem('chatai_tenant', JSON.stringify(tenant))
}

export async function getSession() {
  if (typeof window === 'undefined') return null
  try {
    const sessionPromise = supabase.auth.getSession()
    const { data: { session } } = await Promise.race([
      sessionPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('supabase_timeout')), 3000)),
    ])
    if (session) {
      const tenantStr = localStorage.getItem('chatai_tenant')
      const tenant = tenantStr ? JSON.parse(tenantStr) : { email: session.user.email, id: session.user.id }
      return { token: session.access_token, tenant }
    }
  } catch {
    // Supabase unreachable — try local stored token
  }
  // Local mode: check for stored token from local login
  const localToken = localStorage.getItem('chatbolt_token')
  const tenantStr = localStorage.getItem('chatai_tenant')
  if (localToken && tenantStr) {
    try {
      const tenant = JSON.parse(tenantStr)
      return { token: localToken, tenant }
    } catch {
      return null
    }
  }
  return null
}
