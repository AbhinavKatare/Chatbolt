'use client'
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />,
  error: <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />,
  info: <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />,
}

const BORDERS: Record<ToastType, string> = {
  success: 'border-l-4 border-l-green-500',
  error: 'border-l-4 border-l-red-500',
  warning: 'border-l-4 border-l-yellow-500',
  info: 'border-l-4 border-l-blue-500',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Entrance
    const t1 = setTimeout(() => setVisible(true), 10)
    // Auto-dismiss
    const duration = toast.duration ?? 4500
    const t2 = setTimeout(() => { setLeaving(true); setTimeout(onRemove, 300) }, duration)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [toast.duration, onRemove])

  const handleClose = () => { setLeaving(true); setTimeout(onRemove, 300) }

  return (
    <div
      className={`
        w-full bg-white rounded-xl shadow-2xl shadow-black/10 pointer-events-auto
        ${BORDERS[toast.type]}
        transition-all duration-300 ease-out
        ${visible && !leaving ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}
      `}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        {ICONS[toast.type]}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-black text-[#111] leading-tight">{toast.title}</div>
          {toast.message && (
            <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{toast.message}</div>
          )}
        </div>
        <button onClick={handleClose} className="p-0.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors shrink-0 ml-1">
          <X size={13} />
        </button>
      </div>
      {/* Progress bar */}
      <div className="relative h-0.5 bg-gray-100 rounded-b-xl overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-black/10 rounded-b-xl"
          style={{
            animation: `toast-shrink ${toast.duration ?? 4500}ms linear forwards`,
          }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2)
    setToasts(p => [...p.slice(-4), { ...opts, id }]) // max 5 at a time
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(p => p.filter(t => t.id !== id))
  }, [])

  const ctx: ToastContextValue = {
    toast: addToast,
    success: (title, message) => addToast({ type: 'success', title, message }),
    error: (title, message) => addToast({ type: 'error', title, message }),
    warning: (title, message) => addToast({ type: 'warning', title, message }),
    info: (title, message) => addToast({ type: 'info', title, message }),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 w-80 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
        ))}
      </div>
      <style>{`
        @keyframes toast-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
