'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart2,
  TrendingUp,
  Clock,
  Star,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Calendar,
  Target,
  CheckCircle2,
  Award,
  Activity,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyTask {
  date: string
  count: number
  completed: number
  failed: number
}

interface TopCategory {
  category: string
  count: number
}

interface ProductivityData {
  daily_tasks: DailyTask[]
  top_categories: TopCategory[]
  time_saved_hours: number
  total_completed: number
  current_streak: number
  quality: { avg_rating: number | null; total_ratings: number }
}

interface AutomationStat {
  id: string
  name: string
  type: string
  total_runs: number
  successful_runs: number
  avg_duration_ms: number | null
  last_run_at: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDuration(ms: number | null) {
  if (!ms) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function successRateColor(rate: number) {
  if (rate >= 90) return 'bg-[#00E599]/20 text-[#00E599]'
  if (rate >= 70) return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-red-500/20 text-red-400'
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

function StatCard({ icon, label, value, sub, accent }: StatCardProps) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3 hover:border-zinc-700 transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? 'bg-[#00E599]/15 text-[#00E599]' : 'bg-zinc-800 text-zinc-400'}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ── Custom Bar Chart ───────────────────────────────────────────────────────────

function DailyActivityChart({ data }: { data: DailyTask[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">
        No task data for this period
      </div>
    )
  }

  const maxCount = Math.max(...data.map(d => Number(d.count) || 0), 1)
  const recent = data.slice(-30)

  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-40 w-full overflow-x-auto pb-2">
        {recent.map((d, i) => {
          const total = Number(d.count) || 0
          const completed = Number(d.completed) || 0
          const failed = Number(d.failed) || 0
          const other = Math.max(0, total - completed - failed)
          const heightPct = total === 0 ? 0 : Math.max(4, (total / maxCount) * 100)

          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1 flex-1 min-w-[18px] group cursor-default relative"
              title={`${formatDate(d.date)}: ${completed} completed, ${failed} failed`}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 hidden group-hover:flex flex-col items-center pointer-events-none">
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl">
                  <p className="text-white font-medium">{formatDate(d.date)}</p>
                  <p className="text-[#00E599]">✓ {completed} completed</p>
                  {failed > 0 && <p className="text-red-400">✗ {failed} failed</p>}
                  {other > 0 && <p className="text-zinc-400">~ {other} other</p>}
                </div>
                <div className="w-1.5 h-1.5 bg-zinc-800 border-r border-b border-zinc-700 rotate-45 -mt-1" />
              </div>

              {/* Bar stack */}
              <div
                className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse"
                style={{ height: `${heightPct}%` }}
              >
                {failed > 0 && (
                  <div
                    className="w-full bg-red-500/60 shrink-0"
                    style={{ height: `${(failed / total) * 100}%` }}
                  />
                )}
                {other > 0 && (
                  <div
                    className="w-full bg-zinc-600 shrink-0"
                    style={{ height: `${(other / total) * 100}%` }}
                  />
                )}
                {completed > 0 && (
                  <div
                    className="w-full bg-[#00E599] shrink-0"
                    style={{ height: `${(completed / total) * 100}%` }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* X-axis labels — show every ~5th label */}
      <div className="flex gap-1 w-full overflow-x-auto">
        {recent.map((d, i) => (
          <div key={i} className="flex-1 min-w-[18px] text-center">
            {i % Math.max(1, Math.floor(recent.length / 6)) === 0 && (
              <span className="text-[9px] text-zinc-600 leading-none">
                {formatDate(d.date)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#00E599]" />
          <span className="text-xs text-zinc-500">Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-500/60" />
          <span className="text-xs text-zinc-500">Failed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-zinc-600" />
          <span className="text-xs text-zinc-500">In Progress</span>
        </div>
      </div>
    </div>
  )
}

// ── Top Categories Chart ───────────────────────────────────────────────────────

function TopCategoriesChart({ data }: { data: TopCategory[] }) {
  if (!data || data.length === 0) {
    return <p className="text-zinc-600 text-sm py-4 text-center">No category data yet</p>
  }
  const maxCount = Math.max(...data.map(d => Number(d.count) || 0), 1)
  return (
    <div className="flex flex-col gap-3">
      {data.map((cat, i) => {
        const count = Number(cat.count) || 0
        const pct = Math.round((count / maxCount) * 100)
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 w-28 truncate capitalize">
              {cat.category || 'Unknown'}
            </span>
            <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-[#00E599] rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 w-8 text-right">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Stars Display ──────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-500 text-sm">No ratings yet</span>
  // value is between -1 and 1 (thumbs), convert to a 0–100 positive %
  const pct = Math.round(((value + 1) / 2) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <Star
            key={s}
            className={`w-4 h-4 ${s <= Math.round((pct / 100) * 5) ? 'text-[#00E599] fill-[#00E599]' : 'text-zinc-700'}`}
          />
        ))}
      </div>
      <span className="text-sm text-zinc-400">{pct}% positive</span>
    </div>
  )
}

// ── Feedback Widget ────────────────────────────────────────────────────────────

function FeedbackWidget() {
  const [lastRun, setLastRun] = useState<any>(null)
  const [rated, setRated] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    api.tasks.history(1).then(res => {
      if (res.runs && res.runs.length > 0) setLastRun(res.runs[0])
    }).catch(() => {})
  }, [])

  const handleRate = async (r: number) => {
    if (!lastRun || submitting || rated) return
    setSubmitting(true)
    try {
      await api.analytics.feedback(lastRun.id, r)
      setRating(r)
      setRated(true)
      toast({ title: 'Feedback recorded', message: 'Thanks for helping us improve!', type: 'success' })
    } catch {
      toast({ title: 'Could not submit feedback', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!lastRun) return null

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
      <p className="text-sm text-zinc-400 mb-3 font-medium flex items-center gap-2">
        <Award className="w-4 h-4 text-[#00E599]" />
        Rate your last task
      </p>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-white font-medium truncate">
            {lastRun.workflow?.name || lastRun.trigger || 'Untitled Task'}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">{formatRelativeTime(lastRun.created_at)}</p>
        </div>
        {rated ? (
          <div className="flex items-center gap-2 text-[#00E599] text-sm font-medium shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            Feedback recorded
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleRate(1)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-[#00E599]/20 hover:text-[#00E599] text-zinc-400 transition-colors text-xs font-medium border border-zinc-700 hover:border-[#00E599]/40 disabled:opacity-50"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              Good
            </button>
            <button
              onClick={() => handleRate(-1)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition-colors text-xs font-medium border border-zinc-700 hover:border-red-500/40 disabled:opacity-50"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              Poor
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Personal Tab ──────────────────────────────────────────────────────────────

function PersonalTab({ data, loading }: { data: ProductivityData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data || data.total_completed === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
          <BarChart2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">No data yet</h2>
          <p className="text-sm text-zinc-500 max-w-sm">
            Complete a task to see your productivity stats.
          </p>
        </div>
        <a
          href="/dashboard/terminal"
          className="px-5 py-2.5 bg-[#00E599] text-black text-xs font-black uppercase tracking-wider rounded-xl hover:bg-[#00E599]/90 active:scale-95 transition-all"
        >
          Go to Terminal →
        </a>
      </div>
    )
  }

  const avgRating = data.quality?.avg_rating !== null ? Number(data.quality.avg_rating) : null

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Tasks Completed"
          value={data.total_completed}
          sub="this period"
          accent
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Hours Saved"
          value={`${data.time_saved_hours}h`}
          sub="estimated"
          accent
        />
        <StatCard
          icon={<Calendar className="w-4 h-4" />}
          label="Active Days"
          value={data.current_streak}
          sub="days with tasks"
        />
        <StatCard
          icon={<Star className="w-4 h-4" />}
          label="Quality Score"
          value={avgRating !== null ? `${Math.round(((avgRating + 1) / 2) * 100)}%` : 'N/A'}
          sub={`${data.quality?.total_ratings || 0} ratings`}
        />
      </div>

      {/* Daily activity chart */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00E599]" />
              Daily Task Activity
            </h3>
            <p className="text-xs text-zinc-600 mt-0.5">Completed vs failed per day</p>
          </div>
        </div>
        <DailyActivityChart data={data.daily_tasks} />
      </div>

      {/* Bottom row: categories + quality */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top categories */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-[#00E599]" />
            Top Task Categories
          </h3>
          <TopCategoriesChart data={data.top_categories} />
        </div>

        {/* Quality */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-[#00E599]" />
            Output Quality
          </h3>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-3xl font-bold text-white mb-1">
                {avgRating !== null
                  ? `${Math.round(((avgRating + 1) / 2) * 100)}%`
                  : '—'}
              </p>
              <StarRating value={avgRating} />
            </div>
            <div className="pt-3 border-t border-zinc-800">
              <p className="text-xs text-zinc-500">
                Based on <span className="text-zinc-300">{data.quality?.total_ratings || 0}</span> feedback ratings.
                Rate your tasks below to improve this score.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback widget */}
      <FeedbackWidget />
    </div>
  )
}

// ── Automations Tab ────────────────────────────────────────────────────────────

function AutomationsTab({
  data,
  loading,
}: {
  data: AutomationStat[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-zinc-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Zap className="w-10 h-10 text-zinc-700" />
            <p className="text-zinc-500 text-sm font-medium">No automations yet</p>
            <p className="text-zinc-600 text-xs text-center max-w-xs">
              Build and run your first automation to see performance data here.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-5 py-3.5 text-left text-xs text-zinc-500 font-medium">Name</th>
                <th className="px-5 py-3.5 text-left text-xs text-zinc-500 font-medium">Category</th>
                <th className="px-5 py-3.5 text-right text-xs text-zinc-500 font-medium">Runs</th>
                <th className="px-5 py-3.5 text-right text-xs text-zinc-500 font-medium">Success Rate</th>
                <th className="px-5 py-3.5 text-right text-xs text-zinc-500 font-medium">Avg Duration</th>
                <th className="px-5 py-3.5 text-right text-xs text-zinc-500 font-medium">Last Run</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a, i) => {
                const total = Number(a.total_runs) || 0
                const success = Number(a.successful_runs) || 0
                const rate = total > 0 ? Math.round((success / total) * 100) : 0
                return (
                  <tr
                    key={a.id}
                    className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                      i === data.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-5 py-3.5 text-white font-medium truncate max-w-[180px]">
                      {a.name}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400 capitalize">
                      {a.type || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-zinc-300">{total}</td>
                    <td className="px-5 py-3.5 text-right">
                      {total === 0 ? (
                        <span className="text-zinc-600 text-xs">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${successRateColor(rate)}`}
                        >
                          {rate}%
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-zinc-400">
                      {formatDuration(a.avg_duration_ms)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-zinc-500 text-xs">
                      {formatRelativeTime(a.last_run_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Feedback widget on automations tab too */}
      <FeedbackWidget />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'Personal' | 'Automations'

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('Personal')
  const [days, setDays] = useState(30)

  const [productivityData, setProductivityData] = useState<ProductivityData | null>(null)
  const [automationsData, setAutomationsData] = useState<AutomationStat[]>([])
  const [loadingProductivity, setLoadingProductivity] = useState(true)
  const [loadingAutomations, setLoadingAutomations] = useState(true)

  const { toast } = useToast()

  const fetchProductivity = useCallback(async () => {
    setLoadingProductivity(true)
    try {
      const res = await api.analytics.productivity(days)
      setProductivityData(res)
    } catch {
      toast({ title: 'Failed to load productivity data', type: 'error' })
    } finally {
      setLoadingProductivity(false)
    }
  }, [days])

  const fetchAutomations = useCallback(async () => {
    setLoadingAutomations(true)
    try {
      const res = await api.analytics.automationPerformance()
      setAutomationsData(res.automations || [])
    } catch {
      toast({ title: 'Failed to load automation data', type: 'error' })
    } finally {
      setLoadingAutomations(false)
    }
  }, [])

  useEffect(() => { fetchProductivity() }, [fetchProductivity])
  useEffect(() => { fetchAutomations() }, [fetchAutomations])

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#00E599]" />
              Analytics &amp; Insights
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Track your productivity, automation performance, and output quality
            </p>
          </div>

          {/* Days filter */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  days === d
                    ? 'bg-[#00E599] text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-xl p-1 w-fit">
          {(['Personal', 'Automations'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'Personal' && <TrendingUp className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />}
              {t === 'Automations' && <Zap className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />}
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'Personal' && (
          <PersonalTab data={productivityData} loading={loadingProductivity} />
        )}
        {tab === 'Automations' && (
          <AutomationsTab data={automationsData} loading={loadingAutomations} />
        )}
      </div>
    </div>
  )
}
