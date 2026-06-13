'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSession, api } from '@/lib/api'
import Link from 'next/link'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { 
  Clock, Bot, Menu, X,
  FolderOpen, Search, Bell, Settings, FolderPlus,
  Sliders, Database, Laptop, ChevronDown, PanelLeft, LayoutList, Plus, Zap,
  SquarePen, Target, LayoutGrid, Library, ShieldCheck, XCircle, AlertCircle,
  Loader2, Check
} from 'lucide-react'
import SettingsModal from '@/components/dashboard/SettingsModal'

type MenuItem = {
  name: string
  href: string
  icon: any
  isPrimary?: boolean
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </ToastProvider>
  )
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { success: toastSuccess, info: toastInfo, error: toastError } = useToast()
  
  const [session, setSession] = useState<any>(null)
  const [activeRuns, setActiveRuns] = useState<any[]>([])
  const [showTerminalBadge, setShowTerminalBadge] = useState(false)
  const [lastCompletedCount, setLastCompletedCount] = useState<number | null>(null)
  const [hasConnectedIntegrations, setHasConnectedIntegrations] = useState(true)

  // Premium interactive states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState('Chatbolt 1.6 Lite')
  
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 'n1', text: '✅ FinOps Cost Optimization Complete', time: '2m ago', active: true },
    { id: 'n2', text: '🌐 Web Crawler scraped 12 accounts', time: '1h ago', active: true },
    { id: 'n3', text: '⚠️ Personalization memory auto-synced', time: '3h ago', active: false }
  ])

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showCreateProjModal, setShowCreateProjModal] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [newProjDesc, setNewProjDesc] = useState('')
  
  // Search Overlay
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    getSession().then(s => {
      if (!s) {
        router.replace('/login')
      } else {
        setSession(s)
      }
    }).catch(() => router.replace('/login'))
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K → open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (pathname === '/dashboard/terminal') return
        e.preventDefault()
        setShowSearchModal(prev => !prev)
        setIsNotificationsOpen(false)
        setIsModelDropdownOpen(false)
      }
      // Escape → close any open overlay
      if (e.key === 'Escape') {
        setShowSearchModal(false)
        setIsNotificationsOpen(false)
        setIsModelDropdownOpen(false)
        setShowCreateProjModal(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Fetch recent tasks dynamically to show in sidebar under "All tasks"
  useEffect(() => {
    async function loadRecentTasks() {
      try {
        const res = await api.workflows.listRuns({ limit: 10 })
        const runs = res.runs || []
        setActiveRuns(runs.slice(0, 4))

        const completedRuns = runs.filter((r: any) => 
          r.status === 'completed' || r.status === 'COMPLETED' || r.status === 'failed' || r.status === 'FAILED'
        )
        const currentCompletedCount = completedRuns.length

        if (pathname !== '/dashboard/terminal') {
          if (lastCompletedCount !== null && currentCompletedCount > lastCompletedCount) {
            setShowTerminalBadge(true)
          }
        }
        setLastCompletedCount(currentCompletedCount)
      } catch (err) {
        console.warn('Failed to load recent runs for sidebar:', err)
      }
    }
    if (session) {
      loadRecentTasks()
      // Poll every 15s for updates
      const interval = setInterval(loadRecentTasks, 15000)
      return () => clearInterval(interval)
    }
  }, [session, pathname, lastCompletedCount])

  // Clear badge when actively viewing terminal
  useEffect(() => {
    if (pathname === '/dashboard/terminal') {
      setShowTerminalBadge(false)
    }
  }, [pathname])

  // Global BroadcastChannel to hear task completed / failed events from other tabs/routes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const bc = new BroadcastChannel('chatbolt-tasks')
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'task:completed' || e.data.type === 'task:failed') {
        if (pathname !== '/dashboard/terminal') {
          setShowTerminalBadge(true)
        }
      }
    }
    bc.addEventListener('message', handleMessage)
    return () => {
      bc.removeEventListener('message', handleMessage)
      bc.close()
    }
  }, [pathname])

  // Poll integrations status to show amber dot if zero integrations are connected
  useEffect(() => {
    async function checkIntegrations() {
      try {
        const res = await api.integrations.list()
        const list = res.integrations || []
        const hasConnected = list.some((item: any) => item.connected === true)
        setHasConnectedIntegrations(hasConnected)
      } catch (err) {
        console.warn('Failed to check integration status:', err)
      }
    }
    if (session) {
      checkIntegrations()
      const interval = setInterval(checkIntegrations, 20000)
      return () => clearInterval(interval)
    }
  }, [session])

  const [billingUsage, setBillingUsage] = useState<any>(null)

  useEffect(() => {
    async function checkBillingUsage() {
      try {
        const usage = await api.billing.usage()
        setBillingUsage(usage)
      } catch (err) {
        console.warn('Failed to load billing usage for layout:', err)
      }
    }
    if (session) {
      checkBillingUsage()
      const interval = setInterval(checkBillingUsage, 30000)
      return () => clearInterval(interval)
    }
  }, [session])

  if (!session) return (
    <div className="h-screen w-full flex items-center justify-center bg-[#050507]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 bg-[#534AB7]/20 rounded-xl animate-ping" />
          <div className="relative w-10 h-10 bg-[#0D0D11] border border-[#534AB7]/30 rounded-xl flex items-center justify-center">
            <div className="w-4 h-4 bg-[#534AB7] rounded-sm" />
          </div>
        </div>
        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest animate-pulse">
          Initializing Chatbolt OS...
        </div>
      </div>
    </div>
  )

  const userEmail = session.tenant?.email || session.user?.email || 'user@chatbolt.io'

  // Sidebar nav — 5 core items (ManusAI-style minimal nav)
  const menuItems: MenuItem[] = [
    { name: 'New task', href: '/dashboard/terminal', icon: SquarePen, isPrimary: true },
    { name: 'Agent', href: '/dashboard/agents', icon: Bot },
    { name: 'Plugins', href: '/dashboard/plugins', icon: LayoutGrid },
    { name: 'Scheduled', href: '/dashboard/scheduled', icon: Clock },
    { name: 'Library', href: '/dashboard/workspace', icon: Library },
  ]

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Find workspace first
      const wsRes = await api.workspaces.list()
      const wsList = wsRes.workspaces || []
      if (wsList.length === 0) throw new Error('No active workspace context found.')
      
      await api.workspaces.createProject(wsList[0].id, {
        name: newProjName,
        description: newProjDesc,
        status: 'active'
      })
      toastSuccess('Project Created', `Successfully created workspace project: "${newProjName}"`)
      setShowCreateProjModal(false)
      setNewProjName('')
      setNewProjDesc('')
      
      // Reload page context if currently on workspace route
      if (pathname === '/dashboard/workspace') {
        window.location.reload()
      } else {
        router.push('/dashboard/workspace')
      }
    } catch (err: any) {
      toastError('Creation Failed', err.message || 'Failed to create workspace project.')
    }
  }

  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName)
    setIsModelDropdownOpen(false)
    toastSuccess('Engine Calibrated', `Active LLM gateway routed to: ${modelName}`)
  }

  const handleClearNotifications = () => {
    setNotifications([])
    toastInfo('Inbox Wiped', 'System activity alerts cleared successfully.')
  }

  const handleDismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    toastSuccess('Index Search Completed', `Filtered workflow runs for query: "${searchQuery}"`)
    setShowSearchModal(false)
    router.push(`/dashboard/workspace?search=${encodeURIComponent(searchQuery)}`)
    setSearchQuery('')
  }

  const activeNotifCount = notifications.length

  return (
    <div className="dark flex h-screen bg-[#050507] text-[#EDEDED] antialiased overflow-hidden font-sans select-none">

      {/* SIDEBAR */}
      <aside 
        className={`${
          isSidebarCollapsed ? 'w-[68px]' : 'w-64'
        } border-r border-white/[0.04] flex flex-col shrink-0 bg-[#09090B] justify-between transition-all duration-300 overflow-x-hidden relative`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          
          {/* Top Logo and Sidebar Toggles */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.04] shrink-0">
            <Link href="/dashboard/terminal" className="flex items-center gap-2 no-underline group shrink-0">
              <div className="w-6 h-6 bg-[#534AB7] rounded-md flex items-center justify-center shadow-[0_0_12px_rgba(83,74,183,0.4)]">
                <Zap size={12} className="text-white fill-white" />
              </div>
              {!isSidebarCollapsed && (
                <span className="text-[13px] font-black tracking-tight text-white uppercase animate-in fade-in duration-300">
                  chatbolt
                </span>
              )}
            </Link>
            
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2 animate-in fade-in duration-300">
                <button 
                  onClick={() => setShowSearchModal(true)}
                  className="flex items-center gap-1.5 px-2 py-1 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  title="Search (⌘K)"
                >
                  <Search size={12} />
                  <kbd className="text-[8px] font-black text-zinc-700 bg-white/[0.03] border border-white/[0.06] rounded px-1">⌘K</kbd>
                </button>
                <button 
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-white/5 transition-colors"
                  title="Collapse Sidebar"
                >
                  <PanelLeft size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1.5">
            {menuItems.map(item => {
              const isActive = pathname === item.href
              if (item.isPrimary) {
                const isTerminalItem = item.href === '/dashboard/terminal'
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-4 py-2.5'
                    } bg-[#534AB7] hover:bg-[#534AB7]/90 text-white rounded-xl text-xs font-bold transition-all no-underline w-full shadow-[0_0_12px_rgba(83,74,183,0.4)]`}
                    title={isSidebarCollapsed ? item.name : undefined}
                  >
                    <div className="relative flex items-center">
                      <item.icon size={14} className="text-zinc-300 group-hover:text-white shrink-0" />
                      {isTerminalItem && showTerminalBadge && isSidebarCollapsed && (
                        <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                      )}
                    </div>
                    {!isSidebarCollapsed && (
                      <div className="flex items-center justify-between w-full">
                        <span className="animate-in fade-in duration-300">{item.name}</span>
                        {isTerminalItem && showTerminalBadge && (
                          <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        )}
                      </div>
                    )}
                  </Link>
                )
              }

              const isPluginsItem = item.name === 'Plugins'
              const showPluginsBadge = isPluginsItem && !hasConnectedIntegrations

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
                  } rounded-xl text-xs font-bold transition-all no-underline ${
                    isActive
                      ? 'text-white border-l-2 border-[#534AB7] bg-white/[0.03]'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]'
                  }`}
                  title={isSidebarCollapsed ? item.name : undefined}
                >
                  <div className="relative flex items-center shrink-0">
                    <item.icon
                      size={14}
                      className={`${isActive ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'} shrink-0`}
                    />
                    {showPluginsBadge && isSidebarCollapsed && (
                      <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex items-center justify-between w-full">
                      <span className="animate-in fade-in duration-300">{item.name}</span>
                      {showPluginsBadge && (
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                      )}
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Projects Header & List */}
          <div className="px-4 py-2 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between min-h-[16px]">
              {!isSidebarCollapsed ? (
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest animate-in fade-in duration-300">Projects</span>
              ) : (
                <div className="w-full h-[1px] bg-white/[0.04] my-2" />
              )}
              <button 
                onClick={() => setShowCreateProjModal(true)}
                className="text-zinc-500 hover:text-white transition-colors"
                title="Create Project"
              >
                <Plus size={12} />
              </button>
            </div>

            {/* New project option */}
            {!isSidebarCollapsed ? (
              <button 
                onClick={() => setShowCreateProjModal(true)}
                className="flex items-center gap-2.5 text-xs font-bold text-zinc-500 hover:text-white no-underline transition-all px-1 py-1 w-full text-left bg-transparent border-none outline-none cursor-pointer"
              >
                <FolderPlus size={14} className="text-zinc-600 shrink-0" />
                <span>New project</span>
              </button>
            ) : (
              <button 
                onClick={() => setShowCreateProjModal(true)}
                className="flex justify-center p-1 text-zinc-600 hover:text-white w-full bg-transparent border-none outline-none cursor-pointer"
                title="New Project"
              >
                <FolderPlus size={14} />
              </button>
            )}

            {/* All tasks list */}
            {!isSidebarCollapsed && (
              <div className="pt-4 space-y-2 animate-in fade-in duration-300">
                <div className="flex items-center justify-between text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                  <span>Tasks</span>
                  <button onClick={() => router.push('/dashboard/workspace')} className="text-zinc-600 hover:text-white">
                    <LayoutList size={10} />
                  </button>
                </div>
                
                <div className="space-y-1 pt-1.5">
                  {activeRuns.length === 0 ? (
                    <div className="text-[10px] text-zinc-600 italic px-1">No tasks logged.</div>
                  ) : (
                    activeRuns.map(run => {
                      const isDone = ['completed', 'success'].includes((run.status || '').toLowerCase())
                      const isFail = ['failed', 'error'].includes((run.status || '').toLowerCase())
                      return (
                        <Link 
                          key={run.id}
                          href="/dashboard/workspace"
                          className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-[#534AB7] truncate no-underline py-1 px-1 transition-all"
                        >
                          {isDone ? (
                            <Check size={12} className="text-emerald-500 shrink-0" />
                          ) : isFail ? (
                            <XCircle size={12} className="text-rose-500 shrink-0" />
                          ) : (
                            <Loader2 size={12} className="text-purple-500 animate-spin shrink-0" />
                          )}
                          <span className="truncate">{run.workflow_name || 'Autonomous Task'}</span>
                        </Link>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Bottom Sidebar Controllers */}
        <div className={`p-4 border-t border-white/[0.04] bg-white/[0.005] flex flex-col gap-3 shrink-0`}>
          {/* User Profile & Plan Badge section */}
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between gap-2 px-1 py-0.5 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 min-w-0">
                <div 
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-[10px] font-black text-green-400 cursor-pointer shrink-0"
                >
                  {userEmail?.substring(0, 1).toUpperCase() || 'A'}
                </div>
                <p className="text-[10px] font-bold text-zinc-300 truncate">{userEmail || 'User'}</p>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${
                (() => {
                  const p = (session?.tenant?.plan || 'free').toLowerCase()
                  if (p === 'pro' || p === 'premium') return 'bg-purple-900/40 text-purple-400 border border-purple-800/30'
                  if (p === 'team') return 'bg-teal-900/40 text-teal-400 border border-teal-800/30'
                  if (p === 'enterprise') return 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/30'
                  return 'bg-zinc-800 text-zinc-400 border border-zinc-700/30'
                })()
              }`}>
                {session?.tenant?.plan || 'free'}
              </span>
            </div>
          )}
          {isSidebarCollapsed && (
            <div 
              onClick={() => setIsSettingsOpen(true)}
              className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-[10px] font-black text-green-400 cursor-pointer mx-auto"
              title={session?.tenant?.plan || 'free'}
            >
              {userEmail?.substring(0, 1).toUpperCase() || 'A'}
            </div>
          )}
          <div className={`flex ${isSidebarCollapsed ? 'flex-col gap-2.5 items-center' : 'items-center justify-between'}`}>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-white/5 transition-all"
                title="Personalization settings"
              >
                <Sliders size={14} />
              </button>
              <button 
                onClick={() => router.push('/dashboard/workspace')}
                className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-white/5 transition-all"
                title="Database library"
              >
                <Database size={14} />
              </button>
              <button 
                onClick={() => router.push('/dashboard/playground')}
                className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-white/5 transition-all"
                title="Assistant playground"
              >
                <Laptop size={14} />
              </button>
            </div>
            {/* removed Meta branding */}
          </div>
        </div>

      </aside>

      {/* MAIN BODY PANEL */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-[#050507]">
        
        {/* Top Header Bar */}
        <header className="h-14 shrink-0 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 z-20 relative">
          <div className="flex items-center gap-3">
            {isSidebarCollapsed && (
              <button 
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-1.5 text-zinc-500 hover:text-white rounded transition-colors"
                title="Expand Sidebar"
              >
                <PanelLeft size={16} />
              </button>
            )}
            
            {/* Center/Left model dropdown indicator exactly as in screenshot */}
            <div className="relative">
              <div 
                onClick={() => {
                  setIsModelDropdownOpen(!isModelDropdownOpen)
                  setIsNotificationsOpen(false)
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[11px] font-bold text-zinc-300 hover:text-white cursor-pointer hover:border-white/10 transition-all select-none"
              >
                <span>{selectedModel}</span>
                <ChevronDown size={12} className="text-zinc-500" />
              </div>

              {/* Model Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-[#0D0D11] border border-white/[0.08] rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 z-50">
                  {['Chatbolt 1.6 Lite', 'Chatbolt 2.0 Ultra (Pro)', 'Chatbolt Coder Pro'].map(m => (
                    <button
                      key={m}
                      onClick={() => handleSelectModel(m)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        selectedModel === m ? 'bg-white/[0.05] text-[#534AB7]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Free plan & dynamic upgrade link */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5 text-[10px] font-bold">
            <span className="text-zinc-500">Free plan</span>
            <span className="text-zinc-600">|</span>
            <Link href="/dashboard/billing" className="text-blue-400 hover:underline no-underline transition-all">Upgrade</Link>
          </div>

          {/* Top Right user controllers */}
          <div className="flex items-center gap-3">
            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen)
                  setIsModelDropdownOpen(false)
                }}
                className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-white/[0.04] transition-all relative"
                title="System Notifications"
              >
                <Bell size={15} />
                {activeNotifCount > 0 && (
                  <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#534AB7] rounded-full animate-pulse" />
                )}
              </button>

              {/* Notification Center */}
              {isNotificationsOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-[#0D0D11] border border-white/[0.08] rounded-xl p-4 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-100 z-50">
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white">System Alerts</span>
                    {activeNotifCount > 0 && (
                      <button 
                        onClick={handleClearNotifications}
                        className="text-[9px] font-bold text-zinc-500 hover:text-white uppercase tracking-wider bg-transparent border-none outline-none cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="text-[10px] text-zinc-600 italic py-4 text-center">No active notifications.</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="flex items-start justify-between gap-3 bg-white/[0.01] border border-white/[0.03] p-2.5 rounded-lg">
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-[10px] text-zinc-300 font-bold leading-normal">{n.text}</p>
                            <span className="text-[8px] text-zinc-600 font-bold uppercase">{n.time}</span>
                          </div>
                          <button 
                            onClick={() => handleDismissNotification(n.id)}
                            className="p-0.5 text-zinc-700 hover:text-white bg-transparent border-none outline-none cursor-pointer shrink-0"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Credits pills */}
            <div 
              onClick={() => toastInfo('Credits Limit', 'Account loaded with 300 credits. Recharges renew monthly.')}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/[0.03] border border-white/[0.05] rounded-xl text-[10px] font-bold text-zinc-300 hover:text-white cursor-pointer transition-all hover:bg-white/[0.05]"
              title="View Compute Credits"
            >
              <Zap size={11} className="text-amber-400" />
              <span>300</span>
            </div>

            {/* Avatar circle A exactly as in screenshot */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="w-7 h-7 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-xs font-black text-green-400 hover:scale-105 transition-transform"
              title="User Account settings"
            >
              {userEmail?.substring(0, 1).toUpperCase() || 'A'}
            </button>
          </div>
        </header>

        {/* Warning Banner */}
        {billingUsage?.tasks && billingUsage.tasks.limit > 0 && (pathname === '/dashboard/terminal' || pathname === '/dashboard') && (
          (() => {
            const current = billingUsage.tasks.current
            const limit = billingUsage.tasks.limit
            const percentage = (current / limit) * 100
            if (percentage >= 100) {
              return (
                <div className="bg-red-950/80 border-b border-red-500/30 text-red-200 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 shrink-0 animate-in slide-in-from-top duration-300">
                  <AlertCircle size={14} className="text-red-400" />
                  <span>You've reached your monthly task limit ({current} of {limit}). Upgrade to Pro to continue.</span>
                  <Link href="/dashboard/settings/billing" className="text-[#534AB7] hover:underline font-black ml-1">Upgrade →</Link>
                </div>
              )
            }
            if (percentage >= 80) {
              return (
                <div className="bg-amber-950/80 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 shrink-0 animate-in slide-in-from-top duration-300">
                  <AlertCircle size={14} className="text-amber-400" />
                  <span>You've used {current} of {limit} free tasks this month. Upgrade for unlimited tasks.</span>
                  <Link href="/dashboard/settings/billing" className="text-[#534AB7] hover:underline font-black ml-1">Upgrade →</Link>
                </div>
              )
            }
            return null
          })()
        )}

        {/* Canvas content */}
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>

      </main>

      {/* Global Command Palette */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setShowSearchModal(false)} />
          <form
            onSubmit={handleSearchSubmit}
            className="bg-[#0D0D11] border border-white/[0.1] rounded-2xl max-w-lg w-full relative z-10 shadow-2xl animate-in zoom-in-95 slide-in-from-top-4 duration-200 overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
              <Search size={15} className="text-zinc-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tasks, assistants, artifacts…"
                className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder-zinc-600 font-medium"
                autoFocus
              />
              <kbd className="px-1.5 py-0.5 text-[9px] font-black bg-white/[0.04] border border-white/[0.08] rounded text-zinc-500">ESC</kbd>
            </div>

            {/* Quick Navigation */}
            <div className="p-2">
              <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600 px-3 py-1.5">Quick Navigate</div>
              {[
                { label: 'New Task', sub: 'Open terminal', href: '/dashboard/terminal', icon: SquarePen },
                { label: 'Outcomes', sub: 'View task history', href: '/dashboard/outcomes', icon: Target },
                { label: 'Assistants', sub: 'Manage assistants', href: '/dashboard/agents', icon: Bot },
                { label: 'Plugins', sub: 'Browse integrations', href: '/dashboard/plugins', icon: LayoutGrid },
                { label: 'Connections', sub: 'Manage integrations', href: '/dashboard/plugins', icon: ShieldCheck },
                { label: 'Library', sub: 'Files & workspace', href: '/dashboard/workspace', icon: Library },
              ].map(item => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => { router.push(item.href); setShowSearchModal(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left group"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                    <item.icon size={12} className="text-zinc-400 group-hover:text-[#534AB7] transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-zinc-300 group-hover:text-white transition-colors">{item.label}</p>
                    <p className="text-[9px] text-zinc-600 font-semibold">{item.sub}</p>
                  </div>
                  <ChevronDown size={11} className="text-zinc-700 ml-auto -rotate-90 group-hover:text-zinc-400 transition-colors" />
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[8px] font-bold text-zinc-600">
                  <kbd className="px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.08] rounded">↩</kbd>
                  <span>search</span>
                </div>
                <div className="flex items-center gap-1 text-[8px] font-bold text-zinc-600">
                  <kbd className="px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.08] rounded">esc</kbd>
                  <span>close</span>
                </div>
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#534AB7] text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-[#534AB7]/90 transition-colors"
              >
                Search Records
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CREATE PROJECT */}
      {showCreateProjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setShowCreateProjModal(false)} />
          <form onSubmit={handleCreateProject} className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl max-w-md w-full p-6 relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-white">Create Workspace Project</span>
              <button type="button" onClick={() => setShowCreateProjModal(false)} className="text-zinc-500 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer">
                <XCircle size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Project Name</label>
                <input 
                  type="text" 
                  value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  placeholder="Competitor Research Q3..."
                  className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#534AB7]/40 placeholder-zinc-700"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Description</label>
                <textarea 
                  value={newProjDesc}
                  onChange={e => setNewProjDesc(e.target.value)}
                  placeholder="Track competitors and generate enrichment models..."
                  className="w-full h-20 bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#534AB7]/40 placeholder-zinc-700 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateProjModal(false)} className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-zinc-400 hover:text-white">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-[#534AB7] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#534AB7]/90">
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Settings Personalization Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        userEmail={userEmail}
      />
    </div>
  )
}
