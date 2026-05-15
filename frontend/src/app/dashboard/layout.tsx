'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getSession } from '@/lib/api'
import Link from 'next/link'
import { ToastProvider } from '@/components/ui/Toast'
import { 
  Sparkles, 
  BarChart3, 
  Activity, 
  Database, 
  Zap, 
  Send, 
  Users, 
  Settings,
  ChevronRight,
  User,
  History,
  HelpCircle,
  FileText,
  Workflow,
  Bot
} from 'lucide-react'

const navigation = {
  orchestration: [
    { name: 'Overview', href: '/dashboard', icon: Sparkles },
    { name: 'Workflows', href: '/dashboard/workflows', icon: Workflow },
    { name: 'Playground', href: '/dashboard/playground', icon: Zap },
    { name: 'Agents', href: '/dashboard/agents', icon: Bot },
    { name: 'Conversations', href: '/dashboard/activity', icon: Activity },
  ],
  intelligence: [
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Reports', href: '/dashboard/reports', icon: FileText },
  ],
  system: [
    { name: 'Billing', href: '/dashboard/billing', icon: Zap },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [session, setSession] = useState<any>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      try {
        const s = await getSession()
        setSession(s)
      } catch (err) {
        console.error('Auth check failed', err)
      }
    }
    checkAuth()
  }, [pathname])

  if (!session) return (
    <div className="h-screen w-full flex items-center justify-center bg-[#F9F9F9]">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-8 h-8 bg-black rounded-lg" />
        <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Initializing...</div>
      </div>
    </div>
  )

  return (
    <ToastProvider>
    <div className="flex h-screen bg-white font-sans text-[#1A1A1A]">
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-black/[0.03] flex flex-col shrink-0 bg-[#FDFDFB] z-30">
        <div className="p-6 border-b border-black/[0.03] flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline group">
            <div className="w-7 h-7 bg-[#1A1A1A] rounded-lg flex items-center justify-center shadow-lg shadow-black/10 group-hover:scale-110 transition-transform">
              <div className="w-3 h-3 bg-[#00DFB8] rounded-sm" />
            </div>
            <span className="text-[13px] font-black tracking-tight text-[#1A1A1A]">CHATBOLT</span>
          </Link>
        </div>

        <div className="px-6 py-5 flex items-center gap-3 border-b border-black/[0.03] bg-black/[0.01]">
           <div className="w-9 h-9 rounded-xl bg-white border border-black/[0.05] flex items-center justify-center text-[11px] font-black shadow-sm">
              {session.tenant?.name?.substring(0, 2).toUpperCase() || 'WS'}
           </div>
           <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black truncate uppercase tracking-tight text-[#1A1A1A]">{session.tenant?.name || 'Default Workspace'}</div>
              <div className="text-[9px] font-bold text-[#00DFB8] uppercase tracking-[0.2em] mt-0.5">Enterprise</div>
           </div>
           <ChevronRight size={14} className="text-gray-300" />
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-9">
           {Object.entries(navigation).map(([category, items]) => (
             <div key={category} className="space-y-1.5">
               <h3 className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em] mb-4 ml-3">{category}</h3>
               {items.map((item) => {
                 const isActive = pathname === item.href
                 return (
                   <Link 
                     key={item.name} 
                     href={item.href}
                     className={`flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-[12px] font-bold transition-all no-underline ${
                       isActive 
                         ? 'bg-[#1A1A1A] text-white shadow-xl shadow-black/10' 
                         : 'text-gray-400 hover:text-[#1A1A1A] hover:bg-black/[0.03]'
                     }`}
                   >
                     <item.icon size={16} className={isActive ? 'text-[#00DFB8]' : ''} />
                     {item.name}
                   </Link>
                 )
               })}
             </div>
           ))}
        </nav>

        <div className="p-6 border-t border-black/[0.03] space-y-5 bg-black/[0.01]">
           <div className="space-y-3">
              <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">
                 <span>Compute Units</span>
                 <span className="text-[#1A1A1A]">7,240 / 10k</span>
              </div>
              <div className="h-1 bg-black/[0.05] rounded-full overflow-hidden">
                 <div className="h-full bg-[#00DFB8] w-[72%] shadow-[0_0_8px_rgba(0,223,184,0.5)]" />
              </div>
           </div>
           <button className="w-full py-3 bg-white border border-black/[0.05] rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:shadow-md hover:bg-black hover:text-white transition-all active:scale-[0.98]">
              Manage Access
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9] relative">
        {/* HEADER */}
        <header className="h-16 border-b border-black/5 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 z-20">
           <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <span>System Status</span>
              <div className="flex items-center gap-1.5 text-[#00DFB8]">
                 <div className="w-1.5 h-1.5 bg-[#00DFB8] rounded-full animate-pulse" />
                 Operational
              </div>
           </div>
           <div className="flex items-center gap-4">
              <button className="p-2 text-gray-400 hover:text-black transition-colors">
                 <History size={18} />
              </button>
              <button className="p-2 text-gray-400 hover:text-black transition-colors">
                 <Settings size={18} />
              </button>
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-[10px] font-bold shadow-lg">
                 {session.user?.email?.substring(0, 1).toUpperCase() || 'U'}
              </div>
           </div>
        </header>

        {/* WORKSPACE */}
        <div className="flex-1 overflow-hidden relative">
           <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '16px 16px' }} />
           {children}
        </div>
      </main>
    </div>
    </ToastProvider>
  )
}
