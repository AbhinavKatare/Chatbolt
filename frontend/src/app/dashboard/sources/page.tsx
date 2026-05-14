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
  Loader2
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
      alert('File uploaded successfully')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgentId) return alert('Please select an agent first')
    setIsUploading(true)
    try {
      await api.documents.addUrl(selectedAgentId, url)
      fetchDocuments(selectedAgentId)
      setActiveSourceType(null)
      setUrl('')
      alert('URL added successfully')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgentId) return alert('Please select an agent first')
    setIsUploading(true)
    try {
      await api.documents.addText(selectedAgentId, textData.name, textData.content)
      fetchDocuments(selectedAgentId)
      setActiveSourceType(null)
      setTextData({ name: '', content: '' })
      alert('Text source added successfully')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleQaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgentId) return alert('Please select an agent first')
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
      alert('Q&A Pairs added successfully')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this source?')) return
    try {
      await api.documents.delete(selectedAgentId, docId)
      fetchDocuments(selectedAgentId)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const addQaPair = () => setQaPairs([...qaPairs, { question: '', answer: '' }])
  const updateQaPair = (index: number, field: 'question' | 'answer', val: string) => {
    const newPairs = [...qaPairs]
    newPairs[index][field] = val
    setQaPairs(newPairs)
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-6xl w-full mx-auto p-10 space-y-10 pb-32">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
           <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-bold uppercase tracking-widest mb-2">
                <Database size={12} /> Data Management
              </div>
              <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Knowledge Sources</h1>
              <p className="text-[#888] text-sm">Train your AI models by uploading documents and connecting external data sources.</p>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-[#888] uppercase tracking-widest mb-1">Target Agent</span>
                <select 
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="bg-white border border-black/5 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[#00DFB8] shadow-sm cursor-pointer"
                >
                  {agents.length === 0 && <option value="">No Agents Available</option>}
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
           </div>
        </div>

        {/* TOP STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white border border-black/5 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-gray-400">
                <FileText size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Knowledge Base Size</span>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-2xl font-black text-[#1A1A1A]">
                  {documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0)} Chunks
                </div>
                <div className="text-[10px] font-bold text-[#888]">ACTIVE STATUS</div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#00DFB8] w-[75%]" />
              </div>
           </div>
           <div className="bg-white border border-black/5 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Database size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Files Indexed</span>
              </div>
              <div className="text-2xl font-black text-[#1A1A1A]">{documents.length} Sources</div>
              <div className="text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center gap-1">
                <CheckCircle2 size={10} /> Syncing Health: 100%
              </div>
           </div>
           <div className="bg-white border border-black/5 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-gray-400">
                <RefreshCcw size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Last Sync</span>
              </div>
              <div className="text-2xl font-black text-[#1A1A1A]">Just Now</div>
              <div className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-widest">Autosync Enabled</div>
           </div>
        </div>

        {/* UPLOAD & CONTROLS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-black/5 rounded-2xl p-8 shadow-xl shadow-black/5 space-y-6 min-h-[400px]">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-[#1A1A1A] uppercase tracking-widest">Active Sources</h3>
                    <div className="flex items-center gap-3">
                       <button 
                         onClick={() => selectedAgentId && fetchDocuments(selectedAgentId)}
                         className="p-2 bg-[#FAFAFA] border border-black/5 rounded-xl hover:bg-gray-100 transition-all text-gray-500"
                       >
                          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                       </button>
                    </div>
                 </div>

                 {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 size={32} className="animate-spin text-[#00DFB8]" />
                    </div>
                 ) : documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                       <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                          <Database size={32} />
                       </div>
                       <div className="space-y-1">
                          <div className="font-bold text-[#1A1A1A]">No sources found</div>
                          <div className="text-xs text-[#888]">Connect a new source to start training your agent.</div>
                       </div>
                    </div>
                 ) : (
                    <div className="overflow-hidden border border-black/5 rounded-xl">
                      <table className="w-full text-left">
                         <thead className="bg-[#FAFAFA] border-b border-black/5">
                            <tr>
                               <th className="px-6 py-4 text-[10px] font-black text-[#888] uppercase tracking-widest">Source</th>
                               <th className="px-6 py-4 text-[10px] font-black text-[#888] uppercase tracking-widest">Type</th>
                               <th className="px-6 py-4 text-[10px] font-black text-[#888] uppercase tracking-widest">Status</th>
                               <th className="px-6 py-4 text-[10px] font-black text-[#888] uppercase tracking-widest text-right">Actions</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-black/5">
                            {documents.map((d, i) => (
                               <tr key={d.id} className="hover:bg-[#FDFDFB] transition-all group">
                                  <td className="px-6 py-5">
                                     <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-black/5 rounded-lg flex items-center justify-center text-[#1A1A1A]">
                                           {d.source_type === 'url' ? <Globe size={18} /> : <FileText size={18} />}
                                        </div>
                                        <div className="flex flex-col">
                                           <span className="text-sm font-bold text-[#1A1A1A] truncate max-w-[200px]" title={d.filename}>{d.filename}</span>
                                           <span className="text-[10px] font-bold text-[#888] uppercase">Added {new Date(d.created_at).toLocaleDateString()}</span>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-6 py-5 text-xs font-bold text-[#1A1A1A] uppercase">{d.source_type}</td>
                                  <td className="px-6 py-5">
                                     <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                        d.status === 'ready' ? 'bg-green-50 text-green-600' : 
                                        d.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 
                                        'bg-red-50 text-red-600'
                                     }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                           d.status === 'ready' ? 'bg-green-600' : 
                                           d.status === 'pending' ? 'bg-yellow-600 animate-pulse' : 
                                           'bg-red-600'
                                        }`} />
                                        {d.status}
                                     </div>
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                     <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                        <button className="p-2 hover:bg-[#00DFB8]/10 hover:text-[#00DFB8] rounded-lg transition-all text-gray-400">
                                           <Eye size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteDoc(d.id)}
                                          className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all text-gray-400"
                                        >
                                           <Trash2 size={14} />
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

           <div className="space-y-6">
              <div className="bg-white border border-black/5 rounded-2xl p-8 shadow-xl shadow-black/5 space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-[#1A1A1A] uppercase tracking-widest">Connect New</h3>
                    <Info size={14} className="text-gray-300" />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    {[
                       { id: 'upload', name: 'Upload Files', icon: Upload },
                       { id: 'url', name: 'Website URL', icon: Globe },
                       { id: 'qa', name: 'Q&A Pairs', icon: FileQuestion },
                       { id: 'text', name: 'Raw Text', icon: Type },
                       { id: 'notion', name: 'Notion Sync', icon: BookOpen },
                       { id: 'api', name: 'API Docs', icon: Database },
                    ].map((item, i) => (
                       <button 
                         key={i} 
                         onClick={() => {
                           if (!selectedAgentId) {
                             alert('Please select a Target Agent from the top right first.')
                             return
                           }
                           if (item.id === 'upload') fileInputRef.current?.click()
                           else setActiveSourceType(item.id)
                         }}
                         className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all hover:scale-105 bg-white text-gray-500 border-black/5 hover:border-[#00DFB8]/30 shadow-sm`}
                       >
                          <item.icon size={20} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{item.name}</span>
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

                 <div className="pt-4 space-y-3">
                    <div className="p-4 bg-[#FAFAFA] border border-black/5 rounded-xl flex items-start gap-3">
                       <AlertCircle size={16} className="text-[#00DFB8] mt-0.5" />
                       <div className="text-[10px] text-[#888] font-bold leading-tight">
                          Need to sync from Google Drive or Dropbox? Contact enterprise support.
                       </div>
                    </div>
                    <button className="w-full py-4 bg-white border border-[#00DFB8] text-[#00DFB8] text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-[#00DFB8] hover:text-[#1A1A1A] transition-all">
                       Bulk Import Sources
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* URL MODAL */}
      {activeSourceType === 'url' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <div className="bg-white rounded-[2rem] p-10 max-w-md w-full space-y-8 shadow-2xl relative">
              <button onClick={() => setActiveSourceType(null)} className="absolute top-6 right-6 text-gray-300 hover:text-black transition-all">
                <X size={20} />
              </button>
              <div className="space-y-2">
                 <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tight">Connect Website</h2>
                 <p className="text-xs text-[#888] font-bold uppercase tracking-widest">Import content from any URL</p>
              </div>
              <form onSubmit={handleUrlSubmit} className="space-y-6">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Target URL</label>
                    <input 
                      className="w-full bg-[#FAFAFA] border border-black/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#00DFB8] outline-none transition-all"
                      placeholder="https://example.com/docs"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      required
                    />
                 </div>
                 <button 
                   disabled={isUploading}
                   className="w-full py-4 bg-[#1A1A1A] text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-2"
                 >
                   {isUploading ? <Loader2 size={14} className="animate-spin" /> : null}
                   {isUploading ? 'Crawling...' : 'Start Import'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* TEXT MODAL */}
      {activeSourceType === 'text' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <div className="bg-white rounded-[2rem] p-10 max-w-lg w-full space-y-8 shadow-2xl relative">
              <button onClick={() => setActiveSourceType(null)} className="absolute top-6 right-6 text-gray-300 hover:text-black transition-all">
                <X size={20} />
              </button>
              <div className="space-y-2">
                 <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tight">Add Raw Text</h2>
                 <p className="text-xs text-[#888] font-bold uppercase tracking-widest">Paste text content directly</p>
              </div>
              <form onSubmit={handleTextSubmit} className="space-y-6">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Document Title</label>
                    <input 
                      className="w-full bg-[#FAFAFA] border border-black/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#00DFB8] outline-none transition-all"
                      placeholder="e.g. Refund Policy"
                      value={textData.name}
                      onChange={e => setTextData({...textData, name: e.target.value})}
                      required
                    />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Content</label>
                    <textarea 
                      className="w-full bg-[#FAFAFA] border border-black/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#00DFB8] outline-none transition-all min-h-[200px]"
                      placeholder="Paste your text here..."
                      value={textData.content}
                      onChange={e => setTextData({...textData, content: e.target.value})}
                      required
                    />
                 </div>
                 <button 
                   disabled={isUploading}
                   className="w-full py-4 bg-[#1A1A1A] text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-2"
                 >
                   {isUploading ? <Loader2 size={14} className="animate-spin" /> : null}
                   {isUploading ? 'Saving...' : 'Save Document'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Q&A MODAL */}
      {activeSourceType === 'qa' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <div className="bg-white rounded-[2rem] p-10 max-w-2xl w-full space-y-8 shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-hide">
              <button onClick={() => setActiveSourceType(null)} className="absolute top-6 right-6 text-gray-300 hover:text-black transition-all">
                <X size={20} />
              </button>
              <div className="space-y-2">
                 <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tight">Add Q&A Pairs</h2>
                 <p className="text-xs text-[#888] font-bold uppercase tracking-widest">Train your agent with specific Q&A</p>
              </div>
              <form onSubmit={handleQaSubmit} className="space-y-8">
                 <div className="space-y-6">
                    {qaPairs.map((pair, idx) => (
                      <div key={idx} className="p-6 bg-[#FAFAFA] border border-black/5 rounded-2xl space-y-4 relative group">
                         <div className="space-y-3">
                            <label className="text-[9px] font-black text-[#888] uppercase tracking-widest">Question {idx + 1}</label>
                            <input 
                              className="w-full bg-white border border-black/5 rounded-xl px-4 py-3 text-xs font-bold focus:border-[#00DFB8] outline-none transition-all"
                              placeholder="e.g. How do I reset my password?"
                              value={pair.question}
                              onChange={e => updateQaPair(idx, 'question', e.target.value)}
                              required
                            />
                         </div>
                         <div className="space-y-3">
                            <label className="text-[9px] font-black text-[#888] uppercase tracking-widest">Answer</label>
                            <textarea 
                              className="w-full bg-white border border-black/5 rounded-xl px-4 py-3 text-xs font-bold focus:border-[#00DFB8] outline-none transition-all min-h-[80px]"
                              placeholder="e.g. You can reset it via the 'Forgot Password' link..."
                              value={pair.answer}
                              onChange={e => updateQaPair(idx, 'answer', e.target.value)}
                              required
                            />
                         </div>
                         {idx > 0 && (
                           <button 
                             type="button"
                             onClick={() => setQaPairs(qaPairs.filter((_, i) => i !== idx))}
                             className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-all"
                           >
                             <Trash2 size={14} />
                           </button>
                         )}
                      </div>
                    ))}
                 </div>
                 <div className="flex items-center justify-between gap-4">
                    <button 
                      type="button"
                      onClick={addQaPair}
                      className="px-6 py-4 border border-[#00DFB8] text-[#00DFB8] text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#00DFB8] hover:text-[#1A1A1A] transition-all flex items-center gap-2"
                    >
                       <Plus size={14} /> Add Another Pair
                    </button>
                    <button 
                      disabled={isUploading}
                      className="flex-1 py-4 bg-[#1A1A1A] text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-2"
                    >
                      {isUploading ? <Loader2 size={14} className="animate-spin" /> : null}
                      {isUploading ? 'Processing...' : 'Finish & Train'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* NOTION / API DOCS PLACEHOLDER MODALS */}
      {(activeSourceType === 'notion' || activeSourceType === 'api') && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <div className="bg-white rounded-[2rem] p-10 max-w-md w-full space-y-8 shadow-2xl relative text-center">
              <button onClick={() => setActiveSourceType(null)} className="absolute top-6 right-6 text-gray-300 hover:text-black transition-all">
                <X size={20} />
              </button>
              <div className="w-16 h-16 bg-[#00DFB8]/10 text-[#00DFB8] rounded-2xl flex items-center justify-center mx-auto mb-4">
                 {activeSourceType === 'notion' ? <BookOpen size={32} /> : <Database size={32} />}
              </div>
              <div className="space-y-4">
                 <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tight">Coming Soon</h2>
                 <p className="text-sm text-[#888] leading-relaxed">
                   The {activeSourceType === 'notion' ? 'Notion Sync' : 'API Docs Integration'} feature is currently in closed beta. Please contact enterprise support to request early access.
                 </p>
              </div>
              <button 
                onClick={() => setActiveSourceType(null)}
                className="w-full py-4 bg-[#1A1A1A] text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all"
              >
                Got it
              </button>
           </div>
        </div>
      )}
    </div>
  )
}
