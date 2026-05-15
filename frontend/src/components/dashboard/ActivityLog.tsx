'use client'

import React, { useEffect, useRef } from 'react'
import { Terminal, Check, AlertCircle, Info, ChevronRight } from 'lucide-react'

export interface LogEntry {
  id: string
  timestamp: string
  type: 'info' | 'success' | 'error' | 'warning' | 'agent'
  message: string
  agentName?: string
  data?: any
}

interface ActivityLogProps {
  logs: LogEntry[]
}

export function ActivityLog({ logs }: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="flex flex-col h-full bg-[#080808] rounded-xl border border-white/10 overflow-hidden shadow-2xl">
      {/* TERMINAL HEADER */}
      <div className="h-10 bg-white/[0.03] flex items-center justify-between px-4 shrink-0 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56] shadow-lg shadow-red-500/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E] shadow-lg shadow-yellow-500/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F] shadow-lg shadow-green-500/20" />
          </div>
          <div className="ml-4 flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-[0.2em]">
            <Terminal size={12} className="text-[#00DFB8]" /> Runtime Activity Log
          </div>
        </div>
        <div className="text-[10px] font-mono text-gray-500">
          SESSION: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* TERMINAL BODY */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 font-mono text-[12px] selection:bg-[#00DFB8]/30 no-scrollbar leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-60 gap-4">
             <Terminal size={40} className="text-[#00DFB8]" />
             <div className="text-[11px] font-black uppercase tracking-widest text-white">Awaiting execution...</div>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-4 group animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-gray-500 shrink-0 select-none font-medium">
                  [{log.timestamp}]
                </span>
                
                <span className={`
                  shrink-0 font-black uppercase text-[10px] px-2 py-0.5 rounded flex items-center justify-center min-w-[60px]
                  ${log.type === 'success' ? 'text-black bg-[#00DFB8]' : ''}
                  ${log.type === 'error' ? 'text-white bg-red-500' : ''}
                  ${log.type === 'info' ? 'text-white bg-blue-500' : ''}
                  ${log.type === 'agent' ? 'text-white bg-purple-500' : ''}
                  ${log.type === 'warning' ? 'text-black bg-yellow-500' : ''}
                `}>
                  {log.type}
                </span>
                
                <div className="flex-1 text-gray-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-medium">
                    {log.type === 'success' && <Check size={12} className="text-[#00DFB8]" />}
                    {log.type === 'error' && <AlertCircle size={12} className="text-red-500" />}
                    <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-[#00DFB8]' : 'text-white'}>
                      {log.message}
                    </span>
                  </div>
                  
                  {log.data && (
                    <div className="mt-1 p-3 bg-white/[0.03] rounded-lg border border-white/5 text-[11px] text-gray-400 overflow-x-auto font-mono">
                      <pre>{JSON.stringify(log.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* CURSOR */}
            <div className="flex gap-3 items-center text-[#00DFB8] animate-pulse py-2">
               <ChevronRight size={14} />
               <span className="w-2.5 h-5 bg-[#00DFB8]" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
