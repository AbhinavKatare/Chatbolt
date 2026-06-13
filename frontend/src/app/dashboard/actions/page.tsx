'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  Zap, Plus, ExternalLink, Shield, Code, Settings2, Globe, X,
  Activity, RefreshCw, Play, Cpu, CheckCircle, XCircle,
  MoreHorizontal, Edit3, Trash2, Clock, Terminal, ChevronDown
} from 'lucide-react'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  POST: 'text-[#00E599] bg-[#00E599]/10 border-[#00E599]/20',
  PUT: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  PATCH: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  DELETE: 'text-red-400 bg-red-500/10 border-red-500/20',
}

type Tool = {
  id: string
  name: string
  description: string
  endpoint_url: string
  method: string
  auth_type: string
  auth_header?: string
  is_active: boolean
  call_count: number
  last_called_at?: string
  avg_latency_ms?: number
  created_at: string
}

type ToolStats = {
  total: string
  active: string
  total_calls: string
  avg_latency: string
}

type InvokeResult = {
  success: boolean
  status_code: number
  latency_ms: number
  response: any
  error: string | null
}

export default function ActionsPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [tools, setTools] = useState<Tool[]>([])
  const [stats, setStats] = useState<ToolStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editTool, setEditTool] = useState<Tool | null>(null)
  const [invokeToolId, setInvokeToolId] = useState<string | null>(null)
  const [invokePayload, setInvokePayload] = useState('{}')
  const [invokeResult, setInvokeResult] = useState<InvokeResult | null>(null)
  const [invoking, setInvoking] = useState(false)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', description: '', endpoint_url: '', method: 'POST',
    auth_type: 'none', auth_value: '', auth_header: '', timeout_ms: 10000
  })

  const loadTools = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.customTools.list()
      setTools(res.tools || [])
      setStats(res.stats || null)
    } catch (err: any) {
      toastError('Failed to load tools', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTools() }, [loadTools])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.customTools.create({ ...form, timeout_ms: Number(form.timeout_ms) })
      toastSuccess('Tool created')
      setShowAddModal(false)
      resetForm()
      loadTools()
    } catch (err: any) {
      toastError('Failed to create tool', err.message)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTool) return
    try {
      await api.customTools.update(editTool.id, { ...form, timeout_ms: Number(form.timeout_ms) })
      toastSuccess('Tool updated')
      setEditTool(null)
      loadTools()
    } catch (err: any) {
      toastError('Failed to update tool', err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tool?')) return
    try {
      await api.customTools.delete(id)
      toastSuccess('Tool deleted')
      setActionMenuId(null)
      loadTools()
    } catch (err: any) {
      toastError('Failed to delete tool', err.message)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await api.customTools.toggle(id)
      loadTools()
    } catch (err: any) {
      toastError('Failed to toggle tool', err.message)
    }
  }

  const handleInvoke = async () => {
    if (!invokeToolId) return
    try {
      setInvoking(true)
      setInvokeResult(null)
      let payload: any = {}
      try { payload = JSON.parse(invokePayload) } catch { payload = {} }
      const result = await api.customTools.invoke(invokeToolId, payload)
      setInvokeResult(result)
      if (result.success) toastSuccess(`Tool executed in ${result.latency_ms}ms`)
      else toastError('Tool execution failed', result.error || 'Unknown error')
      loadTools()
    } catch (err: any) {
      toastError('Failed to invoke tool', err.message)
    } finally {
      setInvoking(false)
    }
  }

  const resetForm = () => setForm({
    name: '', description: '', endpoint_url: '', method: 'POST',
    auth_type: 'none', auth_value: '', auth_header: '', timeout_ms: 10000
  })

  const openEdit = (t: Tool) => {
    setForm({ name: t.name, description: t.description, endpoint_url: t.endpoint_url, method: t.method, auth_type: t.auth_type, auth_value: '', auth_header: t.auth_header || '', timeout_ms: 10000 })
    setEditTool(t)
    setActionMenuId(null)
  }

  const statCards = [
    { label: 'Total Tools', value: stats?.total || '0', icon: Zap, color: 'text-[#00E599]' },
    { label: 'Active', value: stats?.active || '0', icon: Activity, color: 'text-blue-400' },
    { label: 'Total Calls', value: stats?.total_calls || '0', icon: Cpu, color: 'text-purple-400' },
    { label: 'Avg Latency', value: stats?.avg_latency ? `${Math.round(parseFloat(stats.avg_latency))}ms` : '—', icon: Clock, color: 'text-amber-400' },
  ]

  const FormContent = ({ onSubmit, title }: { onSubmit: (e: React.FormEvent) => void; title: string }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl p-8 max-w-lg w-full shadow-2xl relative my-8">
        <button onClick={() => { setShowAddModal(false); setEditTool(null) }} className="absolute top-6 right-6 text-zinc-500 hover:text-white">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold text-white mb-6">{title}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Tool Name *</label>
            <input required className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Stripe Payment Check" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Description</label>
            <input className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this tool do?" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Endpoint URL *</label>
              <input required type="url" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none" value={form.endpoint_url} onChange={e => setForm(f => ({ ...f, endpoint_url: e.target.value }))} placeholder="https://api.example.com/v1/..." />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Method</label>
              <select className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Auth Type</label>
              <select className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none" value={form.auth_type} onChange={e => setForm(f => ({ ...f, auth_type: e.target.value }))}>
                {['none','bearer','api_key','basic'].map(a => <option key={a} value={a}>{a === 'api_key' ? 'API Key' : a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
              </select>
            </div>
            {form.auth_type === 'api_key' && (
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Header Name</label>
                <input className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none" value={form.auth_header} onChange={e => setForm(f => ({ ...f, auth_header: e.target.value }))} placeholder="X-API-Key" />
              </div>
            )}
          </div>
          {form.auth_type !== 'none' && (
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">
                {form.auth_type === 'bearer' ? 'Bearer Token' : form.auth_type === 'basic' ? 'user:password' : 'API Key Value'}
              </label>
              <input type="password" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none" value={form.auth_value} onChange={e => setForm(f => ({ ...f, auth_value: e.target.value }))} placeholder="Stored securely..." />
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Timeout (ms)</label>
            <input type="number" min={100} max={60000} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none" value={form.timeout_ms} onChange={e => setForm(f => ({ ...f, timeout_ms: parseInt(e.target.value) || 10000 }))} />
          </div>
          <button type="submit" className="w-full py-3 bg-[#00E599] text-black font-bold rounded-xl text-sm hover:bg-[#00E599]/90 transition-all">
            {title.includes('Create') ? 'Create Tool' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-[#050507] font-sans text-[#EDEDED] overflow-y-auto custom-scrollbar" onClick={() => setActionMenuId(null)}>
      
      {/* Header */}
      <div className="h-14 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          <Cpu size={14} className="text-[#00E599]" /> Custom Tools & Actions
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadTools} className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-500 hover:text-white transition-all">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => { setShowAddModal(true); setEditTool(null); resetForm() }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#00E599] text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#00E599]/90 transition-all">
            <Plus size={12} /> New Tool
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-6">
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <div key={i} className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <s.icon size={16} className={s.color} />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{s.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{loading ? '...' : s.value}</div>
            </div>
          ))}
        </div>

        {/* Tools Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/10 border-t-[#00E599] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map(t => (
              <div key={t.id} className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-6 hover:border-white/10 transition-all group relative" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center justify-center">
                      <Globe size={18} className="text-[#00E599]" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{t.name}</div>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black border ${METHOD_COLORS[t.method] || METHOD_COLORS.POST}`}>
                        {t.method}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${t.is_active ? 'bg-[#00E599] animate-pulse' : 'bg-zinc-600'}`} />
                    <div className="relative">
                      <button onClick={() => setActionMenuId(actionMenuId === t.id ? null : t.id)}
                        className="p-1.5 text-zinc-600 hover:text-white rounded-lg hover:bg-white/[0.04] transition-all">
                        <MoreHorizontal size={14} />
                      </button>
                      {actionMenuId === t.id && (
                        <div className="absolute right-0 top-8 z-10 bg-[#0D0D11] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden min-w-[160px]">
                          <button onClick={() => openEdit(t)} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-zinc-300 hover:text-white hover:bg-white/[0.04]">
                            <Edit3 size={12} /> Edit
                          </button>
                          <button onClick={() => { setInvokeToolId(t.id); setInvokeResult(null); setActionMenuId(null) }} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-zinc-300 hover:text-white hover:bg-white/[0.04]">
                            <Play size={12} /> Test Invoke
                          </button>
                          <button onClick={() => handleToggle(t.id)} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-zinc-300 hover:text-white hover:bg-white/[0.04]">
                            <Activity size={12} /> {t.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button onClick={() => handleDelete(t.id)} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-red-400 hover:bg-red-500/10">
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {t.description && <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{t.description}</p>}
                
                {/* Endpoint */}
                <div className="text-[10px] text-zinc-600 font-mono truncate mb-4 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                  {t.endpoint_url}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-white/[0.04] pt-4">
                  <span>{t.call_count || 0} calls</span>
                  {t.avg_latency_ms && <span>{Math.round(t.avg_latency_ms)}ms avg</span>}
                  <div className={`flex items-center gap-1 text-[9px] font-bold ${t.auth_type !== 'none' ? 'text-[#00E599]' : 'text-zinc-600'}`}>
                    <Shield size={10} /> {t.auth_type !== 'none' ? 'Secured' : 'Public'}
                  </div>
                </div>

                {/* Quick invoke button */}
                <button onClick={() => { setInvokeToolId(t.id); setInvokeResult(null) }}
                  className="mt-4 w-full py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[10px] font-bold text-zinc-400 hover:text-[#00E599] hover:border-[#00E599]/30 transition-all flex items-center justify-center gap-2">
                  <Play size={12} /> Test Invoke
                </button>
              </div>
            ))}

            {/* Add new tool card */}
            <div onClick={() => { setShowAddModal(true); resetForm() }}
              className="border-2 border-dashed border-white/[0.06] rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 hover:border-[#00E599]/30 transition-all cursor-pointer group min-h-[200px]">
              <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center justify-center text-zinc-600 group-hover:text-[#00E599] group-hover:border-[#00E599]/30 transition-all">
                <Plus size={24} />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-400 group-hover:text-white transition-colors">Connect New Tool</div>
                <div className="text-[10px] text-zinc-600 mt-1">REST API, webhook, or custom endpoint</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invoke Modal */}
      {invokeToolId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setInvokeToolId(null); setInvokeResult(null) }}>
          <div className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl p-8 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-[#00E599]" />
                <h2 className="text-base font-bold text-white">Test Invoke</h2>
              </div>
              <button onClick={() => { setInvokeToolId(null); setInvokeResult(null) }} className="text-zinc-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">JSON Payload</label>
                <textarea rows={4} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm font-mono text-[#00E599] focus:border-[#00E599]/50 outline-none resize-none"
                  value={invokePayload} onChange={e => setInvokePayload(e.target.value)} />
              </div>
              <button onClick={handleInvoke} disabled={invoking}
                className="w-full py-3 bg-[#00E599] text-black font-bold rounded-xl text-sm hover:bg-[#00E599]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {invoking ? <><RefreshCw size={14} className="animate-spin" /> Invoking...</> : <><Play size={14} /> Execute Tool</>}
              </button>
              {invokeResult && (
                <div className={`rounded-xl border p-4 ${invokeResult.success ? 'bg-[#00E599]/5 border-[#00E599]/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {invokeResult.success ? <CheckCircle size={14} className="text-[#00E599]" /> : <XCircle size={14} className="text-red-400" />}
                    <span className="text-[11px] font-bold text-zinc-400">
                      {invokeResult.status_code} · {invokeResult.latency_ms}ms
                    </span>
                  </div>
                  {invokeResult.error && <div className="text-xs text-red-400 mb-2">{invokeResult.error}</div>}
                  <pre className="text-[10px] font-mono text-zinc-400 overflow-auto max-h-40 whitespace-pre-wrap">
                    {JSON.stringify(invokeResult.response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddModal && <FormContent onSubmit={handleCreate} title="Create New Tool" />}
      {editTool && <FormContent onSubmit={handleUpdate} title="Edit Tool" />}
    </div>
  )
}
