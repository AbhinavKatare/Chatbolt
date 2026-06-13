'use client'

import { useState, useEffect } from 'react'
import { X, Clock, CheckCircle2, AlertCircle, Loader2, RotateCcw, History, FileText } from 'lucide-react'
import { api } from '@/lib/api'

interface WorkflowRun {
  id: string
  workflow_id?: string
  workflow_name: string
  status: 'completed' | 'failed' | 'running' | 'queued'
  created_at: string
  completed_at?: string
  prompt?: string
  duration_ms?: number
  task_receipt?: string
}

interface HistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  tenantId?: string
  onRerun?: (prompt: string) => void
  onViewArtifact?: (runId: string) => void
}

function statusIcon(status: string) {
  const norm = (status || '').toLowerCase()
  switch (norm) {
    case 'completed': return <CheckCircle2 size={14} className="text-[#534AB7]" />
    case 'failed': return <AlertCircle size={14} className="text-red-400" />
    case 'running':
    case 'executing':
    case 'planning':
      return <Loader2 size={14} className="text-blue-400 animate-spin" />
    default: return <Clock size={14} className="text-zinc-400" />
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    completed: 'Done',
    failed: 'Failed',
    running: 'In Progress',
    executing: 'In Progress',
    planning: 'Planning',
    queued: 'Queued'
  }
  return map[(status || '').toLowerCase()] || status
}

function formatDuration(ms?: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function HistoryPanel({ isOpen, onClose, tenantId, onRerun, onViewArtifact }: HistoryPanelProps) {
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed'>('all')

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const res = await api.tasks.history(50)
      setRuns(res.runs || [])
    } catch (err) {
      console.warn('[History Panel] Failed to fetch runs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    fetchHistory()
  }, [isOpen])

  const filtered = filter === 'all' 
    ? runs 
    : runs.filter(r => (r.status || '').toLowerCase() === filter.toLowerCase())

  return (
    <div
      className={`fixed right-0 top-0 h-full w-80 bg-[#09090b] border-l border-zinc-800 z-50
        flex flex-col shadow-2xl transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <History size={16} className="text-[#534AB7]" />
          <span className="text-sm font-semibold text-white">Run History</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors cursor-pointer">
          <X size={16} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-zinc-800/60">
        {(['all', 'completed', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize cursor-pointer
              ${filter === f
                ? 'bg-[#534AB7]/10 text-[#534AB7] border border-[#534AB7]/30'
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            {f === 'all' ? 'All Runs' : f}
          </button>
        ))}
      </div>

      {/* Run list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-4 p-4 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="space-y-2">
                <div className="h-4 bg-zinc-800 rounded w-[60%]" />
                <div className="h-3 bg-zinc-800 rounded w-[40%]" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-500 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-400">
              <Clock size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">No task history yet</p>
              <p className="text-xs text-zinc-500">Your runs and automations will appear here.</p>
            </div>
            <button
              onClick={() => {
                onClose()
                setTimeout(() => {
                  document.getElementById('terminal-input')?.focus()
                }, 100)
              }}
              className="mt-2 text-xs font-bold text-[#534AB7] hover:underline flex items-center gap-1 cursor-pointer bg-[#534AB7]/5 border border-[#534AB7]/20 rounded-lg px-3 py-1.5 transition-all"
            >
              Run your first task →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map(run => (
              <div key={run.id} className="p-4 hover:bg-zinc-900/50 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {statusIcon(run.status)}
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                        {statusLabel(run.status)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{run.workflow_name}</p>
                    {run.prompt && (
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2 italic">"{run.prompt}"</p>
                    )}
                    {run.task_receipt && (
                      <p className="text-xs text-zinc-300 mt-1.5 p-2 bg-zinc-950/60 rounded border border-white/[0.03] leading-relaxed">
                        {run.task_receipt}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-medium text-zinc-500">
                      <span>{timeAgo(run.created_at)}</span>
                      {run.duration_ms && <span>⏱ {formatDuration(run.duration_ms)}</span>}
                    </div>

                    {/* View Deliverable Button (Artifact) */}
                    {run.status && run.status.toLowerCase() === 'completed' && onViewArtifact && (
                      <button
                        onClick={() => onViewArtifact(run.id)}
                        className="mt-2.5 flex items-center gap-1 text-[10px] font-bold text-[#534AB7] hover:underline cursor-pointer bg-[#534AB7]/5 border border-[#534AB7]/20 rounded px-2 py-1 transition-all"
                      >
                        <FileText size={10} />
                        <span>View Deliverable</span>
                      </button>
                    )}
                  </div>
                  {onRerun && run.prompt && (
                    <button
                      onClick={() => onRerun(run.prompt || '')}
                      title="Recall prompt"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded cursor-pointer
                        text-zinc-500 hover:text-[#534AB7] hover:bg-[#534AB7]/10"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950/40">
        <p className="text-xs text-zinc-500 font-semibold">Showing last {filtered.length} runs</p>
      </div>
    </div>
  )
}
