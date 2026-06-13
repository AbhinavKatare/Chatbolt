'use client'
import React from 'react'
import { Bot, Search, PenLine, Mail, Code2, Database, Table2, BarChart2, Play, Edit3, Info } from 'lucide-react'

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  researcher:     { bg: 'rgba(37, 99, 235, 0.1)', text: '#60A5FA', label: 'Researcher' },
  writer:         { bg: 'rgba(124, 58, 237, 0.1)', text: '#C084FC', label: 'Writer' },
  email_sender:   { bg: 'rgba(22, 163, 74, 0.1)', text: '#4ADE80', label: 'Email Sender' },
  scraper:        { bg: 'rgba(234, 88, 12, 0.1)', text: '#FB923C', label: 'Scraper' },
  web_scraper:    { bg: 'rgba(234, 88, 12, 0.1)', text: '#FB923C', label: 'Scraper' },
  data_processor: { bg: 'rgba(8, 145, 178, 0.1)', text: '#22D3EE', label: 'Data' },
  spreadsheet:    { bg: 'rgba(5, 150, 105, 0.1)', text: '#34D399', label: 'Spreadsheet' },
  code:           { bg: 'rgba(225, 29, 72, 0.1)', text: '#F43F5E', label: 'Coder' },
  coder:          { bg: 'rgba(225, 29, 72, 0.1)', text: '#F43F5E', label: 'Coder' },
  analyzer:       { bg: 'rgba(202, 138, 4, 0.1)', text: '#FBBF24', label: 'Analyzer' },
  summarizer:     { bg: 'rgba(124, 58, 237, 0.1)', text: '#C084FC', label: 'Summarizer' },
  reporter:       { bg: 'rgba(124, 58, 237, 0.1)', text: '#C084FC', label: 'Reporter' },
}

const ROLE_ICONS: Record<string, any> = {
  researcher: Search, writer: PenLine, email_sender: Mail,
  scraper: Code2, web_scraper: Code2, data_processor: Database,
  spreadsheet: Table2, code: Code2, coder: Code2,
  analyzer: BarChart2, summarizer: PenLine, reporter: PenLine,
}

const STATUS_CONFIG = {
  idle:      { dot: 'bg-zinc-600',  text: 'Idle',       border: 'border-white/[0.06]', shadow: '' },
  running:   { dot: 'bg-[#00E599] animate-pulse', text: 'Running...', border: 'border-[#00E599] shadow-[0_0_12px_rgba(0,229,153,0.3)]', shadow: '' },
  completed: { dot: 'bg-[#00E599]', text: 'Done ✓',     border: 'border-[#00E599]/30', shadow: '' },
  failed:    { dot: 'bg-rose-500',   text: 'Error',      border: 'border-rose-500/30', shadow: '' },
  waiting:   { dot: 'bg-amber-400', text: 'Waiting...', border: 'border-white/[0.06]', shadow: '' },
}

interface AgentNodeProps {
  agent: any
  position: number
  x: number
  y: number
  status: 'idle' | 'running' | 'completed' | 'failed' | 'waiting'
  outputSummary?: string
  onMouseDown: (e: React.MouseEvent) => void
  onEdit: () => void
  onDetails: () => void
  onTest: () => void
  selected: boolean
}

export function AgentNode({ agent, position, x, y, status, outputSummary, onMouseDown, onEdit, onDetails, onTest, selected }: AgentNodeProps) {
  const role = agent.role || 'researcher'
  const roleConfig = ROLE_COLORS[role] || ROLE_COLORS.researcher
  const RoleIcon = ROLE_ICONS[role] || Bot
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle

  return (
    <div
      style={{ position: 'absolute', left: x, top: y, width: 200, zIndex: selected ? 20 : 10, userSelect: 'none' }}
      onMouseDown={onMouseDown}
    >
      <div className={`bg-[#0D0D11]/95 border rounded-2xl backdrop-blur-md transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${statusCfg.border} ${selected ? 'scale-[1.02] border-[#00E599]' : 'hover:scale-[1.01]'}`}
        style={{ boxShadow: status === 'running' ? '0 0 15px rgba(0,229,153,0.2), 0 4px 20px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.4)' }}>
        
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 text-[9px] font-black shrink-0">
            {String(position).padStart(2,'0')}
          </div>
          <div className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest"
            style={{ background: roleConfig.bg, color: roleConfig.text }}>
            {roleConfig.label}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <RoleIcon size={14} style={{ color: roleConfig.text }} className="shrink-0" />
            <div className="text-[12px] font-bold text-white truncate leading-tight">{agent.name}</div>
          </div>
          <p className="text-[10px] text-zinc-400 leading-snug line-clamp-2">{agent.description}</p>
        </div>

        {/* Output preview */}
        {outputSummary && (
          <div className="mx-4 mb-2 px-2 py-1 bg-white/[0.02] rounded-lg border border-white/5">
            <p className="text-[9px] text-zinc-500 line-clamp-2">{outputSummary}</p>
          </div>
        )}

        {/* Status */}
        <div className="px-4 pb-3 flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{statusCfg.text}</span>
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 grid grid-cols-3 gap-1.5" onMouseDown={e => e.stopPropagation()}>
          {[
            { label: 'Details', icon: Info, fn: onDetails },
            { label: 'Edit', icon: Edit3, fn: onEdit },
            { label: 'Test', icon: Play, fn: onTest },
          ].map(({ label, icon: Icon, fn }) => (
            <button key={label} onClick={fn}
              className="py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[9px] font-bold text-zinc-400 hover:bg-white/10 hover:text-white hover:border-[#00E599]/30 transition-all flex items-center justify-center gap-1">
              <Icon size={10} />{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
