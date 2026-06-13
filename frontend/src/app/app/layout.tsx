import React from 'react'
import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full min-h-screen bg-[#161616] text-white">
      {/* Sidebar - Sticky to viewport */}
      <div className="sticky top-0 h-screen shrink-0 z-40 border-r border-white/5 bg-[#1C1C1C]">
        <Sidebar />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {children}
      </div>
    </div>
  )
}
