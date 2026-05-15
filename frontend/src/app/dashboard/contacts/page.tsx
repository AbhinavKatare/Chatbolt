'use client'
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Mail, 
  Phone, 
  MessageSquare, 
  MoreHorizontal, 
  ChevronRight,
  UserPlus,
  Hash,
  Clock,
  ExternalLink,
  ShieldCheck,
  Zap,
  Activity,
  Database
} from 'lucide-react'

const contacts = [
  { name: 'Sarah Jones', email: 'sarah.j@example.com', phone: '+91 98XXX XXX01', source: 'Website', date: 'May 12, 2024', status: 'Lead' },
  { name: 'Mike Ross', email: 'mike@pearson.com', phone: '+1 (555) 0123', source: 'WhatsApp', date: 'May 11, 2024', status: 'Qualified' },
  { name: 'Harvey Specter', email: 'harvey@specter.com', phone: '+1 (555) 9999', source: 'API', date: 'May 10, 2024', status: 'Customer' },
  { name: 'Rachel Zane', email: 'rachel@zane.io', phone: '+1 (555) 4444', source: 'Website', date: 'May 09, 2024', status: 'Qualified' },
  { name: 'Louis Litt', email: 'louis@litt-up.com', phone: '+1 (555) 2222', source: 'WhatsApp', date: 'May 08, 2024', status: 'Lead' },
]

