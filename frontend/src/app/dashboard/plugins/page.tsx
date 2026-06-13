'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  Search, Plus, CheckCircle2, ChevronRight, X, Loader2, Sparkles, 
  Layers, ChevronDown, Compass, ShieldAlert, Laptop, Eye, HelpCircle, AlertCircle
} from 'lucide-react'

type IntegrationItem = {
  service: string
  service_name: string
  display_name: string
  description: string
  connected: boolean
}

// 40px High-Fidelity SVG Service Logos
function ServiceLogo({ service }: { service: string }) {
  switch (service) {
    case 'browser':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="12" cy="12" rx="4" ry="10" stroke="#8A82F8" strokeWidth="1.5" />
          <line x1="2" y1="12" x2="22" y2="12" stroke="#8A82F8" strokeWidth="1.5" />
        </svg>
      )
    case 'gmail':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="4" width="20" height="16" rx="3" fill="#2D2D35" stroke="#EA4335" strokeWidth="2" />
          <path d="M2 7L12 13L22 7" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'google-calendar':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#2D2D35" stroke="#4285F4" strokeWidth="2" />
          <line x1="3" y1="9" x2="21" y2="9" stroke="#4285F4" strokeWidth="2" />
          <circle cx="12" cy="14" r="2" fill="#4285F4" />
        </svg>
      )
    case 'google-drive':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.5 4H15.5L22 15H15L8.5 4Z" fill="#34A853" />
          <path d="M15.5 4L12 10.5L8.5 4H15.5Z" fill="#FBBC05" />
          <path d="M2 15L5.5 9H12.5L9 15H2Z" fill="#4285F4" />
          <path d="M9 15H15.5L12.2 20.3L9 15Z" fill="#EA4335" />
        </svg>
      )
    case 'slack':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#2D2D35" stroke="#36C5F0" strokeWidth="2" />
          <circle cx="9" cy="9" r="1.5" fill="#E01E5A" />
          <circle cx="15" cy="9" r="1.5" fill="#2EB67D" />
          <circle cx="9" cy="15" r="1.5" fill="#ECB22E" />
          <circle cx="15" cy="15" r="1.5" fill="#36C5F0" />
        </svg>
      )
    case 'notion':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" stroke="#ffffff" strokeWidth="2" fill="#000000" />
          <path d="M7 7H9.5L14.5 14.5V7H17V17H14.5L9.5 9.5V17H7V7Z" fill="#ffffff" />
        </svg>
      )
    case 'github':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12C2 16.42 4.87 20.17 8.84 21.5C9.34 21.58 9.5 21.27 9.5 21C9.5 20.77 9.5 19.98 9.5 19.17C7 19.67 6.33 18.5 6.13 18C6 17.67 5.5 16.5 5.07 16.25C4.71 16.05 4.2 15.57 5.06 15.55C5.87 15.53 6.45 16.29 6.64 16.6C7.56 18.15 9.03 17.71 9.61 17.44C9.7 16.78 9.96 16.33 10.25 16.08C8 15.83 5.67 14.95 5.67 11.04C5.67 9.93 6.06 9.01 6.7 8.3C6.6 8.04 6.25 7 6.8 5.67C6.8 5.67 7.65 5.4 9.58 6.7C10.39 6.47 11.26 6.36 12.12 6.36C12.98 6.36 13.85 6.47 14.66 6.7C16.59 5.39 17.44 5.67 17.44 5.67C17.99 7 17.64 8.04 17.54 8.3C18.18 9.01 18.57 9.92 18.57 11.04C18.57 14.96 16.23 15.82 13.96 16.08C14.33 16.4 14.65 17.02 14.65 17.98C14.65 19.36 14.64 20.47 14.64 20.81C14.64 21.09 14.79 21.41 15.3 21.3C19.27 19.97 22 16.22 22 12C22 6.477 17.522 2 12 2Z" fill="#ffffff" />
        </svg>
      )
    case 'linear':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#2D2D35" stroke="#5E6AD2" strokeWidth="2" />
          <path d="M7 12H17M7 8H13M7 16H11" stroke="#5E6AD2" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'hubspot':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#2D2D35" stroke="#FF7A59" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill="#FF7A59" />
          <line x1="12" y1="5" x2="12" y2="9" stroke="#FF7A59" strokeWidth="2" />
          <line x1="5" y1="12" x2="9" y2="12" stroke="#FF7A59" strokeWidth="2" />
        </svg>
      )
    case 'stripe':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#2D2D35" stroke="#635BFF" strokeWidth="2" />
          <path d="M10 14.5C10 15.3 10.7 16 11.5 16H13.5C14.3 16 15 15.3 15 14.5C15 13.7 14.3 13 13.5 13H10.5C9.7 13 9 12.3 9 11.5C9 10.7 9.7 10 10.5 10H12.5C13.3 10 14 10.7 14 11.5" stroke="#635BFF" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )
    case 'outlook':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="16" rx="3" fill="#2D2D35" stroke="#0078D4" strokeWidth="2" />
          <path d="M3 6L12 12.5L21 6" stroke="#0078D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'airtable':
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 17V7L12 3L21 7V17L12 21L3 17Z" fill="#2D2D35" stroke="#18BFFF" strokeWidth="2" />
          <path d="M12 3V21" stroke="#18BFFF" strokeWidth="2" />
          <path d="M3 12H21" stroke="#18BFFF" strokeWidth="2" />
        </svg>
      )
    default:
      return (
        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-lg shrink-0">
          🔌
        </div>
      )
  }
}

