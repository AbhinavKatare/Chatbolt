'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  Plus,
  MessageSquare,
  Sparkles,
  Search,
  Copy,
  Check,
  ChevronRight,
  X,
  Send,
  Loader2,
  FileText,
  Brain,
  Zap,
  Shield,
  Settings,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Agent {
  id: string
  name: string
  description?: string
  config?: {
    model?: string
    [key: string]: any
  }
  conversation_count?: number
  document_count?: number
  created_at?: string
  [key: string]: any
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

// ── Avatar color palette ───────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'from-violet-500 to-purple-700',
  'from-cyan-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-orange-400 to-rose-600',
  'from-pink-400 to-fuchsia-600',
  'from-amber-400 to-orange-600',
  'from-sky-400 to-indigo-600',
  'from-lime-400 to-green-600',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ── Skeleton loader ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-zinc-800 rounded-md w-3/5" />
          <div className="h-3 bg-zinc-800 rounded-md w-4/5" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-5 bg-zinc-800 rounded-full w-20" />
        <div className="h-5 bg-zinc-800 rounded-full w-16" />
        <div className="h-5 bg-zinc-800 rounded-full w-14" />
      </div>
      <div className="flex gap-2 mt-auto pt-2 border-t border-zinc-800">
        <div className="h-8 bg-zinc-800 rounded-lg flex-1" />
        <div className="h-8 bg-zinc-800 rounded-lg flex-1" />
        <div className="h-8 bg-zinc-800 rounded-lg w-8" />
      </div>
    </div>
  )
}

// ── Test Chat Modal ────────────────────────────────────────────────────────────
interface TestChatModalProps {
  agent: Agent
  onClose: () => void
}

