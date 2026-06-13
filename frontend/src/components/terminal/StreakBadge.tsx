'use client'

import React from 'react'
import { Flame } from 'lucide-react'

interface StreakBadgeProps {
  streak?: number
}

export default function StreakBadge({ streak = 0 }: StreakBadgeProps) {
  if (streak < 2) return null

  return (
    <div 
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
        bg-orange-500/10 border border-orange-500/30 text-orange-400 
        shadow-sm shadow-orange-500/5 select-none transition-all duration-300"
      title={`${streak} day usage streak! Keep it going.`}
    >
      <Flame size={12} className="fill-orange-500 text-orange-400 animate-bounce" style={{ animationDuration: '2s' }} />
      <span>{streak}</span>
    </div>
  )
}
