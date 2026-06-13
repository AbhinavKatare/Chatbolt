'use client'
import React from 'react'
import { ChevronDown, Bell, Shield } from 'lucide-react'

export default function AppHeader() {
  return (
    <header className="h-14 w-full flex items-center justify-between px-6 shrink-0 bg-transparent text-white">
      {/* Left Area (Version Selector) */}
      <div className="flex items-center">
        <button className="flex items-center gap-2 text-[15px] font-medium text-white/90 hover:text-white transition-colors">
          Chatbolt 1.6 Lite
          <ChevronDown size={14} className="text-white/50" />
        </button>
      </div>

      {/* Right Area (Controls) */}
      <div className="flex items-center gap-4">
        {/* Free plan / Upgrade banner */}
        <div className="hidden md:flex items-center bg-[#242424] border border-white/5 rounded-full text-[12px] font-medium px-1">
          <span className="px-3 text-white/60">Free plan</span>
          <div className="w-[1px] h-3 bg-white/10"></div>
          <button className="px-3 text-[#3B82F6] hover:text-[#60A5FA] transition-colors py-1.5">Upgrade</button>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-white/70 hover:text-white cursor-pointer transition-colors" />
          
          {/* Points/Credits */}
          <button className="flex items-center gap-1.5 bg-[#2A2A2A] hover:bg-[#333333] px-2.5 py-1 rounded-full text-[13px] font-medium transition-colors border border-white/5">
            <span className="text-[#F5A623]">✦</span>
            <span>300</span>
          </button>
          
          {/* Avatar */}
          <button className="w-7 h-7 rounded-full bg-[#4ADE80] text-[#064E3B] flex items-center justify-center font-bold text-[13px]">
            A
          </button>
        </div>
      </div>
    </header>
  )
}
