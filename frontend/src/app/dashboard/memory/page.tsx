'use client'
import { useState, useEffect } from 'react'
import {
  Brain, Trash2, Loader2, Shield, AlertTriangle, RefreshCw,
  Search, User, Briefcase, MapPin, Star, Zap, Edit2, Check,
  X, ChevronDown, ChevronRight, Lock
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

type Fact = { id: string; key: string; value: string; category: string; importance?: number; confidence?: number; source?: string; created_at: string; updated_at?: string }
type Skill = { id: string; key: string; task: string; quality: string; confidence: number; learned_at: string }
type ProfileEntry = { key: string; label: string; icon: any; value?: string }

type Tab = 'Facts' | 'Skills' | 'Profile'

const PROFILE_FIELDS: Omit<ProfileEntry, 'value'>[] = [
  { key: 'user_name',   label: 'Name',       icon: User },
  { key: 'company',     label: 'Company',     icon: Briefcase },
  { key: 'role',        label: 'Role',        icon: Star },
  { key: 'location',    label: 'Location',    icon: MapPin },
  { key: 'preference',  label: 'Preference',  icon: Zap },
]

function catColor(cat: string) {
  const m: Record<string,string> = {
    preference: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    skill:      'bg-purple-500/15 text-purple-400 border-purple-500/20',
    person:     'bg-[#00E599]/15 text-[#00E599] border-[#00E599]/20',
    entity:     'bg-orange-500/15 text-orange-400 border-orange-500/20',
    pattern:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    fact:       'bg-zinc-700 text-zinc-300 border-zinc-600',
  }
  return m[cat] || 'bg-zinc-800 text-zinc-400 border-zinc-700'
}

function sourceLabel(source?: string) {
  if (!source) return 'Inferred'
  if (source === 'manual') return 'Set by you'
  if (source === 'auto-learned') return 'Auto-learned'
  if (source === 'task_harvest') return 'Learned from task'
  return source
}

function ConfidenceBar({ value }: { value?: number }) {
  const pct = Math.round((value || 0.8) * 100)
  const color = pct >= 80 ? 'bg-[#00E599]' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-zinc-600 w-8 text-right">{pct}%</span>
    </div>
  )
}

// ── Facts Tab ─────────────────────────────────────────────────────────────────

