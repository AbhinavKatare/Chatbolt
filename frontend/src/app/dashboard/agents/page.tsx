'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  Bot, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Settings2, 
  FileText, 
  Code, 
  Search, 
  Upload, 
  Globe, 
  CheckCircle2, 
  Sparkles,
  ChevronLeft,
  MessageSquare,
  Hash,
  Zap,
  Filter,
  Activity,
  Cpu
} from 'lucide-react'

type View = 'list' | 'create' | 'detail'

export default function AgentsPage() {
  const { error: toastError, success: toastSuccess } = useToast()
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
      toastSuccess('Agent Created')
    } catch (err: any) { toastError('Error', err.message) }
    finally { setLoading(false) }
  }

  async function deleteAgent(id: string) {
    if (!confirm('Delete this agent?')) return
    try {
      await api.agents.delete(id)
      setAgents(prev => prev.filter(a => a.id !== id))
      toastSuccess('Agent Deleted')
      if (view === 'detail') setView('list')
    } catch (err: any) { toastError('Error', err.message) }
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !selected) return
    try {
      await api.documents.upload(selected.id, f)
      const r = await api.documents.list(selected.id)
      setDocs(r.documents)
      toastSuccess('File Uploaded')
    } catch (err: any) { toastError('Error', err.message) }
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

  const [listTab, setListTab] = useState<'active'|'hiring'>('active')
  const [hiringAgents, setHiringAgents] = useState([
    { id: 'h1', name: 'Growth Strategist', status: 'provisioning', progress: 65, icon: <Sparkles size={24} /> },
    { id: 'h2', name: 'Content Optimizer', status: 'interviewing', progress: 30, icon: <FileText size={24} /> }
  ])

  // ── LIST VIEW ──────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <Bot size={14} className="text-[#00DFB8]" /> Agent Workforce
           </div>
           <div className="h-4 w-px bg-black/[0.05]" />
           <div className="flex items-center gap-4">
              <button 
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${listTab === 'active' ? 'text-black border-b border-black' : 'text-gray-400 hover:text-black'}`}
                onClick={() => setListTab('active')}
              >
                Active Personnel
              </button>
              <button 
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${listTab === 'hiring' ? 'text-black border-b border-black' : 'text-gray-400 hover:text-black'}`}
                onClick={() => setListTab('hiring')}
              >
                Hiring Pipeline
              </button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input className="bg-gray-50 border border-black/[0.05] rounded-lg pl-8 pr-4 py-1.5 text-[10px] font-medium outline-none focus:border-[#00DFB8] w-48" placeholder="Search agents..." />
           </div>
           <button 
             className="bg-[#1A1A1A] text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-sm active:scale-[0.98]"
             onClick={() => setView('create')}
           >
              <Plus size={12} /> New Agent Core
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-8 py-10 space-y-10">
          
          <div className="flex justify-between items-end">
             <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-bold uppercase tracking-widest">
                   <Activity size={10} /> {listTab === 'active' ? 'Operational Status: Optimal' : 'Recruitment Phase: Active'}
                </div>
                <h1 className="text-3xl font-semibold text-[#1A1A1A] tracking-tight">
                  {listTab === 'active' ? 'AI Agent Workforce' : 'Personnel Procurement'}
                </h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest max-w-xl leading-relaxed">
                   {listTab === 'active' 
                     ? 'Manage and train your autonomous personnel. Each core represents a specialized intelligence unit.' 
                     : 'Monitor the synthesis and provisioning of new specialized agent cores for your workforce.'}
                </p>
             </div>
             <div className="flex items-center gap-4 text-[10px] font-black text-gray-300 uppercase tracking-widest">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#00DFB8]" /> {listTab === 'active' ? agents.length : hiringAgents.length} Units {listTab === 'active' ? 'Active' : 'In Progress'}</div>
                <div className="flex items-center gap-2"><Cpu size={12} /> {listTab === 'active' ? '1.2s' : '48h'} Avg {listTab === 'active' ? 'Latency' : 'ETA'}</div>
             </div>
          </div>

          {listTab === 'active' ? (
            agents.length === 0 ? (
              <div className="bg-white border border-black/[0.03] p-20 text-center flex flex-col items-center rounded-3xl shadow-sm">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-200 mb-6 border border-black/[0.03]">
                  <Bot size={32} />
                </div>
                <h3 className="text-sm font-bold text-[#1A1A1A] mb-2">No active agents detected</h3>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest max-w-xs mb-8">Deploy your first specialized agent core to start automating workflows.</p>
                <button 
                  className="bg-[#1A1A1A] text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-lg active:scale-[0.98]"
                  onClick={() => setView('create')}
                >
                  Initialize Core
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map(a => (
                  <div 
                    key={a.id} 
                    className="bg-white border border-black/[0.03] p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-[#00DFB8]/30 transition-all group cursor-pointer relative overflow-hidden" 
                    onClick={() => openAgent(a)}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-12 h-12 bg-gray-50 border border-black/[0.03] rounded-xl flex items-center justify-center text-xl group-hover:bg-[#00DFB8] group-hover:text-[#1A1A1A] transition-all">
                        {a.icon || <Bot size={24} />}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        a.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <div className={`w-1 h-1 rounded-full ${a.is_active ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
                        {a.is_active ? 'Ready' : 'Standby'}
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-[#1A1A1A] group-hover:text-[#00DFB8] transition-colors mb-1 tracking-tight">{a.name}</h3>
                    <p className="text-[9px] font-medium text-gray-400 uppercase tracking-widest mb-6 leading-relaxed line-clamp-2 min-h-[24px]">
                       {a.description || 'General support and information handling assistant'}
                    </p>
                    <div className="flex gap-6 border-t border-black/[0.03] pt-4">
                      <div className="flex items-center gap-2">
                         <FileText size={14} className="text-gray-300" />
                         <div className="text-[10px] font-black text-[#1A1A1A]">{a.document_count ?? 0} <span className="text-gray-300 ml-0.5">Docs</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                         <MessageSquare size={14} className="text-gray-300" />
                         <div className="text-[10px] font-black text-[#1A1A1A]">{a.conversation_count ?? 0} <span className="text-gray-300 ml-0.5">Chats</span></div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <button 
                  className="border-2 border-dashed border-black/[0.03] rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 hover:border-[#00DFB8]/30 transition-all group bg-black/[0.01]"
                  onClick={() => setView('create')}
                >
                   <div className="w-10 h-10 rounded-full border border-black/[0.03] flex items-center justify-center text-gray-300 group-hover:text-[#00DFB8] group-hover:scale-110 transition-all bg-white">
                      <Plus size={20} />
                   </div>
                   <div className="space-y-1">
                      <div className="text-[9px] font-black text-[#1A1A1A] uppercase tracking-[0.2em]">Hire Personnel</div>
                      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Provision Unit</div>
                   </div>
                </button>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
              {hiringAgents.map(a => (
                <div key={a.id} className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-6 relative overflow-hidden">
                   <div className="flex items-center justify-between">
                      <div className="w-12 h-12 bg-black text-[#00DFB8] rounded-xl flex items-center justify-center shadow-lg">
                         {a.icon}
                      </div>
                      <div className="text-[8px] font-black uppercase tracking-widest bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full">
                         {a.status}
                      </div>
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-sm font-bold text-[#1A1A1A] tracking-tight">{a.name}</h3>
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Synthesis in progress</p>
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
                         <span>Logic Training</span>
                         <span className="text-[#1A1A1A]">{a.progress}%</span>
                      </div>
                      <div className="h-1 bg-gray-50 rounded-full overflow-hidden">
                         <div className="h-full bg-[#00DFB8] transition-all" style={{ width: `${a.progress}%` }} />
                      </div>
                   </div>
                   <div className="pt-2">
                      <button className="w-full py-2 bg-gray-50 border border-black/[0.03] text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-black hover:bg-gray-100 transition-all rounded-lg">
                        Cancel Provisioning
                      </button>
                   </div>
                </div>
              ))}
              <button 
                className="border-2 border-dashed border-black/[0.03] rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 hover:border-[#00DFB8]/30 transition-all group bg-black/[0.01]"
                onClick={() => setView('create')}
              >
                 <div className="w-10 h-10 rounded-full border border-black/[0.03] flex items-center justify-center text-gray-300 group-hover:text-[#00DFB8] group-hover:scale-110 transition-all bg-white">
                    <Plus size={20} />
                 </div>
                 <div className="space-y-1">
                    <div className="text-[9px] font-black text-[#1A1A1A] uppercase tracking-[0.2em]">New Core Hire</div>
                    <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Provision Unit</div>
                 </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── CREATE VIEW ────────────────────────────────────────────────
  if (view === 'create') return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30">
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center gap-6 px-8 shrink-0">
         <button 
           className="text-gray-400 hover:text-black transition-all"
           onClick={() => setView('list')}
         >
           <ChevronLeft size={20} />
         </button>
         <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Deployment Pipeline / New Agent</div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">
           <div className="space-y-2 text-center pb-4">
              <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">Initialize Agent Core</h1>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Define the foundational logic for your autonomous unit</p>
           </div>

           <form onSubmit={createAgent} className="space-y-6">
              <div className="bg-white border border-black/[0.03] rounded-2xl p-8 shadow-sm space-y-8">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Operational Designation</label>
                    <input 
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-3 text-xs font-bold focus:border-[#00DFB8] outline-none transition-all" 
                      placeholder="e.g. Technical Liaison" 
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                      required 
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Core Instructions (System Manifest)</label>
                    <textarea 
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-3 text-xs font-medium focus:border-[#00DFB8] outline-none transition-all h-32 resize-none leading-relaxed" 
                      placeholder="Define behavioral constraints and logic parameters..." 
                      value={form.system_prompt}
                      onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))} 
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Persona Modulation</label>
                       <select 
                         className="w-full bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-3 text-xs font-bold outline-none cursor-pointer focus:border-[#00DFB8] transition-all" 
                         value={form.persona_tone} 
                         onChange={e => setForm(f => ({ ...f, persona_tone: e.target.value }))}
                       >
                         {['professional','friendly','casual','formal'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Visual Signature</label>
                       <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={form.color} 
                            onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                            className="w-12 h-10 bg-white border border-black/[0.05] rounded-lg p-1 cursor-pointer shadow-sm" 
                          />
                          <input 
                            className="flex-1 bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest outline-none" 
                            value={form.color} 
                            onChange={e => setForm(f => ({ ...f, color: e.target.value }))} 
                          />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Activation Protocol (Greeting)</label>
                    <input 
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-3 text-xs font-medium focus:border-[#00DFB8] outline-none transition-all" 
                      value={form.welcome} 
                      onChange={e => setForm(f => ({ ...f, welcome: e.target.value }))} 
                    />
                 </div>
              </div>

              <button 
                className="w-full py-5 bg-[#1A1A1A] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] hover:bg-black transition-all shadow-xl active:scale-[0.99] disabled:opacity-50" 
                type="submit" 
                disabled={loading}
              >
                 {loading ? 'Initializing...' : 'Launch Agent Core'}
              </button>
           </form>
        </div>
      </div>
    </div>
  )

  // ── DETAIL VIEW ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30">
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center justify-between px-8 shrink-0">
         <div className="flex items-center gap-6">
            <button 
              className="text-gray-400 hover:text-black transition-all"
              onClick={() => setView('list')}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
               <h2 className="text-xs font-bold text-[#1A1A1A] tracking-tight">{selected?.name}</h2>
               <div className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-green-600 animate-pulse" />
                  Optimal
               </div>
            </div>
         </div>
         <div className="flex items-center gap-4">
            <div className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Core ID: {selected?.id?.slice(0, 12)}</div>
            <button 
              onClick={() => {
                toastSuccess('Workflow Initialized', 'Ideal agent pipeline has been primed.')
                // Ideally this redirects to workflows page with pre-filled prompt or opens a quick-run modal
                window.location.href = '/dashboard/workflows'
              }}
              className="px-4 py-1.5 bg-[#00DFB8]/10 text-[#00DFB8] border border-[#00DFB8]/20 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#00DFB8]/20 transition-all flex items-center gap-2"
            >
               <Zap size={12} fill="currentColor" /> Launch Ideal Workflow
            </button>
            <button 
              className="px-4 py-1.5 border border-red-100 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all" 
              onClick={() => deleteAgent(selected?.id)}
            >
               Terminate Unit
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
          
          <div className="flex gap-1.5 p-1 bg-black/[0.02] rounded-xl w-fit border border-black/[0.03]">
             {[
               { id: 'docs', label: 'Intelligence', icon: FileText },
               { id: 'embed', label: 'Deployment', icon: Code },
               { id: 'config', label: 'Core Config', icon: Settings2 },
             ].map(t => (
               <button 
                 key={t.id} 
                 onClick={() => { setTab(t.id as any); if (t.id === 'embed') loadEmbed() }}
                 className={`flex items-center gap-2 px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                   tab === t.id ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-black'
                 }`}
               >
                 <t.icon size={12} className={tab === t.id ? 'text-[#00DFB8]' : ''} />
                 {t.label}
               </button>
             ))}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             {tab === 'docs' && (
               <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                     <div className="md:col-span-8 space-y-6">
                        <div className="bg-white border border-black/[0.03] rounded-2xl shadow-sm overflow-hidden">
                           <div className="p-6 border-b border-black/[0.03] flex items-center justify-between bg-black/[0.01]">
                              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Knowledge Ingestion</h3>
                              <div className="text-[9px] font-bold text-[#00DFB8] uppercase tracking-widest">{docs.length} Sources Indexed</div>
                           </div>
                           
                           {docs.length === 0 ? (
                             <div className="p-16 text-center flex flex-col items-center">
                                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-200 mb-4 border border-black/[0.03]">
                                   <FileText size={24} />
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-xs">Zero intelligence detected. Ingest sources to train the unit.</p>
                             </div>
                           ) : (
                             <div className="divide-y divide-black/[0.03]">
                               {docs.map((d) => (
                                 <div key={d.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-all">
                                   <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-[#1A1A1A]">
                                        {d.source_type === 'url' ? <Globe size={16} /> : <FileText size={16} />}
                                     </div>
                                     <div>
                                       <div className="text-xs font-bold text-[#1A1A1A]">{d.filename}</div>
                                       <div className="text-[9px] font-medium text-gray-400 uppercase tracking-widest mt-1">Status: {d.status}</div>
                                     </div>
                                   </div>
                                   <button 
                                     className="p-2 text-gray-300 hover:text-red-500 transition-colors" 
                                     onClick={() => deleteDoc(d.id)}
                                   >
                                      <Trash2 size={14} />
                                   </button>
                                 </div>
                               ))}
                             </div>
                           )}
                        </div>
                     </div>
                     
                     <div className="md:col-span-4 space-y-6">
                        <div className="bg-[#1A1A1A] p-8 rounded-2xl shadow-xl space-y-6 border border-black relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                              <Sparkles size={80} className="text-white" />
                           </div>
                           <div className="flex items-center gap-2 text-[#00DFB8]">
                              <Zap size={16} fill="currentColor" />
                              <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Unit Diagnostics</h3>
                           </div>
                           <div className="space-y-4 pt-2">
                              <div className="space-y-2">
                                 <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                    <span>Logic Accuracy</span>
                                    <span className="text-white">98.2%</span>
                                 </div>
                                 <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#00DFB8] w-[98%] shadow-[0_0_8px_rgba(0,223,184,0.5)]" />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                    <span>Knowledge Recall</span>
                                    <span className="text-white">High</span>
                                 </div>
                                 <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#00DFB8] w-[92%]" />
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="bg-white border border-black/[0.03] p-6 rounded-2xl shadow-sm space-y-4">
                           <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">New Intelligence Source</h4>
                           <div className="grid grid-cols-2 gap-3">
                              <button 
                                onClick={() => fileRef.current?.click()}
                                className="flex flex-col items-center gap-2 p-4 bg-gray-50 border border-black/[0.03] rounded-xl hover:border-[#00DFB8]/30 transition-all group"
                              >
                                 <Upload size={16} className="text-gray-300 group-hover:text-[#00DFB8]" />
                                 <span className="text-[8px] font-black uppercase tracking-widest text-[#1A1A1A]">PDF/DOC</span>
                              </button>
                              <button 
                                onClick={addUrl}
                                className="flex flex-col items-center gap-2 p-4 bg-gray-50 border border-black/[0.03] rounded-xl hover:border-[#00DFB8]/30 transition-all group"
                              >
                                 <Globe size={16} className="text-gray-300 group-hover:text-[#00DFB8]" />
                                 <span className="text-[8px] font-black uppercase tracking-widest text-[#1A1A1A]">URL</span>
                              </button>
                              <input ref={fileRef} type="file" accept=".pdf,.txt,.csv,.docx" className="hidden" onChange={uploadFile} />
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
             )}

             {tab === 'embed' && (
               <div className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-8">
                  <div className="flex items-center justify-between">
                     <div className="space-y-1">
                        <h3 className="text-sm font-bold text-[#1A1A1A]">Deployment Manifest</h3>
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Production-ready integration script</p>
                     </div>
                     <Code size={20} className="text-[#00DFB8]" />
                  </div>
                  
                  <div className="space-y-4">
                     <div className="bg-[#1A1A1A] border border-black p-6 rounded-xl font-mono text-[11px] text-[#00DFB8] leading-relaxed break-all shadow-inner relative group">
                        {embedCode || 'Retrieving deployment key...'}
                        <button 
                          className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                          onClick={() => { navigator.clipboard.writeText(embedCode); toastSuccess('Copied to clipboard') }}
                        >
                           <Sparkles size={14} className="text-white" />
                        </button>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                     <div className="p-6 bg-gray-50 rounded-xl space-y-2">
                        <h4 className="text-[9px] font-black text-[#1A1A1A] uppercase tracking-widest">Brand Sync</h4>
                        <p className="text-[9px] text-gray-400 font-medium leading-relaxed uppercase">
                           Inheriting primary signature: <span className="text-black font-bold">{selected?.widget_config?.primaryColor || '#00DFB8'}</span>
                        </p>
                     </div>
                     <div className="p-6 bg-gray-50 rounded-xl space-y-2">
                        <h4 className="text-[9px] font-black text-[#1A1A1A] uppercase tracking-widest">React Adapter</h4>
                        <p className="text-[9px] text-gray-400 font-medium leading-relaxed uppercase">
                           Use package: <code className="text-black font-bold lowercase">@chatbolt/react</code>
                        </p>
                     </div>
                  </div>
               </div>
             )}

             {tab === 'config' && (
               <div className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-8">
                  <div className="flex items-center justify-between border-b border-black/[0.03] pb-6">
                     <h3 className="text-sm font-bold text-[#1A1A1A]">Core Configuration</h3>
                     <Settings2 size={20} className="text-[#00DFB8]" />
                  </div>

                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">System Manifest Override</label>
                        <textarea 
                          className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-xs font-medium focus:border-black/10 outline-none transition-all h-40 resize-none shadow-inner" 
                          defaultValue={selected?.system_prompt} 
                        />
                     </div>

                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">LLM Engine</label>
                           <select className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-xs font-bold outline-none cursor-pointer focus:border-[#00DFB8] transition-all">
                              <option value="autogen">NVIDIA AutoGen-23</option>
                              <option value="llama-3.1-70b-instruct">Llama 3.1 70B (NIM)</option>
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Entropy Control</label>
                           <input 
                             className="w-full bg-gray-50 border border-black/[0.03] rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-[#00DFB8] transition-all" 
                             type="number" 
                             min="0" 
                             max="1" 
                             step="0.1" 
                             defaultValue={selected?.config?.temperature ?? 0.3} 
                           />
                        </div>
                     </div>

                     <div className="space-y-4 pt-4 border-t border-black/[0.03]">
                        <div className="flex items-center justify-between">
                           <div>
                              <h4 className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest">Unit Status</h4>
                              <p className="text-[9px] text-gray-400 font-medium">Toggle autonomous capabilities on or off</p>
                           </div>
                           <button 
                             onClick={async () => {
                               try {
                                 await api.agents.update(selected?.id, { is_active: !selected?.is_active })
                                 setSelected({ ...selected, is_active: !selected?.is_active })
                                 loadAgents()
                                 toastSuccess(selected?.is_active ? 'Unit Deactivated' : 'Unit Activated')
                               } catch(e:any) { toastError('Error', e.message) }
                             }}
                             className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${selected?.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                           >
                             {selected?.is_active ? 'Deactivate' : 'Activate'}
                           </button>
                        </div>
                     </div>

                     <button className="flex items-center justify-center gap-3 w-full py-4 bg-[#1A1A1A] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-black transition-all shadow-lg active:scale-[0.98]">
                        <CheckCircle2 size={16} /> Update Production Core
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
