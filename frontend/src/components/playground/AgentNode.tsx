'use client'
import React from 'react'
import { Bot, Search, PenLine, Mail, Code2, Database, Table2, BarChart2, Play, Edit3, Info } from 'lucide-react'

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  researcher:     { bg: '#EFF6FF', text: '#2563EB', label: 'Researcher' },
  writer:         { bg: '#F5F3FF', text: '#7C3AED', label: 'Writer' },
  email_sender:   { bg: '#F0FDF4', text: '#16A34A', label: 'Email Sender' },
  scraper:        { bg: '#FFF7ED', text: '#EA580C', label: 'Scraper' },
  web_scraper:    { bg: '#FFF7ED', text: '#EA580C', label: 'Scraper' },
  data_processor: { bg: '#ECFEFF', text: '#0891B2', label: 'Data' },
  spreadsheet:    { bg: '#ECFDF5', text: '#059669', label: 'Spreadsheet' },
  code:           { bg: '#FFF1F2', text: '#E11D48', label: 'Coder' },
  coder:          { bg: '#FFF1F2', text: '#E11D48', label: 'Coder' },
  analyzer:       { bg: '#FEFCE8', text: '#CA8A04', label: 'Analyzer' },
  summarizer:     { bg: '#F5F3FF', text: '#7C3AED', label: 'Summarizer' },
  reporter:       { bg: '#F5F3FF', text: '#7C3AED', label: 'Reporter' },
}

const ROLE_ICONS: Record<string, any> = {
  researcher: Search, writer: PenLine, email_sender: Mail,
  scraper: Code2, web_scraper: Code2, data_processor: Database,
  spreadsheet: Table2, code: Code2, coder: Code2,
  analyzer: BarChart2, summarizer: PenLine, reporter: PenLine,
}

const STATUS_CONFIG = {
  idle:      { dot: 'bg-gray-300',  text: 'Idle',       border: 'border-black/10', shadow: '' },
  running:   { dot: 'bg-green-400 animate-pulse', text: 'Running...', border: 'border-[#B8FF00] shadow-[0_0_0_3px_rgba(184,255,0,0.25)]', shadow: '' },
  completed: { dot: 'bg-green-500', text: 'Done ✓',     border: 'border-green-500', shadow: '' },
  failed:    { dot: 'bg-red-500',   text: 'Error',      border: 'border-red-400', shadow: '' },
  waiting:   { dot: 'bg-yellow-400', text: 'Waiting...', border: 'border-black/10', shadow: '' },
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
      <div className={`bg-white rounded-2xl border transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${statusCfg.border} ${selected ? 'scale-[1.02]' : 'hover:shadow-lg hover:scale-[1.01]'}`}
        style={{ boxShadow: status === 'running' ? '0 0 0 3px rgba(184,255,0,0.25), 0 4px 16px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.08)' }}>
        
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="w-6 h-6 rounded-full bg-[#111] flex items-center justify-center text-white text-[9px] font-black shrink-0">
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
            <div className="text-[12px] font-bold text-[#111] truncate leading-tight">{agent.name}</div>
          </div>
          <p className="text-[10px] text-gray-400 leading-snug line-clamp-2">{agent.description}</p>
        </div>

        {/* Output preview */}
        {outputSummary && (
          <div className="mx-4 mb-2 px-2 py-1 bg-gray-50 rounded-lg border border-black/5">
            <p className="text-[9px] text-gray-500 line-clamp-2">{outputSummary}</p>
          </div>
        )}

        {/* Status */}
        <div className="px-4 pb-3 flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{statusCfg.text}</span>
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 grid grid-cols-3 gap-1.5" onMouseDown={e => e.stopPropagation()}>
          {[
            { label: 'Details', icon: Info, fn: onDetails },
            { label: 'Edit', icon: Edit3, fn: onEdit },
            { label: 'Test', icon: Play, fn: onTest },
          ].map(({ label, icon: Icon, fn }) => (
            <button key={label} onClick={fn}
              className="py-1.5 rounded-lg bg-gray-50 border border-black/5 text-[9px] font-bold text-gray-500 hover:bg-[#111] hover:text-white hover:border-[#111] transition-all flex items-center justify-center gap-1">
              <Icon size={10} />{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
