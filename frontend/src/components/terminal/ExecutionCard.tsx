import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { TERMINAL_STRINGS, sanitizeUserFacingText } from './strings'

interface StepItem {
  id?: string
  position: number
  name: string
  role: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting'
}

interface ExecutionCardProps {
  status: string
  progress?: number
  steps?: StepItem[]
  logs?: string[]
  runId?: string
  workflowId?: string
  taskReceipt?: string
  templateCandidate?: boolean
  onCancel: () => void
}

const ExecutionCard = React.memo(({
  status,
  progress,
  steps = [],
  logs = [],
  runId,
  workflowId,
  taskReceipt,
  templateCandidate = false,
  onCancel
}: ExecutionCardProps) => {
  const isExecuting = status === 'executing' || status === 'planning'
  const isCompleted = status === 'completed'
  const isFailed = status === 'failed'

  const totalSteps = steps.length
  const completedStepsCount = steps.filter(s => s.status === 'completed').length

  const [showTemplateChip, setShowTemplateChip] = useState(templateCandidate)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templatePrompt, setTemplatePrompt] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    setShowTemplateChip(templateCandidate)
  }, [templateCandidate])

  const handleOpenSave = async () => {
    if (!runId || !workflowId) return
    try {
      const { api } = await import('@/lib/api')
      const res = await api.workflows.getRun(workflowId, runId)
      if (res?.run) {
        setTemplateName(res.run.workflow_name || 'My Custom Template')
        setTemplatePrompt(res.run.original_prompt || '')
        setTemplateDescription(res.run.task_receipt || '')
        setShowSaveModal(true)
      }
    } catch (err) {
      console.warn('Failed to load run details for template:', err)
    }
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateName.trim() || !templatePrompt.trim()) return
    setSavingTemplate(true)
    try {
      const { api } = await import('@/lib/api')
      await api.templates.create({
        name: templateName,
        description: templateDescription,
        prompt: templatePrompt,
        task_type: 'custom'
      })
      setShowSaveModal(false)
      setShowTemplateChip(false)
      if (runId && workflowId) {
        await api.workflows.updateRun(workflowId, runId, { template_candidate: false })
      }
    } catch (err) {
      console.warn('Failed to save template:', err)
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDismissTemplate = async () => {
    setShowTemplateChip(false)
    try {
      const { api } = await import('@/lib/api')
      if (runId && workflowId) {
        await api.workflows.updateRun(workflowId, runId, { template_candidate: false })
      }
    } catch (err) {
      console.warn('Failed to dismiss template:', err)
    }
  }

  // If completed, transition the entire card into a compact receipt card
  if (isCompleted) {
    return (
      <div 
        style={{
          transition: 'all 200ms ease-out',
          willChange: 'transform, opacity'
        }}
        className="bg-[#141418]/80 border border-[var(--color-success)]/30 rounded-2xl p-5 shadow-2xl shadow-[var(--color-success)]/5 space-y-3 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center text-[var(--color-success)]">
            <CheckCircle size={12} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-success)]">
            Task Resolved • {completedStepsCount} of {totalSteps} steps completed
          </span>
        </div>
        {taskReceipt ? (
          <p className="text-xs text-zinc-200 leading-relaxed font-medium bg-zinc-950/40 p-3 rounded-xl border border-white/[0.03]">
            {taskReceipt}
          </p>
        ) : (
          <p className="text-xs text-zinc-400 leading-relaxed font-medium">
            Your task has been executed successfully.
          </p>
        )}

        {/* Save as Template Prompt */}
        {showTemplateChip && (
          <div className="flex items-center justify-between p-3 bg-zinc-950/60 border border-white/[0.04] rounded-xl mt-3 animate-in fade-in slide-in-from-bottom-2">
            <span className="text-[10px] font-bold text-zinc-400">Save this setup as a template?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDismissTemplate}
                className="px-2.5 py-1 text-zinc-500 hover:text-white bg-transparent border border-zinc-850 hover:bg-zinc-900 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleOpenSave}
                className="px-2.5 py-1 text-black bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Save Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setShowSaveModal(false)} />
            <form onSubmit={handleSaveTemplate} className="bg-[var(--color-surface)] border border-white/[0.08] rounded-2xl max-w-md w-full p-6 relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                <span className="text-xs font-black uppercase tracking-widest text-[var(--color-success)]">
                  Save Personal Template
                </span>
                <button type="button" onClick={() => setShowSaveModal(false)} className="text-[9px] font-black uppercase tracking-wider text-zinc-500 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer">
                  Close
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Template Name</label>
                  <input 
                    type="text" 
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g. Daily Outbound Report"
                    className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[var(--color-accent)]/45 placeholder-zinc-705"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Original Prompt</label>
                  <textarea 
                    value={templatePrompt}
                    onChange={e => setTemplatePrompt(e.target.value)}
                    className="w-full h-20 bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[var(--color-accent)]/45 placeholder-zinc-705 resize-none custom-scrollbar font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Description (Optional)</label>
                  <textarea 
                    value={templateDescription}
                    onChange={e => setTemplateDescription(e.target.value)}
                    placeholder="Brief description of the template purpose..."
                    className="w-full h-16 bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[var(--color-accent)]/45 placeholder-zinc-705 resize-none custom-scrollbar"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSaveModal(false)} className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 hover:text-white">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingTemplate}
                  className="px-4 py-2.5 bg-[var(--color-accent)] text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[var(--color-accent)]/90 transition-colors cursor-pointer"
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      style={{
        transition: 'all 200ms ease-out',
        willChange: 'transform, opacity'
      }}
      className="bg-[var(--color-surface)]/60 border border-white/[0.06] rounded-2xl overflow-hidden shadow-xl backdrop-blur-md space-y-4 p-5 animate-in fade-in zoom-in-95 duration-300"
    >
      {/* CSS Keyframes for slideIn entry */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateY(8px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      
      {/* Execution Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${
            isFailed ? 'bg-red-500' : 'bg-amber-400 animate-ping'
          }`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white">
            {TERMINAL_STRINGS.processProgressTitle}
          </span>
        </div>
        
        {isExecuting && (
          <button
            onClick={onCancel}
            className="p-1 hover:bg-white/5 border border-white/[0.06] rounded-md text-zinc-400 hover:text-red-400 transition-all cursor-pointer text-[9px] font-black uppercase tracking-widest px-2 py-1"
          >
            {TERMINAL_STRINGS.cancelLabel}
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-zinc-500">
            <span>Overall Completion</span>
            <span className="text-[var(--color-success)] font-mono">{progress}%</span>
          </div>
          <div className="w-full h-1 bg-zinc-950 border border-white/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-success)]/80 to-[var(--color-success)] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps List */}
      {steps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
          {steps.map((s) => {
            const isDone = s.status === 'completed'
            return (
              <div
                key={s.position}
                style={{
                  transition: 'max-height 120ms ease-out, padding 120ms ease-out',
                  maxHeight: isDone ? '28px' : '100px',
                  overflow: 'hidden',
                  willChange: 'max-height',
                  animation: 'slideIn 150ms ease-out forwards',
                }}
                className={`rounded-xl border flex items-center gap-2.5 transition-all duration-300 ${
                  s.status === 'running'
                    ? 'bg-[var(--color-accent)]/5 border-[var(--color-success)]/30 shadow-[0_0_12px_rgba(0,229,153,0.05)] p-2.5'
                    : isDone
                    ? 'bg-white/[0.02] border-[var(--color-success)]/15 px-2.5 py-1'
                    : s.status === 'failed'
                    ? 'bg-red-500/5 border-red-500/20 p-2.5'
                    : 'bg-white/[0.01] border-white/[0.04] p-2.5'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shrink-0 ${
                  isDone
                    ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                    : s.status === 'running'
                    ? 'bg-[var(--color-accent)] text-black animate-pulse'
                    : s.status === 'failed'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-white/5 text-zinc-500'
                }`}>
                  {isDone ? <CheckCircle size={10} /> : s.status === 'failed' ? <XCircle size={10} /> : s.position}
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-white truncate">{sanitizeUserFacingText(s.name)}</p>
                  {!isDone && (
                    <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500 truncate mt-0.5">
                      Phase {s.position}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Console Log Narration */}
      {logs.length > 0 && (
        <div className="space-y-1">
          <div className="bg-black/40 border border-white/[0.03] rounded-xl p-3 h-24 overflow-y-auto font-mono text-[9px] text-[var(--color-success)]/80 space-y-0.5 custom-scrollbar">
            {logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed whitespace-pre-wrap opacity-95">
                {sanitizeUserFacingText(log)}
              </div>
            ))}
            {isExecuting && (
              <div className="flex items-center gap-1 mt-1">
                <Loader2 size={8} className="animate-spin text-[var(--color-success)]" />
                <span className="text-zinc-500 animate-pulse text-[8px] uppercase tracking-widest font-black">Processing</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

ExecutionCard.displayName = 'ExecutionCard'

export default ExecutionCard
