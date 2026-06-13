'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Sidebar as SidebarIcon, Edit, Bot, Puzzle, Clock, Library, Plus, ListFilter, Settings, Grid, MonitorSmartphone } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[260px] h-screen bg-[#1C1C1C] text-white flex flex-col border-r border-white/5 shrink-0 transition-all duration-300">
      
      {/* Top Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-white/5 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
            <path d="M10.82 2.652a2.001 2.001 0 0 1 2.36 0l5.875 4.316a2 2 0 0 1 .74 2.278l-2.245 6.908a2 2 0 0 1-1.902 1.382H8.352a2 2 0 0 1-1.902-1.382l-2.245-6.908a2 2 0 0 1 .74-2.278l5.875-4.316Z" fill="currentColor"/>
          </svg>
          <span className="font-serif font-bold text-[18px]">chatbolt</span>
        </Link>
        <div className="flex items-center gap-3 text-white/50">
          <Search size={16} className="cursor-pointer hover:text-white transition-colors" />
          <SidebarIcon size={16} className="cursor-pointer hover:text-white transition-colors" />
        </div>
      </div>

      {/* Main Nav Content */}
      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-6 custom-scrollbar">
        
        {/* Primary Actions */}
        <div className="flex flex-col gap-1">
          <Link href="/app" className="no-underline w-full mb-2 block">
            <button className="flex items-center justify-center gap-3 px-3 py-2.5 bg-[#534AB7] hover:bg-[#534AB7]/90 text-white rounded-lg transition-colors text-[13px] font-bold w-full shadow-[0_0_12px_rgba(83,74,183,0.4)] border-none cursor-pointer">
              <Edit size={16} className="text-white" />
              <span>New task</span>
            </button>
          </Link>
          
          <Link href="/app" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-[13px] no-underline font-semibold ${pathname === '/app' ? 'bg-[#534AB7] text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}>
            <Bot size={16} />
            <span>Agent</span>
          </Link>
          <Link href="/app/plugins" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-[13px] no-underline font-semibold ${pathname === '/app/plugins' ? 'bg-[#534AB7] text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}>
            <Puzzle size={16} />
            <span>Plugins</span>
          </Link>
          <Link href="/app/scheduled" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-[13px] no-underline font-semibold ${pathname === '/app/scheduled' ? 'bg-[#534AB7] text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}>
            <Clock size={16} />
            <span>Scheduled</span>
          </Link>
          <Link href="/app/library" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-[13px] no-underline font-semibold ${pathname === '/app/library' ? 'bg-[#534AB7] text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}>
            <Library size={16} />
            <span>Library</span>
          </Link>
        </div>

        {/* Projects Section */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-3 py-1 mb-1">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Projects</span>
            <Plus size={14} className="text-white/40 cursor-pointer hover:text-white transition-colors" />
          </div>
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-white/80 hover:text-white rounded-lg transition-colors text-[13px] w-full text-left bg-transparent border-none cursor-pointer">
            <Plus size={16} className="text-white/50" />
            <span>New project</span>
          </button>
        </div>

        {/* Tasks Section */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-3 py-1 mb-1">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">All tasks</span>
            <ListFilter size={14} className="text-white/40 cursor-pointer hover:text-white transition-colors" />
          </div>
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-white/80 hover:text-white rounded-lg transition-colors text-[13px] w-full text-left truncate bg-transparent border-none cursor-pointer">
            <div className="w-4 h-4 rounded-full border-2 border-dashed border-[#F5A623] shrink-0" />
            <span className="truncate">Personal Finance Advisor: Optimize ...</span>
          </button>
        </div>
      </div>

      {/* Footer Area */}
      <div className="p-4 border-t border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 text-white/40">
          <Settings size={16} className="cursor-pointer hover:text-white transition-colors" />
          <Grid size={16} className="cursor-pointer hover:text-white transition-colors" />
          <MonitorSmartphone size={16} className="cursor-pointer hover:text-white transition-colors" />
        </div>
      </div>
    </aside>
  )
}
