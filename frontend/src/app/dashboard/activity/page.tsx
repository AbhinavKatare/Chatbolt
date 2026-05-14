'use client'
import { Activity as ActivityIcon, Clock, MessageSquare, UserCheck, RefreshCcw, Download, Filter } from 'lucide-react'

const activity = [
  { type: 'conversation', content: 'Agent "Support_Pro" resolved a query about "API integration"', time: '2 mins ago', status: 'resolved' },
  { type: 'lead', content: 'New lead captured: sarah.jones@example.com (via WhatsApp)', time: '14 mins ago', status: 'new' },
  { type: 'training', content: 'Knowledge base updated: 14 new documents processed', time: '1 hour ago', status: 'complete' },
  { type: 'escalation', content: 'Query about "Refund Policy" escalated to human support', time: '3 hours ago', status: 'escalated' },
  { type: 'conversation', content: 'Agent "Billing_Bot" handled a subscription renewal question', time: '5 hours ago', status: 'resolved' },
  { type: 'lead', content: 'New lead captured: mike.chen@techcorp.com (via Web)', time: '6 hours ago', status: 'new' },
]

export default function ActivityPage() {
  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-5xl w-full mx-auto p-10 space-y-10 pb-32">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
           <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-bold uppercase tracking-widest mb-2">
                <ActivityIcon size={12} /> Live Audit Log
              </div>
              <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">System Activity</h1>
              <p className="text-[#888] text-sm">Real-time overview of agent actions, lead captures, and system events.</p>
           </div>
           <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-black/5 rounded-xl shadow-sm text-xs font-bold text-[#1A1A1A] hover:bg-gray-50 transition-all">
                <Download size={14} /> Export
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A1A] text-white border border-black/5 rounded-xl shadow-sm text-xs font-bold hover:bg-black transition-all">
                <RefreshCcw size={14} /> Refresh
              </button>
           </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="flex items-center gap-4">
           <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Search activity logs..." 
                className="w-full pl-12 pr-4 py-3 bg-white border border-black/5 rounded-2xl text-sm outline-none focus:border-[#00DFB8] transition-all shadow-sm"
              />
              <Filter size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
           </div>
           <select className="px-6 py-3 bg-white border border-black/5 rounded-2xl text-xs font-bold text-[#1A1A1A] outline-none shadow-sm cursor-pointer">
              <option>All Activities</option>
              <option>Conversations</option>
              <option>Leads</option>
              <option>Training</option>
           </select>
        </div>

        {/* ACTIVITY LIST */}
        <div className="bg-white border border-black/5 rounded-2xl shadow-xl shadow-black/5 overflow-hidden divide-y divide-black/5">
          {activity.map((item, i) => (
            <div key={i} className="px-8 py-6 flex items-start gap-6 hover:bg-[#FDFDFB] transition-all group cursor-pointer">
               <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-black/5 ${
                 item.status === 'resolved' ? 'bg-green-50 text-green-600' : 
                 item.status === 'new' ? 'bg-[#00DFB8]/10 text-[#00DFB8]' : 
                 item.status === 'escalated' ? 'bg-red-50 text-red-600' : 
                 'bg-gray-50 text-gray-600'
               }`}>
                  {item.type === 'conversation' ? <MessageSquare size={20} /> : 
                   item.type === 'lead' ? <UserCheck size={20} /> : 
                   <ActivityIcon size={20} />}
               </div>
               <div className="flex-1">
                  <div className="text-[15px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">{item.content}</div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-[#888] uppercase tracking-[0.1em]">
                     <span className="flex items-center gap-1.5 bg-black/5 px-2 py-0.5 rounded-full"><Clock size={10} /> {item.time}</span>
                     <span className="w-1.5 h-1.5 bg-[#00DFB8] rounded-full animate-pulse" />
                     <span className="opacity-70">Status: {item.status}</span>
                  </div>
               </div>
               <div className="flex flex-col items-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button className="px-4 py-2 text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest bg-black/5 rounded-lg hover:bg-[#00DFB8] hover:text-[#1A1A1A] transition-all">
                    View Logs
                  </button>
               </div>
            </div>
          ))}
        </div>
        
        <div className="text-center pt-6">
           <button className="px-8 py-4 bg-white border border-black/5 rounded-2xl text-[11px] font-black text-[#1A1A1A] uppercase tracking-[0.2em] shadow-sm hover:shadow-md hover:border-[#00DFB8]/30 transition-all">
              Load More History
           </button>
        </div>
      </div>
    </div>
  )
}
