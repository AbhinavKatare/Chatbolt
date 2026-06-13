'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  MessageSquare, Search, RefreshCw, Clock, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Bot, User, ExternalLink, Filter, Activity,
  ThumbsUp, ThumbsDown, AlertCircle, Copy, CheckCheck, Calendar
} from 'lucide-react'

type Conversation = {
  id: string
  session_id: string
  agent_id: string
  agent_name?: string
  user_message: string
  assistant_message: string
  resolved: boolean
  created_at: string
  rating?: number | null
  tokens_used?: number
}

const truncate = (s: string, n: number) => s && s.length > n ? s.slice(0, n) + '…' : s

export default function ActivityPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'resolved' | 'open'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [copied, setCopied] = useState<string | null>(null)
  const limit = 25

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true)
      const agents = await api.agents.list().catch(() => ({ agents: [] }))
      const agentList = agents.agents || []

      // Fetch conversations for all agents
      const convPromises = agentList.map((a: any) =>
        api.chat.conversations(a.id).catch(() => ({ conversations: [] })).then((r: any) =>
          (r.conversations || []).map((c: any) => ({ ...c, agent_name: a.name }))
        )
      )
      const all = (await Promise.all(convPromises)).flat()
      all.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setConversations(all)
    } catch (err: any) {
      toastError('Failed to load conversations', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  const handleResolve = async (agentId: string, convId: string) => {
    try {
      await api.chat.resolve(agentId, convId)
      toastSuccess('Conversation resolved')
      loadConversations()
    } catch (err: any) {
      toastError('Failed to resolve', err.message)
    }
  }

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const filtered = conversations.filter(c => {
    const matchSearch = !search || c.user_message?.toLowerCase().includes(search.toLowerCase()) || c.assistant_message?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'resolved' ? c.resolved : !c.resolved)
    return matchSearch && matchFilter
  })

  const paginated = filtered.slice((page - 1) * limit, page * limit)
  const totalPages = Math.ceil(filtered.length / limit)

  const stats = {
    total: conversations.length,
    resolved: conversations.filter(c => c.resolved).length,
    open: conversations.filter(c => !c.resolved).length,
  }

  return (
    <div className="flex flex-col h-full bg-[#050507] text-[#EDEDED] overflow-y-auto custom-scrollbar">

      {/* Header */}
      <div className="h-14 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare size={16} className="text-[#00E599]" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Conversations</span>
          <div className="h-4 w-px bg-white/[0.05]" />
          <span className="text-[10px] text-zinc-600 font-bold">{conversations.length} total</span>
        </div>
        <button onClick={loadConversations} className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-500 hover:text-white transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: MessageSquare, color: 'text-zinc-300' },
            { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: 'text-[#00E599]' },
            { label: 'Open', value: stats.open, icon: AlertCircle, color: 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center ${s.color}`}>
                <s.icon size={18} />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{loading ? '—' : s.value}</div>
                <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              className="w-full pl-9 pr-4 py-2 bg-[#0D0D11] border border-white/[0.06] rounded-xl text-sm text-white outline-none focus:border-[#00E599]/40 placeholder-zinc-600 transition-all"
              placeholder="Search messages..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex items-center gap-1 bg-[#0D0D11] border border-white/[0.06] rounded-xl p-1">
            {(['all', 'open', 'resolved'] as const).map(f => (
              <button key={f} onClick={() => { setFilter(f); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all capitalize ${filter === f ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#00E599] rounded-full animate-spin" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <MessageSquare size={32} className="text-zinc-700 mb-3" />
              <div className="text-zinc-500 text-sm">No conversations found</div>
            </div>
          ) : paginated.map((conv) => {
            const isOpen = expanded === conv.id
            return (
              <div key={conv.id} className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
                
                {/* Row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : conv.id)}
                >
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${conv.resolved ? 'bg-[#00E599]' : 'bg-amber-400 animate-pulse'}`} />

                  {/* Agent badge */}
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[9px] font-bold text-zinc-400 shrink-0">
                    <Bot size={10} className="text-[#00E599]" />
                    {conv.agent_name || 'Agent'}
                  </div>

                  {/* Message preview */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{truncate(conv.user_message || '', 80)}</div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">{truncate(conv.assistant_message || '', 80)}</div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 text-[9px] text-zinc-600">
                      <Calendar size={10} />
                      {new Date(conv.created_at).toLocaleDateString()}
                    </div>
                    <div className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      conv.resolved
                        ? 'text-[#00E599] bg-[#00E599]/10 border-[#00E599]/20'
                        : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                    }`}>
                      {conv.resolved ? 'Resolved' : 'Open'}
                    </div>
                    {isOpen ? <ChevronUp size={14} className="text-zinc-600" /> : <ChevronDown size={14} className="text-zinc-600" />}
                  </div>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div className="border-t border-white/[0.04] px-5 py-4 space-y-4">
                    {/* User message */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                        <User size={12} className="text-zinc-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">User</div>
                        <div className="text-sm text-zinc-200 leading-relaxed">{conv.user_message}</div>
                      </div>
                    </div>

                    {/* Assistant message */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#00E599]/10 border border-[#00E599]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={12} className="text-[#00E599]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Assistant</div>
                        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{conv.assistant_message}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <button onClick={() => copyText(conv.assistant_message || '', conv.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">
                        {copied === conv.id ? <CheckCheck size={12} className="text-[#00E599]" /> : <Copy size={12} />}
                        {copied === conv.id ? 'Copied' : 'Copy'}
                      </button>
                      {!conv.resolved && (
                        <button onClick={() => handleResolve(conv.agent_id, conv.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00E599]/10 border border-[#00E599]/20 rounded-lg text-[10px] font-bold text-[#00E599] hover:bg-[#00E599]/20 transition-all">
                          <CheckCircle2 size={12} /> Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-[10px] text-zinc-600">
            <span>{filtered.length} conversations · Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 bg-[#0D0D11] border border-white/[0.06] rounded-lg disabled:opacity-30 hover:text-white transition-all font-bold">
                ← Prev
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 bg-[#0D0D11] border border-white/[0.06] rounded-lg disabled:opacity-30 hover:text-white transition-all font-bold">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
