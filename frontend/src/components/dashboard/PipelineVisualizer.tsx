'use client'

import React from 'react'
import { Check, Loader2, Play, AlertCircle, Clock } from 'lucide-react'

interface Agent {
  id: string
  name: string
  role: string
  position: number
  status: 'idle' | 'running' | 'completed' | 'failed'
}

interface Step {
  id: string
  agent_id: string
  status: 'running' | 'completed' | 'failed'
  step_number: number
  duration_ms?: number
  output_summary?: string
}

interface PipelineVisualizerProps {
  agents: Agent[]
  steps: Step[]
  currentRunId?: string
}

export function PipelineVisualizer({ agents, steps, currentRunId }: PipelineVisualizerProps) {
  return (
    <div className="flex items-center gap-4 py-8 overflow-x-auto no-scrollbar">
      {agents.sort((a, b) => a.position - b.position).map((agent, idx) => {
        const step = steps.find(s => s.agent_id === agent.id)
        const isLast = idx === agents.length - 1
        const status = step?.status || 'idle'

        return (
          <React.Fragment key={agent.id}>
            <div className="flex flex-col items-center group">
              {/* AGENT NODE */}
              <div 
                className={`
                  w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-500 relative
                  ${status === 'running' ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 shadow-[0_0_20px_rgba(83,74,183,0.2)]' : ''}
                  ${status === 'completed' ? 'border-[var(--color-accent)]/30 bg-[var(--color-success)]/10 text-white' : ''}
                  ${status === 'failed' ? 'border-red-500/50 bg-red-500/5' : ''}
                  ${status === 'idle' ? 'border-white/10 bg-white/5' : ''}
                `}
              >
                {status === 'running' ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
                ) : status === 'completed' ? (
                  <Check className="w-6 h-6 text-[var(--color-accent)]" />
                ) : status === 'failed' ? (
                  <AlertCircle className="w-6 h-6 text-red-500" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-white/20 flex items-center justify-center text-[10px] font-black text-white">
                    {agent.position}
                  </div>
                )}
                
                <span className={`text-[9px] font-black uppercase tracking-widest mt-2 px-1 text-center truncate w-full ${status === 'completed' ? 'text-[var(--color-accent)]' : 'text-gray-400'}`}>
                  {agent.role}
                </span>

                {status === 'running' && (
                  <div className="absolute -top-1 -right-1">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--color-accent)]"></span>
                    </span>
                  </div>
                )}
              </div>

              {/* LABEL */}
              <div className="mt-3 text-center">
                <div className="text-[11px] font-bold text-white uppercase tracking-tight">{agent.name}</div>
                {step?.duration_ms && (
                  <div className="text-[9px] font-mono text-gray-400 mt-1 flex items-center justify-center gap-1">
                    <Clock size={8} /> {(step.duration_ms / 1000).toFixed(1)}s
                  </div>
                )}
              </div>
            </div>

            {/* CONNECTOR */}
            {!isLast && (
              <div className="w-12 h-px bg-white/10 relative -mt-10">
                <div 
                  className={`absolute top-0 left-0 h-full bg-[var(--color-accent)] transition-all duration-1000 ease-in-out`}
                  style={{ width: status === 'completed' ? '100%' : '0%' }}
                />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
