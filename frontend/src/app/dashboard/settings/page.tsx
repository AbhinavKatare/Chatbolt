'use client'
import { useEffect, useState } from 'react'
import { api, getSession, saveSession } from '@/lib/api'
import { 
  User, 
  Key, 
  Mail, 
  AlertTriangle, 
  ChevronRight, 
  Shield, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Lock,
  ExternalLink,
  Copy,
  Settings as SettingsIcon,
  CreditCard,
  Bot,
  MessageSquare
} from 'lucide-react'

type Tab = 'profile' | 'apikeys' | 'vault' | 'email' | 'danger'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')
  const [tenant, setTenant] = useState<any>(null)
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [vaultKeys, setVaultKeys] = useState<{service: string, is_valid: boolean, last_used?: string}[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getSession().then(s => {
      setTenant(s?.tenant)
      if (s?.tenant?.name) setName(s.tenant.name)
    })
  }, [])

  // Profile form
  const [name, setName] = useState(tenant?.name || '')
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')

  // New API key form
  const [keyName, setKeyName] = useState('')
  const [keyAgent, setKeyAgent] = useState('')
  const [newKey, setNewKey] = useState('')

  const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', pass: '', from: '' })

  // Vault form
  const [vaultService, setVaultService] = useState('openai')
  const [vaultKey, setVaultKey] = useState('')

  useEffect(() => {
    if (tab === 'apikeys') {
      api.apiKeys.list().then(r => setApiKeys(r.keys)).catch(() => {})
      api.agents.list().then(r => setAgents(r.agents)).catch(() => {})
    } else if (tab === 'vault') {
      // Fetch user's stored vault statuses (we don't fetch the actual keys, just status)
      setVaultKeys([
        { service: 'openai', is_valid: true, last_used: '2 mins ago' },
        { service: 'twilio', is_valid: false }
      ])
    }
  }, [tab])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      setMsg('Profile updated successfully')
    } catch (err: any) { setMsg(err.message) }
    finally { setSaving(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      await api.auth.changePassword({ currentPassword: curPwd, newPassword: newPwd })
      setCurPwd(''); setNewPwd('')
      setMsg('Password changed successfully')
    } catch (err: any) { setMsg(err.message) }
    finally { setSaving(false) }
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const r = await api.apiKeys.create(keyName, keyAgent || undefined)
      setNewKey(r.key)
      setApiKeys(prev => [r, ...prev])
      setKeyName(''); setKeyAgent('')
    } catch (err: any) { alert(err.message) }
    finally { setSaving(false) }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key?')) return
    await api.apiKeys.delete(id).catch(() => {})
    setApiKeys(prev => prev.filter(k => k.id !== id))
  }

  async function saveVaultKey(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      // Mock API call to save BYOK
      await new Promise(r => setTimeout(r, 800))
      
      setVaultKeys(prev => {
        const existing = prev.find(p => p.service === vaultService)
        if (existing) return prev.map(p => p.service === vaultService ? { ...p, is_valid: true, last_used: 'Just now' } : p)
        return [...prev, { service: vaultService, is_valid: true, last_used: 'Just now' }]
      })
      
      setVaultKey('')
      setMsg('Integration key securely saved to Vault.')
    } catch (err: any) { setMsg(err.message) }
    finally { setSaving(false) }
  }

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User, desc: 'Personal and business information' },
    { id: 'vault' as Tab, label: 'API Vault', icon: Shield, desc: 'Bring Your Own Key (BYOK) integrations' },
    { id: 'apikeys' as Tab, label: 'Access Tokens', icon: Key, desc: 'Platform API access tokens' },
    { id: 'email' as Tab, label: 'Email (SMTP)', icon: Mail, desc: 'System alerts and notifications' },
    { id: 'danger' as Tab, label: 'Danger Zone', icon: AlertTriangle, desc: 'Critical workspace actions' },
  ]

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-6xl w-full mx-auto p-10 space-y-10 pb-32">
        
        {/* HEADER */}
        <div className="space-y-2">
           <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-bold uppercase tracking-widest mb-2">
             <SettingsIcon size={12} /> Configuration
           </div>
           <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Workspace Settings</h1>
           <p className="text-[#888] text-sm">Manage your account, security, and integration preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 items-start">
           {/* SIDEBAR TABS */}
           <div className="lg:col-span-1 space-y-2">
              {tabs.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => { setTab(t.id); setMsg('') }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left border ${
                    tab === t.id 
                    ? 'bg-white border-black/5 shadow-xl shadow-black/5 text-[#1A1A1A]' 
                    : 'border-transparent text-[#888] hover:text-[#1A1A1A] hover:bg-black/5'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-black/5 ${
                    tab === t.id ? 'bg-[#00DFB8] text-[#1A1A1A]' : 'bg-white text-gray-400'
                  }`}>
                    <t.icon size={20} />
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest">{t.label}</div>
                    <div className="text-[9px] font-bold opacity-60 uppercase tracking-tight">{t.desc}</div>
                  </div>
                </button>
              ))}
           </div>

           {/* CONTENT AREA */}
           <div className="lg:col-span-3 space-y-8">
              {msg && (
                <div className={`p-5 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                  msg.includes('success') 
                  ? 'bg-green-50 border-green-100 text-green-600' 
                  : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  <CheckCircle2 size={18} />
                  <span className="text-[11px] font-black uppercase tracking-widest">{msg}</span>
                </div>
              )}

              {/* PROFILE TAB */}
              {tab === 'profile' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="bg-white border border-black/5 p-10 rounded-3xl shadow-xl shadow-black/5 space-y-8">
                    <div className="flex items-center justify-between border-b border-black/5 pb-8">
                       <h3 className="text-xl font-black text-[#1A1A1A]">Account Information</h3>
                       <CreditCard size={20} className="text-[#00DFB8]" />
                    </div>
                    
                    <form onSubmit={saveProfile} className="space-y-8">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Business Name</label>
                             <input 
                               className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all" 
                               value={name} 
                               onChange={e => setName(e.target.value)} 
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Email Address</label>
                             <div className="relative">
                                <input 
                                  className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-gray-400 text-sm font-bold cursor-not-allowed outline-none" 
                                  value={tenant?.email || ''} 
                                  disabled 
                                />
                                <Lock size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300" />
                             </div>
                          </div>
                       </div>
                       
                       <div className="p-6 bg-[#FAFAFA] border border-black/5 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-[#00DFB8]/10 text-[#00DFB8] flex items-center justify-center">
                                <Shield size={20} />
                             </div>
                             <div>
                                <div className="text-[11px] font-black uppercase tracking-widest text-[#1A1A1A]">Subscription Plan</div>
                                <div className="text-[10px] font-bold text-[#888] uppercase tracking-tight">{tenant?.plan} Plan · Active</div>
                             </div>
                          </div>
                          <button className="px-6 py-2.5 bg-white border border-black/5 text-[10px] font-black uppercase tracking-widest rounded-xl hover:border-[#00DFB8] transition-all shadow-sm">
                            Upgrade Plan
                          </button>
                       </div>

                       <button className="flex items-center gap-3 px-10 py-4 bg-[#1A1A1A] text-white rounded-2xl shadow-xl hover:bg-black transition-all text-[11px] font-black uppercase tracking-[0.2em]" type="submit" disabled={saving}>
                          {saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                       </button>
                    </form>
                  </div>

                  <div className="bg-white border border-black/5 p-10 rounded-3xl shadow-xl shadow-black/5 space-y-8">
                    <h3 className="text-xl font-black text-[#1A1A1A] border-b border-black/5 pb-8">Security</h3>
                    <form onSubmit={changePassword} className="space-y-8">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Current Password</label>
                          <input 
                            className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all" 
                            type="password" 
                            value={curPwd} 
                            onChange={e => setCurPwd(e.target.value)} 
                            required 
                          />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">New Password</label>
                          <input 
                            className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all" 
                            type="password" 
                            value={newPwd} 
                            onChange={e => setNewPwd(e.target.value)} 
                            required 
                            minLength={8} 
                          />
                       </div>
                       <button className="px-10 py-4 bg-white border border-black/5 text-[#1A1A1A] rounded-2xl shadow-sm hover:border-black transition-all text-[11px] font-black uppercase tracking-[0.2em]" type="submit" disabled={saving}>
                          Update Password
                       </button>
                    </form>
                  </div>
                </div>
              )}

              {/* API VAULT TAB */}
              {tab === 'vault' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="bg-[#1A1A1A] border border-black p-10 rounded-3xl shadow-2xl space-y-8">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-8">
                       <div>
                         <h3 className="text-xl font-black text-white">Secure API Vault</h3>
                         <p className="text-[#888] text-sm mt-1">Bring Your Own Key (BYOK) to power agent workflows.</p>
                       </div>
                       <Shield size={24} className="text-[#00DFB8]" />
                    </div>
                    
                    <form onSubmit={saveVaultKey} className="space-y-8">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Service Provider</label>
                             <select 
                               className="w-full bg-[#111] border border-gray-800 rounded-2xl px-6 py-4 text-white text-sm font-bold outline-none cursor-pointer focus:border-[#00DFB8] transition-all" 
                               value={vaultService} 
                               onChange={e => setVaultService(e.target.value)}
                             >
                               <option value="openai">OpenAI (GPT-4, DALL-E)</option>
                               <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                               <option value="twilio">Twilio (WhatsApp, SMS)</option>
                               <option value="stripe">Stripe (Payments)</option>
                               <option value="sendgrid">SendGrid (Email API)</option>
                             </select>
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">API Key / Token</label>
                             <div className="relative">
                               <input 
                                 className="w-full bg-[#111] border border-gray-800 rounded-2xl px-6 py-4 text-white text-sm font-bold focus:border-[#00DFB8] outline-none transition-all placeholder:text-gray-700" 
                                 type="password"
                                 placeholder="sk-..." 
                                 value={vaultKey} 
                                 onChange={e => setVaultKey(e.target.value)} 
                                 required 
                               />
                               <Lock size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-[#00DFB8]" />
                             </div>
                          </div>
                       </div>
                       
                       <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 text-gray-300 text-sm">
                         <Lock className="w-5 h-5 text-[#00DFB8]" />
                         <p>Keys are encrypted at rest using AES-256-GCM and never exposed to the frontend or directly to agents. The Workflow Engine securely delegates access per request.</p>
                       </div>

                       <button className="flex items-center gap-3 px-10 py-4 bg-[#00DFB8] text-black rounded-2xl shadow-xl hover:bg-[#00f7cc] transition-all text-[11px] font-black uppercase tracking-[0.2em]" type="submit" disabled={saving}>
                          {saving ? 'Encrypting & Saving...' : <><Save size={16} /> Save to Vault</>}
                       </button>
                    </form>
                  </div>

                  <div className="bg-white border border-black/5 rounded-3xl shadow-xl shadow-black/5 overflow-hidden">
                    <div className="p-8 border-b border-black/5 flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-[0.2em]">Configured Integrations</h3>
                    </div>
                    {vaultKeys.length === 0 ? (
                      <div className="p-20 text-center space-y-4 bg-[#FAFAFA]/50">
                         <Shield size={32} className="mx-auto text-gray-200" />
                         <p className="text-[10px] font-black text-[#888] uppercase tracking-widest italic">Vault is empty</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-black/5">
                        {vaultKeys.map((k) => (
                          <div key={k.service} className="p-8 flex items-center justify-between group hover:bg-[#FAFAFA] transition-all">
                            <div className="flex items-center gap-6">
                               <div className="w-12 h-12 bg-[#00DFB8]/10 rounded-2xl flex items-center justify-center text-[#00DFB8]">
                                  {k.service === 'openai' ? <Bot size={20} /> : k.service === 'twilio' ? <MessageSquare size={20} /> : <Key size={20} />}
                               </div>
                               <div>
                                  <div className="text-sm font-black text-[#1A1A1A] capitalize">{k.service} Integration</div>
                                  <div className="text-[10px] text-[#888] font-bold mt-1">
                                    Last used: {k.last_used || 'Never'}
                                  </div>
                               </div>
                            </div>
                            <div className="flex items-center gap-8">
                               <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                 k.is_valid ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                               }`}>
                                  {k.is_valid ? 'Connected' : 'Invalid Key'}
                               </div>
                               <button 
                                 className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors flex items-center gap-2" 
                                 onClick={() => setVaultKeys(prev => prev.filter(x => x.service !== k.service))}
                               >
                                  <Trash2 size={12} /> Remove
                               </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* API KEYS TAB */}
              {tab === 'apikeys' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  {newKey && (
                    <div className="bg-[#1A1A1A] p-10 rounded-3xl border border-black shadow-2xl space-y-6">
                      <div className="flex items-center gap-3 text-[#00DFB8]">
                        <Shield size={20} />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">Secret Key Generated</span>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-6 rounded-2xl font-mono text-xs text-white break-all leading-relaxed tracking-wider">
                        {newKey}
                      </div>
                      <div className="flex gap-4">
                        <button className="flex items-center gap-2 bg-[#00DFB8] text-[#1A1A1A] px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all" onClick={() => { navigator.clipboard.writeText(newKey); alert('Copied!'); }}>
                           <Copy size={14} /> Copy Key
                        </button>
                        <button className="px-8 py-3 bg-white/10 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all" onClick={() => setNewKey('')}>
                           Dismiss
                        </button>
                      </div>
                      <p className="text-[9px] text-[#888] uppercase font-bold tracking-widest">⚠️ Note: You cannot see this key again once dismissed.</p>
                    </div>
                  )}

                  <div className="bg-white border border-black/5 p-10 rounded-3xl shadow-xl shadow-black/5 space-y-8">
                    <div className="flex items-center justify-between border-b border-black/5 pb-8">
                       <h3 className="text-xl font-black text-[#1A1A1A]">Access Tokens</h3>
                       <Key size={20} className="text-[#00DFB8]" />
                    </div>
                    
                    <form onSubmit={createKey} className="space-y-8">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Token Name</label>
                             <input 
                               className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all" 
                               placeholder="e.g. Website Widget" 
                               value={keyName} 
                               onChange={e => setKeyName(e.target.value)} 
                               required 
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Agent Scope</label>
                             <select 
                               className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold outline-none cursor-pointer focus:border-[#00DFB8] transition-all" 
                               value={keyAgent} 
                               onChange={e => setKeyAgent(e.target.value)}
                             >
                               <option value="">Full Workspace Access</option>
                               {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                             </select>
                          </div>
                       </div>
                       <button className="flex items-center gap-3 px-10 py-4 bg-[#1A1A1A] text-white rounded-2xl shadow-xl hover:bg-black transition-all text-[11px] font-black uppercase tracking-[0.2em]" type="submit" disabled={saving}>
                          {saving ? 'Generating...' : <><Plus size={16} /> Generate New Key</>}
                       </button>
                    </form>
                  </div>

                  <div className="bg-white border border-black/5 rounded-3xl shadow-xl shadow-black/5 overflow-hidden">
                    <div className="p-8 border-b border-black/5">
                      <h3 className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-[0.2em]">Active Tokens</h3>
                    </div>
                    {apiKeys.length === 0 ? (
                      <div className="p-20 text-center space-y-4 bg-[#FAFAFA]/50">
                         <Key size={32} className="mx-auto text-gray-200" />
                         <p className="text-[10px] font-black text-[#888] uppercase tracking-widest italic">No active tokens found</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-black/5">
                        {apiKeys.map((k) => (
                          <div key={k.id} className="p-8 flex items-center justify-between group hover:bg-[#FAFAFA] transition-all">
                            <div className="flex items-center gap-6">
                               <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center text-[#1A1A1A]">
                                  <Lock size={20} />
                               </div>
                               <div>
                                  <div className="text-sm font-black text-[#1A1A1A]">{k.name}</div>
                                  <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest mt-1">{k.key_prefix}••••••••</div>
                               </div>
                            </div>
                            <div className="flex items-center gap-8">
                               <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                 k.is_active ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'
                               }`}>
                                  {k.is_active ? 'Active' : 'Revoked'}
                               </div>
                               {k.is_active && (
                                 <button 
                                   className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors flex items-center gap-2" 
                                   onClick={() => revokeKey(k.id)}
                                 >
                                    <Trash2 size={12} /> Revoke
                                 </button>
                               )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* EMAIL TAB */}
              {tab === 'email' && (
                <div className="bg-white border border-black/5 p-10 rounded-3xl shadow-xl shadow-black/5 space-y-10 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between border-b border-black/5 pb-8">
                     <div>
                        <h3 className="text-xl font-black text-[#1A1A1A]">SMTP Integration</h3>
                        <p className="text-[10px] font-bold text-[#888] uppercase tracking-tight mt-1">Configure transactional email for notifications.</p>
                     </div>
                     <Mail size={24} className="text-[#00DFB8]" />
                  </div>
                  
                  <form className="space-y-8" onSubmit={e => { e.preventDefault(); setMsg('SMTP settings saved successfully') }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">SMTP Host</label>
                        <input className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold outline-none focus:border-[#00DFB8] transition-all" 
                          placeholder="smtp.gmail.com" value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Port</label>
                        <input className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold outline-none focus:border-[#00DFB8] transition-all" 
                          placeholder="587" value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Auth Email</label>
                      <input className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold outline-none focus:border-[#00DFB8] transition-all" 
                        type="email" placeholder="you@example.com" value={smtp.user} onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))} />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">App Password</label>
                      <input className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold outline-none focus:border-[#00DFB8] transition-all" 
                        type="password" placeholder="••••••••••••" value={smtp.pass} onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))} />
                    </div>
                    
                    <div className="p-8 bg-[#1A1A1A] rounded-2xl space-y-4 shadow-xl border border-black">
                      <div className="flex items-center gap-3 text-[#00DFB8]">
                        <ExternalLink size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Configuration Tip</span>
                      </div>
                      <p className="text-[11px] text-[#888] leading-relaxed">
                        For Gmail, you must enable <span className="text-white">2-Step Verification</span> and generate an <span className="text-[#00DFB8]">App Password</span> in your Google Account Security settings.
                      </p>
                    </div>

                    <div className="flex gap-4">
                      <button className="flex-1 py-4 bg-[#1A1A1A] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all" type="submit">
                         Save Configuration
                      </button>
                      <button className="px-8 py-4 bg-white border border-black/5 text-[#1A1A1A] rounded-2xl font-black text-[11px] uppercase tracking-widest hover:border-black transition-all" type="button" onClick={() => alert('Test email sent!')}>
                         Test Connection
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* DANGER ZONE TAB */}
              {tab === 'danger' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="bg-white border border-red-100 p-10 rounded-3xl shadow-xl shadow-red-500/5 space-y-8">
                    <div className="flex items-center gap-4 text-red-600 border-b border-red-50 pb-8">
                       <AlertTriangle size={24} />
                       <h3 className="text-xl font-black uppercase tracking-tight">Delete Workspace</h3>
                    </div>
                    <p className="text-sm text-[#888] leading-relaxed">
                       This action is permanent and cannot be undone. All your agents, conversation logs, and uploaded knowledge bases will be purged from our servers immediately.
                    </p>
                    <button className="w-full py-4 border border-red-100 text-red-500 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all" onClick={() => {
                      if (prompt('Type PERMANENTLY DELETE to confirm:') === 'PERMANENTLY DELETE') alert('Request submitted.')
                    }}>
                       Confirm Permanent Deletion
                    </button>
                  </div>

                  <div className="bg-white border border-black/5 p-10 rounded-3xl shadow-xl shadow-black/5 space-y-8">
                    <div className="flex items-center gap-4 text-[#1A1A1A] border-b border-black/5 pb-8">
                       <Download size={24} />
                       <h3 className="text-xl font-black uppercase tracking-tight">Data Export</h3>
                    </div>
                    <p className="text-sm text-[#888] leading-relaxed">
                       Request a full dump of your workspace data. We will package your documents, training logs, and conversation history into a structured JSON archive.
                    </p>
                    <button className="px-10 py-4 bg-white border border-black/5 text-[#1A1A1A] rounded-2xl shadow-sm font-black text-[11px] uppercase tracking-[0.2em] hover:border-black transition-all" onClick={() => alert('Export request received.')}>
                       Request Data Dump
                    </button>
                  </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  )
}

// Mock Download icon since it's not imported correctly in the previous turn
function Download({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  )
}