function FactsTab() {
  const [grouped, setGrouped] = useState<Record<string, Fact[]>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['preference', 'fact']))
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [wiping, setWiping] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.memory.facts()
      setGrouped(res.grouped || {})
      setTotal(res.total || 0)
      if (res.grouped) setExpanded(new Set(Object.keys(res.grouped).slice(0, 3)))
    } catch { /* silently */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const deleteFact = async (id: string, category: string) => {
    try {
      await api.memory.deleteFact(id)
      setGrouped(prev => {
        const updated = { ...prev }
        if (updated[category]) updated[category] = updated[category].filter(f => f.id !== id)
        return updated
      })
      setTotal(t => t - 1)
    } catch {
      toast({ title: 'Could not delete fact', type: 'error' })
    }
  }

  const wipeAll = async () => {
    setWiping(true)
    try {
      await api.memory.wipeAll()
      setGrouped({})
      setTotal(0)
      setConfirmWipe(false)
      toast({ title: 'All memories cleared', type: 'success' })
    } catch {
      toast({ title: 'Could not clear memories', type: 'error' })
    } finally { setWiping(false) }
  }

  const toggleSection = (cat: string) => {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(cat) ? s.delete(cat) : s.add(cat)
      return s
    })
  }

  const filteredGrouped = Object.entries(grouped).reduce<Record<string, Fact[]>>((acc, [cat, facts]) => {
    if (!search) { acc[cat] = facts; return acc }
    const f = facts.filter(f =>
      f.key.toLowerCase().includes(search.toLowerCase()) ||
      f.value.toLowerCase().includes(search.toLowerCase())
    )
    if (f.length) acc[cat] = f
    return acc
  }, {})

  const categories = Object.keys(filteredGrouped)
  const avgConf = total > 0
    ? Math.round(Object.values(grouped).flat().reduce((s, f) => s + (f.confidence || 0.8), 0) / total * 100)
    : 0

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Facts', value: total },
          { label: 'Categories', value: categories.length || Object.keys(grouped).length },
          { label: 'Avg Confidence', value: total ? `${avgConf}%` : '—' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-3.5 h-3.5" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search facts..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E599]/50"
          />
        </div>
        <button onClick={load} className="p-2 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => setConfirmWipe(true)}
          className="flex items-center gap-1.5 px-3 py-2 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 text-sm transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear all
        </button>
      </div>

      {/* Facts grouped */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="h-3 bg-zinc-800 rounded w-[30%]" />
              <div className="h-3 bg-zinc-800 rounded w-[60%]" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-500 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
            <Brain className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Nothing stored yet</p>
            <p className="text-xs text-zinc-500">
              Chatbolt learns about you as you work — start by running a task.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => {
            const facts = filteredGrouped[cat]
            const isOpen = expanded.has(cat)
            return (
              <div key={cat} className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection(cat)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${catColor(cat)}`}>
                      {cat}
                    </span>
                    <span className="text-xs text-zinc-500">{facts.length} {facts.length === 1 ? 'fact' : 'facts'}</span>
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                </button>
                {isOpen && (
                  <div className="divide-y divide-zinc-800/50">
                    {facts.map(f => (
                      <div key={f.id} className="px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs font-medium text-zinc-400">
                                {f.key.replace(/_/g, ' ')}
                              </p>
                              <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                                {sourceLabel(f.source)}
                              </span>
                            </div>
                            <p className="text-sm text-white">{f.value}</p>
                            <div className="mt-2 max-w-[200px]">
                              <ConfidenceBar value={f.confidence} />
                            </div>
                          </div>
                          <button
                            onClick={() => deleteFact(f.id, cat)}
                            className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Wipe confirm */}
      {confirmWipe && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-red-500/10">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="font-semibold text-white">Clear all memories?</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-5">
              This permanently deletes all {total} stored facts. Chatbolt will start fresh. Cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmWipe(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={wipeAll} disabled={wiping} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                {wiping ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Clear all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Skills Tab ─────────────────────────────────────────────────────────────────

function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    api.memory.skills()
      .then(res => setSkills(res.skills || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-600" /></div>

  if (skills.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-600">
      <Zap className="w-10 h-10" />
      <p className="text-sm">No skills learned yet</p>
      <p className="text-xs text-zinc-700">Complete tasks and Chatbolt will remember patterns that worked</p>
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-600">Chatbolt automatically remembers task patterns that produced great results.</p>
      <div className="grid gap-3">
        {skills.map(s => {
          const pct = Math.round(s.confidence * 100)
          const quality = s.quality === 'excellent' ? { label: 'Excellent', color: 'text-[#00E599]' } : { label: 'Good', color: 'text-yellow-400' }
          return (
            <div key={s.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.quality === 'excellent' ? 'bg-[#00E599]/15' : 'bg-yellow-500/10'}`}>
                  <Star className={`w-5 h-5 ${s.quality === 'excellent' ? 'text-[#00E599]' : 'text-yellow-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white capitalize">{s.task}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs font-medium ${quality.color}`}>{quality.label}</span>
                    <span className="text-xs text-zinc-600">Confidence: {pct}%</span>
                    <span className="text-xs text-zinc-700">{new Date(s.learned_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-2">
                    <ConfidenceBar value={s.confidence} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Profile Tab ────────────────────────────────────────────────────────────────

function ProfileTab() {
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    api.memory.profile()
      .then(res => setProfile(res.profile || {}))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async (key: string) => {
    setSaving(true)
    try {
      await api.memory.setPreference(key, editValue)
      setProfile(prev => ({ ...prev, [key]: editValue }))
      setEditing(null)
      toast({ title: 'Preference saved', type: 'success' })
    } catch {
      toast({ title: 'Could not save', type: 'error' })
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-600" /></div>

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div className="bg-gradient-to-br from-[#00E599]/10 to-transparent border border-[#00E599]/20 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-[#00E599]/20 border border-[#00E599]/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-[#00E599]">
              {(profile['user_name'] || '?')[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-white text-base">{profile['user_name'] || 'Unknown User'}</h3>
            {profile['role'] && profile['company'] && (
              <p className="text-sm text-zinc-400">{profile['role']} at {profile['company']}</p>
            )}
            {profile['location'] && (
              <p className="text-xs text-zinc-600 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {profile['location']}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          This profile is built automatically from your conversations.
          Edit any field to correct or add information.
        </p>
      </div>

      {/* Fields */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl divide-y divide-zinc-800/50 overflow-hidden">
        {PROFILE_FIELDS.map(({ key, label, icon: Icon }) => {
          const value = profile[key]
          const isEditing = editing === key
          return (
            <div key={key} className="px-5 py-3.5 hover:bg-zinc-800/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500 mb-1">{label}</p>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') save(key); if (e.key === 'Escape') setEditing(null) }}
                        className="flex-1 bg-zinc-900 border border-[#00E599]/50 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none"
                        placeholder={`Enter your ${label.toLowerCase()}...`}
                      />
                      <button onClick={() => save(key)} disabled={saving} className="p-1.5 bg-[#00E599] text-black rounded-lg hover:bg-[#00E599]/90 transition-colors">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditing(null)} className="p-1.5 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className={`text-sm ${value ? 'text-white' : 'text-zinc-600 italic'}`}>
                      {value || `Not set — start chatting to auto-learn`}
                    </p>
                  )}
                </div>
                {!isEditing && (
                  <button
                    onClick={() => { setEditing(key); setEditValue(value || '') }}
                    className="p-1.5 text-zinc-600 hover:text-[#00E599] hover:bg-[#00E599]/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4">
        <Lock className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-600 leading-relaxed">
          Profile data is stored only on your account and never shared. 
          Chatbolt uses this to personalize responses — always respectfully and never for ads.
        </p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const [tab, setTab] = useState<Tab>('Facts')
  const tabs: Tab[] = ['Facts', 'Skills', 'Profile']

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Memory & Privacy</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Everything Chatbolt knows about you — transparent and in your control</p>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="flex items-start gap-3 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <Shield className="w-4 h-4 text-[#00E599] mt-0.5 shrink-0" />
          <p className="text-xs text-zinc-400 leading-relaxed">
            Chatbolt learns from your conversations to give smarter, faster responses. All memory is encrypted, 
            tied to your account, and you can delete any fact or wipe everything at any time.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'Facts'   && <FactsTab />}
        {tab === 'Skills'  && <SkillsTab />}
        {tab === 'Profile' && <ProfileTab />}
      </div>
    </div>
  )
}
