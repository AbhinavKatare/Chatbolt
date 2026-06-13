'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Clock, Plus, Calendar, ArrowRight, CheckCircle2,
  Workflow, Trash2, Loader2, Sparkles, RefreshCw, X, Play,
  ChevronRight, Zap, Pause, AlarmClock, Layers, Bolt,
  Search, ExternalLink, ToggleLeft, ToggleRight
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduledTask = {
  id: string
  workflow_name: string
  workflow_id: string
  cron_expression: string
  is_active: boolean
  last_triggered?: string
  description?: string
}

type WorkflowItem = {
  id: string
  name: string
}

// ─── Cron Humanizer ───────────────────────────────────────────────────────────

function humanizeCron(cron: string): string {
  if (!cron || typeof cron !== 'string') return 'Invalid schedule'
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return `Custom: ${cron}`

  const [minute, hour, dom, month, dow] = parts

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtTime = (h: string, m: string) => {
    const hNum = parseInt(h, 10)
    const mNum = parseInt(m, 10)
    if (isNaN(hNum) || isNaN(mNum)) return `${h}:${m}`
    const suffix = hNum >= 12 ? 'PM' : 'AM'
    const h12 = hNum % 12 === 0 ? 12 : hNum % 12
    return `${h12}:${pad(mNum)} ${suffix}`
  }

  const DOW_NAMES: Record<string, string> = {
    '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday',
    '4': 'Thursday', '5': 'Friday', '6': 'Saturday',
    'sun': 'Sunday', 'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday',
    'thu': 'Thursday', 'fri': 'Friday', 'sat': 'Saturday',
  }

  const MONTH_NAMES: Record<string, string> = {
    '1': 'January', '2': 'February', '3': 'March', '4': 'April',
    '5': 'May', '6': 'June', '7': 'July', '8': 'August',
    '9': 'September', '10': 'October', '11': 'November', '12': 'December',
  }

  const isNum = (v: string) => /^\d+$/.test(v)
  const isWild = (v: string) => v === '*'

  // Every minute
  if (minute === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*')
    return 'Every minute'

  // Every N minutes
  if (minute.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const n = minute.slice(2)
    return `Every ${n} minutes`
  }

  // Every hour at minute X
  if (isNum(minute) && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `Every hour at :${pad(parseInt(minute, 10))}`
  }

  // Weekdays (1-5) at specific time
  if (dow === '1-5' && isNum(hour) && isNum(minute) && isWild(dom) && isWild(month)) {
    return `Weekdays at ${fmtTime(hour, minute)}`
  }

  // Mon-Fri
  if (dow === 'mon-fri' && isNum(hour) && isNum(minute) && isWild(dom) && isWild(month)) {
    return `Weekdays at ${fmtTime(hour, minute)}`
  }

  // Every day at specific time
  if (isNum(hour) && isNum(minute) && isWild(dom) && isWild(month) && isWild(dow)) {
    return `Every day at ${fmtTime(hour, minute)}`
  }

  // Specific day of week
  if (isNum(dow) && isNum(hour) && isNum(minute) && isWild(dom) && isWild(month)) {
    const dayName = DOW_NAMES[dow] || `Day ${dow}`
    return `Every ${dayName} at ${fmtTime(hour, minute)}`
  }

  // Named day of week
  if (!isNum(dow) && dow !== '*' && !dow.includes('-') && isNum(hour) && isNum(minute)) {
    const dayName = DOW_NAMES[dow.toLowerCase()] || dow
    return `Every ${dayName} at ${fmtTime(hour, minute)}`
  }

  // Every N hours
  if (hour.startsWith('*/') && minute === '0' && isWild(dom) && isWild(month) && isWild(dow)) {
    const n = hour.slice(2)
    return `Every ${n} hours`
  }

  // Specific day of month
  if (isNum(dom) && isNum(hour) && isNum(minute) && isWild(month) && isWild(dow)) {
    const suffix = parseInt(dom, 10) === 1 ? 'st' : parseInt(dom, 10) === 2 ? 'nd' : parseInt(dom, 10) === 3 ? 'rd' : 'th'
    return `Monthly on the ${dom}${suffix} at ${fmtTime(hour, minute)}`
  }

  // Specific month + dom
  if (isNum(month) && isNum(dom) && isNum(hour) && isNum(minute) && isWild(dow)) {
    return `${MONTH_NAMES[month] || month} ${dom} at ${fmtTime(hour, minute)}`
  }

  return `Custom: ${cron}`
}

// ─── Next-Run Calculator ──────────────────────────────────────────────────────

function getNextRunTimes(cron: string, count: number = 3): Date[] {
  if (!cron || typeof cron !== 'string') return []
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return []

  const [minuteExpr, hourExpr, domExpr, , dowExpr] = parts

  function parseField(expr: string, min: number, max: number): number[] {
    if (expr === '*') {
      const result: number[] = []
      for (let i = min; i <= max; i++) result.push(i)
      return result
    }
    if (expr.startsWith('*/')) {
      const step = parseInt(expr.slice(2), 10)
      if (isNaN(step) || step <= 0) return []
      const result: number[] = []
      for (let i = min; i <= max; i += step) result.push(i)
      return result
    }
    if (expr.includes('-')) {
      const [start, end] = expr.split('-').map(Number)
      const result: number[] = []
      for (let i = start; i <= end; i++) result.push(i)
      return result
    }
    if (expr.includes(',')) {
      return expr.split(',').map(Number).filter(n => n >= min && n <= max)
    }
    const val = parseInt(expr, 10)
    if (!isNaN(val) && val >= min && val <= max) return [val]
    return []
  }

  const validMinutes = parseField(minuteExpr, 0, 59)
  const validHours   = parseField(hourExpr,   0, 23)
  const validDows    = dowExpr === '*' ? null : parseField(dowExpr, 0, 6)
  const validDoms    = domExpr === '*' ? null : parseField(domExpr, 1, 31)

  const results: Date[] = []
  const now = new Date()
  // Start from next minute
  const cursor = new Date(now)
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  const maxIterations = 60 * 24 * 366 // search up to a year forward
  let iterations = 0

  while (results.length < count && iterations < maxIterations) {
    iterations++
    const m   = cursor.getMinutes()
    const h   = cursor.getHours()
    const dom = cursor.getDate()
    const dow = cursor.getDay() // 0=Sun

    const minuteOk = validMinutes.includes(m)
    const hourOk   = validHours.includes(h)
    const dowOk    = validDows === null || validDows.includes(dow)
    const domOk    = validDoms === null || validDoms.includes(dom)

    if (minuteOk && hourOk && dowOk && domOk) {
      results.push(new Date(cursor))
      // Advance by 1 minute to find next occurrence
      cursor.setMinutes(cursor.getMinutes() + 1)
    } else if (!minuteOk) {
      // Find next valid minute
      const nextMin = validMinutes.find(v => v > m)
      if (nextMin !== undefined) {
        cursor.setMinutes(nextMin)
      } else {
        // Roll over to next hour
        cursor.setMinutes(validMinutes[0])
        cursor.setHours(cursor.getHours() + 1)
      }
    } else if (!hourOk) {
      // Find next valid hour
      const nextHour = validHours.find(v => v > h)
      if (nextHour !== undefined) {
        cursor.setHours(nextHour)
        cursor.setMinutes(validMinutes[0])
      } else {
        // Roll over to next day
        cursor.setDate(cursor.getDate() + 1)
        cursor.setHours(validHours[0])
        cursor.setMinutes(validMinutes[0])
      }
    } else {
      // day mismatch — advance one day
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(validHours[0])
      cursor.setMinutes(validMinutes[0])
    }
  }

  return results
}

function formatRelative(date: Date): string {
  const now = Date.now()
  const diff = date.getTime() - now
  if (diff <= 0) return 'Now'
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days > 0)  return `in ${days}d ${hours % 24}h`
  if (hours > 0) return `in ${hours}h ${mins % 60}m`
  return `in ${mins}m`
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// ─── Preset Schedules ─────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Every day at 9 AM',    cron: '0 9 * * *'   },
  { label: 'Weekdays at 8 AM',     cron: '0 8 * * 1-5' },
  { label: 'Every Monday at 9 AM', cron: '0 9 * * 1'   },
]

