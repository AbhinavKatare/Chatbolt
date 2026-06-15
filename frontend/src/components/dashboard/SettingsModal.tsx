'use client'
import { useState } from 'react'
import { X, User, Settings, CreditCard, Brain, Shield, HardDrive, Chrome, Compass, Cpu, HelpCircle, Import, ChevronRight } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type SettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  userEmail: string
}

export default function SettingsModal({ isOpen, onClose, userEmail }: SettingsModalProps) {
  const { success: toastSuccess, error: toastError } = useToast()
  const [activeTab, setActiveTab] = useState<'profile' | 'knowledge'>('profile')
  const [activeMenu, setActiveMenu] = useState('Personalization')

  // Form states
  const [nickname, setNickname] = useState('Jane')
  const [occupation, setOccupation] = useState('Hobbyist')
  const [aboutMe, setAboutMe] = useState("I'm an Analyst based in NYC. I work mainly in React and SQL.")

  if (!isOpen) return null

  const handleImportMemory = () => {
    toastSuccess('Memory Ingested', 'Dynamically parsed and auto-filled agent knowledge profiles.')
  }

  const handleSave = () => {
    toastSuccess('Settings Saved', 'Modulations successfully synced back to Chatbolt agent networks.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Box */}
      <div className="relative w-full max-w-4xl h-[560px] bg-[var(--color-surface)] border border-white/[0.08] rounded-2xl flex overflow-hidden shadow-2xl text-zinc-300 font-sans z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Left Side Sidebar */}
        <aside className="w-56 border-r border-white/[0.05] bg-[var(--color-bg)] p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            {/* Profile Summary */}
            <div className="flex items-center gap-3 px-2 py-1 hover:bg-white/[0.02] rounded-xl transition-all">
              <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-xs font-black text-green-400">
                {userEmail?.substring(0, 1).toUpperCase() || 'A'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{userEmail?.split('@')[0] || 'Abhinav Katare'}</div>
                <div className="text-[9px] text-zinc-500 truncate">Personal Account</div>
              </div>
            </div>

            {/* Menu List */}
            <nav className="space-y-4">
              <div className="space-y-1">
                <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest px-2 mb-1">Account</div>
                {[
                  { name: 'Account', icon: User },
                  { name: 'General', icon: Settings },
                  { name: 'Usage & Billing', icon: CreditCard },
                  { name: 'Personalization', icon: Brain },
                ].map(item => (
                  <button
                    key={item.name}
                    onClick={() => setActiveMenu(item.name)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeMenu === item.name
                        ? 'bg-white/[0.06] text-white'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
                    }`}
                  >
                    <item.icon size={13} className={activeMenu === item.name ? 'text-[var(--color-accent)]' : ''} />
                    {item.name}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest px-2 mb-1">Features</div>
                {[
                  { name: 'Mail Chatbolt', icon: Import },
                  { name: 'Data controls', icon: Shield },
                  { name: 'My Computer', icon: HardDrive },
                  { name: 'Cloud browser', icon: Chrome },
                  { name: 'My plugins', icon: Compass },
                  { name: 'Integrations', icon: Cpu },
                ].map(item => (
                  <button
                    key={item.name}
                    onClick={() => setActiveMenu(item.name)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeMenu === item.name
                        ? 'bg-white/[0.06] text-white'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
                    }`}
                  >
                    <item.icon size={13} className={activeMenu === item.name ? 'text-[var(--color-accent)]' : ''} />
                    {item.name}
                  </button>
                ))}
              </div>
            </nav>
          </div>

          {/* Bottom Help */}
          <button className="flex items-center gap-2 px-2.5 py-1.5 text-zinc-500 hover:text-white text-xs font-semibold transition-all">
            <HelpCircle size={14} />
            Get help
          </button>
        </aside>

        {/* Right Side Settings Panel */}
        <main className="flex-1 bg-[var(--color-surface)] p-8 overflow-y-auto custom-scrollbar flex flex-col justify-between">
          <div className="space-y-6">
            
            {/* Header Title */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">{activeMenu}</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  {activeMenu === 'Personalization' 
                    ? 'Manage who you are and what Chatbolt remembers.' 
                    : `Customize your agent parameters for ${activeMenu.toLowerCase()}.`}
                </p>
              </div>
              <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            {activeMenu === 'Personalization' ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Tabs */}
                <div className="flex gap-4 border-b border-white/[0.05] pb-2">
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all ${
                      activeTab === 'profile' ? 'text-white' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Profile
                    {activeTab === 'profile' && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('knowledge')}
                    className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all flex items-center gap-1 ${
                      activeTab === 'knowledge' ? 'text-white' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Knowledge
                    <HelpCircle size={11} className="text-zinc-600" />
                    {activeTab === 'knowledge' && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
                    )}
                  </button>
                </div>

                {activeTab === 'profile' ? (
                  <div className="space-y-5">
                    {/* Highlight Box */}
                    <div 
                      onClick={handleImportMemory}
                      className="bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[var(--color-accent)]">
                          <Import size={15} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-[var(--color-accent)] transition-colors">Import memory from another AI</div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">Auto-fill your profile using conversations from other AI providers.</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-zinc-600 group-hover:text-white transition-all" />
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nickname</label>
                        <input
                          type="text"
                          value={nickname}
                          onChange={e => setNickname(e.target.value)}
                          className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[var(--color-accent)]/30 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Occupation</label>
                        <input
                          type="text"
                          value={occupation}
                          onChange={e => setOccupation(e.target.value)}
                          className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[var(--color-accent)]/30 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">More about you</label>
                      <textarea
                        value={aboutMe}
                        onChange={e => setAboutMe(e.target.value)}
                        className="w-full h-24 bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[var(--color-accent)]/30 outline-none resize-none custom-scrollbar"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/30 rounded-xl p-8 text-center text-zinc-500 text-xs border border-white/[0.04]">
                    Add document facts, credentials, and custom instructions to synchronize memories.
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-black/30 border border-white/[0.04] rounded-2xl p-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center h-64">
                <Cpu className="text-zinc-700 mb-3" size={24} />
                Manage your enterprise connectors and credentials under the {activeMenu} tab.
              </div>
            )}

          </div>

          {/* Footer Save Area */}
          <div className="border-t border-white/[0.05] pt-4 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Chatbolt OS uses this info to adapt responses.</span>
            <div className="flex gap-2">
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-[var(--color-accent)] text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-[var(--color-accent)]/90"
              >
                Save Changes
              </button>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