function TestChatModal({ agent, onClose }: TestChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm **${agent.name}**. ${agent.description ? agent.description + ' ' : ''}How can I help you today?`,
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionId = useRef(`test-${agent.id}-${Date.now()}`)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Build history from messages (exclude the last assistant bubble if it's streaming)
  function buildHistory(msgs: ChatMessage[]) {
    return msgs
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, content: m.content }))
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', streaming: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setStreaming(true)

    const history = buildHistory([...messages, userMsg])

    try {
      abortRef.current = new AbortController()
      const res = await api.chat.sendStream(agent.id, text, sessionId.current, history)

      if (!res.ok || !res.body) {
        throw new Error(`Stream failed: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })

        // SSE format: lines starting with "data: "
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              const delta =
                parsed?.choices?.[0]?.delta?.content ??
                parsed?.delta ??
                parsed?.content ??
                parsed?.text ??
                ''
              accumulated += delta
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulated,
                  streaming: true,
                }
                return updated
              })
            } catch {
              // raw text chunk
              accumulated += data
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulated,
                  streaming: true,
                }
                return updated
              })
            }
          }
        }
      }

      // Mark done
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: accumulated || '…',
          streaming: false,
        }
        return updated
      })
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          streaming: false,
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Render simple markdown bold
  function renderContent(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700/60 bg-[#0d0d12] shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: 540 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800/70 bg-zinc-900/60">
          <div
            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColor(agent.id)} flex items-center justify-center text-white font-bold text-sm shrink-0`}
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
            <p className="text-[11px] text-zinc-500">Test Chat</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" style={{ maxHeight: 360 }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {msg.role === 'assistant' && (
                <div
                  className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColor(agent.id)} flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5`}
                >
                  {agent.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#00E599]/15 text-[#00E599] rounded-tr-sm border border-[#00E599]/20'
                    : 'bg-zinc-800/70 text-zinc-200 rounded-tl-sm border border-zinc-700/40'
                }`}
              >
                {renderContent(msg.content)}
                {msg.streaming && (
                  <span className="inline-block w-1 h-3.5 bg-[#00E599] ml-0.5 animate-pulse rounded-sm align-middle" />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-zinc-800/70 bg-zinc-900/40">
          <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2 border border-zinc-700/40 focus-within:border-[#00E599]/40 transition-colors">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              disabled={streaming}
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none min-w-0"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              className="w-7 h-7 rounded-lg bg-[#00E599] hover:bg-[#00d48a] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
            >
              {streaming ? (
                <Loader2 size={13} className="text-black animate-spin" />
              ) : (
                <Send size={13} className="text-black" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5 text-center">
            Session · {sessionId.current.slice(-8)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Agent Card ─────────────────────────────────────────────────────────────────
interface AgentCardProps {
  agent: Agent
  onTestChat: (agent: Agent) => void
  onViewDetails: (id: string) => void
  onEmbed: (id: string) => void
  copiedId: string | null
}

function AgentCard({ agent, onTestChat, onViewDetails, onEmbed, copiedId }: AgentCardProps) {
  const model = agent.config?.model ?? 'gpt-4o'
  const convCount = agent.conversation_count ?? 0
  const docCount = agent.document_count ?? 0
  const isCopied = copiedId === agent.id

  return (
    <div className="group relative rounded-2xl border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700/60 transition-all duration-200 p-5 flex flex-col gap-4 overflow-hidden">
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(0,229,153,0.04) 0%, transparent 70%)' }}
      />

      {/* Top row: avatar + name + status */}
      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor(agent.id)} flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg`}
        >
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00E599]/10 border border-[#00E599]/20 text-[10px] font-medium text-[#00E599]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] animate-pulse" />
              Active
            </span>
          </div>
          {agent.description && (
            <p className="text-[12px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
              {agent.description}
            </p>
          )}
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        {/* Model badge */}
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-300 font-medium">
          <Brain size={10} />
          {model}
        </span>
        {/* Conversations badge */}
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 font-medium">
          <MessageSquare size={10} />
          {convCount.toLocaleString()} chats
        </span>
        {/* Documents badge */}
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-medium">
          <FileText size={10} />
          {docCount} docs
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-auto pt-3 border-t border-zinc-800/60">
        {/* Test Chat */}
        <button
          onClick={() => onTestChat(agent)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#00E599]/10 hover:bg-[#00E599]/20 border border-[#00E599]/20 hover:border-[#00E599]/40 text-[#00E599] text-[12px] font-medium transition-all"
        >
          <MessageSquare size={12} />
          Test Chat
        </button>

        {/* View Details */}
        <button
          onClick={() => onViewDetails(agent.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 hover:border-zinc-600/60 text-zinc-300 text-[12px] font-medium transition-all"
        >
          View Details
          <ChevronRight size={12} />
        </button>

        {/* Embed */}
        <button
          onClick={() => onEmbed(agent.id)}
          title="Copy embed code"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 hover:border-zinc-600/60 text-zinc-400 hover:text-zinc-200 transition-all"
        >
          {isCopied ? <Check size={13} className="text-[#00E599]" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  )
}

// ── Stats Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-zinc-800/60 bg-zinc-900/40">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-white leading-tight">{value}</p>
        <p className="text-[11px] text-zinc-500">{label}</p>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const router = useRouter()
  const { success, error: toastError, info } = useToast()

  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [chatAgent, setChatAgent] = useState<Agent | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Load agents
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.agents
      .list()
      .then(({ agents: data }) => {
        if (!cancelled) setAgents(data ?? [])
      })
      .catch((err) => {
        if (!cancelled) toastError('Failed to load agents', err?.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // Filtered agents
  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Stats
  const totalConversations = agents.reduce((acc, a) => acc + (a.conversation_count ?? 0), 0)
  const totalDocuments = agents.reduce((acc, a) => acc + (a.document_count ?? 0), 0)
  const uniqueModels = new Set(agents.map((a) => a.config?.model ?? 'gpt-4o')).size

  // Embed handler
  async function handleEmbed(id: string) {
    try {
      const { embed_code } = await api.agents.embedCode(id)
      await navigator.clipboard.writeText(embed_code)
      setCopiedId(id)
      success('Embed code copied!', 'Paste it into your website HTML.')
      setTimeout(() => setCopiedId(null), 2500)
    } catch (err: any) {
      toastError('Could not copy embed code', err?.message)
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 border border-[#00E599]/20 flex items-center justify-center">
              <Bot size={20} className="text-[#00E599]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">AI Agents</h1>
              <p className="text-[13px] text-zinc-500 mt-0.5">
                {loading ? 'Loading…' : `${agents.length} agent${agents.length !== 1 ? 's' : ''} deployed`}
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push('/dashboard/autopilot')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00E599] hover:bg-[#00d48a] text-black font-semibold text-sm transition-colors shadow-lg shadow-[#00E599]/20"
          >
            <Plus size={16} />
            New Agent
          </button>
        </div>

        {/* ── Stats Row ── */}
        {!loading && agents.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Bot size={16} className="text-[#00E599]" />}
              label="Total Agents"
              value={agents.length}
              color="bg-[#00E599]/10 border border-[#00E599]/20"
            />
            <StatCard
              icon={<MessageSquare size={16} className="text-blue-400" />}
              label="Conversations Handled"
              value={totalConversations.toLocaleString()}
              color="bg-blue-500/10 border border-blue-500/20"
            />
            <StatCard
              icon={<FileText size={16} className="text-amber-400" />}
              label="Documents Trained"
              value={totalDocuments.toLocaleString()}
              color="bg-amber-500/10 border border-amber-500/20"
            />
            <StatCard
              icon={<Brain size={16} className="text-violet-400" />}
              label="Models Used"
              value={uniqueModels}
              color="bg-violet-500/10 border border-violet-500/20"
            />
          </div>
        )}

        {/* ── Search / Filter Bar ── */}
        {!loading && agents.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 focus-within:border-zinc-600/60 transition-colors">
              <Search size={15} className="text-zinc-500 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agents by name…"
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-2">
              <Bot size={28} className="text-zinc-600" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-300">No agents deployed yet</h2>
            <p className="text-sm text-zinc-600 max-w-xs">
              Create your first AI agent to start handling customer conversations automatically.
            </p>
            <button
              onClick={() => router.push('/dashboard/autopilot')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00E599] hover:bg-[#00d48a] text-black font-semibold text-sm transition-colors shadow-lg shadow-[#00E599]/20 mt-2"
            >
              <Sparkles size={15} />
              Deploy First Agent
            </button>
          </div>
        )}

        {/* ── No Search Results ── */}
        {!loading && agents.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <Search size={28} className="text-zinc-700" />
            <p className="text-sm text-zinc-500">
              No agents match &quot;<span className="text-zinc-300">{searchQuery}</span>&quot;
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-[#00E599] text-sm hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {/* ── Agents Grid ── */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onTestChat={(a) => setChatAgent(a)}
                onViewDetails={(id) => router.push(`/dashboard/agents/${id}`)}
                onEmbed={handleEmbed}
                copiedId={copiedId}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Test Chat Modal ── */}
      {chatAgent && (
        <TestChatModal
          agent={chatAgent}
          onClose={() => setChatAgent(null)}
        />
      )}
    </div>
  )
}
