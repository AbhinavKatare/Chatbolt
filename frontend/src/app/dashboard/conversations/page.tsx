'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { 
  MessageSquare, 
  Search, 
  Filter, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  Bot, 
  MoreHorizontal,
  Hash
} from 'lucide-react'

export default function ConversationsPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [agentId, setAgentId] = useState('')
  const [conversations, setConversations] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [filter, setFilter] = useState<'all'|'escalated'|'resolved'>('all')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    api.agents.list().then(r => {
      setAgents(r.agents)
      if (r.agents[0]) setAgentId(r.agents[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!agentId) return
    const escalated = filter === 'escalated' ? true : undefined
    api.chat.conversations(agentId, 1, escalated).then(r => {
      setConversations(r.conversations)
      setTotal(r.total)
    }).catch(() => {})
  }, [agentId, filter])

  async function openConversation(conv: any) {
    setSelected(conv)
    const r = await api.chat.messages(agentId, conv.id).catch(() => ({ messages: [] }))
    setMessages(r.messages)
  }

  async function resolve(convId: string) {
    await api.chat.resolve(agentId, convId).catch(() => {})
    setConversations(c => c.map(x => x.id === convId ? { ...x, resolved: true } : x))
    if (selected?.id === convId) setSelected((s: any) => ({ ...s, resolved: true }))
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <div className="flex h-full bg-[#FAFAFA] overflow-hidden">
      {/* CONVERSATION LIST PANEL */}
      <div className="w-[380px] flex flex-col border-r border-black/5 bg-white shrink-0">
        <div className="p-8 border-b border-black/5 space-y-6">
           <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight">Conversations</h1>
              <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-xs font-bold text-[#888]">
                {total}
              </div>
           </div>
           
           <div className="space-y-4">
              {agents.length > 0 && (
                <div className="relative group">
                   <select 
                     className="w-full appearance-none bg-[#FAFAFA] border border-black/5 px-4 py-2.5 rounded-xl text-xs font-bold text-[#1A1A1A] outline-none cursor-pointer focus:border-[#00DFB8] transition-all"
                     value={agentId} 
                     onChange={e => setAgentId(e.target.value)}
                   >
                     {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                   </select>
                   <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 rotate-90" />
                </div>
              )}

              <div className="flex items-center gap-1.5 p-1 bg-[#FAFAFA] border border-black/5 rounded-xl">
                 {(['all','escalated','resolved'] as const).map(f => (
                    <button 
                      key={f} 
                      onClick={() => setFilter(f)} 
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        filter === f ? 'bg-white text-[#1A1A1A] shadow-sm shadow-black/5' : 'text-[#888] hover:text-[#1A1A1A]'
                      }`}
                    >
                      {f}
                    </button>
                 ))}
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-black/5">
          {conversations.length === 0 ? (
            <div className="p-12 text-center space-y-3">
               <div className="w-12 h-12 bg-[#FAFAFA] rounded-full flex items-center justify-center mx-auto text-gray-300">
                  <MessageSquare size={24} />
               </div>
               <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest">No conversations found</p>
            </div>
          ) : conversations.map(c => (
            <div 
              key={c.id} 
              onClick={() => openConversation(c)}
              className={`p-6 cursor-pointer transition-all border-l-4 ${
                selected?.id === c.id ? 'bg-[#00DFB8]/5 border-[#00DFB8]' : 'bg-white border-transparent hover:bg-[#FAFAFA]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00DFB8]" />
                    <span className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest">Session {c.session_id?.slice(0, 8)}</span>
                 </div>
                 <span className="text-[9px] font-bold text-[#888]">{timeAgo(c.last_message_at || c.created_at)}</span>
              </div>
              <p className="text-xs font-medium text-[#555] line-clamp-2 mb-3 leading-relaxed">
                 {c.last_message || 'Waiting for first message...'}
              </p>
              <div className="flex items-center gap-3">
                 {c.escalated && (
                   <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      <AlertTriangle size={8} /> Escalated
                   </span>
                 )}
                 {c.resolved ? (
                   <span className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      <CheckCircle2 size={8} /> Resolved
                   </span>
                 ) : (
                   <span className="flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      <Clock size={8} /> Active
                   </span>
                 )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT PANEL */}
      <div className="flex-1 flex flex-col bg-white">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#FAFAFA]/50">
            <div className="w-24 h-24 bg-white rounded-3xl border border-black/5 shadow-xl shadow-black/5 flex items-center justify-center mb-8 rotate-3">
               <MessageSquare size={40} className="text-[#00DFB8]" />
            </div>
            <h2 className="text-xl font-black text-[#1A1A1A] tracking-tight mb-2">Select a Conversation</h2>
            <p className="text-sm text-[#888] max-w-xs">Click on a chat entry to view the full interaction logs and handle escalations.</p>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="h-20 px-8 flex items-center justify-between border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-10">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-[#1A1A1A]">
                     <Hash size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#1A1A1A] uppercase tracking-widest">Session {selected.session_id?.slice(0, 12)}</h3>
                    <p className="text-[10px] font-bold text-[#888]">{selected.channel} · {new Date(selected.created_at).toLocaleString()}</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-3">
                  {!selected.resolved ? (
                    <button 
                      onClick={() => resolve(selected.id)}
                      className="px-6 py-2.5 bg-[#00DFB8] text-[#1A1A1A] text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg hover:shadow-[#00DFB8]/20 transition-all"
                    >
                      Mark as Resolved
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-6 py-2.5 bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-green-100">
                       <CheckCircle2 size={14} /> Resolved
                    </div>
                  )}
                  <button className="p-2.5 bg-black/5 text-[#1A1A1A] rounded-xl hover:bg-black/10 transition-all">
                     <MoreHorizontal size={20} />
                  </button>
               </div>
            </div>

            {/* MESSAGES VIEW */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#FAFAFA]/50">
               {messages.length === 0 ? (
                 <div className="flex items-center justify-center h-full">
                    <p className="text-xs font-bold text-[#888] uppercase tracking-widest italic">No messages found for this session.</p>
                 </div>
               ) : messages.map((m, idx) => {
                 const isUser = m.role === 'user';
                 return (
                   <div key={m.id || idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                         <div className={`flex items-center gap-2 mb-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isUser ? 'bg-[#00DFB8] text-[#1A1A1A]' : 'bg-[#1A1A1A] text-white'}`}>
                               {isUser ? <User size={12} /> : <Bot size={12} />}
                            </div>
                            <span className="text-[9px] font-black text-[#888] uppercase tracking-widest">{isUser ? 'Customer' : 'AI Agent'}</span>
                         </div>
                         
                         <div className={`p-5 rounded-3xl shadow-sm border ${
                           isUser 
                           ? 'bg-[#1A1A1A] text-white border-black rounded-tr-sm' 
                           : 'bg-white text-[#1A1A1A] border-black/5 rounded-tl-sm shadow-xl shadow-black/5'
                         }`}>
                            <p className="text-[14px] leading-relaxed font-medium">{m.content}</p>
                            <div className={`mt-3 text-[9px] font-bold uppercase tracking-widest ${isUser ? 'text-gray-400' : 'text-gray-400'}`}>
                               {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                         </div>
                      </div>
                   </div>
                 );
               })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
