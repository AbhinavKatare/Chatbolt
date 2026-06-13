'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Target, Award, TrendingUp, Brain, BarChart3, Activity,
  RefreshCw, CheckCircle2, XCircle, Clock, Loader2, ChevronRight,
  Zap, ShieldCheck, BadgeDollarSign, Calendar, Play
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

interface Run {
  id: string
  workflow_id: string
  workflow_name: string
  status: string
  created_at: string
  completed_at?: string
  inputs?: any
  tenant_id?: string
}

interface DerivedStats {
  total: number
  completed: number
  failed: number
  running: number
  successRate: number
  avgDurationMs: number
  savedHours: number
  roiDollar: number
}

function computeStats(runs: Run[]): DerivedStats {
  const total = runs.length
  const completed = runs.filter(r => r.status === 'completed').length
  const failed = runs.filter(r => r.status === 'error' || r.status === 'failed').length
  const running = runs.filter(r => r.status === 'running' || r.status === 'queued').length
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0

  // Estimate avg duration from completed runs with timestamps
  const completedWithDuration = runs.filter(r => r.status === 'completed' && r.completed_at && r.created_at)
  const avgDurationMs = completedWithDuration.length > 0
    ? completedWithDuration.reduce((acc, r) => {
        return acc + (new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime())
      }, 0) / completedWithDuration.length
    : 0

  // Assumption: each completed run saves ~30 min human labor @ $50/hr
  const savedHours = completed * 0.5
  const roiDollar = savedHours * 50

  return { total, completed, failed, running, successRate, avgDurationMs, savedHours, roiDollar }
}

function fmtDuration(ms: number): string {
  if (!ms) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  completed: { label: 'Completed', color: 'text-[#00E599]', bg: 'bg-[#00E599]/10', border: 'border-[#00E599]/20', icon: CheckCircle2 },
  error: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle },
  failed: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle },
  running: { label: 'Running', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Loader2 },
  queued: { label: 'Queued', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Clock },
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-white/[0.06]', icon: XCircle },
}

