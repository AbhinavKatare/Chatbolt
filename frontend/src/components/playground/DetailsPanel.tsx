'use client'
import React, { useEffect, useState } from 'react'
import { X, Edit3, Clock, CheckCircle2, XCircle, Zap } from 'lucide-react'
import { api } from '@/lib/api'

interface DetailsPanelProps {
  agent: any
  workflowId: string
  stepData?: any
  onClose: () => void
  onEdit: () => void
}

export function DetailsPanel({ agent, workflowId, stepData, onClose, onEdit }: DetailsPanelProps) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.workflows.getAgentHistory(workflowId, agent.id)
      .then(r => setHistory(r.steps || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [agent.id, workflowId])

  const avgDuration = history.length
    ? Math.round(history.reduce((s, h) => s + (h.duration_ms || 0), 0) / history.length)
    : null

  const successRate = history.length
    ? Math.round((history.filter(h => h.status === 'completed').length / history.length) * 100)
    : null

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-black/8 z-40 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between shrink-0">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Agent Details</div>
          <div className="text-base font-bold text-[#111] mt-0.5">{agent.name}</div>
          <div className="text-[9px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded-full inline-block bg-gray-100 text-gray-500">
            {agent.role}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111] text-white rounded-lg text-[10px] font-bold hover:bg-black transition-colors">
            <Edit3 size={11} /> Edit
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Last Output */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Last Output</h3>
          {stepData?.output_data ? (
            <div className="bg-gray-50 rounded-xl p-4 border border-black/5">
              <div className="text-[11px] font-medium text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-6">
                {typeof stepData.output_data === 'string'
                  ? stepData.output_data
                  : JSON.stringify(stepData.output_data, null, 2).slice(0, 400)}
              </div>
              {stepData.duration_ms && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={10} /> Done
                  </span>
                  <span className="text-[9px] font-bold text-gray-400">
                    <Clock size={9} className="inline mr-1" />{(stepData.duration_ms / 1000).toFixed(1)}s
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-8 text-center border border-black/5">
              <div className="text-[11px] text-gray-400 font-medium">No output yet. Run the workflow.</div>
            </div>
          )}
        </section>

        {/* Stats */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Performance</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Runs', value: history.length || '0' },
              { label: 'Avg Time', value: avgDuration ? `${(avgDuration/1000).toFixed(1)}s` : '—' },
              { label: 'Success', value: successRate !== null ? `${successRate}%` : '—' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center border border-black/5">
                <div className="text-lg font-bold text-[#111]">{s.value}</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Mini bar chart */}
          {history.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 border border-black/5">
              <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">Last {history.length} Runs</div>
              <div className="flex items-end gap-1.5 h-12">
                {history.slice(0, 10).reverse().map((h, i) => {
                  const maxD = Math.max(...history.map(x => x.duration_ms || 1))
                  const pct = ((h.duration_ms || 0) / maxD) * 100
                  return (
                    <div key={i} className="flex-1 rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(pct, 8)}%`,
                        background: h.status === 'completed' ? '#22C55E' : '#EF4444',
                        opacity: 0.7,
                      }}
                      title={`${h.status} — ${((h.duration_ms||0)/1000).toFixed(1)}s`}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* Run History */}
        {history.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Run History</h3>
            <div className="space-y-2">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-black/5">
                  <div className="flex items-center gap-2">
                    {h.status === 'completed'
                      ? <CheckCircle2 size={12} className="text-green-500" />
                      : <XCircle size={12} className="text-red-500" />}
                    <span className="text-[10px] font-medium text-gray-500">
                      {h.started_at ? new Date(h.started_at).toLocaleTimeString() : 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.duration_ms && (
                      <span className="text-[9px] font-bold text-gray-400">{(h.duration_ms/1000).toFixed(1)}s</span>
                    )}
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                      h.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>{h.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-black/10 border-t-black rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>
    </div>
  )
}
