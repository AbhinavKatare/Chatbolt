'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, X, ExternalLink, Sparkles } from 'lucide-react'

export interface TaskToastData {
  id: string
  title: string
  description?: string
  runId?: string
  type?: 'success' | 'error' | 'info'
}

interface TaskToastProps {
  tasks: TaskToastData[]
  onDismiss: (id: string) => void
  onViewTask?: (runId: string) => void
}

function SingleToast({
  task,
  onDismiss,
  onViewTask
}: {
  task: TaskToastData
  onDismiss: (id: string) => void
  onViewTask?: (runId: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(task.id), 350)
  }, [task.id, onDismiss])

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setVisible(true), 50)
    // Auto-dismiss after 8 seconds
    const dismissTimer = setTimeout(dismiss, 8000)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(dismissTimer)
    }
  }, [dismiss])

  const isError = task.type === 'error'
  const accentColor = isError ? 'text-red-400' : 'text-[#534AB7]'
  const borderColor = isError ? 'border-red-500/30' : 'border-[#534AB7]/30'
  const bgGlow = isError ? 'shadow-red-500/10' : 'shadow-[#534AB7]/10'

  return (
    <div
      className={`
        w-80 rounded-xl border ${borderColor} bg-zinc-950/95 backdrop-blur-sm p-4
        shadow-2xl ${bgGlow}
        transition-all duration-350 ease-out
        ${visible && !exiting ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${accentColor}`}>
          {isError
            ? <X size={18} />
            : <CheckCircle2 size={18} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={10} className="text-[#534AB7]" />
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
              {isError ? 'Task Failed' : 'Task Complete'}
            </p>
          </div>
          <p className="text-sm font-semibold text-white mt-0.5 truncate">{task.title}</p>
          {task.description && (
            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{task.description}</p>
          )}
          {task.runId && onViewTask && (
            <button
              onClick={() => onViewTask(task.runId!)}
              className="mt-2 flex items-center gap-1 text-xs text-[#534AB7] hover:underline"
            >
              View results <ExternalLink size={10} />
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          className="text-zinc-600 hover:text-zinc-300 transition-colors mt-0.5"
        >
          <X size={14} />
        </button>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${isError ? 'bg-red-500' : 'bg-[#534AB7]'} rounded-full`}
          style={{ animation: 'shrink 8s linear forwards' }}
        />
      </div>
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}

export default function TaskToast({ tasks, onDismiss, onViewTask }: TaskToastProps) {
  if (tasks.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center">
      {tasks.map((task) => (
        <SingleToast
          key={task.id}
          task={task}
          onDismiss={onDismiss}
          onViewTask={onViewTask}
        />
      ))}
    </div>
  )
}

// Hook for easy management
export function useTaskToast() {
  const [toasts, setToasts] = useState<TaskToastData[]>([])

  const addToast = useCallback((toast: Omit<TaskToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { ...toast, id }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}