// ─── Empty State Ideas ────────────────────────────────────────────────────────

const IDEA_ROWS: { text: string; cron: string; description: string }[] = [
  {
    text: 'Set up automated monitoring for any topic, competitor, or keyword.',
    cron: '0 8 * * 1-5',
    description: 'Monitor competitors and keywords every weekday morning',
  },
  {
    text: "Get a daily summary of what's in your inbox before starting your day.",
    cron: '0 7 * * *',
    description: 'Daily inbox summary at 7 AM',
  },
  {
    text: 'Turn any manual, multi-step process into an automated pipeline on schedule.',
    cron: '0 9 * * 1',
    description: 'Weekly automated pipeline run every Monday morning',
  },
]

// ─── Mock seed data ───────────────────────────────────────────────────────────

const MOCK_TASKS: ScheduledTask[] = [
  {
    id: 'sc_1',
    workflow_name: 'Competitor B2B Enrichment Specialist',
    workflow_id: 'wf_mock_1',
    cron_expression: '0 9 * * 1-5',
    is_active: true,
    last_triggered: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    description: 'Runs competitor enrichment every weekday morning',
  },
  {
    id: 'sc_2',
    workflow_name: 'SMTP Email Outreach Sequence Builder',
    workflow_id: 'wf_mock_2',
    cron_expression: '0 10 * * 1-5',
    is_active: true,
    last_triggered: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    description: 'Builds daily outreach sequences weekdays at 10 AM',
  },
]

