'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'

interface TaskFeedbackProps {
  runId: string
  onRated?: (rating: number) => void
}

export default function TaskFeedback({ runId, onRated }: TaskFeedbackProps) {
  const [rated, setRated] = useState(false)
  const [activeRating, setActiveRating] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRate = async (rating: number) => {
    if (rated || loading || !runId) return
    setLoading(true)
    try {
      await api.analytics.feedback(runId, rating)
      setActiveRating(rating)
      setRated(true)
      onRated?.(rating)
    } catch {
      // silently fail — feedback is non-critical
    } finally {
      setLoading(false)
    }
  }

  if (rated) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-[#00E599] font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Thanks for the feedback ✓
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xs text-zinc-600">Was this helpful?</span>
      <button
        onClick={() => handleRate(1)}
        disabled={loading}
        aria-label="Thumbs up — good output"
        className={`
          p-1.5 rounded-lg border transition-all duration-150 disabled:opacity-50
          ${
            activeRating === 1
              ? 'bg-[#00E599]/20 border-[#00E599]/40 text-[#00E599]'
              : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:bg-[#00E599]/10 hover:border-[#00E599]/30 hover:text-[#00E599]'
          }
        `}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleRate(-1)}
        disabled={loading}
        aria-label="Thumbs down — poor output"
        className={`
          p-1.5 rounded-lg border transition-all duration-150 disabled:opacity-50
          ${
            activeRating === -1
              ? 'bg-red-500/20 border-red-500/40 text-red-400'
              : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
          }
        `}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
