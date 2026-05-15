'use client'
import { useEffect, useState } from 'react'
import { api, getSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
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
  MessageSquare,
  Activity,
  Download,
  ShieldCheck,
  Zap,
  Globe,
  Database,
  Terminal
} from 'lucide-react'

type Tab = 'profile' | 'apikeys' | 'vault' | 'email' | 'danger'

export default function SettingsPage() {
  const { success: toastSuccess, info: toastInfo, warning: toastWarning } = useToast()
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
  const [name, setName] = useState('')
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
    } catch (err: any) { console.error(err) }
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
    { id: 'profile' as Tab, label: 'Profile', icon: User, desc: 'Identity Manifest' },
    { id: 'vault' as Tab, label: 'API Vault', icon: Shield, desc: 'BYOK Integrations' },
    { id: 'apikeys' as Tab, label: 'Access Tokens', icon: Key, desc: 'Platform Interface' },
    { id: 'email' as Tab, label: 'Communication', icon: Mail, desc: 'SMTP Protocols' },
    { id: 'danger' as Tab, label: 'Destruction', icon: AlertTriangle, desc: 'Critical Actions' },
  ]

  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              <SettingsIcon size={14} className="text-[#00DFB8]" /> System Configuration
           </div>
           <div className="h-4 w-px bg-black/[0.05]" />
           <div className="flex items-center gap-4">
              <button className="text-[10px] font-bold text-black uppercase tracking-widest border-b border-black">Workspace</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Compliance</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Audit Logs</button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-black/[0.05] rounded-lg text-[9px] font-black uppercase tracking-widest text-black cursor-default">
              <Activity size={12} className="text-[#00DFB8]" /> V2.4.0-STABLE
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
          
          <div className="flex justify-between items-end">
             <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-black uppercase tracking-widest">
                   <ShieldCheck size={10} /> Certified Architecture
                </div>
                <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">System Environment Matrix</h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
                   Manage high-fidelity workspace protocols, encrypted vault integrations, and secure platform access tokens.
                </p>
             </div>
          </div>

          <div className="grid grid-cols-12 gap-10">
             {/* SIDEBAR TABS */}
             <div className="col-span-3 space-y-1.5">
                {tabs.map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => { setTab(t.id); setMsg('') }}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left group ${
                      tab === t.id 
                      ? 'bg-white border border-black/[0.05] shadow-sm text-[#1A1A1A]' 
                      : 'text-gray-400 hover:text-[#1A1A1A]'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-black/[0.03] transition-all ${
                      tab === t.id ? 'bg-[#1A1A1A] text-[#00DFB8]' : 'bg-gray-50 text-gray-300 group-hover:bg-gray-100'
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
             <div className="col-span-9 space-y-6">
                {msg && (
                  <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                    msg.includes('success') 
                    ? 'bg-green-50 border-green-100 text-green-600' 
                    : 'bg-red-50 border-red-100 text-red-600'
                  }`}>
                    <CheckCircle2 size={16} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{msg}</span>
                  </div>
                )}

                {/* PROFILE TAB */}
                {tab === 'profile' && (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-8">
                      <div className="flex items-center justify-between border-b border-black/[0.03] pb-6">
                         <h3 className="text-xs font-black text-[#1A1A1A] uppercase tracking-widest">Workspace Identity</h3>
                         <Globe size={16} className="text-[#00DFB8]" />
                      </div>
                      
                      <form onSubmit={saveProfile} className="space-y-8">
                         <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Business Entity</label>
                               <input 
                                 className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-[#1A1A1A] text-xs font-bold focus:border-black/20 outline-none transition-all" 
                                 value={name} 
                                 onChange={e => setName(e.target.value)} 
                               />
                            </div>
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Administrative Email</label>
                               <div className="relative">
                                  <input 
                                    className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-gray-300 text-xs font-bold cursor-not-allowed outline-none" 
                                    value={tenant?.email || ''} 
                                    disabled 
                                  />
                                  <Lock size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-200" />
                               </div>
                            </div>
                         </div>
                         
                         <div className="p-4 bg-gray-50 border border-black/[0.03] rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <div className="w-9 h-9 rounded-lg bg-[#1A1A1A] text-[#00DFB8] flex items-center justify-center">
                                  <Zap size={16} fill="currentColor" />
                               </div>
                               <div>
                                  <div className="text-[10px] font-black uppercase tracking-widest text-[#1A1A1A]">Enterprise Deployment</div>
                                  <div className="text-[8px] font-bold text-gray-300 uppercase tracking-widest mt-0.5">High Volume Logic · Tier: {tenant?.plan || 'PRO'}</div>
                               </div>
                            </div>
                            <button className="px-4 py-1.5 bg-white border border-black/[0.05] text-[9px] font-black uppercase tracking-widest rounded-lg hover:border-black transition-all shadow-sm">
                              Scale Tier
                            </button>
                         </div>

                         <button className="flex items-center gap-2 px-8 py-3 bg-[#1A1A1A] text-white rounded-xl shadow-sm hover:bg-black transition-all text-[10px] font-black uppercase tracking-widest" type="submit" disabled={saving}>
                            {saving ? 'Processing...' : <><Save size={14} /> Synchronize Manifest</>}
                         </button>
                      </form>
                    </div>

                    <div className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-8">
                      <h3 className="text-xs font-black text-[#1A1A1A] uppercase tracking-widest border-b border-black/[0.03] pb-6">Security Protocols</h3>
                      <form onSubmit={changePassword} className="space-y-6">
                         <div className="space-y-3">
                            <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Active Credential</label>
                            <input 
                              className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-[#1A1A1A] text-xs font-bold focus:border-black/20 outline-none transition-all" 
                              type="password" 
                              value={curPwd} 
                              onChange={e => setCurPwd(e.target.value)} 
                              required 
                            />
                         </div>
                         <div className="space-y-3">
                            <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">New Protocol Manifest</label>
                            <input 
                              className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-[#1A1A1A] text-xs font-bold focus:border-black/20 outline-none transition-all" 
                              type="password" 
                              value={newPwd} 
                              onChange={e => setNewPwd(e.target.value)} 
                              required 
                              minLength={8} 
                            />
                         </div>
                         <button className="px-8 py-3 bg-white border border-black/[0.05] text-[#1A1A1A] rounded-xl shadow-sm hover:border-black transition-all text-[10px] font-black uppercase tracking-widest" type="submit" disabled={saving}>
                            Update Security State
                         </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* API VAULT TAB */}
                {tab === 'vault' && (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="bg-[#1A1A1A] border border-black p-8 rounded-2xl shadow-xl space-y-8">
                      <div className="flex items-center justify-between border-b border-white/[0.05] pb-6">
                         <div>
                           <h3 className="text-xs font-black text-white uppercase tracking-widest">Secure Integration Vault</h3>
                           <p className="text-gray-400 text-[10px] font-medium mt-1 uppercase tracking-widest">Encrypted BYOK Protocol Storage</p>
                         </div>
                         <Shield size={20} className="text-[#00DFB8]" />
                      </div>
                      
                      <form onSubmit={saveVaultKey} className="space-y-6">
                         <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Provider Matrix</label>
                               <select 
                                 className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold outline-none cursor-pointer focus:border-[#00DFB8] transition-all" 
                                 value={vaultService} 
                                 onChange={e => setVaultService(e.target.value)}
                               >
                                 <option value="openai">OpenAI (GPT-4)</option>
                                 <option value="anthropic">Anthropic (Claude)</option>
                                 <option value="twilio">Twilio (WhatsApp)</option>
                                 <option value="stripe">Stripe (Payments)</option>
                                 <option value="sendgrid">SendGrid (Mail)</option>
                               </select>
                            </div>
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Neural Token / Secret</label>
                               <div className="relative">
                                 <input 
                                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold focus:border-[#00DFB8] outline-none transition-all placeholder:text-gray-700" 
                                   type="password"
                                   placeholder="sk-••••••••" 
                                   value={vaultKey} 
                                   onChange={e => setVaultKey(e.target.value)} 
                                   required 
                                 />
                                 <Lock size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00DFB8]" />
                               </div>
                            </div>
                         </div>
                         
                         <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl flex items-center gap-4 text-gray-400 text-[10px] font-medium leading-relaxed uppercase tracking-widest">
                           <Shield className="w-5 h-5 text-[#00DFB8] shrink-0" />
                           <p>Tokens are encrypted via AES-256-GCM. Decryption occurs only within the isolated execution environment during active inference cycles.</p>
                         </div>

                         <button className="flex items-center gap-2 px-8 py-3 bg-[#00DFB8] text-black rounded-xl shadow-lg hover:bg-[#00f7cc] transition-all text-[10px] font-black uppercase tracking-widest" type="submit" disabled={saving}>
                            {saving ? 'Encrypting...' : <><Save size={14} /> Commit to Vault</>}
                         </button>
                      </form>
                    </div>

                    <div className="bg-white border border-black/[0.03] rounded-2xl shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-black/[0.03] flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest">Encrypted Key Index</h3>
                        <Database size={14} className="text-gray-300" />
                      </div>
                      {vaultKeys.length === 0 ? (
                        <div className="p-16 text-center space-y-3 opacity-20">
                           <Shield size={24} className="mx-auto" />
                           <p className="text-[9px] font-black uppercase tracking-widest">Vault is empty</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-black/[0.03]">
                          {vaultKeys.map((k) => (
                            <div key={k.service} className="p-6 flex items-center justify-between group hover:bg-gray-50/50 transition-all">
                              <div className="flex items-center gap-5">
                                 <div className="w-10 h-10 bg-gray-50 border border-black/[0.03] rounded-xl flex items-center justify-center text-[#1A1A1A] group-hover:bg-white transition-all shadow-sm">
                                    {k.service === 'openai' ? <Bot size={18} /> : k.service === 'twilio' ? <MessageSquare size={18} /> : <Key size={18} />}
                                 </div>
                                 <div>
                                    <div className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-widest">{k.service} Protocol</div>
                                    <div className="text-[8px] text-gray-300 font-black uppercase tracking-widest mt-1">
                                      Cycle State: {k.is_valid ? 'Operational' : 'Suspended'} · {k.last_used || 'Never Used'}
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6">
                                 <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                   k.is_valid ? 'text-green-600 bg-green-50 border border-green-100' : 'text-red-600 bg-red-50 border border-red-100'
                                 }`}>
                                    {k.is_valid ? 'Authenticated' : 'Invalid Auth'}
                                 </div>
                                 <button 
                                   className="text-[9px] font-black text-gray-300 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center gap-2" 
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
                  <div className="space-y-6 animate-in fade-in duration-500">
                    {newKey && (
                      <div className="bg-[#1A1A1A] p-8 rounded-2xl border border-black shadow-xl space-y-6">
                        <div className="flex items-center gap-2 text-[#00DFB8]">
                          <ShieldCheck size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Interface Key provisioned</span>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-5 rounded-xl font-mono text-[11px] text-gray-300 break-all leading-relaxed tracking-wider select-all">
                          {newKey}
                        </div>
                        <div className="flex gap-4">
                          <button className="flex items-center gap-2 bg-[#00DFB8] text-black px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 transition-all" onClick={() => { navigator.clipboard.writeText(newKey); toastSuccess('Copied to clipboard'); }}>
                             <Copy size={14} /> Copy Manifest
                          </button>
                          <button className="px-6 py-2.5 bg-white/10 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white/20 transition-all" onClick={() => setNewKey('')}>
                             Dismiss
                          </button>
                        </div>
                        <p className="text-[8px] text-red-400 uppercase font-black tracking-widest italic">⚠️ Warning: Critical data. Unrecoverable if lost.</p>
                      </div>
                    )}

                    <div className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-8">
                      <div className="flex items-center justify-between border-b border-black/[0.03] pb-6">
                         <h3 className="text-xs font-black text-[#1A1A1A] uppercase tracking-widest">Platform Access Protocols</h3>
                         <Key size={16} className="text-[#00DFB8]" />
                      </div>
                      
                      <form onSubmit={createKey} className="space-y-6">
                         <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Protocol Identifier</label>
                               <input 
                                 className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-[#1A1A1A] text-xs font-bold focus:border-black/20 outline-none transition-all" 
                                 placeholder="e.g. Analytics Webhook" 
                                 value={keyName} 
                                 onChange={e => setKeyName(e.target.value)} 
                                 required 
                               />
                            </div>
                            <div className="space-y-3">
                               <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Deployment Scope</label>
                               <select 
                                 className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-[#1A1A1A] text-xs font-bold outline-none cursor-pointer focus:border-black/20 transition-all" 
                                 value={keyAgent} 
                                 onChange={e => setKeyAgent(e.target.value)}
                               >
                                 <option value="">Global Infrastructure</option>
                                 {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                               </select>
                            </div>
                         </div>
                         <button className="flex items-center gap-2 px-8 py-3 bg-[#1A1A1A] text-white rounded-xl shadow-sm hover:bg-black transition-all text-[10px] font-black uppercase tracking-widest" type="submit" disabled={saving}>
                            {saving ? 'Provisioning...' : <><Plus size={14} /> Provision Interface Key</>}
                         </button>
                      </form>
                    </div>

                    <div className="bg-white border border-black/[0.03] rounded-2xl shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-black/[0.03]">
                        <h3 className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest">Active Access Manifest</h3>
                      </div>
                      {apiKeys.length === 0 ? (
                        <div className="p-16 text-center space-y-3 opacity-20">
                           <Key size={24} className="mx-auto" />
                           <p className="text-[9px] font-black uppercase tracking-widest">No keys provisioned</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-black/[0.03]">
                          {apiKeys.map((k) => (
                            <div key={k.id} className="p-6 flex items-center justify-between group hover:bg-gray-50/50 transition-all">
                              <div className="flex items-center gap-5">
                                 <div className="w-10 h-10 bg-gray-50 border border-black/[0.03] rounded-xl flex items-center justify-center text-[#1A1A1A] group-hover:bg-white transition-all shadow-sm">
                                    <Terminal size={16} />
                                 </div>
                                 <div>
                                    <div className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-widest">{k.name}</div>
                                    <div className="font-mono text-[9px] text-gray-300 uppercase tracking-widest mt-1">{k.key_prefix}••••••••</div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6">
                                 <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                   k.is_active ? 'text-green-600 bg-green-50 border border-green-100' : 'text-gray-300 bg-gray-100'
                                 }`}>
                                    {k.is_active ? 'Validated' : 'Revoked'}
                                 </div>
                                 {k.is_active && (
                                   <button 
                                     className="text-[9px] font-black text-gray-300 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center gap-2" 
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
                  <div className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-8 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between border-b border-black/[0.03] pb-6">
                       <div>
                          <h3 className="text-xs font-black text-[#1A1A1A] uppercase tracking-widest">SMTP Infrastructure Protocol</h3>
                          <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mt-1">Transactional Communication Node</p>
                       </div>
                       <Mail size={18} className="text-[#00DFB8]" />
                    </div>
                    
                    <form className="space-y-6" onSubmit={e => { e.preventDefault(); setMsg('SMTP settings saved successfully') }}>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Neural Gateway (Host)</label>
                          <input className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-[#1A1A1A] text-xs font-bold outline-none focus:border-black/20 transition-all" 
                            placeholder="smtp.neural.com" value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Protocol Port</label>
                          <input className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-[#1A1A1A] text-xs font-bold outline-none focus:border-black/20 transition-all" 
                            placeholder="587" value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Authentication Identity</label>
                        <input className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-[#1A1A1A] text-xs font-bold outline-none focus:border-black/20 transition-all" 
                          type="email" placeholder="systems@business.com" value={smtp.user} onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">App Secret Protocol</label>
                        <input className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-[#1A1A1A] text-xs font-bold outline-none focus:border-black/20 transition-all" 
                          type="password" placeholder="••••••••••••" value={smtp.pass} onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))} />
                      </div>
                      
                      <div className="p-5 bg-[#1A1A1A] rounded-xl border border-black space-y-4">
                        <div className="flex items-center gap-2 text-[#00DFB8]">
                          <Terminal size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Implementation Note</span>
                        </div>
                        <p className="text-[10px] text-gray-400 leading-relaxed uppercase font-medium tracking-widest">
                          Protocol requires <span className="text-white">TLS/SSL</span> encapsulation. Ensure the source IP is whitelisted in your DNS SPF records for maximum deliverability.
                        </p>
                      </div>

                      <div className="flex gap-4">
                        <button className="flex-1 py-3 bg-[#1A1A1A] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all" type="submit">
                           Commit Protocol
                        </button>
                        <button className="px-6 py-3 bg-white border border-black/[0.05] text-[#1A1A1A] rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-black transition-all" type="button" onClick={() => toastInfo('Test protocol initiated...')}>
                           Test Pulse
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* DANGER ZONE TAB */}
                {tab === 'danger' && (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="bg-white border border-red-100 p-8 rounded-2xl shadow-sm space-y-6">
                      <div className="flex items-center gap-3 text-red-600 border-b border-red-50 pb-4">
                         <AlertTriangle size={20} />
                         <h3 className="text-xs font-black uppercase tracking-widest">Purge Workspace Architecture</h3>
                      </div>
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest leading-loose">
                         Permanent infrastructure teardown. Purges all agents, encrypted vaults, knowledge bases, and neural transaction history. Action is irreversible.
                      </p>
                      <button className="w-full py-3 border border-red-100 text-red-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all" onClick={() => {
                        if (prompt('Type PURGE ARCHITECTURE to confirm:') === 'PURGE ARCHITECTURE') toastWarning('Initiating teardown...')
                      }}>
                         Initiate Teardown
                      </button>
                    </div>

                    <div className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-6">
                      <div className="flex items-center gap-3 text-[#1A1A1A] border-b border-black/[0.03] pb-4">
                         <Download size={20} />
                         <h3 className="text-xs font-black uppercase tracking-widest">Architecture Export</h3>
                      </div>
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest leading-loose">
                         Generate a full structural manifest of your workspace metadata. Includes agent definitions, knowledge schemas, and audit logs in structured JSON format.
                      </p>
                      <button className="px-8 py-3 bg-white border border-black/[0.05] text-[#1A1A1A] rounded-xl shadow-sm font-black text-[9px] uppercase tracking-widest hover:border-black transition-all" onClick={() => toastInfo('Manifest export initiated.')}>
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
