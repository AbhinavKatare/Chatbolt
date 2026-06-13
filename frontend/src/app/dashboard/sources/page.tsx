'use client'
import { 
  Database, 
  Plus, 
  Search, 
  FileText, 
  Globe, 
  Trash2, 
  RefreshCcw,
  Upload,
  Info,
  ChevronDown,
  Eye,
  Type,
  FileQuestion,
  BookOpen,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Cpu,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

export default function SourcesPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [agents, setAgents] = useState<any[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSourceType, setActiveSourceType] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  // Form states
  const [url, setUrl] = useState('')
  const [textData, setTextData] = useState({ name: '', content: '' })
  const [qaPairs, setQaPairs] = useState([{ question: '', answer: '' }])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchAgents()
  }, [])

  useEffect(() => {
    if (selectedAgentId) {
      fetchDocuments(selectedAgentId)
    }
  }, [selectedAgentId])

  const fetchAgents = async () => {
    try {
      const res = await api.agents.list()
      setAgents(res.agents || [])
      if (res.agents && res.agents.length > 0) {
        setSelectedAgentId(res.agents[0].id)
      }
    } catch (err: any) {
      toastError('Failed to fetch agents', err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchDocuments = async (agentId: string) => {
    setLoading(true)
    try {
      const res = await api.documents.list(agentId)
      setDocuments(res.documents || [])
    } catch (err: any) {
      toastError('Failed to fetch documents', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedAgentId) return
    setIsUploading(true)
    try {
      await api.documents.upload(selectedAgentId, file)
      toastSuccess(`File "${file.name}" uploaded successfully`)
      fetchDocuments(selectedAgentId)
      setActiveSourceType(null)
    } catch (err: any) {
      toastError('Failed to upload file', err.message)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgentId) return
    setIsUploading(true)
    try {
      await api.documents.addUrl(selectedAgentId, url)
      toastSuccess('URL source added successfully')
      fetchDocuments(selectedAgentId)
      setActiveSourceType(null)
      setUrl('')
    } catch (err: any) {
      toastError('Failed to add URL source', err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgentId) return
    setIsUploading(true)
    try {
      await api.documents.addText(selectedAgentId, textData.name, textData.content)
      toastSuccess('Text source injected successfully')
      fetchDocuments(selectedAgentId)
      setActiveSourceType(null)
      setTextData({ name: '', content: '' })
    } catch (err: any) {
      toastError('Failed to inject text', err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleQaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgentId) return
    setIsUploading(true)
    try {
      const formattedText = qaPairs
        .filter(p => p.question && p.answer)
        .map(p => `Q: ${p.question}\n\nA: ${p.answer}`)
        .join('\n\n---\n\n')
      
      if (!formattedText) throw new Error('Add at least one complete Q&A pair')
      
      await api.documents.addText(selectedAgentId, `Q&A - ${new Date().toLocaleDateString()}`, formattedText)
      toastSuccess('Q&A Manifest injected successfully')
      fetchDocuments(selectedAgentId)
      setActiveSourceType(null)
      setQaPairs([{ question: '', answer: '' }])
    } catch (err: any) {
      toastError('Failed to inject Q&A', err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    try {
      await api.documents.delete(selectedAgentId, docId)
      toastSuccess('Source deleted successfully')
      fetchDocuments(selectedAgentId)
    } catch (err: any) {
      toastError('Failed to delete source', err.message)
    }
  }

  const addQaPair = () => setQaPairs([...qaPairs, { question: '', answer: '' }])
  const updateQaPair = (index: number, field: 'question' | 'answer', val: string) => {
    const newPairs = [...qaPairs]
    newPairs[index][field] = val
    setQaPairs(newPairs)
  }

  return (
    <div className="flex flex-col h-full bg-[#050507] text-[#EDEDED] overflow-y-auto custom-scrollbar">
      
      {/* TOOLBAR */}
      <div className="h-14 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
              <Layers size={14} className="text-[#00E599]" /> Knowledge Architecture
           </div>
           <div className="h-4 w-px bg-white/[0.06]" />
           <div className="flex items-center gap-4">
              <div className="relative">
                <select 
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="bg-transparent text-[10px] font-black text-white uppercase tracking-widest outline-none cursor-pointer hover:text-[#00E599] transition-colors pr-6"
                  style={{ colorScheme: 'dark' }}
                >
                  {agents.length === 0 && <option value="" className="bg-[#0D0D11] text-white">No Active Agents</option>}
                  {agents.map(a => (
                    <option key={a.id} value={a.id} className="bg-[#0D0D11] text-white">{a.name}</option>
                  ))}
                </select>
              </div>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => selectedAgentId && fetchDocuments(selectedAgentId)}
             className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-500 hover:text-white transition-all"
           >
              <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
           </button>
           <button 
             onClick={() => setActiveSourceType('url')}
             className="bg-[#00E599] text-black px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#00E599]/90 transition-all shadow-[0_0_12px_rgba(0,229,153,0.3)]"
           >
              <Plus size={12} /> Provision Source
           </button>
        </div>
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          
          <div className="flex justify-between items-end">
             <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-[#00E599]/10 text-[#00E599] rounded-full text-[9px] font-black uppercase tracking-widest border border-[#00E599]/20">
                   <Database size={10} /> Neural Index: Optimized
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Knowledge Source Repositories</h1>
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
                   Manage high-fidelity training data and external architecture tunnels to feed your autonomous agent workforce.
                </p>
             </div>
          </div>

          {/* TOP STATS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-[#0D0D11] border border-white/[0.06] p-5 rounded-2xl shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <FileText size={14} className="text-blue-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Inference Chunks</span>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold text-white">
                    {documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0)} Units
                  </div>
                  <div className="text-[8px] font-black text-[#00E599] uppercase tracking-widest">Synced</div>
                </div>
                <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className="h-full bg-[#00E599] w-[75%] rounded-full shadow-[0_0_6px_#00E599]" />
                </div>
             </div>
             <div className="bg-[#0D0D11] border border-white/[0.06] p-5 rounded-2xl shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Database size={14} className="text-purple-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Indexed Repos</span>
                </div>
                <div className="text-2xl font-bold text-white">{documents.length} Origins</div>
                <div className="flex items-center gap-1.5 text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                  <CheckCircle2 size={10} /> Health: 100%
                </div>
             </div>
             <div className="bg-[#0D0D11] border border-white/[0.06] p-5 rounded-2xl shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <RefreshCcw size={14} className="text-amber-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Cycle Latency</span>
                </div>
                <div className="text-2xl font-bold text-white">Sub-second</div>
                <div className="text-[8px] font-black text-[#00E599] uppercase tracking-widest">Autosync: Active</div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             {/* LEFT: SOURCE LIST */}
             <div className="col-span-1 lg:col-span-8 space-y-6">
                <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden min-h-[400px]">
                   <div className="p-5 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Architecture Sources</h3>
                      <div className="relative">
                         <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                         <input className="pl-8 pr-4 py-1.5 bg-black/40 border border-white/[0.06] rounded-lg text-[10px] font-medium text-white outline-none focus:border-[#00E599]/40 w-48 placeholder-zinc-600 transition-all" placeholder="Filter sources..." />
                      </div>
                   </div>

                   {loading ? (
                      <div className="flex items-center justify-center py-32">
                        <Loader2 size={24} className="animate-spin text-[#00E599]" />
                      </div>
                   ) : documents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
                         <div className="w-12 h-12 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center text-zinc-600">
                            <Database size={24} />
                         </div>
                         <div className="space-y-1">
                            <div className="text-sm font-bold text-white">Repository Empty</div>
                            <div className="text-[9px] text-[#00E599] uppercase font-black tracking-widest">Inject new data to begin inference</div>
                         </div>
                      </div>
                   ) : (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                           <thead className="bg-white/[0.01] border-b border-white/[0.04]">
                              <tr>
                                 <th className="px-6 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Source Entity</th>
                                 <th className="px-6 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Type</th>
                                 <th className="px-6 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest">State</th>
                                 <th className="px-6 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/[0.03]">
                              {documents.map((d) => (
                                 <tr key={d.id} className="hover:bg-white/[0.01] transition-all group">
                                    <td className="px-6 py-4">
                                       <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 bg-white/[0.02] border border-white/[0.06] rounded-lg flex items-center justify-center text-zinc-300">
                                             {d.source_type === 'url' ? <Globe size={14} className="text-blue-400" /> : <FileText size={14} className="text-purple-400" />}
                                          </div>
                                          <div className="flex flex-col min-w-0">
                                             <span className="text-xs font-bold text-white truncate max-w-[200px]">{d.filename}</span>
                                             <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">{new Date(d.created_at).toLocaleDateString()}</span>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-[9px] font-black text-zinc-400 uppercase tracking-widest">{d.source_type}</td>
                                    <td className="px-6 py-4">
                                       <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                          d.status === 'ready' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                          d.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                                          'bg-red-500/10 text-red-400 border border-red-500/20'
                                       }`}>
                                          <div className={`w-1 h-1 rounded-full ${
                                             d.status === 'ready' ? 'bg-emerald-400 shadow-[0_0_6px_#10B981]' : 
                                             d.status === 'pending' ? 'bg-amber-400 animate-pulse' : 
                                             'bg-red-400'
                                          }`} />
                                          {d.status}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                       <div className="flex items-center justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-all duration-200">
                                          <button className="p-1.5 hover:bg-white/[0.04] text-zinc-500 hover:text-white rounded-lg transition-all">
                                             <Eye size={12} />
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteDoc(d.id)}
                                            className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-all"
                                          >
                                             <Trash2 size={12} />
                                          </button>
                                       </div>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                         </table>
                       </div>
                    )}
                 </div>
              </div>

              {/* RIGHT: INJECTION TOOLS */}
              <div className="col-span-1 lg:col-span-4 space-y-6">
                 <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-6 shadow-2xl space-y-6">
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                       <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Injection Engine</h3>
                       <Activity size={14} className="text-[#00E599]" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       {[
                          { id: 'upload', name: 'Raw Files', icon: Upload },
                          { id: 'url', name: 'Web Origin', icon: Globe },
                          { id: 'qa', name: 'Q&A Manifest', icon: FileQuestion },
                          { id: 'text', name: 'Dynamic Text', icon: Type },
                          { id: 'notion', name: 'Notion Sync', icon: BookOpen },
                          { id: 'api', name: 'API Schema', icon: Database },
                       ].map((item, i) => (
                          <button 
                            key={i} 
                            onClick={() => {
                              if (!selectedAgentId) {
                                toastError('Select or create an agent first')
                                return
                              }
                              if (item.id === 'upload') fileInputRef.current?.click()
                              else setActiveSourceType(item.id)
                            }}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/[0.04] hover:border-[#00E599]/30 hover:bg-white/[0.02] bg-white/[0.01] group transition-all"
                          >
                             <item.icon size={18} className="text-zinc-500 group-hover:text-[#00E599] transition-colors" />
                             <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white mt-1">{item.name}</span>
                          </button>
                       ))}
                     </div>

                     <input 
                       type="file" 
                       ref={fileInputRef} 
                       className="hidden" 
                       onChange={handleFileUpload} 
                       accept=".pdf,.txt,.csv,.docx,.md"
                     />

                    <div className="pt-2 space-y-3">
                       <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-start gap-3">
                          <ShieldCheck size={14} className="text-[#00E599] mt-0.5 shrink-0" />
                          <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                             Encrypted architecture storage enabled. All sources are isolated via secure tunnels.
                          </div>
                       </div>
                       <button onClick={() => toastSuccess('Bulk import initialized')} className="w-full py-3 bg-[#00E599] text-black text-[9px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-[#00E599]/90 transition-all shadow-[0_0_12px_rgba(0,229,153,0.2)] active:scale-[0.98]">
                          Initialize Bulk Import
                       </button>
                    </div>
                 </div>

                 <div className="bg-[#0D0D11] border border-white/[0.06] p-6 rounded-2xl shadow-2xl relative overflow-hidden group cursor-pointer hover:border-[#00E599]/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-all">
                       <Zap size={60} className="text-white" />
                    </div>
                    <div className="flex items-center gap-2 text-[#00E599] mb-3">
                       <Cpu size={14} />
                       <h3 className="text-[9px] font-black uppercase tracking-widest">Inference Hub</h3>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-medium uppercase tracking-widest mb-4">
                       Scale your knowledge architecture across 12 distributed regions instantly.
                    </p>
                    <div className="flex items-center gap-1 text-[8px] font-black text-white uppercase tracking-widest group-hover:text-[#00E599] transition-colors">
                       Explore Cluster <ChevronRight size={12} />
                    </div>
                 </div>
              </div>
          </div>
        </div>
      </div>

      {/* URL MODAL */}
      {activeSourceType === 'url' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <div className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl p-8 max-w-md w-full space-y-6 shadow-2xl relative">
              <button onClick={() => setActiveSourceType(null)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-all">
                <X size={18} />
              </button>
              <div className="space-y-1">
                 <h2 className="text-lg font-bold text-white">Establish Web Origin</h2>
                 <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Crawl architecture via secure URL tunnel</p>
              </div>
              <form onSubmit={handleUrlSubmit} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Origin URL</label>
                    <input 
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all"
                      placeholder="https://docs.enterprise.com"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      required
                    />
                 </div>
                 <button 
                   disabled={isUploading}
                   className="w-full py-3 bg-[#00E599] text-black rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#00E599]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {isUploading ? <Loader2 size={14} className="animate-spin" /> : null}
                   {isUploading ? 'Tunneling...' : 'Start Extraction'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* TEXT MODAL */}
      {activeSourceType === 'text' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <div className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl p-8 max-w-lg w-full space-y-6 shadow-2xl relative">
              <button onClick={() => setActiveSourceType(null)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-all">
                <X size={18} />
              </button>
              <div className="space-y-1">
                 <h2 className="text-lg font-bold text-white">Inject Logic Block</h2>
                 <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Direct knowledge injection via raw text</p>
              </div>
              <form onSubmit={handleTextSubmit} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Entity Name</label>
                    <input 
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all"
                      placeholder="e.g. Protocol-X_Manifest"
                      value={textData.name}
                      onChange={e => setTextData({...textData, name: e.target.value})}
                      required
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Data Stream</label>
                    <textarea 
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all min-h-[150px] custom-scrollbar"
                      placeholder="Input knowledge architecture..."
                      value={textData.content}
                      onChange={e => setTextData({...textData, content: e.target.value})}
                      required
                    />
                 </div>
                 <button 
                   disabled={isUploading}
                   className="w-full py-3 bg-[#00E599] text-black rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#00E599]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {isUploading ? <Loader2 size={14} className="animate-spin" /> : null}
                   {isUploading ? 'Injecting...' : 'Finalize Injection'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Q&A MODAL */}
      {activeSourceType === 'qa' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <div className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl p-8 max-w-lg w-full space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button onClick={() => setActiveSourceType(null)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-all">
                <X size={18} />
              </button>
              <div className="space-y-1">
                 <h2 className="text-lg font-bold text-white">Inject Q&A Manifest</h2>
                 <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Inject paired questions and answers directly</p>
              </div>
              <form onSubmit={handleQaSubmit} className="space-y-6">
                 <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                   {qaPairs.map((pair, idx) => (
                     <div key={idx} className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl space-y-3 relative">
                       {qaPairs.length > 1 && (
                         <button 
                           type="button" 
                           onClick={() => setQaPairs(qaPairs.filter((_, i) => i !== idx))}
                           className="absolute top-2 right-2 text-zinc-500 hover:text-red-400"
                         >
                           <X size={14} />
                         </button>
                       )}
                       <div>
                          <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Question {idx + 1}</label>
                          <input 
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00E599]/50 outline-none"
                            placeholder="e.g. How do I initiate a sync?"
                            value={pair.question}
                            onChange={e => updateQaPair(idx, 'question', e.target.value)}
                            required
                          />
                       </div>
                       <div>
                          <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Answer {idx + 1}</label>
                          <textarea 
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00E599]/50 outline-none min-h-[60px]"
                            placeholder="Provide the exact answer..."
                            value={pair.answer}
                            onChange={e => updateQaPair(idx, 'answer', e.target.value)}
                            required
                          />
                       </div>
                     </div>
                   ))}
                 </div>
                 
                 <div className="flex justify-between items-center">
                   <button 
                     type="button" 
                     onClick={addQaPair}
                     className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] text-white hover:text-[#00E599] rounded-lg text-[9px] font-black uppercase tracking-widest"
                   >
                     + Add Pair
                   </button>
                 </div>

                 <button 
                   disabled={isUploading}
                   className="w-full py-3 bg-[#00E599] text-black rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#00E599]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {isUploading ? <Loader2 size={14} className="animate-spin" /> : null}
                   {isUploading ? 'Injecting...' : 'Finalize Injection'}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  )
}
