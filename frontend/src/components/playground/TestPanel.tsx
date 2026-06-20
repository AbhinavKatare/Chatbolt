'use client'
import React, { useState } from 'react'
import { X, Play, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { api } from '@/lib/api'

interface TestPanelProps {
  agent: any
  workflowId: string
  userInputs: Record<string, string>
  onClose: () => void
}

export function TestPanel({ agent, workflowId, userInputs, onClose }: TestPanelProps) {
  const [task, setTask] = useState(agent.description || '')            // task related use state
  const [simPrevOutput, setSimPrevOutput] = useState('')           // prevoutput for previous works
  const [simEnabled, setSimEnabled] = useState(false)         
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showRaw, setShowRaw] = useState(false)          // Raw file and working files

  const handleRun = async () => {
    setRunning(true)
    setResult(null)
    try {
      const inputs = { ...userInputs }
      if (simEnabled && simPrevOutput) inputs._previous_output = simPrevOutput
      const res = await api.workflows.testAgent(workflowId, agent.id, inputs, task)
      setResult(res)
    } catch (e: any) {
      setResult({ error: e.message, duration_ms: 0, output: null })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white border-t border-black/10 rounded-t-3xl shadow-2xl w-full"
        style={{ maxHeight: '45vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Testing Agent</div>
            <div className="text-sm font-bold text-[#111]">{agent.name}</div>
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
              {agent.role}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex h-full" style={{ maxHeight: 'calc(45vh - 64px)' }}>
          {/* Left — Input */}
          <div className="w-1/2 border-r border-black/5 p-6 flex flex-col gap-4 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Task</label>
              <textarea
                value={task}
                onChange={e => setTask(e.target.value)}
                rows={3}
                className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-black/30"
                placeholder="What should this agent do?"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Simulate Previous Output</label>
                <button
                  onClick={() => setSimEnabled(!simEnabled)}
                  className={`w-8 h-4 rounded-full transition-all relative ${simEnabled ? 'bg-[#111]' : 'bg-gray-200'}`}
                >
                  <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${simEnabled ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
              {simEnabled && (
                <textarea
                  value={simPrevOutput}
                  onChange={e => setSimPrevOutput(e.target.value)}
                  rows={3}
                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-black/30 font-mono text-xs"
                  placeholder="Paste mock output from previous agent..."
                />
              )}
            </div>

            <button
              onClick={handleRun}
              disabled={running || !task.trim()}
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#B8FF00] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#c8ff20] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? (
                <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Running...</>
              ) : (
                <><Play size={12} fill="currentColor" /> Run this agent</>
              )}
            </button>
          </div>

          {/* Right — Output */}
          <div className="w-1/2 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live Output</label>
              {result && (
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-[9px] font-bold text-gray-400 hover:text-black transition-colors"
                >
                  {showRaw ? 'Show formatted' : 'Show raw JSON'}
                </button>
              )}
            </div>

            {!result && !running && (
              <div className="h-32 flex items-center justify-center text-gray-300">
                <div className="text-center space-y-2">
                  <Play size={24} />
                  <div className="text-[10px] font-medium">Run the agent to see output</div>
                </div>
              </div>
            )}

            {running && (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                ))}
                <div className="w-2 h-4 bg-gray-300 animate-pulse inline-block" />
              </div>
            )}

            {result && !running && (
              <div className="space-y-3">
                {/* Status */}
                <div className="flex items-center gap-3">
                  {result.error
                    ? <XCircle size={14} className="text-red-500" />
                    : <CheckCircle2 size={14} className="text-green-500" />}
                  <span className={`text-[10px] font-black uppercase ${result.error ? 'text-red-500' : 'text-green-600'}`}>
                    {result.error ? 'Error' : 'Success'}
                  </span>
                  {result.duration_ms && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock size={10} />{(result.duration_ms/1000).toFixed(2)}s
                    </span>
                  )}
                </div>

                {/* Content */}
                {result.error ? (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 font-medium">{result.error}</div>
                ) : showRaw ? (
                  <pre className="bg-gray-900 text-green-400 rounded-xl p-4 text-[10px] overflow-auto max-h-48 font-mono">
                    {JSON.stringify(result.output, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-4 border border-black/5 max-h-48 overflow-y-auto">
                    <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {result.output?.data?.content || result.output?.summary || JSON.stringify(result.output, null, 2)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