export default function OutcomesPage() {
  const router = useRouter()
  const { error: toastError } = useToast()
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DerivedStats | null>(null)

  const loadOutcomes = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.workflows.listRuns({ limit: 50 })
      const runsData: Run[] = res.runs || []
      setRuns(runsData)
      setStats(computeStats(runsData))
    } catch (err: any) {
      toastError('Failed to load outcomes', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOutcomes()
    // Auto-refresh every 30s
    const interval = setInterval(loadOutcomes, 30000)
    return () => clearInterval(interval)
  }, [])

  const statCards = stats ? [
    {
      label: 'Success Rate',
      value: `${stats.successRate}%`,
      sub: `${stats.completed} of ${stats.total} outcomes achieved`,
      icon: Award,
      iconColor: 'text-[#00E599]',
      trend: stats.successRate >= 80 ? 'up' : 'neutral'
    },
    {
      label: 'Blended Labor ROI',
      value: `$${stats.roiDollar.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      sub: `${stats.savedHours.toFixed(1)} hrs of human labor saved`,
      icon: BadgeDollarSign,
      iconColor: 'text-blue-400',
      trend: 'up'
    },
    {
      label: 'Avg Execution Time',
      value: fmtDuration(stats.avgDurationMs),
      sub: 'Per completed autonomous run',
      icon: Zap,
      iconColor: 'text-amber-400',
      trend: 'neutral'
    },
    {
      label: 'Active Swarms',
      value: String(stats.running),
      sub: `${stats.total} total runs logged`,
      icon: Activity,
      iconColor: 'text-purple-400',
      trend: 'neutral'
    },
  ] : []

  return (
    <div className="flex flex-col h-full bg-[#050507] text-[#EDEDED] overflow-y-auto custom-scrollbar font-sans">

      {/* Page Header */}
      <div className="h-14 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Target size={15} className="text-[#00E599]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Outcomes & Task History</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00E599] hover:bg-[#00f7cc] text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <Play size={10} />
            New Task
          </button>
          <button
            onClick={loadOutcomes}
            disabled={loading}
            className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-500 hover:text-white transition-all disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-7 space-y-7">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading && !stats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#0D0D11] border border-white/[0.05] rounded-2xl p-5 h-24 animate-pulse" />
            ))
          ) : (
            statCards.map((card) => (
              <div key={card.label} className="bg-[#0D0D11] border border-white/[0.05] rounded-2xl p-5 space-y-2.5 hover:border-white/[0.09] transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{card.label}</span>
                  <card.icon size={13} className={card.iconColor} />
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">{card.value}</div>
                <p className="text-[9px] text-zinc-500 font-semibold leading-relaxed">{card.sub}</p>
              </div>
            ))
          )}
        </div>

        {/* Run History Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Execution History</span>
            {!loading && runs.length > 0 && (
              <span className="text-[9px] font-bold text-zinc-600">{runs.length} total runs</span>
            )}
          </div>

          {loading && runs.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[#0D0D11] border border-white/[0.04] rounded-xl h-14 animate-pulse" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="border border-dashed border-white/[0.06] rounded-2xl flex flex-col items-center justify-center text-center py-16 bg-black/20">
              <Target size={28} className="text-zinc-700 mb-3" />
              <h5 className="text-sm font-bold text-zinc-500">No task history yet</h5>
              <p className="text-[10px] text-zinc-600 max-w-xs mt-1.5 font-semibold leading-relaxed">
                Task runs will appear here as you launch autonomous tasks from the main terminal.
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="mt-4 px-4 py-2 bg-[#00E599] hover:bg-[#00f7cc] text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              >
                Launch First Task
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => {
                const sc = STATUS_CONFIG[run.status] || STATUS_CONFIG['pending']
                const StatusIcon = sc.icon
                const duration = run.completed_at
                  ? new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()
                  : 0

                return (
                  <div
                    key={run.id}
                    className="group bg-[#0D0D11]/60 border border-white/[0.05] hover:border-white/[0.09] rounded-xl px-5 py-4 flex items-center gap-5 transition-all cursor-pointer"
                    onClick={() => router.push(`/dashboard/workflows`)}
                  >
                    {/* Status Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${sc.bg} border ${sc.border}`}>
                      <StatusIcon size={13} className={`${sc.color} ${run.status === 'running' ? 'animate-spin' : ''}`} />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-[11px] font-bold text-white truncate">
                        {run.workflow_name || 'Unnamed Task'}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[8px] font-black uppercase tracking-wider ${sc.color} ${sc.bg} border ${sc.border} px-2 py-0.5 rounded-full`}>
                          {sc.label}
                        </span>
                        <span className="text-[9px] text-zinc-600 font-semibold">
                          <Calendar size={9} className="inline mr-1" />
                          {fmtDate(run.created_at)}
                        </span>
                        {duration > 0 && (
                          <span className="text-[9px] text-zinc-600 font-semibold">
                            <Zap size={9} className="inline mr-1" />
                            {fmtDuration(duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Time ago + Arrow */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[9px] font-bold text-zinc-600 hidden md:block">{timeAgo(run.created_at)}</span>
                      <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Success Breakdown Chart (visual-only bar) */}
        {stats && stats.total > 0 && (
          <div className="bg-[#0D0D11] border border-white/[0.05] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Outcome Breakdown</span>
              <BarChart3 size={13} className="text-zinc-600" />
            </div>

            {/* Stacked bar */}
            <div className="h-2.5 w-full rounded-full overflow-hidden flex gap-0.5">
              {stats.completed > 0 && (
                <div
                  className="h-full bg-[#00E599] rounded-full transition-all duration-500"
                  style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                />
              )}
              {stats.running > 0 && (
                <div
                  className="h-full bg-blue-400 animate-pulse transition-all duration-500"
                  style={{ width: `${(stats.running / stats.total) * 100}%` }}
                />
              )}
              {stats.failed > 0 && (
                <div
                  className="h-full bg-red-400 transition-all duration-500"
                  style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 flex-wrap">
              {[
                { label: 'Completed', count: stats.completed, color: 'bg-[#00E599]' },
                { label: 'Running', count: stats.running, color: 'bg-blue-400' },
                { label: 'Failed', count: stats.failed, color: 'bg-red-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-[9px] font-bold text-zinc-500">{item.label}</span>
                  <span className="text-[9px] font-black text-zinc-300">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