export default function PluginsPage() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  const [search, setSearch] = useState('')
  const [plugins, setPlugins] = useState<IntegrationItem[]>([])
  const [loading, setLoading] = useState(true)

  // Extension Modal details
  const [showExtensionModal, setShowExtensionModal] = useState(false)

  // Pull active status from GET /api/integrations
  const loadPlugins = async () => {
    try {
      setLoading(true)
      const res = await api.integrations.list()
      // map fields to match local display values
      const list = (res.integrations || []).map((item: any) => ({
        service: item.service,
        service_name: item.service_name,
        display_name: item.display_name,
        description: item.description,
        connected: item.connected
      }))
      setPlugins(list)
    } catch (err: any) {
      toastError('Failed to load plugins', err.message || 'Supabase unreachable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlugins()
  }, [])

  // Listen to message event for popup callback verification
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const backendOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').origin
      if (event.origin !== backendOrigin) return
      if (event.data?.type === 'oauth_success') {
        toastSuccess('Connected', `Successfully connected ${event.data.service || 'plugin'}!`)
        loadPlugins()
      }
    }
    window.addEventListener('message', handleOAuthMessage)
    return () => window.removeEventListener('message', handleOAuthMessage)
  }, [])

  const handleConnect = async (service: string) => {
    if (service === 'browser') {
      setShowExtensionModal(true)
      return
    }

    try {
      const res = await api.integrations.authUrl(service)
      const connectUrl = res.url
      
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      window.open(
        connectUrl,
        `connect_${service}`,
        `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
      )
    } catch (err: any) {
      toastError('Connection Failed', err.message || 'Failed to retrieve auth URL.')
    }
  }

  const handleDisconnect = async (service: string, displayName: string) => {
    try {
      await api.integrations.revoke(service)
      toastInfo('Disconnected', `Credential access for ${displayName} has been revoked.`)
      loadPlugins()
    } catch (err: any) {
      try {
        await api.integrations.disconnect(service)
        toastInfo('Disconnected', `Credential access for ${displayName} has been revoked.`)
        loadPlugins()
      } catch (err2: any) {
        toastError('Revocation Failed', err2.message || `Failed to disconnect ${displayName}.`)
      }
    }
  }

  const filteredPlugins = plugins.filter(p => 
    p.display_name.toLowerCase().includes(search.toLowerCase()) || 
    p.description.toLowerCase().includes(search.toLowerCase())
  )

  // 3 rotating weekly featured cards
  const featured = [
    { service: 'browser', title: 'Chrome Operator', desc: 'Securely run tasks in your real browser using active sessions.' },
    { service: 'gmail', title: 'Gmail Triage', desc: 'Draft context-rich responses and triage high-volume threads instantly.' },
    { service: 'github', title: 'Git Engine', desc: 'Automate code reviews, issue tracking, and repository updates.' }
  ]

  return (
    <div className="flex flex-col h-full bg-[#050507] text-[#EDEDED] overflow-y-auto custom-scrollbar font-sans selection:bg-[#534AB7]/30 relative">
      
      {/* Header Panel */}
      <div className="h-14 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
        <span className="text-[14px] font-bold text-white">Plugins</span>
        <div className="flex items-center gap-2">
          <button className="px-3.5 py-1.5 bg-[#0D0D11]/60 border border-white/[0.06] rounded-xl text-xs font-bold text-zinc-300 hover:text-white transition-all select-none">
            Active Connectors
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-8 z-10">
        
        {/* Featured Weekly Rows */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Featured Plugins</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featured.map(f => (
              <div 
                key={f.title}
                className="bg-[#0D0D11]/50 border border-white/[0.06] rounded-2xl p-5 flex flex-col justify-between h-36 hover:border-white/10 transition-colors cursor-pointer group"
                onClick={() => handleConnect(f.service)}
              >
                <div className="flex items-center justify-between">
                  <ServiceLogo service={f.service} />
                  <ChevronRight size={14} className="text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{f.title}</h4>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full max-w-xl mx-auto">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search connectors, skills, data sources"
            className="w-full bg-[#0D0D11]/60 border border-white/[0.06] rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white outline-none focus:border-[#534AB7]/30 placeholder-zinc-600 transition-all font-semibold"
          />
        </div>

        {/* Connectors Grid */}
        <div className="space-y-4 pt-2">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Connectors</h3>
            <p className="text-[10px] text-zinc-500 font-semibold uppercase mt-0.5 tracking-wider">Connect apps and APIs to share context with Chatbolt</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-[#0D0D11]/30 border border-white/[0.04] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlugins.map(p => {
                const active = p.connected
                const isBrowser = p.service === 'browser'
                return (
                  <div 
                    key={p.service}
                    className="bg-[#0D0D11]/60 border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="shrink-0">
                        <ServiceLogo service={p.service} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          {p.display_name}
                          {active && (
                            <span className="w-1.5 h-1.5 bg-[#534AB7] rounded-full animate-pulse shadow-[0_0_6px_#534AB7]" />
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1 font-semibold leading-relaxed line-clamp-2">{p.description}</p>
                        {isBrowser && active && (
                          <span className="text-[9px] text-[#22c55e] font-bold uppercase mt-1 flex items-center gap-1">
                            <span className="w-1 h-1 bg-[#22c55e] rounded-full" /> Connected to Chrome
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {active ? (
                        <button 
                          onClick={() => handleDisconnect(p.service, p.display_name)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transition-all group"
                          title="Disconnect connector"
                        >
                          <CheckCircle2 size={14} className="group-hover:hidden" />
                          <X size={14} className="hidden group-hover:block" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleConnect(p.service)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/10 transition-all"
                          title="Connect app"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Skills Section */}
        <div className="pt-6 border-t border-white/[0.04] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Skills</h3>
            <p className="text-[10px] text-zinc-500 font-semibold uppercase mt-0.5 tracking-wider">Reusable workflows from your successful tasks</p>
          </div>
          
          <div className="bg-[#0D0D11]/30 border border-white/[0.06] rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-2.5">
            <Layers size={24} className="text-zinc-600 animate-pulse" />
            <p className="text-xs text-zinc-500 font-semibold max-w-sm leading-normal">
              Your skills appear here as Chatbolt learns from your work. Once a task finishes successfully, its recipes are harvested automatically.
            </p>
          </div>
        </div>

      </div>

      {/* CHROME EXTENSION INSTALL MODAL */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowExtensionModal(false)} />
          <div className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl max-w-md w-full p-6 relative z-10 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Laptop size={14} className="text-[#534AB7]" /> Install Browser Connector
              </span>
              <button onClick={() => setShowExtensionModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect your real local browser session securely to Chatbolt. This lets our AI agents assist you using your logged-in accounts, cookies, and tabs, without running in a slow, headless environment.
              </p>

              <div className="p-4 bg-white/[0.01] rounded-xl border border-white/[0.05] space-y-2">
                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-wider block flex items-center gap-1.5">
                  <AlertCircle size={12} className="text-[#534AB7]" /> Installation Steps:
                </span>
                <ol className="text-[10px] text-zinc-500 space-y-1.5 list-decimal pl-4 font-semibold uppercase leading-normal">
                  <li>Download the Chatbolt Extension package (.zip).</li>
                  <li>Extract it to a folder on your computer.</li>
                  <li>Open Chrome and navigate to <code className="text-white lowercase bg-white/5 px-1 py-0.5 rounded">chrome://extensions</code>.</li>
                  <li>Enable "Developer mode" in the top right.</li>
                  <li>Click "Load unpacked" and select the extracted folder.</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowExtensionModal(false)} className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-zinc-400 hover:text-white">
                Close
              </button>
              <a 
                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/chatai-extension`} 
                download="chatbolt-extension.zip"
                onClick={() => {
                  toastSuccess('Download Started', 'Chrome Extension zip is downloading. Follow steps to load unpacked.')
                  setShowExtensionModal(false)
                }}
                className="px-4 py-2 bg-[#534AB7] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#534AB7]/90 select-none text-center no-underline"
              >
                Download Package
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