// ─── Page Component ───────────────────────────────────────────────────────────

type PageTab = 'Scheduled' | 'Templates' | 'Event Triggers'

// ─── Templates Sub-component ─────────────────────────────────────────────────

function TemplatesTab({ workflows, prefillName }: { workflows: WorkflowItem[]; prefillName?: string }) {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(prefillName || '')
  const [category, setCategory] = useState('All')
  const [activating, setActivating] = useState<string | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Record<string, string>>({})
  const { success, error } = useToast()

  useEffect(() => {
    if (prefillName) {
      setTimeout(() => {
        const el = document.getElementById('template-search-input')
        if (el) el.focus()
      }, 150)
    }
  }, [prefillName])

  useEffect(() => {
    api.automations.templates()
      .then(r => setTemplates(r.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const cats = ['All', ...Array.from(new Set(templates.map(t => t.category)))]

  const filtered = templates.filter(t => {
    const matchCat = category === 'All' || t.category === category
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const activate = async (templateId: string, templateName: string) => {
    const wfId = selectedWorkflow[templateId]
    if (!wfId) { error('Select a process first', 'Choose which process to trigger'); return }
    setActivating(templateId)
    try {
      await api.automations.fromTemplate(templateId, wfId)
      success('Automation activated', `"${templateName}" is now scheduled`)
    } catch (e: any) {
      error('Could not activate', e.message)
    } finally {
      setActivating(null)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-600" /></div>

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input id="template-search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." className="w-full bg-[#0D0D11] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E599]/40" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {cats.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                category === c ? 'bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30' : 'bg-white/[0.03] text-zinc-500 border border-white/[0.05] hover:text-white'
              }`}>{c}</button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(t => (
          <div key={t.id} className="bg-[#0D0D11] border border-white/[0.05] rounded-2xl p-5 hover:border-white/[0.10] transition-all">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${t.color}18` }}>
                {t.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">{t.name}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{t.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] text-zinc-600 bg-zinc-800/60 border border-zinc-700/40 px-2 py-0.5 rounded font-mono">{t.cron}</span>
              <span className="text-[9px] text-zinc-500">{humanizeCron(t.cron)}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedWorkflow[t.id] || ''}
                onChange={e => setSelectedWorkflow(prev => ({ ...prev, [t.id]: e.target.value }))}
                className="flex-1 bg-black/30 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-[#00E599]/40"
              >
                <option value="">— Choose process —</option>
                {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <button
                onClick={() => activate(t.id, t.name)}
                disabled={activating === t.id || !selectedWorkflow[t.id]}
                className="px-3 py-1.5 bg-[#00E599] text-black text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-[#00E599]/90 disabled:opacity-40 transition-all flex items-center gap-1"
              >
                {activating === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Activate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Event Triggers Sub-component ────────────────────────────────────────────

function EventTriggersTab({ workflows }: { workflows: WorkflowItem[] }) {
  const [types, setTypes] = useState<any[]>([])
  const [active, setActive] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState('')
  const [selectedWf, setSelectedWf] = useState('')
  const [creating, setCreating] = useState(false)
  const { success, error } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const [typesRes, activeRes] = await Promise.all([
      api.automations.eventTriggerTypes().catch(() => ({ triggers: [] })),
      api.automations.activeEventTriggers().catch(() => ({ rules: [] })),
    ])
    setTypes(typesRes.triggers || [])
    setActive(activeRes.rules || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!selectedType || !selectedWf) return
    setCreating(true)
    try {
      await api.automations.createEventTrigger({ trigger_type: selectedType, workflow_id: selectedWf })
      success('Trigger created', 'Now listening for events')
      setSelectedType('')
      setSelectedWf('')
      await load()
    } catch (e: any) {
      error('Could not create trigger', e.message)
    } finally {
      setCreating(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await api.automations.deleteEventTrigger(id)
      setActive(prev => prev.filter(r => r.id !== id))
    } catch { error('Could not remove trigger') }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-600" /></div>

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
      {/* Trigger type cards */}
      <div>
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Choose a trigger</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {types.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedType(selectedType === t.id ? '' : t.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedType === t.id
                  ? 'border-[#00E599]/40 bg-[#00E599]/10'
                  : 'border-white/[0.05] bg-[#0D0D11] hover:border-white/[0.10]'
              }`}
            >
              <div className="text-2xl mb-2">{t.icon}</div>
              <p className="text-xs font-bold text-white">{t.name}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Workflow + create */}
      {selectedType && (
        <div className="bg-[#0D0D11] border border-[#00E599]/20 rounded-xl p-5 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5">Process to trigger</label>
            <select
              value={selectedWf}
              onChange={e => setSelectedWf(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E599]/40"
            >
              <option value="">— Choose process —</option>
              {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <button
            onClick={create}
            disabled={creating || !selectedWf}
            className="px-5 py-2.5 bg-[#00E599] text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#00E599]/90 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bolt className="w-3.5 h-3.5" />}
            Enable Trigger
          </button>
        </div>
      )}

      {/* Active triggers */}
      {active.length > 0 && (
        <div>
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Active triggers ({active.length})</h3>
          <div className="bg-[#0D0D11] border border-white/[0.05] rounded-xl divide-y divide-white/[0.04] overflow-hidden">
            {active.map(r => (
              <div key={r.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                <div className="w-2 h-2 rounded-full bg-[#00E599] animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">{r.trigger_type.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-zinc-600">{r.workflow_name || 'Linked process'}</p>
                </div>
                <button onClick={() => remove(r.id)} className="p-1.5 text-zinc-600 hover:text-red-400 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && !selectedType && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-600">
          <Bolt className="w-8 h-8" />
          <p className="text-sm">No event triggers active</p>
          <p className="text-xs text-zinc-700">Pick a trigger above to get started</p>
        </div>
      )}
    </div>
  )
}

export default function ScheduledPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [activeTab, setActiveTab] = useState<PageTab>('Scheduled')

  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([])
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')
  const [cronExpression, setCronExpression] = useState('0 9 * * *')
  const [taskDescription, setTaskDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [prefillTemplate, setPrefillTemplate] = useState('')

  // ── Load data ───────────────────────────────────────────────────────────────

  useEffect(() => {
    loadData()
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const prefill = params.get('prefill')
      if (prefill === 'briefing') {
        setActiveTab('Templates')
        setPrefillTemplate('Daily Email Digest')
      }
    }
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const wfRes = await api.workflows.list().catch(() => ({ workflows: [] }))
      setWorkflows(wfRes.workflows || [])
      
      const schedulesRes = await api.schedules.list().catch(() => ({ schedules: [] }))
      setScheduledTasks(schedulesRes.schedules || [])
    } catch (err: any) {
      toastError('Failed to load scheduler', err?.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Modal helpers ────────────────────────────────────────────────────────────

  function openModal(prefillCron?: string, prefillDesc?: string) {
    setCronExpression(prefillCron ?? '0 9 * * *')
    setTaskDescription(prefillDesc ?? '')
    setSelectedWorkflowId('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setSelectedWorkflowId('')
    setCronExpression('0 9 * * *')
    setTaskDescription('')
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedWorkflowId) return
    setSubmitting(true)
    try {
      const selectedWf = workflows.find(w => w.id === selectedWorkflowId)
      const res = await api.schedules.create({
        workflow_id: selectedWorkflowId,
        workflow_name: selectedWf?.name || 'Scheduled Task',
        cron_expression: cronExpression,
        description: taskDescription,
        task_prompt: taskDescription || selectedWf?.name || 'Run workflow',
      })
      const newSchedule = res.schedule
      setScheduledTasks(prev => [...prev, newSchedule])
      toastSuccess('Schedule Created', `Runs: ${humanizeCron(cronExpression)}`)
      closeModal()
    } catch (err: any) {
      toastError('Failed to schedule', err?.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(id: string) {
    const task = scheduledTasks.find(t => t.id === id)
    if (!task) return
    const nextState = !task.is_active
    try {
      await api.schedules.toggle(id, nextState)
      setScheduledTasks(prev =>
        prev.map(t => (t.id === id ? { ...t, is_active: nextState } : t))
      )
      toastSuccess(nextState ? 'Schedule Activated' : 'Schedule Paused')
    } catch (err: any) {
      toastError('Failed to update schedule status', err?.message)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.schedules.delete(id)
      setScheduledTasks(prev => prev.filter(t => t.id !== id))
      toastSuccess('Schedule Removed')
    } catch (err: any) {
      toastError('Failed to remove schedule', err?.message)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  const totalSchedules  = scheduledTasks.length
  const activeSchedules = scheduledTasks.filter(t => t.is_active).length
  const tasksCompleted  = 247 // mock

  const nextRunDate: Date | null = (() => {
    const runs = scheduledTasks
      .filter(t => t.is_active)
      .flatMap(t => getNextRunTimes(t.cron_expression, 1))
      .sort((a, b) => a.getTime() - b.getTime())
    return runs[0] ?? null
  })()

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#050507] text-[#EDEDED] overflow-y-auto custom-scrollbar font-sans selection:bg-[#00E599]/30 relative">

      {/* ── Header ── */}
      <div className="h-14 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-1">
          {(['Scheduled', 'Templates', 'Event Triggers'] as PageTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                activeTab === tab
                  ? 'bg-white/[0.08] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab === 'Scheduled' && <AlarmClock className="inline w-3 h-3 mr-1" />}
              {tab === 'Templates' && <Layers className="inline w-3 h-3 mr-1" />}
              {tab === 'Event Triggers' && <Bolt className="inline w-3 h-3 mr-1" />}
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 'Scheduled' && scheduledTasks.length > 0 && (
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#00E599] text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#00E599]/90 active:scale-95 transition-all"
          >
            <Plus size={12} /> Add Schedule
          </button>
        )}
      </div>

      {activeTab === 'Templates' && <TemplatesTab workflows={workflows} prefillName={prefillTemplate} />}
      {activeTab === 'Event Triggers' && <EventTriggersTab workflows={workflows} />}
      {activeTab === 'Scheduled' && (
        loading ? (
            // ── Loading Skeleton ──
            <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-4 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-zinc-900/60 border border-zinc-800/40 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-zinc-800 rounded w-[40%]" />
                    <div className="h-3 bg-zinc-800 rounded w-[60%]" />
                  </div>
                </div>
              ))}
            </div>
          ) : scheduledTasks.length === 0 ? (
            // ── Empty State ──
            <div className="flex-grow flex flex-col items-center justify-center px-6 py-16">
              <div className="max-w-xl w-full flex flex-col items-center text-center space-y-6">
                {/* Icon */}
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 shadow-2xl">
                  <Clock size={28} />
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <h1 className="text-xl font-bold text-white">No automations yet</h1>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Automate your business tasks on dynamic schedules.
                  </p>
                </div>

                {/* Idea rows */}
                <div className="w-full space-y-2">
                  {IDEA_ROWS.map((idea, idx) => (
                    <div
                      key={idx}
                      onClick={() => openModal(idea.cron, idea.description)}
                      className="bg-[#0D0D11]/40 border border-white/[0.05] rounded-xl p-3.5 flex items-center justify-between text-left hover:border-[#00E599]/20 hover:bg-[#00E599]/[0.03] cursor-pointer transition-all group"
                    >
                      <div className="flex items-start gap-2.5">
                        <Sparkles size={11} className="text-[#00E599]/50 mt-0.5 shrink-0" />
                        <span className="text-xs text-zinc-400 font-semibold leading-relaxed">{idea.text}</span>
                      </div>
                      <ArrowRight size={11} className="text-zinc-650 group-hover:text-[#00E599] shrink-0 ml-3 transition-colors" />
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={() => openModal()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#00E599] text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                  <Plus size={12} />
                  Create your first automation
                </button>
              </div>
            </div>
        ) : (
          // ── Tasks View ──
          <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-6">

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Schedules', value: String(totalSchedules),  icon: <Calendar size={13} />,     color: 'text-zinc-400' },
                { label: 'Active',          value: String(activeSchedules), icon: <CheckCircle2 size={13} />, color: 'text-[#00E599]' },
                { label: 'Next Run In',     value: nextRunDate ? formatRelative(nextRunDate) : '—', icon: <Clock size={13} />, color: 'text-sky-400' },
                { label: 'Tasks Completed', value: String(tasksCompleted),  icon: <Zap size={13} />,          color: 'text-amber-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-[#0D0D11]/60 border border-white/[0.05] rounded-xl p-4 flex flex-col gap-2">
                  <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${stat.color}`}>
                    {stat.icon}
                    <span>{stat.label}</span>
                  </div>
                  <div className="text-xl font-black text-white">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Table card */}
            <div className="bg-[#0D0D11] border border-white/[0.05] rounded-2xl overflow-hidden shadow-2xl">
              {/* Table header */}
              <div className="px-6 py-4 border-b border-white/[0.04] bg-[#09090B]/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[#00E599]" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">Configured Execution Schedules</span>
                </div>
                <button
                  onClick={loadData}
                  className="p-1.5 text-zinc-600 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-white/[0.04]">
                {scheduledTasks.map(task => {
                  const nextRuns = getNextRunTimes(task.cron_expression, 1)
                  const nextRun  = nextRuns[0] ?? null

                  return (
                    <div key={task.id} className="px-6 py-4 flex items-center gap-4 flex-wrap hover:bg-white/[0.01] transition-colors group">
                      {/* Workflow icon + name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-[#00E599] shrink-0">
                          <Workflow size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{task.workflow_name}</div>
                          {task.description && (
                            <div className="text-[10px] text-zinc-600 truncate mt-0.5">{task.description}</div>
                          )}
                        </div>
                      </div>

                      {/* Humanized schedule */}
                      <div className="hidden sm:flex flex-col gap-0.5 min-w-[160px]">
                        <div className="text-[11px] font-semibold text-zinc-300">{humanizeCron(task.cron_expression)}</div>
                        <div className="text-[10px] text-zinc-600 font-mono">{task.cron_expression}</div>
                      </div>

                      {/* Next run */}
                      <div className="hidden md:flex flex-col gap-0.5 min-w-[120px]">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Next Run</div>
                        {nextRun ? (
                          <>
                            <div className="text-[11px] font-semibold text-sky-400">{formatRelative(nextRun)}</div>
                            <div className="text-[10px] text-zinc-600">{formatDateTime(nextRun)}</div>
                          </>
                        ) : (
                          <div className="text-[11px] text-zinc-600">—</div>
                        )}
                      </div>

                      {/* Status pill */}
                      <div className="flex items-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          task.is_active
                            ? 'bg-[#00E599]/10 text-[#00E599] border-[#00E599]/20'
                            : 'bg-white/[0.03] text-zinc-500 border-white/[0.06]'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${task.is_active ? 'bg-[#00E599] animate-pulse' : 'bg-zinc-600'}`} />
                          {task.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggle(task.id)}
                          title={task.is_active ? 'Pause' : 'Resume'}
                          className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors"
                        >
                          {task.is_active ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          title="Delete"
                          className="p-2 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/[0.08] transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          <form
            onSubmit={handleCreateSchedule}
            className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl max-w-md w-full p-6 relative z-10 space-y-5 shadow-2xl"
            style={{ animation: 'fadeInScale 0.15s ease' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[#00E599]" />
                <span className="text-xs font-black uppercase tracking-wider text-white">Schedule Automated Task</span>
              </div>
              <button type="button" onClick={closeModal} className="text-zinc-500 hover:text-white transition-colors p-1 rounded">
                <X size={16} />
              </button>
            </div>

            {/* Workflow picker */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Select Process</label>
              <select
                value={selectedWorkflowId}
                onChange={e => setSelectedWorkflowId(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.06] text-xs text-white rounded-xl px-3.5 py-2.5 outline-none focus:border-[#00E599]/40 transition-colors appearance-none"
                required
              >
                <option value="">— Choose a process —</option>
                {workflows.length === 0 && (
                  <option value="demo_wf" className="text-zinc-400">Demo Process (no processes found)</option>
                )}
                {workflows.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Cron expression */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Cron Expression</label>

              {/* Preset pills */}
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <button
                    key={p.cron}
                    type="button"
                    onClick={() => setCronExpression(p.cron)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      cronExpression === p.cron
                        ? 'bg-[#00E599]/15 border-[#00E599]/40 text-[#00E599]'
                        : 'bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Cron input */}
              <input
                type="text"
                value={cronExpression}
                onChange={e => setCronExpression(e.target.value)}
                placeholder="0 9 * * *"
                className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#00E599]/40 placeholder-zinc-700 font-mono transition-colors"
                required
              />

              {/* Live humanized preview */}
              <div className="flex items-center gap-1.5 px-1">
                <Sparkles size={10} className="text-[#00E599]/60" />
                <span className="text-[10px] text-zinc-500">
                  Runs:{' '}
                  <span className="text-[#00E599] font-semibold">{humanizeCron(cronExpression)}</span>
                </span>
              </div>
            </div>

            {/* Next run preview */}
            {cronExpression && (() => {
              const upcoming = getNextRunTimes(cronExpression, 3)
              if (upcoming.length === 0) return null
              return (
                <div className="bg-black/30 border border-white/[0.04] rounded-xl px-4 py-3 space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Next Scheduled Runs</div>
                  <div className="space-y-1">
                    {upcoming.map((d, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400">{formatDateTime(d)}</span>
                        <span className="text-[10px] text-sky-400 font-semibold">{formatRelative(d)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Description (optional)</label>
              <textarea
                value={taskDescription}
                onChange={e => setTaskDescription(e.target.value)}
                placeholder="What does this scheduled task do?"
                rows={2}
                className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#00E599]/40 placeholder-zinc-700 resize-none transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:border-white/[0.10] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedWorkflowId}
                className="flex items-center gap-2 px-5 py-2 bg-[#00E599] text-black rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#00E599]/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {submitting ? (
                  <><Loader2 size={12} className="animate-spin" /> Creating…</>
                ) : (
                  <><Clock size={12} /> Schedule Task</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </div>
  )
}
