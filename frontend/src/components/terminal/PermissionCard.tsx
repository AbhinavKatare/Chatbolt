import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { TERMINAL_STRINGS, sanitizeUserFacingText } from './strings'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface PermissionCardProps {
  onApprove: () => void
  onReject: () => void
}

export default function PermissionCard({ onApprove, onReject }: PermissionCardProps) {
  const containerRef = useFocusTrap(true) as React.MutableRefObject<HTMLDivElement | null>

  return (
    <div ref={containerRef} className="p-4.5 bg-amber-500/5 border border-amber-500/25 rounded-2xl space-y-3.5 animate-in slide-in-from-bottom-2 duration-300 shadow-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={16} />
        <div className="space-y-0.5">
          <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            Authorization Request
          </h5>
          <p className="text-[11px] text-zinc-300 font-medium leading-relaxed">
            {sanitizeUserFacingText("A planned execution step requires your confirmation to execute outbound actions.")}
          </p>
        </div>
      </div>
      
      <div className="flex gap-2 justify-end">
        <button
          onClick={onReject}
          className="px-3.5 py-2 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
        >
          {TERMINAL_STRINGS.rejectLabel}
        </button>
        <button
          onClick={onApprove}
          className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-black font-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md"
        >
          {TERMINAL_STRINGS.approveLabel}
        </button>
      </div>
    </div>
  )
}
