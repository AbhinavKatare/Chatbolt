'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import Link from 'next/link'
import { 
  Bot, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Settings2, 
  FileText, 
  Code, 
  ExternalLink, 
  Search, 
  Filter, 
  Upload, 
  Globe, 
  CheckCircle2, 
  Info,
  Clock,
  Sparkles,
  ChevronLeft,
  MessageSquare,
  Hash
} from 'lucide-react'

type View = 'list' | 'create' | 'detail'

export default function AgentsPage() {
  const [view, setView] = useState<View>('list')
  const [agents, setAgents] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'config'|'docs'|'embed'>('docs')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ 
    name: '', 
    system_prompt: '', 
    persona_tone: 'professional', 
    welcome: 'Hi! How can I help you today?', 
    color: '#00DFB8' 
  })

  useEffect(() => { loadAgents() }, [])

  async function loadAgents() {
    const r = await api.agents.list().catch(() => ({ agents: [] }))
    setAgents(r.agents)
  }

  async function openAgent(a: any) {
    setSelected(a); setView('detail'); setTab('docs')
    const r = await api.documents.list(a.id).catch(() => ({ documents: [] }))
    setDocs(r.documents)
  }

  async function createAgent(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      await api.agents.create({
        name: form.name,
        system_prompt: form.system_prompt || `You are a helpful support assistant for ${form.name}. Answer questions based only on the provided knowledge base.`,
        persona: { tone: form.persona_tone },
        widget_config: { primaryColor: form.color, welcomeMessage: form.welcome, position: 'bottom-right' },
      })
      await loadAgents(); setView('list')
    } catch (err: any) { alert(err.message) }
    finally { setLoading(false) }
  }

  async function deleteAgent(id: string) {
    if (!confirm('Delete this agent?')) return
    await api.agents.delete(id).catch(() => {})
    await loadAgents(); if (view === 'detail') setView('list')
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !selected) return
    try {
      await api.documents.upload(selected.id, f)
      const r = await api.documents.list(selected.id)
      setDocs(r.documents)
    } catch (err: any) { alert(err.message) }
    finally { if (fileRef.current) fileRef.current.value = '' }
  }

  async function addUrl() {
    const url = prompt('Enter URL to scrape:'); if (!url || !selected) return
    try {
      await api.documents.addUrl(selected.id, url)
      const r = await api.documents.list(selected.id); setDocs(r.documents)
    } catch (err: any) { alert(err.message) }
  }

  async function deleteDoc(docId: string) {
    if (!confirm('Delete this document?') || !selected) return
    await api.documents.delete(selected.id, docId).catch(() => {})
    const r = await api.documents.list(selected.id); setDocs(r.documents)
  }

  const [embedCode, setEmbedCode] = useState('')
  async function loadEmbed() {
    if (!selected) return
    const r = await api.agents.embedCode(selected.id).catch(() => ({ embed_code: '' }))
    setEmbedCode(r.embed_code)
  }

  // ── LIST VIEW ──────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-6xl w-full mx-auto p-10 space-y-10 pb-32">
        <div className="flex items-center justify-between">
           <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-bold uppercase tracking-widest mb-2">
                <Bot size={12} /> Workforce
              </div>
              <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">AI Agents</h1>
              <p className="text-[#888] text-sm">Deploy and manage your autonomous support workforce.</p>
           </div>
           <button 
             className="flex items-center gap-3 px-8 py-4 bg-[#1A1A1A] text-white rounded-2xl shadow-xl hover:bg-black transition-all text-xs font-black uppercase tracking-[0.2em] transform hover:-translate-y-1"
             onClick={() => setView('create')}
           >
             <Plus size={18} /> Deploy Agent
           </button>
        </div>

        {agents.length === 0 ? (
          <div className="bg-white border border-black/5 p-20 text-center flex flex-col items-center rounded-3xl shadow-xl shadow-black/5">
            <div className="w-24 h-24 bg-[#FAFAFA] rounded-3xl flex items-center justify-center text-[#00DFB8] mb-8 rotate-3 shadow-sm border border-black/5">
              <Bot size={48} />
            </div>
            <h3 className="text-2xl font-black text-[#1A1A1A] tracking-tight mb-2">No active agents</h3>
            <p className="text-[#888] max-w-sm mb-10 text-sm">Start by creating your first AI agent. Each agent can be trained on specific knowledge and tools.</p>
            <button className="px-10 py-4 bg-[#1A1A1A] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-black transition-all shadow-lg" onClick={() => setView('create')}>
              Create Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {agents.map(a => (
              <div 
                key={a.id} 
                className="bg-white border border-black/5 p-8 rounded-3xl shadow-xl shadow-black/5 hover:border-[#00DFB8]/30 transition-all group cursor-pointer relative overflow-hidden" 
                onClick={() => openAgent(a)}
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="w-14 h-14 bg-[#FAFAFA] border border-black/5 rounded-2xl flex items-center justify-center text-3xl group-hover:bg-[#00DFB8] group-hover:text-[#1A1A1A] transition-all transform group-hover:rotate-6">
                    {a.icon || <Bot size={28} />}
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    a.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${a.is_active ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
                    {a.is_active ? 'Online' : 'Paused'}
                  </div>
                </div>
                <h3 className="text-xl font-black text-[#1A1A1A] group-hover:text-[#00DFB8] transition-colors mb-2">{a.name}</h3>
                <p className="text-[10px] font-bold text-[#888] uppercase tracking-[0.15em] mb-8 leading-relaxed">
                   {a.description || 'General support and information handling assistant'}
                </p>
                <div className="flex gap-8 border-t border-black/5 pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center text-[#1A1A1A]">
                       <FileText size={14} />
                    </div>
                    <div>
                       <div className="text-sm font-black text-[#1A1A1A] leading-tight">{a.document_count ?? 0}</div>
                       <div className="text-[8px] font-bold text-[#888] uppercase tracking-widest">Docs</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center text-[#1A1A1A]">
                       <MessageSquare size={14} />
                    </div>
                    <div>
                       <div className="text-sm font-black text-[#1A1A1A] leading-tight">{a.conversation_count ?? 0}</div>
                       <div className="text-[8px] font-bold text-[#888] uppercase tracking-widest">Chats</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* ADD PLACEHOLDER */}
            <div 
              className="border-4 border-dashed border-black/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 hover:border-[#00DFB8]/20 transition-all cursor-pointer group bg-black/[0.01]"
              onClick={() => setView('create')}
            >
               <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-gray-300 group-hover:text-[#00DFB8] transition-all shadow-sm">
                  <Plus size={32} />
               </div>
               <div className="space-y-1">
                  <div className="text-sm font-black text-[#1A1A1A] uppercase tracking-widest">Hire New Agent</div>
                  <div className="text-[10px] font-bold text-[#888] uppercase tracking-widest">Scale your capacity</div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ── CREATE VIEW ────────────────────────────────────────────────
  if (view === 'create') return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-4xl w-full mx-auto p-10 space-y-10 pb-32">
        <div className="flex items-center gap-6">
           <button 
             className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center text-[#1A1A1A] hover:border-black transition-all shadow-sm"
             onClick={() => setView('list')}
           >
             <ChevronLeft size={20} />
           </button>
           <div>
              <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight">Create Agent</h1>
              <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest">Deployment Pipeline</p>
           </div>
        </div>

        <form onSubmit={createAgent} className="bg-white border border-black/5 p-10 rounded-3xl shadow-2xl shadow-black/5 space-y-10">
           <div className="space-y-3">
              <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Agent Identity</label>
              <input 
                className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all" 
                placeholder="e.g. Support Specialist" 
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                required 
              />
           </div>

           <div className="space-y-3">
              <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Core Instructions (System Prompt)</label>
              <textarea 
                className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all h-40 resize-none" 
                placeholder="Describe exactly how this agent should behave..." 
                value={form.system_prompt}
                onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))} 
              />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Communication Tone</label>
                 <select 
                   className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold outline-none cursor-pointer focus:border-[#00DFB8] transition-all" 
                   value={form.persona_tone} 
                   onChange={e => setForm(f => ({ ...f, persona_tone: e.target.value }))}
                 >
                   {['professional','friendly','casual','formal'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                 </select>
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Brand Identity (Primary Color)</label>
                 <div className="flex gap-4">
                    <input 
                      type="color" 
                      value={form.color} 
                      onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                      className="w-16 h-14 bg-white border border-black/5 rounded-2xl p-1.5 cursor-pointer shadow-sm" 
                    />
                    <input 
                      className="flex-1 bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold font-mono outline-none" 
                      value={form.color} 
                      onChange={e => setForm(f => ({ ...f, color: e.target.value }))} 
                    />
                 </div>
              </div>
           </div>

           <div className="space-y-3">
              <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Activation Greeting</label>
              <input 
                className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all" 
                value={form.welcome} 
                onChange={e => setForm(f => ({ ...f, welcome: e.target.value }))} 
              />
           </div>

           <button className="w-full py-5 bg-[#1A1A1A] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl" type="submit" disabled={loading}>
              {loading ? 'Initializing Core...' : 'Launch Agent'}
           </button>
        </form>
      </div>
    </div>
  )

  // ── DETAIL VIEW ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-6xl w-full mx-auto p-10 space-y-10 pb-32">
        
        {/* DETAIL HEADER */}
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-6">
              <button 
                className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center text-[#1A1A1A] hover:border-black transition-all shadow-sm"
                onClick={() => setView('list')}
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <div className="flex items-center gap-3">
                   <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">{selected?.name}</h1>
                   <div className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                      Live
                   </div>
                </div>
                <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest mt-1">Agent ID: {selected?.id?.slice(0, 16)}...</p>
              </div>
           </div>
           <button 
             className="px-6 py-3 border border-red-100 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm" 
             onClick={() => deleteAgent(selected?.id)}
           >
              Shutdown Agent
           </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 p-1 bg-black/5 rounded-2xl w-fit">
           {[
             { id: 'docs', label: 'Knowledge', icon: FileText },
             { id: 'embed', label: 'Deployment', icon: Code },
             { id: 'config', label: 'Core Config', icon: Settings2 },
           ].map(t => (
             <button 
               key={t.id} 
               onClick={() => { setTab(t.id as any); if (t.id === 'embed') loadEmbed() }}
               className={`flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 tab === t.id ? 'bg-[#1A1A1A] text-white shadow-lg' : 'text-[#888] hover:text-[#1A1A1A]'
               }`}
             >
               <t.icon size={14} />
               {t.label}
             </button>
           ))}
        </div>

        {/* CONTENT AREA */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           {tab === 'docs' && (
             <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="bg-white border border-black/5 p-10 rounded-3xl shadow-xl shadow-black/5 space-y-6">
                      <h3 className="text-sm font-black text-[#1A1A1A] uppercase tracking-widest border-b border-black/5 pb-4">Train AI</h3>
                      <div className="grid grid-cols-2 gap-4">
                         <button 
                           className="flex flex-col items-center gap-3 p-8 bg-[#FAFAFA] border border-black/5 rounded-2xl hover:border-[#00DFB8] transition-all group"
                           onClick={() => fileRef.current?.click()}
                         >
                            <Upload size={24} className="text-[#888] group-hover:text-[#00DFB8]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#1A1A1A]">Upload PDF</span>
                         </button>
                         <button 
                           className="flex flex-col items-center gap-3 p-8 bg-[#FAFAFA] border border-black/5 rounded-2xl hover:border-[#00DFB8] transition-all group"
                           onClick={addUrl}
                         >
                            <Globe size={24} className="text-[#888] group-hover:text-[#00DFB8]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#1A1A1A]">Scrape URL</span>
                         </button>
                         <input ref={fileRef} type="file" accept=".pdf,.txt,.csv,.docx" className="hidden" onChange={uploadFile} />
                      </div>
                   </div>
                   
                   <div className="bg-[#1A1A1A] p-10 rounded-3xl shadow-2xl space-y-6 border border-black">
                      <div className="flex items-center gap-3 text-[#00DFB8]">
                         <Sparkles size={20} />
                         <h3 className="text-sm font-black uppercase tracking-widest">Agent Health</h3>
                      </div>
                      <div className="space-y-4 pt-4">
                         <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-[#888]">Knowledge Coverage</span>
                            <span className="text-white">High (98%)</span>
                         </div>
                         <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-[#00DFB8] w-[98%]" />
                         </div>
                         <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-[#888]">Inference Latency</span>
                            <span className="text-white">1.2s avg</span>
                         </div>
                      </div>
                   </div>
                </div>

                {docs.length === 0 ? (
                  <div className="bg-white border border-black/5 p-20 text-center flex flex-col items-center rounded-3xl shadow-xl shadow-black/5">
                    <div className="w-20 h-20 bg-[#FAFAFA] rounded-2xl flex items-center justify-center text-gray-300 mb-6 border border-black/5">
                      <FileText size={32} />
                    </div>
                    <p className="text-[10px] font-black text-[#888] uppercase tracking-widest max-w-xs leading-relaxed">The knowledge base is empty. Upload files to give your agent intelligence.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-black/5 rounded-3xl shadow-xl shadow-black/5 overflow-hidden">
                    <div className="p-8 border-b border-black/5 flex items-center justify-between">
                       <h3 className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-widest">Active Intelligence Sources</h3>
                       <div className="text-[10px] font-bold text-[#888] uppercase">{docs.length} Items Indexed</div>
                    </div>
                    <div className="divide-y divide-black/5">
                      {docs.map((d) => (
                        <div key={d.id} className="p-8 flex items-center justify-between group hover:bg-[#FAFAFA] transition-all">
                          <div className="flex items-center gap-6">
                            <div className="w-12 h-12 bg-black/5 rounded-xl flex items-center justify-center text-[#1A1A1A]">
                               {d.source_type === 'url' ? <Globe size={20} /> : <FileText size={20} />}
                            </div>
                            <div>
                              <div className="text-sm font-black text-[#1A1A1A]">{d.filename}</div>
                              <div className="flex items-center gap-3 mt-1.5">
                                 <div className="text-[9px] font-bold text-[#888] uppercase tracking-widest flex items-center gap-1">
                                    <Hash size={10} /> {d.chunk_count > 0 ? `${d.chunk_count} logic blocks` : 'Preprocessing...'}
                                 </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              d.status === 'ready' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                            }`}>
                               {d.status}
                            </div>
                            <button 
                              className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors" 
                              onClick={() => deleteDoc(d.id)}
                            >
                               Purge
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
           )}

           {tab === 'embed' && (
             <div className="bg-white border border-black/5 p-10 rounded-3xl shadow-xl shadow-black/5 space-y-10">
                <div className="flex items-center justify-between border-b border-black/5 pb-8">
                   <div>
                      <h3 className="text-xl font-black text-[#1A1A1A]">Web Deployment</h3>
                      <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest mt-1">Activate the floating widget on your site</p>
                   </div>
                   <Code size={24} className="text-[#00DFB8]" />
                </div>
                
                <div className="space-y-4">
                   <p className="text-sm text-[#888] leading-relaxed">
                      Copy and paste this script tag at the bottom of your HTML, just before the closing <code className="text-[#1A1A1A] bg-black/5 px-1.5 py-0.5 rounded font-bold">&lt;/body&gt;</code> tag.
                   </p>
                   <div className="bg-[#1A1A1A] border border-black p-8 rounded-2xl font-mono text-xs text-[#00DFB8] leading-relaxed break-all shadow-inner relative group">
                      {embedCode || 'Retrieving deployment key...'}
                      <button 
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                        onClick={() => { navigator.clipboard.writeText(embedCode); alert('Copied!') }}
                      >
                         <Sparkles size={14} className="text-white" />
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="p-8 bg-[#FAFAFA] border border-black/5 rounded-2xl space-y-4">
                      <h4 className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-widest">Custom Styling</h4>
                      <p className="text-[10px] text-[#888] font-bold leading-relaxed">
                         The widget will inherit the brand color ({selected?.widget_config?.primaryColor || '#00DFB8'}) you defined in core settings.
                      </p>
                   </div>
                   <div className="p-8 bg-[#FAFAFA] border border-black/5 rounded-2xl space-y-4">
                      <h4 className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-widest">API Integration</h4>
                      <p className="text-[10px] text-[#888] font-bold leading-relaxed">
                         Deploying via React? Use our NPM package <code className="text-[#1A1A1A]">@chatbolt/react-widget</code> for deeper state control.
                      </p>
                   </div>
                </div>
             </div>
           )}

           {tab === 'config' && (
             <div className="bg-white border border-black/5 p-10 rounded-3xl shadow-xl shadow-black/5 space-y-10">
                <div className="flex items-center justify-between border-b border-black/5 pb-8">
                   <h3 className="text-xl font-black text-[#1A1A1A]">Core Configuration</h3>
                   <Settings2 size={24} className="text-[#00DFB8]" />
                </div>

                <div className="space-y-8">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">System Prompt Rewrite</label>
                      <textarea 
                        className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all h-48 resize-none shadow-inner" 
                        defaultValue={selected?.system_prompt} 
                      />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">LLM Architecture</label>
                         <select className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold outline-none cursor-pointer focus:border-[#00DFB8] transition-all">
                            <option value="llama-3.1-70b-instruct">Llama 3.1 70B (NVIDIA NIM)</option>
                            <option value="nemotron-70b-instruct">Nemotron 70B (NVIDIA NIM)</option>
                            <option value="qwen/qwen3-235b-a22b:free">Qwen 3 (DeepSeek Engine)</option>
                         </select>
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Temperature (Creativity)</label>
                         <input 
                           className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold outline-none focus:border-[#00DFB8] transition-all" 
                           type="number" 
                           min="0" 
                           max="1" 
                           step="0.1" 
                           defaultValue={selected?.config?.temperature ?? 0.3} 
                         />
                      </div>
                   </div>

                   <button className="flex items-center justify-center gap-3 w-full py-5 bg-[#1A1A1A] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl">
                      <CheckCircle2 size={16} /> Save Production Changes
                   </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  )
}
