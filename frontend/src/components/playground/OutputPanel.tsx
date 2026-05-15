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
}

const LOG_COLORS: Record<string, string> = {
  agent_start: '#6B7280', agent_done: '#22C55E', agent_error: '#EF4444',
  workflow_start: '#B8FF00', workflow_done: '#22C55E', workflow_error: '#EF4444',
  info: '#6B7280', success: '#22C55E', error: '#EF4444',
}

const LOG_PREFIXES: Record<string, string> = {
  agent_start: '→', agent_done: '✓', agent_error: '✗',
  workflow_start: '⬡', workflow_done: '✅', workflow_error: '✗',
  info: '·', success: '✓', error: '✗',
}

export function OutputPanel({ logs, agents, agentSteps, runStatus, runDuration }: OutputPanelProps) {
  const [tab, setTab] = useState<'output' | 'log' | 'history'>('output')
  const [copied, setCopied] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
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
    <div className="w-[300px] bg-white border-l border-black/8 flex flex-col shrink-0 h-full">
      {/* Tabs */}
      <div className="flex border-b border-black/5 shrink-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${tab === t.id ? 'text-[#111]' : 'text-gray-400 hover:text-gray-600'}`}>
            {t.label}
            {t.id === 'log' && (t as any).badge && (
              <span className="ml-1 w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-pulse" />
            )}
            {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#111]" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* OUTPUT TAB */}
        {tab === 'output' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {runStatus === 'idle' && logs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Clock size={24} className="text-gray-200 mb-3" />
                <div className="text-[11px] font-medium text-gray-400">Run workflow to see output</div>
              </div>
            )}

            {agents.map((agent, i) => {
              const step = agentSteps[agent.id] || {}
              const isRunning = step.status === 'running'
              const isDone = step.status === 'completed'
              const isWaiting = !step.status && runStatus === 'running'
              return (
                <div key={agent.id} className="border border-black/5 rounded-xl overflow-hidden">
                  <div className={`flex items-center justify-between px-3 py-2 ${isDone ? 'bg-green-50' : isRunning ? 'bg-[#B8FF00]/10' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      {isDone && <CheckCircle2 size={12} className="text-green-500" />}
                      {isRunning && <div className="w-2 h-2 bg-[#B8FF00] rounded-full animate-pulse" />}
                      {isWaiting && <div className="w-2 h-2 bg-yellow-400 rounded-full" />}
                      {!isDone && !isRunning && !isWaiting && <div className="w-2 h-2 bg-gray-300 rounded-full" />}
                      <span className="text-[10px] font-bold text-[#111]">{agent.name}</span>
                    </div>
                    {step.duration_ms && (
                      <span className="text-[9px] text-gray-400">{(step.duration_ms / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    {isRunning && <div className="text-[10px] text-gray-400 animate-pulse">Generating output...</div>}
                    {isWaiting && <div className="text-[10px] text-gray-300">Waiting for previous agent...</div>}
                    {isDone && step.outputSummary && (
                      <p className="text-[10px] text-gray-600 leading-relaxed">{step.outputSummary}</p>
                    )}
                    {!isDone && !isRunning && !isWaiting && (
                      <div className="text-[10px] text-gray-300">Not yet run</div>
                    )}
                  </div>
                </div>
              )
            })}

            {runStatus === 'complete' && (
              <>
                <div className="flex items-center justify-between pt-2 border-t border-black/5">
                  <div className="text-[9px] text-gray-400 uppercase font-black tracking-widest">
                    {runDuration ? `${(runDuration / 1000).toFixed(0)}s · ${agents.length}/${agents.length} agents` : `${agents.length} agents complete`}
                  </div>
                  <button onClick={copyOutput}
                    className="flex items-center gap-1 px-2 py-1 border border-black/10 rounded-lg text-[9px] font-bold hover:bg-gray-50 transition-all">
                    {copied ? <CheckCircle2 size={10} className="text-green-500" /> : <Copy size={10} />}
                    {copied ? 'Copied' : 'Copy'}
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
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">
                <Terminal size={10} /> Terminal
              </div>
              <button onClick={() => setAutoScroll(!autoScroll)}
                className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all ${autoScroll ? 'bg-[#111] text-white border-[#111]' : 'border-black/10 text-gray-400'}`}>
                Auto-scroll
              </button>
            </div>
            <div ref={logRef} className="flex-1 bg-[#111] rounded-xl p-3 overflow-y-auto font-mono text-[10px] space-y-1">
              {logs.length === 0 && (
                <div className="text-gray-600">Waiting for execution...</div>
              )}
              {logs.map(log => {
                const color = LOG_COLORS[log.type] || '#6B7280'
                const prefix = LOG_PREFIXES[log.type] || '·'
                return (
                  <div key={log.id} className="flex gap-2">
                    <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                    <span style={{ color }} className="shrink-0">{prefix}</span>
                    <span className="text-gray-300 break-all">{log.message}</span>
                  </div>
                )
              })}
              {runStatus === 'running' && (
                <div className="flex gap-2 text-gray-500">
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
              <Clock size={24} className="text-gray-200 mx-auto mb-3" />
              <div className="text-[11px] font-medium text-gray-400">Run history appears here</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
