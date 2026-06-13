import React, { useState } from 'react'
import { Bot, User, AlertTriangle } from 'lucide-react'
import ExecutionCard from './ExecutionCard'
import PermissionCard from './PermissionCard'
import UpgradePrompt from './UpgradePrompt'
import { TERMINAL_STRINGS, sanitizeUserFacingText } from './strings'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content?: string
  isTask?: boolean
  taskConfig?: any
  runId?: string
  workflowId?: string
  status?: string
  steps?: any[]
  logs?: string[]
  screenshot?: string
  progress?: number
  isTyping?: boolean
  taskReceipt?: string
  templateCandidate?: boolean
}

interface ChatThreadProps {
  messages: ChatMessage[]
  onApprovePermission: (msgIndex: number) => void
  onRejectPermission: (msgIndex: number) => void
  onCancelRun: (runId: string) => void
  onSubmitCalibration: (msgIndex: number, values: Record<string, string>) => void
  onDismissCancel?: (msgIndex: number) => void
}

// Inline Markdown formatter
function formatMarkdown(text: string): string {
  if (!text) return ''
  return text
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="code-block font-mono text-[10.5px] bg-black/60 border border-white/[0.04] p-3.5 rounded-xl my-2 whitespace-pre-wrap"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-white/5 border border-white/[0.06] rounded px-1.5 py-0.5 font-mono text-[10.5px]">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-zinc-300">$1</li>')
}

