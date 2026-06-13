'use client'

import React from 'react'
import { Sparkles, ArrowRight, Shield, Zap, Check } from 'lucide-react'

interface UpgradePromptProps {
  message: string
  taskType?: string
  onUpgradeClick?: () => void
  isDark?: boolean
}

export default function UpgradePrompt({
  message,
  taskType = 'other',
  onUpgradeClick,
  isDark = true
}: UpgradePromptProps) {
  const handleCheckout = () => {
    if (onUpgradeClick) {
      onUpgradeClick()
      return
    }
    // Default fallback to billing page
    window.location.href = `/dashboard/settings/billing?source=${taskType}`
  }

  return (
    <div className={`my-4 p-5 rounded-2xl border transition-all duration-300 shadow-xl ${
      isDark 
        ? 'bg-[#141418]/90 border-white/[0.08] text-zinc-100 shadow-black/40' 
        : 'bg-zinc-50 border-zinc-200 text-zinc-800 shadow-zinc-200/50'
    }`}>
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
          <Zap size={18} className="animate-pulse" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-orange-400 font-bold uppercase tracking-wider">
              <Sparkles size={12} />
              <span>Limit Reached</span>
            </div>
            <p className="mt-1 text-sm font-semibold leading-relaxed">
              {message}
            </p>
          </div>

          {/* Plan Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-1">
            <div className={`p-3.5 rounded-xl border ${
              isDark ? 'bg-black/30 border-white/[0.04]' : 'bg-white border-zinc-100'
            }`}>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Free Plan</div>
              <ul className="space-y-1.5 text-xs text-zinc-400">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  20 tasks per month
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  Standard speed
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  2 integrations limit
                </li>
              </ul>
            </div>

            <div className={`p-3.5 rounded-xl border ${
              isDark 
                ? 'bg-gradient-to-br from-[#00E599]/5 to-emerald-950/5 border-[#00E599]/20' 
                : 'bg-emerald-50/30 border-emerald-100'
            }`}>
              <div className="text-xs font-bold text-[#00E599] uppercase tracking-wider mb-2 flex items-center gap-1">
                <span>Pro Upgrade</span>
                <Sparkles size={11} className="animate-bounce" />
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check size={12} className="text-[#00E599] shrink-0" />
                  500 tasks / month
                </li>
                <li className="flex items-center gap-2">
                  <Check size={12} className="text-[#00E599] shrink-0" />
                  Priority reasoning models
                </li>
                <li className="flex items-center gap-2">
                  <Check size={12} className="text-[#00E599] shrink-0" />
                  Unlimited integrations
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleCheckout}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold
                bg-[#00E599] hover:bg-[#00c885] active:scale-95 text-black transition-all cursor-pointer shadow-md shadow-[#00E599]/10"
            >
              <span>Upgrade to Pro</span>
              <ArrowRight size={14} />
            </button>
            <a
              href="/pricing"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Compare plans
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