export default function ContactsPage() {
  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <Database size={14} className="text-[#00DFB8]" /> Lead Intelligence
           </div>
           <div className="h-4 w-px bg-black/[0.05]" />
           <div className="flex items-center gap-4">
              <button className="text-[10px] font-bold text-black uppercase tracking-widest border-b border-black">All Contacts</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Qualified</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Archived</button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-black/[0.05] rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-all">
              <Download size={12} /> Export CSV
           </button>
           <button className="bg-[#1A1A1A] text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-sm">
              <UserPlus size={12} /> Provision Contact
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
          
          <div className="flex justify-between items-end">
             <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-bold uppercase tracking-widest">
                   <Activity size={10} /> Database Sync: Active
                </div>
                <h1 className="text-3xl font-semibold text-[#1A1A1A] tracking-tight">Leads & Global Contacts</h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest max-w-xl leading-relaxed">
                   Centralized repository for all user interactions captured across autonomous edge channels.
                </p>
             </div>
          </div>

          {/* STATS OVERVIEW */}
          <div className="grid grid-cols-4 gap-4">
             {[
               { label: 'Total Index', value: '1,402', icon: Users, color: 'text-blue-500' },
               { label: 'New Captured', value: '+42', icon: UserPlus, color: 'text-[#00DFB8]' },
               { label: 'Interactions', value: '893', icon: MessageSquare, color: 'text-purple-500' },
               { label: 'Signal Strength', value: '24.2%', icon: Hash, color: 'text-amber-500' },
             ].map((stat, i) => (
               <div key={i} className="bg-white border border-black/[0.03] p-5 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center ${stat.color}`}>
                     <stat.icon size={18} />
                  </div>
                  <div>
                     <div className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">{stat.label}</div>
                     <div className="text-lg font-bold text-[#1A1A1A]">{stat.value}</div>
                  </div>
               </div>
             ))}
          </div>

          {/* DATA TABLE */}
          <div className="bg-white border border-black/[0.03] rounded-2xl shadow-sm overflow-hidden">
             <div className="p-6 border-b border-black/[0.03] bg-black/[0.01] flex items-center justify-between gap-6">
                <div className="relative flex-1 max-w-md">
                   <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                   <input 
                     className="w-full pl-10 pr-4 py-2 bg-white border border-black/[0.05] rounded-xl text-[11px] font-medium text-[#1A1A1A] outline-none focus:border-[#00DFB8] transition-all" 
                     placeholder="Search database..." 
                   />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-black/[0.05] text-[#1A1A1A] rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-black transition-all">
                   <Filter size={12} /> Filter Manifest
                </button>
             </div>

             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-black/[0.01]">
                         <th className="px-8 py-4 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-black/[0.03]">Personnel</th>
                         <th className="px-8 py-4 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-black/[0.03]">Contact Meta</th>
                         <th className="px-8 py-4 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-black/[0.03]">Channel</th>
                         <th className="px-8 py-4 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-black/[0.03]">Lifecycle</th>
                         <th className="px-8 py-4 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-black/[0.03] text-right">Captured</th>
                         <th className="px-8 py-4 border-b border-black/[0.03]"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-black/[0.03]">
                      {contacts.map((c, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-all group">
                           <td className="px-8 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-9 h-9 bg-[#1A1A1A] text-[#00DFB8] rounded-xl flex items-center justify-center text-[10px] font-black shadow-lg shadow-black/10 group-hover:scale-110 transition-all">
                                    {c.name.split(' ').map(n => n[0]).join('')}
                                 </div>
                                 <div>
                                    <div className="text-xs font-bold text-[#1A1A1A] group-hover:text-[#00DFB8] transition-colors">{c.name}</div>
                                    <div className="text-[9px] font-medium text-gray-400 uppercase tracking-widest">UID-00{i + 402}</div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-8 py-4">
                              <div className="space-y-1">
                                 <div className="flex items-center gap-2 text-[10px] font-medium text-gray-500"><Mail size={10} className="text-gray-300" /> {c.email}</div>
                                 <div className="flex items-center gap-2 text-[10px] font-medium text-gray-500"><Phone size={10} className="text-gray-300" /> {c.phone}</div>
                              </div>
                           </td>
                           <td className="px-8 py-4">
                              <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-gray-50 border border-black/[0.03] rounded text-[8px] font-black text-[#1A1A1A] uppercase tracking-widest">
                                 {c.source === 'WhatsApp' ? <MessageSquare size={10} className="text-[#25D366]" /> : <ExternalLink size={10} className="text-blue-500" />}
                                 {c.source}
                              </div>
                           </td>
                           <td className="px-8 py-4">
                              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                 c.status === 'Customer' ? 'bg-green-50 text-green-600' : c.status === 'Qualified' ? 'bg-[#00DFB8]/10 text-[#00DFB8]' : 'bg-gray-100 text-gray-400'
                              }`}>
                                 <div className={`w-1 h-1 rounded-full ${c.status === 'Customer' ? 'bg-green-600' : c.status === 'Qualified' ? 'bg-[#00DFB8]' : 'bg-gray-400'}`} />
                                 {c.status}
                              </div>
                           </td>
                           <td className="px-8 py-4 text-right">
                              <div className="flex flex-col items-end">
                                 <div className="text-[10px] font-bold text-[#1A1A1A] uppercase tracking-widest">{c.date}</div>
                                 <div className="text-[8px] font-medium text-gray-400 uppercase tracking-tight flex items-center gap-1 mt-0.5">
                                    <Clock size={8} /> 14:32 Z
                                 </div>
                              </div>
                           </td>
                           <td className="px-8 py-4 text-right">
                              <button className="p-2 text-gray-300 hover:text-black transition-all">
                                 <MoreHorizontal size={16} />
                              </button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             
             <div className="p-6 bg-black/[0.01] border-t border-black/[0.03] flex items-center justify-between">
                <div className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Data Block 1 of 28</div>
                <div className="flex items-center gap-2">
                   <button className="p-2 bg-white border border-black/[0.05] rounded-lg text-gray-300 cursor-not-allowed">
                      <ChevronRight size={14} className="rotate-180" />
                   </button>
                   <button className="p-2 bg-white border border-black/[0.05] rounded-lg text-[#1A1A1A] hover:border-black transition-all shadow-sm">
                      <ChevronRight size={14} />
                   </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