// Inline config form for missing parameters
function InlineCalibrationForm({
  fields,
  onSubmit
}: {
  fields: any[]
  onSubmit: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const missing = fields.filter(f => f.required && !values[f.field]?.trim())
    if (missing.length > 0) return
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 mt-2 bg-[#141418]/40 border border-white/[0.05] p-4.5 rounded-2xl">
      <div className="space-y-0.5">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-[#534AB7]">
          {TERMINAL_STRINGS.needsInputsTitle}
        </h5>
        <p className="text-[10px] text-zinc-400 font-medium">
          {TERMINAL_STRINGS.needsInputsSubtitle}
        </p>
      </div>

      {fields.map(f => (
        <div key={f.field} className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">
            {f.question} {f.required && <span className="text-red-400">*</span>}
          </label>
          <input
            type={f.type === 'number' ? 'number' : 'text'}
            placeholder={`Enter ${f.field}...`}
            value={values[f.field] || ''}
            onChange={(e) => setValues(prev => ({ ...prev, [f.field]: e.target.value }))}
            className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-[#534AB7]/40 transition-colors"
            required={f.required}
          />
        </div>
      ))}
      <button
        type="submit"
        className="w-full py-2.5 bg-[#534AB7] hover:bg-[#534AB7]/90 text-white font-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
      >
        Confirm Parameters
      </button>
    </form>
  )
}

// Sub-component for cancel confirmation to allow dedicated focus trapping
function CancelConfirmationCard({
  runId,
  idx,
  onDismissCancel,
  onCancelRun
}: {
  runId?: string
  idx: number
  onDismissCancel?: (idx: number) => void
  onCancelRun: (runId: string) => void
}) {
  const containerRef = useFocusTrap(true) as React.MutableRefObject<HTMLDivElement | null>

  return (
    <div ref={containerRef} className="w-full min-w-[280px] md:min-w-[420px] bg-zinc-950/80 border border-red-500/20 p-4.5 rounded-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Cancel Task Confirmation</span>
      </div>
      <p className="text-[11px] text-zinc-300 font-medium">
        Are you sure you want to cancel the currently running process?
      </p>
      <div className="flex items-center gap-2.5 mt-1">
        <button
          type="button"
          onClick={() => {
            if (onDismissCancel) {
              onDismissCancel(idx)
            }
          }}
          className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer border border-zinc-800"
        >
          Keep going
        </button>
        <button
          type="button"
          onClick={() => {
            if (runId) onCancelRun(runId)
          }}
          className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer"
        >
          Yes, cancel
        </button>
      </div>
    </div>
  )
}

export default function ChatThread({
  messages,
  onApprovePermission,
  onRejectPermission,
  onCancelRun,
  onSubmitCalibration,
  onDismissCancel
}: ChatThreadProps) {
  return (
    <div className="space-y-6">
      {messages.map((msg, idx) => {
        const isUser = msg.role === 'user'
        
        return (
          <div key={msg.id || idx} className={`flex gap-3.5 max-w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
            
            {/* Left side avatar for Assistant */}
            {!isUser && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/[0.06] flex items-center justify-center text-zinc-400 shrink-0 shadow-md">
                <Bot size={15} />
              </div>
            )}

            {/* Bubble Contents */}
            <div className={`flex flex-col gap-2.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
              
              {/* Text Bubble */}
              {(msg.content || msg.isTyping) && (
                <div className={`rounded-2xl px-4 py-3 text-[12px] leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-[#141418] border border-white/[0.05] text-zinc-100 font-medium'
                    : 'text-zinc-200'
                }`}>
                  <div 
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(sanitizeUserFacingText(msg.content || '')) }} 
                    className="space-y-1.5"
                  />
                  {msg.isTyping && (
                    <span className="inline-block w-1.5 h-3.5 bg-[#534AB7] ml-1.5 animate-pulse vertical-middle align-middle" />
                  )}
                </div>
              )}

              {/* Step Progress Tracker Card (strips all technical terms) */}
              {msg.isTask && msg.status !== 'needs_inputs' && (
                <div className="w-full min-w-[280px] md:min-w-[420px]">
                  <ExecutionCard
                    status={msg.status || 'planning'}
                    progress={msg.progress}
                    steps={msg.steps}
                    logs={msg.logs}
                    runId={msg.runId}
                    taskReceipt={msg.taskReceipt}
                    templateCandidate={msg.templateCandidate}
                    onCancel={() => msg.runId && onCancelRun(msg.runId)}
                  />
                </div>
              )}

              {/* Inline Permission Gates (replacing overlays/modals) */}
              {msg.isTask && msg.status === 'waiting' && (
                <div className="w-full min-w-[280px] md:min-w-[420px]">
                  <PermissionCard
                    onApprove={() => onApprovePermission(idx)}
                    onReject={() => onRejectPermission(idx)}
                  />
                </div>
              )}

              {/* Inline Calibration Setup form */}
              {msg.isTask && msg.status === 'needs_inputs' && msg.taskConfig && (
                <div className="w-full min-w-[280px] md:min-w-[420px]">
                  <InlineCalibrationForm
                    fields={msg.taskConfig.missing_inputs || []}
                    onSubmit={(values) => onSubmitCalibration(idx, values)}
                  />
                </div>
              )}

              {/* Inline Integration Connection card */}
              {msg.isTask && msg.status === 'integration_required' && msg.taskConfig && (
                <div className="w-full min-w-[280px] md:min-w-[420px] bg-[#141418]/40 border border-white/[0.05] p-5 rounded-2xl flex flex-col items-center gap-3.5 text-center">
                  <div className="w-10 h-10 bg-[#534AB7]/10 border border-[#534AB7]/20 rounded-xl flex items-center justify-center">
                    <span className="text-xl">⚡</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 font-medium">
                    {msg.taskConfig.userMessage}
                  </p>
                  <a
                    href={msg.taskConfig.actionUrl}
                    className="px-4 py-2.5 bg-[#534AB7] hover:bg-[#534AB7]/90 text-white font-black rounded-xl text-[9px] uppercase tracking-widest inline-block transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-95 no-underline"
                  >
                    Connect {msg.taskConfig.service === 'google-calendar' ? 'Google Calendar' : msg.taskConfig.service === 'google-drive' ? 'Google Drive' : msg.taskConfig.service.charAt(0).toUpperCase() + msg.taskConfig.service.slice(1)}
                  </a>
                </div>
              )}

              {/* Inline Billing Upgrade card */}
              {msg.isTask && msg.status === 'billing_required' && msg.taskConfig && (
                <UpgradePrompt
                  message={msg.taskConfig.userMessage}
                  taskType={msg.taskConfig.taskType}
                  onUpgradeClick={() => {
                    window.location.href = msg.taskConfig.actionUrl
                  }}
                  isDark={true}
                />
              )}

              {/* Inline Cancel Confirmation */}
              {msg.isTask && msg.status === 'cancel_confirmation' && (
                <CancelConfirmationCard
                  runId={msg.runId}
                  idx={idx}
                  onDismissCancel={onDismissCancel}
                  onCancelRun={onCancelRun}
                />
              )}

            </div>

            {/* Right side avatar for User */}
            {isUser && (
              <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/[0.06] flex items-center justify-center text-zinc-400 shrink-0 shadow-md">
                <User size={15} />
              </div>
            )}

          </div>
        )
      })}
    </div>
  )
}
