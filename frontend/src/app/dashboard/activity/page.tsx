'use client'
import { useState } from 'react'
import { 
  Activity as ActivityIcon, 
  Clock, 
  MessageSquare, 
  UserCheck, 
  RefreshCcw, 
  Download, 
  Filter, 
  Search, 
  Terminal,
  Zap,
  ShieldCheck,
  ChevronRight
} from 'lucide-react'

const activity = [
  { type: 'conversation', content: 'Agent "Support_Pro" resolved a query about "API integration"', time: '2m', status: 'resolved' },
  { type: 'lead', content: 'New lead captured: sarah.jones@example.com (via WhatsApp)', time: '14m', status: 'new' },
  { type: 'training', content: 'Knowledge base updated: 14 new documents processed', time: '1h', status: 'complete' },
  { type: 'escalation', content: 'Query about "Refund Policy" escalated to human support', time: '3h', status: 'escalated' },
  { type: 'conversation', content: 'Agent "Billing_Bot" handled a subscription renewal question', time: '5h', status: 'resolved' },
  { type: 'lead', content: 'New lead captured: mike.chen@techcorp.com (via Web)', time: '6h', status: 'new' },
]

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState<'feed'|'errors'|'history'>('feed')
  const [selectedEvent, setSelectedEvent] = useState<any>(null)

  const errorLogs = [
    { type: 'error', content: 'Connection timeout in "Research_Agent" pipeline', time: '5m', status: 'critical', code: 'ETIMEDOUT' },
    { type: 'warning', content: 'Rate limit approaching for NVIDIA NIM API', time: '22m', status: 'warning', code: 'RATE_LIMIT' },
  ]

  const trainingHistory = [
    { type: 'history', content: 'Knowledge Base: "Internal_Docs.pdf" indexed', time: '1h', status: 'success' },
    { type: 'history', content: 'Persona "Tone" modulation updated for Agent 04', time: '4h', status: 'success' },
  ]

  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30 relative">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <Terminal size={14} className="text-[#00DFB8]" /> System Audit Log
           </div>
           <div className="h-4 w-px bg-black/[0.05]" />
           <div className="flex items-center gap-4">
              <button 
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'feed' ? 'text-black border-b border-black' : 'text-gray-400 hover:text-black'}`}
                onClick={() => setActiveTab('feed')}
              >
                Real-time Feed
              </button>
              <button 
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'errors' ? 'text-black border-b border-black' : 'text-gray-400 hover:text-black'}`}
                onClick={() => setActiveTab('errors')}
              >
                Error Logs
              </button>
              <button 
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'history' ? 'text-black border-b border-black' : 'text-gray-400 hover:text-black'}`}
                onClick={() => setActiveTab('history')}
              >
                Training History
              </button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-black/[0.05] rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-all">
              <Download size={12} /> Export Manifest
           </button>
           <button className="p-1.5 bg-white border border-black/[0.05] rounded-lg text-gray-400 hover:text-black transition-all">
              <RefreshCcw size={14} />
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto px-8 py-10 space-y-8">
          
          <div className="flex justify-between items-end">
             <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-black uppercase tracking-widest">
                   <Zap size={10} fill="currentColor" /> {activeTab === 'feed' ? 'Live Pipeline Stream' : activeTab === 'errors' ? 'Anomaly Detection' : 'Log Synthesis'}
                </div>
                <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">
                  {activeTab === 'feed' ? 'System Activity Logs' : activeTab === 'errors' ? 'System Diagnostics' : 'Intelligence Audit'}
                </h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
                   {activeTab === 'feed' 
                     ? 'Comprehensive audit of autonomous agent actions, lead generation events, and system architecture updates.'
                     : activeTab === 'errors' 
                     ? 'Real-time monitoring of execution failures, latency spikes, and logic anomalies within the workforce.'
                     : 'Historical record of knowledge ingestion, persona fine-tuning, and core behavioral updates.'}
                </p>
             </div>
          </div>

          {/* SEARCH & FILTERS */}
          <div className="flex items-center gap-4">
             <div className="flex-1 relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                <input 
                  type="text" 
                  placeholder={`Query ${activeTab} events...`} 
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/[0.03] rounded-xl text-[11px] font-medium outline-none focus:border-[#00DFB8] transition-all shadow-sm"
                />
             </div>
             <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-black/[0.05] text-[#1A1A1A] rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-black transition-all">
                <Filter size={12} /> Filter Logic
             </button>
          </div>

          {/* ACTIVITY FEED */}
          <div className="bg-white border border-black/[0.03] rounded-2xl shadow-sm overflow-hidden divide-y divide-black/[0.03]">
            {(activeTab === 'feed' ? activity : activeTab === 'errors' ? errorLogs : trainingHistory).map((item, i) => (
              <div 
                key={i} 
                className="px-6 py-4 flex items-start gap-5 hover:bg-gray-50/50 transition-all group cursor-pointer relative overflow-hidden"
                onClick={() => setSelectedEvent(item)}
              >
                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-black/[0.03] transition-all ${
                   item.status === 'resolved' || item.status === 'success' ? 'bg-green-50 text-green-600' : 
                   item.status === 'new' ? 'bg-[#00DFB8]/10 text-[#00DFB8]' : 
                   item.status === 'escalated' || item.status === 'critical' ? 'bg-red-50 text-red-600' : 
                   'bg-gray-50 text-gray-600'
                 }`}>
                    {item.type === 'conversation' ? <MessageSquare size={16} /> : 
                     item.type === 'error' ? <ShieldCheck size={16} /> : 
                     item.type === 'lead' ? <UserCheck size={16} /> : 
                     <ActivityIcon size={16} />}
                 </div>
                 <div className="flex-1 space-y-1">
                    <div className="text-[12px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#00DFB8] transition-colors">{item.content}</div>
                    <div className="flex items-center gap-3 text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                       <span className="flex items-center gap-1"><Clock size={10} /> {item.time}</span>
                       <span className="w-1 h-1 bg-gray-200 rounded-full" />
                       <span className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'resolved' || item.status === 'success' ? 'bg-green-500' : 
                            item.status === 'new' ? 'bg-[#00DFB8]' : 
                            'bg-red-500'
                          }`} />
                          {item.status}
                       </span>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    <button className="text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-black flex items-center gap-1">
                      Inspect <ChevronRight size={12} />
                    </button>
                 </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-center pt-4">
             <button className="px-6 py-2.5 bg-white border border-black/[0.05] rounded-xl text-[9px] font-black text-gray-400 hover:text-black uppercase tracking-widest shadow-sm transition-all">
                Load Architecture History
             </button>
          </div>

          {/* SYSTEM HEALTH CARDS */}
          <div className="grid grid-cols-2 gap-4 mt-12">
             <div className="bg-[#1A1A1A] p-6 rounded-2xl shadow-xl border border-black space-y-4">
                <div className="flex items-center gap-2 text-[#00DFB8]">
                   <ShieldCheck size={14} />
                   <h3 className="text-[9px] font-black uppercase tracking-widest">Security Audit</h3>
                </div>
                <div className="text-[10px] text-gray-400 leading-relaxed uppercase font-medium">
                   All ingress channels monitored. Zero anomalies detected in the last 24 cycles.
                </div>
             </div>
             <div className="bg-white border border-black/[0.03] p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-blue-500">
                   <ActivityIcon size={14} />
                   <h3 className="text-[9px] font-black uppercase tracking-widest">Uptime Performance</h3>
                </div>
                <div className="text-[10px] text-gray-400 leading-relaxed uppercase font-medium">
                   Global CDN availability at 99.99%. Inference engine stable across 8 regions.
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* INSPECTION MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-black/[0.05]">
              <div className="p-8 border-b border-black/[0.03] flex justify-between items-start bg-black/[0.01]">
                 <div className="space-y-1">
                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Event Ingress Details</div>
                    <h3 className="text-sm font-black text-[#1A1A1A] uppercase tracking-widest">{selectedEvent.type} ANALYSIS</h3>
                 </div>
                 <button onClick={() => setSelectedEvent(null)} className="text-gray-300 hover:text-black transition-colors">
                    <RefreshCcw size={20} className="rotate-45" />
                 </button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="p-6 bg-gray-50 rounded-2xl border border-black/[0.03] space-y-3">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Logic Trace</div>
                    <div className="text-[13px] font-bold text-[#1A1A1A] leading-relaxed">{selectedEvent.content}</div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Timestamp</div>
                       <div className="text-[10px] font-bold text-[#1A1A1A] uppercase">{selectedEvent.time} ago</div>
                    </div>
                    <div className="space-y-1">
                       <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">System Status</div>
                       <div className="text-[10px] font-bold text-[#1A1A1A] uppercase">{selectedEvent.status}</div>
                    </div>
                 </div>
                 <div className="pt-4">
                    <button className="w-full py-4 bg-[#1A1A1A] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-black transition-all shadow-lg">
                       Acknowledge and Close
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
