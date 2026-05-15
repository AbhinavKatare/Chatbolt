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

export default function SourcesPage() {
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
      setAgents(res.agents)
      if (res.agents.length > 0) {
        setSelectedAgentId(res.agents[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDocuments = async (agentId: string) => {
    setLoading(true)
    try {
      const res = await api.documents.list(agentId)
      setDocuments(res.documents)
    } catch (err) {
      console.error('Failed to fetch documents:', err)
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
      fetchDocuments(selectedAgentId)
      setActiveSourceType(null)
    } catch (err: any) {
      console.error(err)
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
      fetchDocuments(selectedAgentId)
      setActiveSourceType(null)
      setUrl('')
    } catch (err: any) {
      console.error(err)
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
      fetchDocuments(selectedAgentId)
      setActiveSourceType(null)
      setTextData({ name: '', content: '' })
    } catch (err: any) {
      console.error(err)
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
      fetchDocuments(selectedAgentId)
      setActiveSourceType(null)
      setQaPairs([{ question: '', answer: '' }])
    } catch (err: any) {
      console.error(err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    try {
      await api.documents.delete(selectedAgentId, docId)
      fetchDocuments(selectedAgentId)
    } catch (err: any) {
      console.error(err)
    }
  }

  const addQaPair = () => setQaPairs([...qaPairs, { question: '', answer: '' }])
  const updateQaPair = (index: number, field: 'question' | 'answer', val: string) => {
    const newPairs = [...qaPairs]
    newPairs[index][field] = val
    setQaPairs(newPairs)
  }

  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              <Layers size={14} className="text-[#00DFB8]" /> Knowledge Architecture
           </div>
           <div className="h-4 w-px bg-black/[0.05]" />
           <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <select 
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="bg-transparent text-[10px] font-bold text-black uppercase tracking-widest outline-none cursor-pointer hover:text-[#00DFB8] transition-colors"
                >
                  {agents.length === 0 && <option value="">No Active Agents</option>}
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => selectedAgentId && fetchDocuments(selectedAgentId)}
             className="p-1.5 bg-white border border-black/[0.05] rounded-lg text-gray-400 hover:text-black transition-all"
           >
              <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
           </button>
           <button 
             onClick={() => setActiveSourceType('bulk')}
             className="bg-[#1A1A1A] text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-sm"
           >
              <Plus size={12} /> Provision Source
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
          
          <div className="flex justify-between items-end">
             <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-black uppercase tracking-widest">
                   <Database size={10} /> Neural Index: Optimized
                </div>
                <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">Knowledge Source Repositories</h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
                   Manage high-fidelity training data and external architecture tunnels to feed your autonomous agent workforce.
                </p>
             </div>
          </div>

          {/* TOP STATS ROW */}
          <div className="grid grid-cols-3 gap-4">
             <div className="bg-white border border-black/[0.03] p-5 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-400">
                  <FileText size={14} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Inference Chunks</span>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-lg font-bold text-[#1A1A1A]">
                    {documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0)} Units
                  </div>
                  <div className="text-[8px] font-black text-[#00DFB8] uppercase tracking-widest">Synced</div>
                </div>
                <div className="h-1 bg-gray-50 rounded-full overflow-hidden">
                  <div className="h-full bg-[#00DFB8] w-[75%]" />
                </div>
             </div>
             <div className="bg-white border border-black/[0.03] p-5 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-400">
                  <Database size={14} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Indexed Repos</span>
                </div>
                <div className="text-lg font-bold text-[#1A1A1A]">{documents.length} Origins</div>
                <div className="flex items-center gap-1.5 text-[8px] font-black text-green-500 uppercase tracking-widest">
                  <CheckCircle2 size={10} /> Health: 100%
                </div>
             </div>
             <div className="bg-white border border-black/[0.03] p-5 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-400">
                  <RefreshCcw size={14} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Cycle Latency</span>
                </div>
                <div className="text-lg font-bold text-[#1A1A1A]">Sub-second</div>
                <div className="text-[8px] font-black text-[#00DFB8] uppercase tracking-widest">Autosync: Active</div>
             </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
             {/* LEFT: SOURCE LIST */}
             <div className="col-span-8 space-y-6">
                <div className="bg-white border border-black/[0.03] rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
                   <div className="p-5 border-b border-black/[0.03] bg-black/[0.01] flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Architecture Sources</h3>
                      <div className="relative">
                         <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                         <input className="pl-8 pr-4 py-1.5 bg-white border border-black/[0.05] rounded-lg text-[10px] font-medium outline-none w-48" placeholder="Filter sources..." />
                      </div>
                   </div>

                   {loading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 size={24} className="animate-spin text-[#00DFB8]" />
                      </div>
                   ) : documents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                         <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-200">
                            <Database size={24} />
                         </div>
                         <div className="space-y-1">
                            <div className="text-[11px] font-bold text-[#1A1A1A]">Repository Empty</div>
                            <div className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Inject new data to begin inference</div>
                         </div>
                      </div>
                   ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead className="bg-black/[0.01] border-b border-black/[0.03]">
                              <tr>
                                 <th className="px-6 py-3 text-[9px] font-black text-gray-300 uppercase tracking-widest">Source Entity</th>
                                 <th className="px-6 py-3 text-[9px] font-black text-gray-300 uppercase tracking-widest">Type</th>
                                 <th className="px-6 py-3 text-[9px] font-black text-gray-300 uppercase tracking-widest">State</th>
                                 <th className="px-6 py-3 text-[9px] font-black text-gray-300 uppercase tracking-widest text-right">Actions</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-black/[0.03]">
                              {documents.map((d) => (
                                 <tr key={d.id} className="hover:bg-gray-50/50 transition-all group">
                                    <td className="px-6 py-4">
                                       <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 bg-gray-50 border border-black/[0.03] rounded-lg flex items-center justify-center text-[#1A1A1A]">
                                             {d.source_type === 'url' ? <Globe size={14} /> : <FileText size={14} />}
                                          </div>
                                          <div className="flex flex-col">
                                             <span className="text-[11px] font-bold text-[#1A1A1A] truncate max-w-[200px]">{d.filename}</span>
                                             <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">{new Date(d.created_at).toLocaleDateString()}</span>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-[9px] font-black text-[#1A1A1A] uppercase tracking-widest">{d.source_type}</td>
                                    <td className="px-6 py-4">
                                       <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                          d.status === 'ready' ? 'bg-green-50 text-green-600' : 
                                          d.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 
                                          'bg-red-50 text-red-600'
                                       }`}>
                                          <div className={`w-1 h-1 rounded-full ${
                                             d.status === 'ready' ? 'bg-green-600' : 
                                             d.status === 'pending' ? 'bg-yellow-600 animate-pulse' : 
                                             'bg-red-600'
                                          }`} />
                                          {d.status}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                       <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                          <button className="p-1.5 hover:bg-[#00DFB8]/10 hover:text-[#00DFB8] rounded-lg transition-all text-gray-300">
                                             <Eye size={12} />
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteDoc(d.id)}
                                            className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all text-gray-300"
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
             <div className="col-span-4 space-y-6">
                <div className="bg-white border border-black/[0.03] rounded-2xl p-6 shadow-sm space-y-6">
                   <div className="flex items-center justify-between border-b border-black/[0.03] pb-4">
                      <h3 className="text-[10px] font-black text-black uppercase tracking-widest">Injection Engine</h3>
                      <Activity size={14} className="text-[#00DFB8]" />
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
                             if (!selectedAgentId) return
                             if (item.id === 'upload') fileInputRef.current?.click()
                             else setActiveSourceType(item.id)
                           }}
                           className={`flex flex-col items-center gap-2 p-3 rounded-xl border border-black/[0.03] transition-all hover:border-[#00DFB8] bg-white group`}
                         >
                            <item.icon size={18} className="text-gray-300 group-hover:text-[#00DFB8] transition-colors" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 group-hover:text-black">{item.name}</span>
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
                      <div className="p-3 bg-black/[0.01] border border-black/[0.03] rounded-xl flex items-start gap-3">
                         <ShieldCheck size={14} className="text-[#00DFB8] mt-0.5" />
                         <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                            Encrypted architecture storage enabled. All sources are isolated via secure tunnels.
                         </div>
                      </div>
                      <button className="w-full py-3 bg-[#1A1A1A] text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-black transition-all shadow-lg active:scale-[0.98]">
                         Initialize Bulk Import
                      </button>
                   </div>
                </div>

                <div className="bg-[#1A1A1A] p-6 rounded-2xl shadow-xl border border-black relative overflow-hidden group cursor-pointer">
                   <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-all">
                      <Zap size={60} className="text-white" />
                   </div>
                   <div className="flex items-center gap-2 text-[#00DFB8] mb-3">
                      <Cpu size={14} />
                      <h3 className="text-[9px] font-black uppercase tracking-widest">Inference Hub</h3>
                   </div>
                   <p className="text-[10px] text-gray-400 leading-relaxed font-medium uppercase tracking-widest mb-4">
                      Scale your knowledge architecture across 12 distributed regions instantly.
                   </p>
                   <div className="flex items-center gap-1 text-[8px] font-black text-white uppercase tracking-widest">
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
           <div className="bg-white rounded-2xl p-8 max-w-md w-full space-y-6 shadow-2xl relative border border-black/[0.05]">
              <button onClick={() => setActiveSourceType(null)} className="absolute top-4 right-4 text-gray-300 hover:text-black transition-all">
                <X size={18} />
              </button>
              <div className="space-y-1">
                 <h2 className="text-lg font-bold text-[#1A1A1A]">Establish Web Origin</h2>
                 <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Crawl architecture via secure URL tunnel</p>
              </div>
              <form onSubmit={handleUrlSubmit} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Origin URL</label>
                    <input 
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-2.5 text-[11px] font-medium focus:border-[#00DFB8] outline-none transition-all"
                      placeholder="https://docs.enterprise.com"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      required
                    />
                 </div>
                 <button 
                   disabled={isUploading}
                   className="w-full py-3 bg-[#1A1A1A] text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-2"
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
           <div className="bg-white rounded-2xl p-8 max-w-lg w-full space-y-6 shadow-2xl relative border border-black/[0.05]">
              <button onClick={() => setActiveSourceType(null)} className="absolute top-4 right-4 text-gray-300 hover:text-black transition-all">
                <X size={18} />
              </button>
              <div className="space-y-1">
                 <h2 className="text-lg font-bold text-[#1A1A1A]">Inject Logic Block</h2>
                 <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Direct knowledge injection via raw text</p>
              </div>
              <form onSubmit={handleTextSubmit} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Entity Name</label>
                    <input 
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-2.5 text-[11px] font-medium focus:border-[#00DFB8] outline-none transition-all"
                      placeholder="e.g. Protocol-X_Manifest"
                      value={textData.name}
                      onChange={e => setTextData({...textData, name: e.target.value})}
                      required
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Data Stream</label>
                    <textarea 
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-2.5 text-[11px] font-medium focus:border-[#00DFB8] outline-none transition-all min-h-[150px] custom-scrollbar"
                      placeholder="Input knowledge architecture..."
                      value={textData.content}
                      onChange={e => setTextData({...textData, content: e.target.value})}
                      required
                    />
                 </div>
                 <button 
                   disabled={isUploading}
                   className="w-full py-3 bg-[#1A1A1A] text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-2"
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
