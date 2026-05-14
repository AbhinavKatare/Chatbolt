'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getSession } from '@/lib/api'
import Link from 'next/link'
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
  FileText
} from 'lucide-react'

const topTabs = [
  { name: 'Playground', href: '/dashboard', icon: Sparkles },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Activity', href: '/dashboard/activity', icon: Activity },
  { name: 'Sources', href: '/dashboard/sources', icon: Database },
  { name: 'Actions', href: '/dashboard/actions', icon: Zap },
]

const sidebarItems = [
  { name: 'Playground', href: '/dashboard', icon: Sparkles },
  { name: 'Activity', href: '/dashboard/activity', icon: Activity },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText },
  { name: 'Sources', href: '/dashboard/sources', icon: Database },
  { name: 'Actions', href: '/dashboard/actions', icon: Zap },
  { name: 'Deploy', href: '/dashboard/deploy', icon: Send },
  { name: 'Contacts', href: '/dashboard/contacts', icon: Users },
  { name: 'Agent settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [session, setSession] = useState<any>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      const s = await getSession()
      if (!s) {
        window.location.href = '/login'
        return
      }
      
      // Mandatory Pricing Check: Redirect if no active paid plan
      const plan = s.tenant?.plan
      if (!plan || plan === 'hobby' || plan === 'free') {
        if (pathname !== '/onboarding') {
          window.location.href = '/onboarding'
          return
        }
      }
      
      setSession(s)
    }
    checkAuth()
  }, [pathname])

  if (!session) return null

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex flex-1 overflow-hidden">
        {/* UNIFIED SIDEBAR */}
        <aside className="w-64 bg-white border-r border-black/5 flex flex-col shrink-0">
          <div className="p-6 flex items-center justify-between border-b border-black/5">
            <Link href="/" className="flex items-center gap-3 no-underline">
              <div className="w-6 h-6 bg-[#00DFB8] rounded-sm flex items-center justify-center">
                <div className="w-3 h-3 bg-[#FDFDFB]" />
              </div>
              <span className="text-sm font-black text-[#1A1A1A] tracking-tight">CHATBOLT</span>
            </Link>
            
            <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#1A1A1A] text-[10px] font-bold border border-black/5">
              {session.tenant.name.substring(0, 2).toUpperCase()}
            </div>
          </div>
          
          <div className="px-6 py-4 flex items-center gap-2 text-[10px] font-bold text-[#888] uppercase tracking-widest border-b border-black/5">
            <span className="truncate">Workspace <span className="bg-[#00DFB8]/10 text-[#00DFB8] px-1.5 py-0.5 rounded-full text-[9px] font-bold ml-1">{session.tenant.plan || 'No Plan'}</span></span>
            <ChevronRight size={14} className="ml-auto" />
          </div>

          <nav className="flex-1 py-4">
             {sidebarItems.map((item) => {
               const isActive = pathname === item.href
               return (
                 <Link 
                   key={item.name} 
                   href={item.href}
                   className={`flex items-center gap-3 px-6 py-2.5 text-[12px] font-medium transition-all no-underline ${isActive ? 'bg-gray-50 text-black border-r-2 border-black' : 'text-gray-500 hover:bg-gray-50 hover:text-black'}`}
                 >
                   <item.icon size={16} />
                   {item.name}
                 </Link>
               )
             })}
          </nav>

          <div className="p-6 border-t border-gray-100">
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Messages</span>
                <span>75 / 100</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[75%]" />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Sources</span>
                <span>230 / 320 MB</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[72%]" />
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE */}
        <main className="flex-1 overflow-auto bg-[#FAFAFA] relative">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '16px 16px' }} />
          <div className="relative h-full">
            {children}
          </div>

          {/* TOGGLEABLE CHAT PREVIEW OVERLAY */}
          {isChatOpen && (
            <div className="fixed bottom-24 right-8 w-[380px] h-[600px] bg-white shadow-2xl rounded-xl border border-gray-200 overflow-hidden flex flex-col z-50 animate-in slide-in-from-bottom-5">
               <div className="bg-[#FDFDFB] p-4 flex items-center justify-between text-[#1A1A1A] border-b border-black/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-black/5 rounded-lg flex items-center justify-center">
                      <Sparkles size={16} className="text-[#00DFB8]" />
                    </div>
                    <span className="text-sm font-bold">Chatbolt Preview</span>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-black">
                    ✕
                  </button>
               </div>
               <div className="flex-1 p-6 space-y-6 overflow-auto bg-[#FAFAFA]">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-[#FDFDFB] rounded-full shadow-sm flex items-center justify-center shrink-0">
                      <Sparkles size={14} className="text-[#00DFB8]" />
                    </div>
                    <div className="bg-white border border-black/5 shadow-sm p-4 rounded-2xl rounded-tl-none text-sm text-[#1A1A1A]">
                      Hey, I am your Chatbolt workflow assistant.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-transparent shrink-0" />
                    <div className="bg-white border border-black/5 shadow-sm p-4 rounded-2xl text-sm text-[#1A1A1A]">
                      You can test your 5-agent workflow here!
                    </div>
                  </div>
               </div>
               <div className="p-4 border-t border-gray-100 bg-white">
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#00DFB8]" placeholder="Test your workflow..." />
               </div>
            </div>
          )}

          {/* FLOATING ACTION BUTTON */}
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="fixed bottom-8 right-8 w-14 h-14 bg-[#1A1A1A] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform z-50"
          >
            <Sparkles size={24} className="text-[#00DFB8]" />
          </button>
        </main>
      </div>
    </div>
  )
}

