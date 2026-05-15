import { supabase } from './supabase'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

async function getToken() {
  if (typeof window === 'undefined') return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || 'mock-token'
  } catch {
    return 'mock-token'
  }
}

async function req<T>(method: string, path: string, body?: any, raw = false): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

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
    sendStream: async (agentId: string, message: string, sessionId: string, history: any[]) => {
      const token = await getToken()
      return fetch(`${BASE}/chat/${agentId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, session_id: sessionId, history }),
      })
    },
  },

  billing: {
    plans: () => req<{ plans: any[] }>('GET', '/billing/plans'),
    checkout: (plan: string) => req<{ url: string }>('POST', '/billing/checkout', { plan }),
    portal: () => req<{ url: string }>('POST', '/billing/portal'),
    subscription: () => req<{ subscription: any; plan: string }>('GET', '/billing/subscription'),
    credits: () => req<{ credits_remaining: number; credits_monthly: number; plan: string; history: any[] }>('GET', '/billing/credits'),
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
    saveAgentPosition: (workflowId: string, agentId: string, x: number, y: number) =>
      req('PATCH', `/workflows/${workflowId}/agents/${agentId}/position`, { x, y }),
    testAgent: (workflowId: string, agentId: string, inputs: any, task?: string) =>
      req<{ output: any; duration_ms: number }>('POST', `/workflows/${workflowId}/agents/${agentId}/test`, { inputs, task }),
    getAgentHistory: (workflowId: string, agentId: string) =>
      req<{ steps: any[] }>('GET', `/workflows/${workflowId}/agents/${agentId}/history`),
    updateAgent: (workflowId: string, agentId: string, data: any) =>
      req('PATCH', `/workflows/${workflowId}/agents/${agentId}`, data),
  },

  reports: {
    list: (limit = 10) => req<{ reports: any[] }>('GET', `/reports?limit=${limit}`),
    generate: () => req<{ success: boolean; report: any }>('POST', '/reports/generate'),
  },
}

export async function logout() {
  await supabase.auth.signOut()
  localStorage.removeItem('chatai_tenant')
  window.location.href = '/login'
}

export function saveSession(token: string, tenant: any) {
  // token is managed by Supabase, we only save tenant data for UI context
  localStorage.setItem('chatai_tenant', JSON.stringify(tenant))
}

export async function getSession() {
  if (typeof window === 'undefined') return null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      // Fallback for testing when auth is paused
      return { 
        token: 'mock-token', 
        tenant: { 
          id: 'test-tenant-id', 
          name: 'Test Business', 
          email: 'test@chatbolt.io', 
          plan: 'pro' 
        } 
      }
    }
    const tenantStr = localStorage.getItem('chatai_tenant')
    const tenant = tenantStr ? JSON.parse(tenantStr) : { email: session.user.email, id: session.user.id }
    return { token: session.access_token, tenant }
  } catch { 
    return { 
      token: 'mock-token', 
      tenant: { 
        id: 'test-tenant-id', 
        name: 'Test Business', 
        email: 'test@chatbolt.io', 
        plan: 'pro' 
      } 
    }
  }
}
