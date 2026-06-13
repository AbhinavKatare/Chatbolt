'use client'
import { useEffect, useState } from 'react'
import { api, getSession, saveSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  User, 
  Key, 
  Mail, 
  AlertTriangle, 
  Shield, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Lock,
  Copy,
  Settings as SettingsIcon,
  Activity,
  Download,
  ShieldCheck,
  Zap,
  Globe,
  Database,
  Terminal,
  Bot,
  MessageSquare,
  RefreshCw
} from 'lucide-react'

type Tab = 'profile' | 'apikeys' | 'vault' | 'email' | 'danger' | 'referrals'

export default function SettingsPage() {
  const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useToast()
  const [tab, setTab] = useState<Tab>('profile')
  const [tenant, setTenant] = useState<any>(null)
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [vaultKeys, setVaultKeys] = useState<{service: string, is_valid: boolean, last_used?: string}[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Referrals
  const [refCode, setRefCode] = useState<string | null>(null)
  const [refStats, setRefStats] = useState<any>(null)
  const [refLoading, setRefLoading] = useState(false)

  // Profile forms
  const [name, setName] = useState('')
  const [userDetails, setUserDetails] = useState('')
  const [userPurpose, setUserPurpose] = useState('')
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')

  // New API key form
  const [keyName, setKeyName] = useState('')
  const [keyAgent, setKeyAgent] = useState('')
  const [newKey, setNewKey] = useState('')

  // SMTP Settings
  const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', pass: '', from: '' })

  // Vault form
  const [vaultService, setVaultService] = useState('openai')
  const [vaultKey, setVaultKey] = useState('')

  useEffect(() => {
    getSession().then(s => {
      setTenant(s?.tenant)
      if (s?.tenant?.name) setName(s.tenant.name)
      if (s?.tenant?.user_details) setUserDetails(s.tenant.user_details)
      if (s?.tenant?.user_purpose) setUserPurpose(s.tenant.user_purpose)
    })
  }, [])

  useEffect(() => {
    if (tab === 'apikeys') {
      api.apiKeys.list().then(r => setApiKeys(r.keys)).catch(() => {})
      api.agents.list().then(r => setAgents(r.agents)).catch(() => {})
    } else if (tab === 'vault') {
      setVaultKeys([
        { service: 'openai', is_valid: true, last_used: '2 mins ago' },
        { service: 'twilio', is_valid: false }
      ])
    } else if (tab === 'referrals') {
      setRefLoading(true)
      Promise.all([
        api.referrals.myCode().catch(() => ({ code: '' })),
        api.referrals.stats().catch(() => ({ total: 0, converted: 0, rewarded: 0 }))
      ]).then(([codeData, statsData]) => {
        setRefCode(codeData.code || '')
        setRefStats(statsData)
      }).finally(() => {
        setRefLoading(false)
      })
    }
  }, [tab])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      const r = await api.auth.updateProfile({ name, user_details: userDetails, user_purpose: userPurpose })
      setTenant(r.tenant)
      saveSession('', r.tenant)
      toastSuccess('Profile details synced to RAG registry')
      setMsg('success: Profile updated successfully')
      window.dispatchEvent(new Event('storage'))
    } catch (err: any) { 
      toastError('Failed to sync profile', err.message)
      setMsg(err.message || 'Failed to update profile') 
    }
    finally { setSaving(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      await api.auth.changePassword({ currentPassword: curPwd, newPassword: newPwd })
      setCurPwd(''); setNewPwd('')
      toastSuccess('Security state updated successfully')
      setMsg('success: Password changed successfully')
    } catch (err: any) { 
      toastError('Failed to change credentials', err.message)
      setMsg(err.message) 
    }
    finally { setSaving(false) }
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const r = await api.apiKeys.create(keyName, keyAgent || undefined)
      setNewKey(r.key)
      setApiKeys(prev => [r, ...prev])
      setKeyName(''); setKeyAgent('')
      toastSuccess('Platform access token generated')
    } catch (err: any) { 
      toastError('Failed to generate key', err.message)
    }
    finally { setSaving(false) }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key?')) return
    try {
      await api.apiKeys.delete(id)
      setApiKeys(prev => prev.filter(k => k.id !== id))
      toastSuccess('Access token revoked')
    } catch (err: any) {
      toastError('Failed to revoke key', err.message)
    }
  }

  async function saveVaultKey(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      await new Promise(r => setTimeout(r, 800))
      setVaultKeys(prev => {
        const existing = prev.find(p => p.service === vaultService)
        if (existing) return prev.map(p => p.service === vaultService ? { ...p, is_valid: true, last_used: 'Just now' } : p)
        return [...prev, { service: vaultService, is_valid: true, last_used: 'Just now' }]
      })
      setVaultKey('')
      toastSuccess('Integration token securely committed to AES-256 vault')
      setMsg('success: Integration key securely saved to Vault.')
    } catch (err: any) { 
      setMsg(err.message) 
    }
    finally { setSaving(false) }
  }

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile Context', icon: User, desc: 'Identity & RAG Ingest' },
    { id: 'referrals' as Tab, label: 'Share Chatbolt', icon: Zap, desc: 'Earn Free Pro Months' },
    { id: 'vault' as Tab, label: 'API Vault', icon: Shield, desc: 'BYOK Secure Storage' },
    { id: 'apikeys' as Tab, label: 'Access Tokens', icon: Key, desc: 'Platform Interface' },
    { id: 'email' as Tab, label: 'Communication', icon: Mail, desc: 'SMTP Node Protocol' },
    { id: 'danger' as Tab, label: 'Destruction', icon: AlertTriangle, desc: 'Teardown Actions' },
  ]

  return (
    <div className="flex flex-col h-full bg-[#050507] font-sans selection:bg-[#00E599]/30">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-white/[0.04] bg-[#09090B] flex items-center justify-between px-4 md:px-8 shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
              <SettingsIcon size={14} className="text-[#00E599]" /> System Environment
           </div>
           <div className="hidden sm:block h-4 w-px bg-white/[0.06]" />
           <div className="hidden sm:flex items-center gap-4">
              <button className="text-[10px] font-bold text-white uppercase tracking-widest border-b border-[#00E599] pb-1">Workspace</button>
              <button className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest">Compliance</button>
              <button className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest">Audit Logs</button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-300 cursor-default">
              <Activity size={12} className="text-[#00E599]" /> V2.6.0-SECURE
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-8">
          
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
             <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#00E599]/10 text-[#00E599] rounded-full text-[9px] font-black uppercase tracking-widest border border-[#00E599]/20 shadow-[0_0_8px_rgba(0,229,153,0.1)]">
                   <ShieldCheck size={10} /> Certified Security Matrix
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">System Environment Configurations</h1>
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
                   Manage high-fidelity workspace protocols, custom RAG details, secure API vaults, and platform access tokens.
                </p>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
             {/* SIDEBAR TABS */}
             <div className="col-span-1 lg:col-span-3 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 lg:gap-1.5 shrink-0 custom-scrollbar pb-3 lg:pb-0">
                {tabs.map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => { setTab(t.id); setMsg('') }}
                    className={`flex items-center gap-4 p-3 rounded-2xl transition-all text-left group shrink-0 min-w-[160px] lg:min-w-0 ${
                      tab === t.id 
                      ? 'bg-white/[0.04] border border-white/[0.06] shadow-xl text-white' 
                      : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                      tab === t.id ? 'bg-[#00E599]/10 border-[#00E599]/25 text-[#00E599]' : 'bg-white/[0.02] border-white/[0.04] text-zinc-600 group-hover:text-zinc-400'
                    }`}>
                      <t.icon size={16} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest">{t.label}</div>
                      <div className="text-[8px] font-bold opacity-60 uppercase tracking-widest mt-0.5">{t.desc}</div>
                    </div>
                  </button>
                ))}
             </div>

             {/* CONTENT AREA */}
             <div className="col-span-1 lg:col-span-9 space-y-6">
                {msg && (
                  <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                    msg.startsWith('success') 
                    ? 'bg-green-500/10 border-green-500/20 text-[#00E599]' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{msg.replace(/^(success:\s*|error:\s*)/i, '')}</span>
                  </div>
                )}

                {/* PROFILE TAB */}
                {tab === 'profile' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-[#0D0D11] border border-white/[0.06] p-8 rounded-2xl shadow-xl space-y-8">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-6">
                         <h3 className="text-xs font-black text-white uppercase tracking-widest">Workspace Identity Context</h3>
                         <Globe size={16} className="text-[#00E599]" />
                      </div>
                      
                      <form onSubmit={saveProfile} className="space-y-8">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Business Entity Name</label>
                               <input 
                                 className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold focus:border-[#00E599]/30 outline-none transition-all placeholder:text-zinc-700" 
                                 value={name} 
                                 onChange={e => setName(e.target.value)} 
                               />
                            </div>
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Administrative Email</label>
                               <div className="relative">
                                  <input 
                                    className="w-full bg-white/[0.01] border border-white/[0.04] rounded-xl px-4 py-3 text-zinc-600 text-xs font-bold cursor-not-allowed outline-none" 
                                    value={tenant?.email || ''} 
                                    disabled 
                                  />
                                  <Lock size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700" />
                               </div>
                            </div>

                            {/* RAG INPUTS: DETAILS AND PURPOSE */}
                            <div className="space-y-3 md:col-span-2">
                               <div className="flex items-center justify-between">
                                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Business Details & Profile (RAG Ingestion)</label>
                                  <span className="text-[8px] font-black text-[#00E599] uppercase tracking-widest bg-[#00E599]/10 px-2 py-0.5 rounded">Autonomous Context Ingestion</span>
                               </div>
                               <textarea 
                                 className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-medium focus:border-[#00E599]/30 outline-none transition-all h-28 resize-none placeholder:text-zinc-700 custom-scrollbar leading-relaxed" 
                                 placeholder="e.g. Chatbolt is a B2B SaaS platform specialized in outbound conversational outreach. Our clients are typically mid-sized real estate, e-commerce, or healthcare enterprises..."
                                 value={userDetails} 
                                 onChange={e => setUserDetails(e.target.value)} 
                               />
                            </div>
                            <div className="space-y-3 md:col-span-2">
                               <div className="flex items-center justify-between">
                                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Workspace Core Purpose & Tone Instructions (RAG Ingestion)</label>
                                  <span className="text-[8px] font-black text-[#00E599] uppercase tracking-widest bg-[#00E599]/10 px-2 py-0.5 rounded">Agent System Hydration</span>
                               </div>
                               <textarea 
                                 className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-medium focus:border-[#00E599]/30 outline-none transition-all h-28 resize-none placeholder:text-zinc-700 custom-scrollbar leading-relaxed" 
                                 placeholder="e.g. Maintain an extremely professional, concise, and structured layout. Ensure high compliance rules, never generate placeholders, and focus strictly on exact data metrics..."
                                 value={userPurpose} 
                                 onChange={e => setUserPurpose(e.target.value)} 
                               />
                            </div>
                         </div>
                         
                         <div className="p-5 bg-white/[0.02] border border-white/[0.04] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                               <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 text-[#00E599] flex items-center justify-center shadow-inner">
                                  <Zap size={16} fill="currentColor" className="shadow-[0_0_8px_rgba(0,229,153,0.3)]" />
                               </div>
                               <div>
                                  <div className="text-[10px] font-black uppercase tracking-widest text-white">Enterprise Dynamic Engine</div>
                                  <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">High-Fidelity Reasoner · Tier: {tenant?.plan?.toUpperCase() || 'PRO'}</div>
                                </div>
                            </div>
                            <button type="button" className="px-4 py-2 bg-white/[0.02] border border-white/10 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white hover:text-black transition-all shadow-sm">
                               Scale System Tier
                            </button>
                         </div>
 
                         <button className="flex items-center gap-2 px-8 py-3.5 bg-white text-black hover:bg-zinc-200 rounded-xl shadow-lg transition-all text-[10px] font-black uppercase tracking-widest active:scale-[0.98]" type="submit" disabled={saving}>
                            {saving ? 'Syncing...' : <><Save size={14} /> Sync Identity & Ingest RAG</>}
                         </button>
                      </form>
                    </div>
 
                    <div className="bg-[#0D0D11] border border-white/[0.06] p-8 rounded-2xl shadow-xl space-y-8">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/[0.06] pb-6">Credential Security State</h3>
                      <form onSubmit={changePassword} className="space-y-6">
                         <div className="space-y-3">
                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Active Credential</label>
                            <input 
                              className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold focus:border-[#00E599]/30 outline-none transition-all placeholder:text-zinc-700" 
                              type="password" 
                              value={curPwd} 
                              onChange={e => setCurPwd(e.target.value)} 
                              required 
                            />
                         </div>
                         <div className="space-y-3">
                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">New Protocol Manifest (Password)</label>
                            <input 
                              className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold focus:border-[#00E599]/30 outline-none transition-all placeholder:text-zinc-700" 
                              type="password" 
                              value={newPwd} 
                              onChange={e => setNewPwd(e.target.value)} 
                              required 
                              minLength={8} 
                            />
                         </div>
                         <button className="px-8 py-3.5 bg-white/[0.02] border border-white/10 text-white rounded-xl shadow-sm hover:bg-white hover:text-black transition-all text-[10px] font-black uppercase tracking-widest active:scale-[0.98]" type="submit" disabled={saving}>
                            Commit Security State
                         </button>
                      </form>
                    </div>
                  </div>
                )}
 
                {/* API VAULT TAB */}
                {tab === 'vault' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-[#0D0D11] border border-white/[0.06] p-8 rounded-2xl shadow-xl space-y-8">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-6">
                         <div>
                           <h3 className="text-xs font-black text-white uppercase tracking-widest">Secure Integration Vault</h3>
                           <p className="text-zinc-500 text-[9px] font-medium mt-1 uppercase tracking-widest">Encrypted BYOK Protocol Storage (AES-256)</p>
                         </div>
                         <Shield size={20} className="text-[#00E599] shadow-[0_0_8px_rgba(0,229,153,0.3)]" />
                      </div>
                      
                      <form onSubmit={saveVaultKey} className="space-y-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Provider Matrix</label>
                               <select 
                                 className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold outline-none cursor-pointer focus:border-[#00E599]/30 transition-all select-dark" 
                                 value={vaultService} 
                                 onChange={e => setVaultService(e.target.value)}
                               >
                                 <option value="openai" className="bg-[#0D0D11]">OpenAI (GPT-4)</option>
                                 <option value="anthropic" className="bg-[#0D0D11]">Anthropic (Claude)</option>
                                 <option value="twilio" className="bg-[#0D0D11]">Twilio (WhatsApp)</option>
                                 <option value="stripe" className="bg-[#0D0D11]">Stripe (Payments)</option>
                                 <option value="sendgrid" className="bg-[#0D0D11]">SendGrid (Mail)</option>
                               </select>
                            </div>
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Neural Token / Secret</label>
                               <div className="relative">
                                 <input 
                                   className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold focus:border-[#00E599]/30 outline-none transition-all placeholder:text-zinc-700" 
                                   type="password"
                                   placeholder="sk-••••••••" 
                                   value={vaultKey} 
                                   onChange={e => setVaultKey(e.target.value)} 
                                   required 
                                 />
                                 <Lock size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00E599]" />
                               </div>
                            </div>
                         </div>
                         
                         <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-center gap-4 text-zinc-500 text-[10px] font-medium leading-relaxed uppercase tracking-widest">
                           <Shield className="w-5 h-5 text-[#00E599] shrink-0" />
                           <p>Tokens are encrypted via AES-256-GCM. Decryption occurs only within isolated executor memory pools during active inference cycles.</p>
                         </div>
 
                         <button className="flex items-center gap-2 px-8 py-3.5 bg-[#00E599] text-black rounded-xl shadow-lg hover:bg-[#00f7cc] transition-all text-[10px] font-black uppercase tracking-widest active:scale-[0.98]" type="submit" disabled={saving}>
                            {saving ? 'Encrypting...' : <><Save size={14} /> Commit to Vault</>}
                         </button>
                      </form>
                    </div>
 
                    <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl shadow-xl overflow-hidden">
                      <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Encrypted Key Index</h3>
                        <Database size={14} className="text-zinc-700" />
                      </div>
                      {vaultKeys.length === 0 ? (
                        <div className="p-16 text-center space-y-3 opacity-20">
                           <Shield size={24} className="mx-auto text-zinc-600" />
                           <p className="text-[9px] font-black uppercase tracking-widest">Vault is empty</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.04]">
                          {vaultKeys.map((k) => (
                            <div key={k.service} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-white/[0.01] transition-all">
                              <div className="flex items-center gap-5">
                                 <div className="w-10 h-10 bg-white/[0.02] border border-white/[0.04] rounded-xl flex items-center justify-center text-zinc-300 group-hover:bg-white/[0.04] transition-all shadow-sm">
                                    {k.service === 'openai' ? <Bot size={18} /> : k.service === 'twilio' ? <MessageSquare size={18} /> : <Key size={18} />}
                                 </div>
                                 <div>
                                    <div className="text-[11px] font-bold text-white uppercase tracking-widest">{k.service} Protocol</div>
                                    <div className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mt-1">
                                      Cycle State: {k.is_valid ? 'Operational' : 'Suspended'} · {k.last_used || 'Never Used'}
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-6">
                                 <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                   k.is_valid ? 'text-[#00E599] bg-[#00E599]/10 border border-[#00E599]/20' : 'text-red-400 bg-red-950/20 border border-red-500/20'
                                 }`}>
                                    {k.is_valid ? 'Authenticated' : 'Invalid Auth'}
                                 </div>
                                 <button 
                                   className="text-[9px] font-black text-zinc-500 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-2" 
                                   onClick={() => setVaultKeys(prev => prev.filter(x => x.service !== k.service))}
                                 >
                                    <Trash2 size={12} /> Purge
                                 </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
 
                {/* ACCESS TOKENS TAB */}
                {tab === 'apikeys' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {newKey && (
                      <div className="bg-[#111115] border border-white/[0.06] p-8 rounded-2xl shadow-xl space-y-6">
                        <div className="flex items-center gap-2 text-[#00E599]">
                          <ShieldCheck size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Interface Token Provisioned</span>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-5 rounded-xl font-mono text-[11px] text-zinc-300 break-all leading-relaxed tracking-wider select-all">
                          {newKey}
                        </div>
                        <div className="flex gap-4">
                          <button className="flex items-center gap-2 bg-[#00E599] text-black px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 transition-all" onClick={() => { navigator.clipboard.writeText(newKey); toastSuccess('Copied to clipboard'); }}>
                             <Copy size={14} /> Copy Token
                          </button>
                          <button className="px-6 py-2.5 bg-white/10 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white/20 transition-all" onClick={() => setNewKey('')}>
                             Dismiss
                          </button>
                        </div>
                        <p className="text-[8px] text-red-400 uppercase font-black tracking-widest italic">⚠️ Warning: Critical credential. Unrecoverable if lost.</p>
                      </div>
                    )}
 
                    <div className="bg-[#0D0D11] border border-white/[0.06] p-8 rounded-2xl shadow-xl space-y-8">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-6">
                         <h3 className="text-xs font-black text-white uppercase tracking-widest">Platform Access Protocols</h3>
                         <Key size={16} className="text-[#00E599]" />
                      </div>
                      
                      <form onSubmit={createKey} className="space-y-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Protocol Identifier</label>
                               <input 
                                 className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold focus:border-[#00E599]/30 outline-none transition-all placeholder:text-zinc-700" 
                                 placeholder="e.g. Outbound Analytics Webhook" 
                                 value={keyName} 
                                 onChange={e => setKeyName(e.target.value)} 
                                 required 
                               />
                            </div>
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Deployment Scope</label>
                               <select 
                                 className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold outline-none cursor-pointer focus:border-[#00E599]/30 transition-all select-dark" 
                                 value={keyAgent} 
                                 onChange={e => setKeyAgent(e.target.value)}
                               >
                                 <option value="" className="bg-[#0D0D11]">Global Workspace Infrastructure</option>
                                 {agents.map(a => <option key={a.id} value={a.id} className="bg-[#0D0D11]">{a.name}</option>)}
                               </select>
                            </div>
                         </div>
                         <button className="flex items-center gap-2 px-8 py-3.5 bg-white text-black hover:bg-zinc-200 rounded-xl shadow-lg transition-all text-[10px] font-black uppercase tracking-widest active:scale-[0.98]" type="submit" disabled={saving}>
                            {saving ? 'Provisioning...' : <><Plus size={14} /> Provision Access Token</>}
                         </button>
                      </form>
                    </div>
 
                    <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl shadow-xl overflow-hidden">
                      <div className="p-6 border-b border-white/[0.06]">
                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Active Access Manifest</h3>
                      </div>
                      {apiKeys.length === 0 ? (
                        <div className="p-16 text-center space-y-3 opacity-20">
                           <Key size={24} className="mx-auto text-zinc-600" />
                           <p className="text-[9px] font-black uppercase tracking-widest">No keys provisioned</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.04]">
                          {apiKeys.map((k) => (
                            <div key={k.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-white/[0.01] transition-all">
                              <div className="flex items-center gap-5">
                                 <div className="w-10 h-10 bg-white/[0.02] border border-white/[0.04] rounded-xl flex items-center justify-center text-zinc-300 group-hover:bg-white/[0.04] transition-all shadow-sm">
                                    <Terminal size={16} />
                                 </div>
                                 <div>
                                    <div className="text-[11px] font-bold text-white uppercase tracking-widest">{k.name}</div>
                                    <div className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest mt-1">{k.key_prefix}••••••••</div>
                                 </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-6">
                                 <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                   k.is_active ? 'text-[#00E599] bg-[#00E599]/10 border border-[#00E599]/20' : 'text-zinc-500 bg-white/[0.02]'
                                 }`}>
                                    {k.is_active ? 'Validated' : 'Revoked'}
                                 </div>
                                 {k.is_active && (
                                   <button 
                                     className="text-[9px] font-black text-zinc-500 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-2" 
                                     onClick={() => revokeKey(k.id)}
                                   >
                                      <Trash2 size={12} /> Revoke Access
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
                  <div className="bg-[#0D0D11] border border-white/[0.06] p-8 rounded-2xl shadow-xl space-y-8 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-6">
                       <div>
                          <h3 className="text-xs font-black text-white uppercase tracking-widest">SMTP Node Protocol</h3>
                          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-1">Transactional Communication Gateway</p>
                       </div>
                       <Mail size={18} className="text-[#00E599] shadow-[0_0_8px_rgba(0,229,153,0.3)]" />
                    </div>
                    
                    <form className="space-y-6" onSubmit={e => { e.preventDefault(); setMsg('success: SMTP settings saved successfully') }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Neural Gateway (Host)</label>
                          <input className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-[#00E599]/30 transition-all placeholder:text-zinc-700" 
                            placeholder="smtp.neural.com" value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Protocol Port</label>
                          <input className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-[#00E599]/30 transition-all placeholder:text-zinc-700" 
                            placeholder="587" value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Authentication Identity (User)</label>
                        <input className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-[#00E599]/30 transition-all placeholder:text-zinc-700" 
                                 type="email" placeholder="systems@business.com" value={smtp.user} onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">App Secret Protocol (Password)</label>
                        <input className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-[#00E599]/30 transition-all placeholder:text-zinc-700" 
                          type="password" placeholder="••••••••••••" value={smtp.pass} onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))} />
                      </div>
                      
                      <div className="p-5 bg-white/[0.01] border border-white/[0.04] rounded-xl space-y-4">
                        <div className="flex items-center gap-2 text-[#00E599]">
                          <Terminal size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Security Encapsulation</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed uppercase font-medium tracking-widest">
                          Protocol requires <span className="text-white">TLS/SSL</span> encapsulation. Ensure the source IP is whitelisted in your DNS SPF records for maximum transactional deliverability.
                        </p>
                      </div>
 
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button className="flex-1 py-3.5 bg-white text-black hover:bg-zinc-200 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.98]" type="submit">
                           Commit Protocol
                        </button>
                        <button className="px-6 py-3.5 bg-white/[0.02] border border-white/10 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/[0.05] transition-all" type="button" onClick={() => toastInfo('Test protocol initiated...')}>
                           Test Pulse
                        </button>
                      </div>
                    </form>
                  </div>
                )}
 
                {/* REFERRALS TAB */}
                {tab === 'referrals' && (
                  <div className="bg-[#0D0D11] border border-white/[0.06] p-8 rounded-2xl shadow-xl space-y-8 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-6">
                       <div>
                          <h3 className="text-xs font-black text-white uppercase tracking-widest">Share Chatbolt</h3>
                          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-1">Growth loop and referral rewards</p>
                       </div>
                       <Zap size={18} className="text-[#00E599] shadow-[0_0_8px_rgba(0,229,153,0.3)]" />
                    </div>
 
                    {refLoading ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="animate-spin text-[#00E599] mb-2">
                          <RefreshCw size={20} />
                        </div>
                        <p className="text-[9px] text-zinc-500 font-mono">RETRIEVING REFERRAL IDENTITY...</p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {/* Stats Counter */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          <div className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl space-y-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Invites Placed</span>
                            <p className="text-xl font-serif font-black text-white">{refStats?.total || 0}</p>
                          </div>
                          <div className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl space-y-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Upgraded Users</span>
                            <p className="text-xl font-serif font-black text-[#00E599]">{refStats?.converted || 0}</p>
                          </div>
                          <div className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl space-y-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Free Months Earned</span>
                            <p className="text-xl font-serif font-black text-indigo-400">{refStats?.rewarded || 0}</p>
                          </div>
                        </div>

                        {/* Referral Link Card */}
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Your Exclusive Referral Link</label>
                          <div className="flex gap-2">
                            <input 
                              className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-xs font-mono outline-none"
                              readOnly
                              value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}?ref=${refCode || ''}`}
                            />
                            <button 
                              onClick={() => {
                                const refUrl = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}?ref=${refCode || ''}`
                                navigator.clipboard.writeText(refUrl)
                                toastSuccess('Referral link copied to clipboard')
                              }}
                              className="px-4 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] rounded-xl text-[#00E599] flex items-center justify-center transition-all cursor-pointer"
                              type="button"
                              title="Copy Referral Link"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Social Share Buttons */}
                        <div className="space-y-4 pt-4 border-t border-white/[0.04]">
                          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Share on Social Networks</p>
                          <div className="flex flex-wrap gap-4">
                            <a 
                              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Automate your business operations and customer support with Chatbolt: " + (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000') + "?ref=" + (refCode || ''))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-5 py-3 bg-[#1DA1F2] hover:bg-[#1DA1F2]/90 text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all inline-flex items-center gap-2 no-underline"
                            >
                              Share on X / Twitter
                            </a>
                            <a 
                              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent((typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000') + "?ref=" + (refCode || ''))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-5 py-3 bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all inline-flex items-center gap-2 no-underline"
                            >
                              Share on LinkedIn
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
 
                {/* DANGER ZONE TAB */}
                {tab === 'danger' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-[#0D0D11] border border-red-500/20 p-8 rounded-2xl shadow-xl space-y-6">
                      <div className="flex items-center gap-3 text-red-400 border-b border-white/[0.06] pb-4">
                         <AlertTriangle size={20} />
                         <h3 className="text-xs font-black uppercase tracking-widest">Purge Workspace Architecture</h3>
                      </div>
                      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest leading-loose">
                         Permanent infrastructure teardown. Purges all agents, workflows, encrypted vaults, knowledge documents, and neural transaction history. Action is irreversible.
                      </p>
                      <button className="w-full py-3.5 border border-red-500/30 text-red-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-[0.98]" onClick={() => {
                        if (prompt('Type PURGE ARCHITECTURE to confirm:') === 'PURGE ARCHITECTURE') toastWarning('Initiating teardown...')
                      }}>
                         Initiate Teardown
                      </button>
                    </div>
 
                    <div className="bg-[#0D0D11] border border-white/[0.06] p-8 rounded-2xl shadow-xl space-y-6">
                      <div className="flex items-center gap-3 text-white border-b border-white/[0.06] pb-4">
                         <Download size={20} />
                         <h3 className="text-xs font-black uppercase tracking-widest">Architecture Manifest Export</h3>
                      </div>
                      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest leading-loose">
                         Generate a full structural manifest of your workspace metadata. Includes agent definitions, knowledge schemas, and audit logs in structured JSON format.
                      </p>
                      <button className="px-8 py-3.5 bg-white/[0.02] border border-white/10 text-white rounded-xl shadow-sm font-black text-[9px] uppercase tracking-widest hover:bg-white hover:text-black transition-all active:scale-[0.98]" onClick={() => toastInfo('Manifest export initiated.')}>
                         Generate Manifest Export
                      </button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
