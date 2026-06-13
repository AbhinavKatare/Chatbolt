'use client'
import React, { useState, useEffect, useRef } from 'react'
import { Clock, Copy, Download, CheckCircle2, XCircle, Terminal } from 'lucide-react'

interface LogEntry { id: string; timestamp: string; type: string; message: string }

interface OutputPanelProps {
  logs: LogEntry[]
  agents: any[]
  agentSteps: Record<string, any>
  runStatus: 'idle' | 'running' | 'complete' | 'error'
  runDuration?: number
  workflowId?: string
  runId?: string
}

const LOG_COLORS: Record<string, string> = {
  agent_start: '#A1A1AA', agent_done: '#00E599', agent_error: '#EF4444',
  workflow_start: '#00E599', workflow_done: '#00E599', workflow_error: '#EF4444',
  info: '#71717A', success: '#00E599', error: '#EF4444',
}

const LOG_PREFIXES: Record<string, string> = {
  agent_start: '→', agent_done: '✓', agent_error: '✗',
  workflow_start: '⬡', workflow_done: '✅', workflow_error: '✗',
  info: '·', success: '✓', error: '✗',
}

export function OutputPanel({ logs, agents, agentSteps, runStatus, runDuration, workflowId, runId }: OutputPanelProps) {
  const [tab, setTab] = useState<'output' | 'log' | 'history'>('output')
  const [copied, setCopied] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  const handleSandboxClick = async (e: React.MouseEvent<HTMLImageElement>, wId: string, rId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      let token = ''
      try {
        const stored = localStorage.getItem('supabase.auth.token')
        if (stored) {
          const parsed = JSON.parse(stored)
          token = parsed?.currentSession?.access_token || ''
        }
      } catch {}

      await fetch(`${baseUrl}/workflows/${wId}/runs/${rId}/browser/click-relative`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ xPercent, yPercent })
      })
    } catch (err: any) {
      console.error('Failed to forward click coordinate:', err.message)
    }
  }
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (runStatus === 'running' || runStatus === 'error') setTab('log')
    if (runStatus === 'complete') setTimeout(() => setTab('output'), 1200)
  }, [runStatus])

  useEffect(() => {
    if (autoScroll && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs, autoScroll])

  const allOutputs = Object.values(agentSteps).filter(s => s?.output_data || s?.outputSummary)

  const copyOutput = () => {
    const text = allOutputs.map(s => s.outputSummary || JSON.stringify(s.output_data)).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs = [
    { id: 'output', label: 'Output' },
    { id: 'log', label: 'Live Log', badge: runStatus === 'running' },
    { id: 'history', label: 'History' },
  ] as const

  return (
    <div className="w-[300px] bg-[#09090B] border-l border-white/[0.04] flex flex-col shrink-0 h-full text-white">
      {/* Tabs */}
      <div className="flex border-b border-white/[0.04] shrink-0 bg-white/[0.01]">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${tab === t.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
            {t.id === 'log' && (t as any).badge && (
              <span className="ml-1 w-1.5 h-1.5 bg-[#00E599] rounded-full inline-block animate-pulse shadow-[0_0_6px_#00E599]" />
            )}
            {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00E599]" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* OUTPUT TAB */}
        {tab === 'output' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {runStatus === 'idle' && logs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Clock size={24} className="text-zinc-800 mb-3" />
                <div className="text-[11px] font-medium text-zinc-500">Run workflow to see output</div>
              </div>
            )}

            {agents.map((agent, i) => {
              const step = agentSteps[agent.id] || {}
              const isRunning = step.status === 'running'
              const isDone = step.status === 'completed'
              const isWaiting = !step.status && runStatus === 'running'
              return (
                <div key={agent.id} className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0D0D11]/60">
                  <div className={`flex items-center justify-between px-3 py-2 ${isDone ? 'bg-[#00E599]/5' : isRunning ? 'bg-[#00E599]/10 animate-pulse' : 'bg-white/[0.01]'}`}>
                    <div className="flex items-center gap-2">
                      {isDone && <CheckCircle2 size={12} className="text-[#00E599]" />}
                      {isRunning && <div className="w-2 h-2 bg-[#00E599] rounded-full animate-pulse shadow-[0_0_6px_#00E599]" />}
                      {isWaiting && <div className="w-2 h-2 bg-amber-400 rounded-full" />}
                      {!isDone && !isRunning && !isWaiting && <div className="w-2 h-2 bg-zinc-700 rounded-full" />}
                      <span className="text-[10px] font-bold text-white">{agent.name}</span>
                    </div>
                    {step.duration_ms && (
                      <span className="text-[9px] text-zinc-500">{(step.duration_ms / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <div className="px-3 py-2 border-t border-white/[0.04]">
                    {isRunning && !step.screenshot && <div className="text-[10px] text-zinc-500 animate-pulse">Generating output...</div>}
                    {isWaiting && <div className="text-[10px] text-zinc-600 text-slate-400">Waiting for previous agent...</div>}
                    {isDone && step.outputSummary && (
                      <p className="text-[10px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{step.outputSummary}</p>
                    )}
                    {!isDone && !isRunning && !isWaiting && (
                      <div className="text-[10px] text-zinc-600">Not yet run</div>
                    )}
                    {/* Live Sandbox View (Manus-Style Visual Browser Stream) */}
                    {(isRunning || isDone) && step.screenshot && (
                      <div className="mt-2 border border-white/[0.06] rounded-lg overflow-hidden bg-black/60 shadow-inner">
                        <div className="px-2 py-1 bg-white/[0.02] text-[8px] font-black uppercase text-zinc-500 flex justify-between items-center select-none">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#00E599] rounded-full inline-block animate-ping" />
                            Live Sandbox Screen
                          </span>
                          <span className="text-[7px] text-zinc-600 font-mono">playwright-vnc</span>
                        </div>
                        <img 
                          src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${step.screenshot}`} 
                          alt="Live Sandbox Screen" 
                          className="w-full h-auto max-h-[160px] object-cover hover:object-contain transition-all duration-300 cursor-crosshair active:scale-[0.98] select-none"
                          onClick={(e) => {
                            if (workflowId && runId) {
                              handleSandboxClick(e, workflowId, runId)
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {runStatus === 'complete' && (
              <>
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <div className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                    {runDuration ? `${(runDuration / 1000).toFixed(0)}s · ${agents.length}/${agents.length} agents` : `${agents.length} agents complete`}
                  </div>
                  <button onClick={copyOutput}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[9px] font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition-all">
                    {copied ? <CheckCircle2 size={10} className="text-[#00E599]" /> : <Copy size={10} />}
                    {copied ? 'Copied' : 'Copy Output'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* LOG TAB */}
        {tab === 'log' && (
          <div className="flex-1 flex flex-col min-h-0 p-3">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                <Terminal size={10} /> Live Execution Terminal
              </div>
              <button onClick={() => setAutoScroll(!autoScroll)}
                className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all ${autoScroll ? 'bg-[#00E599] text-black border-[#00E599] hover:bg-[#00cc88]' : 'border-white/10 text-zinc-500'}`}>
                Auto-scroll
              </button>
            </div>
            <div ref={logRef} className="flex-1 bg-[#030305] border border-white/[0.05] rounded-xl p-3 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar shadow-inner">
              {logs.length === 0 && (
                <div className="text-zinc-700">Waiting for execution...</div>
              )}
              {logs.map(log => {
                const color = LOG_COLORS[log.type] || '#71717A'
                const prefix = LOG_PREFIXES[log.type] || '·'
                return (
                  <div key={log.id} className="flex gap-2">
                    <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                    <span style={{ color }} className="shrink-0">{prefix}</span>
                    <span className="text-zinc-300 break-all">{log.message}</span>
                  </div>
                )
              })}
              {runStatus === 'running' && (
                <div className="flex gap-2 text-[#00E599]">
                  <span className="animate-pulse">▌</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-center py-12">
              <Clock size={24} className="text-zinc-800 mx-auto mb-3" />
              <div className="text-[11px] font-medium text-zinc-500">Run history appears here</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
