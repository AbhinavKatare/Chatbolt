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
  ExternalLink
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
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-6xl w-full mx-auto p-10 space-y-10 pb-32">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
           <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                <Users size={12} /> CRM
              </div>
              <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Leads & Contacts</h1>
              <p className="text-[#888] text-sm">Centralized database of users captured by your AI agents.</p>
           </div>
           <div className="flex items-center gap-4">
              <button className="flex items-center gap-3 px-6 py-3 bg-white border border-black/5 text-[#1A1A1A] rounded-2xl shadow-sm hover:border-black transition-all text-[10px] font-black uppercase tracking-widest">
                 <Download size={14} /> Export CSV
              </button>
              <button className="flex items-center gap-3 px-8 py-4 bg-[#1A1A1A] text-white rounded-2xl shadow-xl hover:bg-black transition-all text-xs font-black uppercase tracking-[0.2em]">
                 <UserPlus size={18} /> New Contact
              </button>
           </div>
        </div>

        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
           {[
             { label: 'Total Contacts', value: '1,402', icon: Users, color: 'bg-blue-50 text-blue-600' },
             { label: 'New This Week', value: '+42', icon: UserPlus, color: 'bg-[#00DFB8]/10 text-[#00DFB8]' },
             { label: 'Conversations', value: '893', icon: MessageSquare, color: 'bg-purple-50 text-purple-600' },
             { label: 'Conversion Rate', value: '24.2%', icon: Hash, color: 'bg-amber-50 text-amber-600' },
           ].map((stat, i) => (
             <div key={i} className="bg-white border border-black/5 p-6 rounded-3xl shadow-xl shadow-black/5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.color}`}>
                   <stat.icon size={20} />
                </div>
                <div>
                   <div className="text-[10px] font-black text-[#888] uppercase tracking-widest leading-none mb-1">{stat.label}</div>
                   <div className="text-xl font-black text-[#1A1A1A]">{stat.value}</div>
                </div>
             </div>
           ))}
        </div>

        {/* DATA TABLE */}
        <div className="bg-white border border-black/5 rounded-[2.5rem] shadow-xl shadow-black/5 overflow-hidden">
           <div className="p-8 border-b border-black/5 bg-[#FAFAFA]/50 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="relative w-full md:w-96">
                 <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" />
                 <input 
                   className="w-full pl-14 pr-6 py-4 bg-white border border-black/5 rounded-2xl text-sm font-bold text-[#1A1A1A] outline-none focus:border-[#00DFB8] shadow-sm transition-all" 
                   placeholder="Search leads by name or email..." 
                 />
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                 <button className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-white border border-black/5 text-[#1A1A1A] rounded-2xl shadow-sm text-[10px] font-black uppercase tracking-widest hover:border-black transition-all">
                    <Filter size={14} /> Filter Logic
                 </button>
                 <div className="h-8 w-px bg-black/5 hidden md:block" />
                 <div className="text-[10px] font-black text-[#888] uppercase tracking-widest hidden lg:block">
                    Showing top 50 of 1,402
                 </div>
              </div>
           </div>

           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-white">
                       <th className="px-10 py-6 text-[10px] font-black text-[#888] uppercase tracking-[0.2em] border-b border-black/5">Identity</th>
                       <th className="px-10 py-6 text-[10px] font-black text-[#888] uppercase tracking-[0.2em] border-b border-black/5">Communication</th>
                       <th className="px-10 py-6 text-[10px] font-black text-[#888] uppercase tracking-[0.2em] border-b border-black/5">Channel</th>
                       <th className="px-10 py-6 text-[10px] font-black text-[#888] uppercase tracking-[0.2em] border-b border-black/5">Cycle Status</th>
                       <th className="px-10 py-6 text-[10px] font-black text-[#888] uppercase tracking-[0.2em] border-b border-black/5 text-right">Captured</th>
                       <th className="px-10 py-6 border-b border-black/5"></th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-black/5">
                    {contacts.map((c, i) => (
                      <tr key={i} className="hover:bg-[#FAFAFA] transition-all group">
                         <td className="px-10 py-6">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-[#1A1A1A] text-[#00DFB8] rounded-2xl flex items-center justify-center text-xs font-black shadow-lg shadow-black/10 group-hover:rotate-6 transition-all">
                                  {c.name.split(' ').map(n => n[0]).join('')}
                               </div>
                               <div>
                                  <div className="text-sm font-black text-[#1A1A1A] group-hover:text-[#00DFB8] transition-colors">{c.name}</div>
                                  <div className="text-[10px] font-bold text-[#888] uppercase tracking-widest">Lead {i + 402}</div>
                               </div>
                            </div>
                         </td>
                         <td className="px-10 py-6">
                            <div className="space-y-1.5">
                               <div className="flex items-center gap-2 text-[11px] font-bold text-[#555]"><Mail size={12} className="text-gray-300" /> {c.email}</div>
                               <div className="flex items-center gap-2 text-[11px] font-bold text-[#555]"><Phone size={12} className="text-gray-300" /> {c.phone}</div>
                            </div>
                         </td>
                         <td className="px-10 py-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FAFAFA] border border-black/5 rounded-lg text-[9px] font-black text-[#1A1A1A] uppercase tracking-widest">
                               {c.source === 'WhatsApp' ? <MessageSquare size={10} className="text-[#25D366]" /> : <ExternalLink size={10} className="text-blue-500" />}
                               {c.source}
                            </div>
                         </td>
                         <td className="px-10 py-6">
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                               c.status === 'Customer' ? 'bg-green-50 text-green-600' : c.status === 'Qualified' ? 'bg-[#00DFB8]/10 text-[#00DFB8]' : 'bg-gray-100 text-gray-400'
                            }`}>
                               <div className={`w-1.5 h-1.5 rounded-full ${c.status === 'Customer' ? 'bg-green-600' : c.status === 'Qualified' ? 'bg-[#00DFB8]' : 'bg-gray-400'}`} />
                               {c.status}
                            </div>
                         </td>
                         <td className="px-10 py-6 text-right">
                            <div className="flex flex-col items-end">
                               <div className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest">{c.date}</div>
                               <div className="text-[9px] font-bold text-[#888] uppercase tracking-tight flex items-center gap-1 mt-1">
                                  <Clock size={8} /> 14:32 GMT
                               </div>
                            </div>
                         </td>
                         <td className="px-10 py-6 text-right">
                            <button className="w-10 h-10 rounded-xl hover:bg-black/5 flex items-center justify-center text-gray-300 hover:text-black transition-all">
                               <MoreHorizontal size={20} />
                            </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
           
           <div className="p-8 bg-[#FAFAFA]/50 border-t border-black/5 flex items-center justify-between">
              <div className="text-[10px] font-black text-[#888] uppercase tracking-widest">Page 1 of 28</div>
              <div className="flex items-center gap-2">
                 <button className="p-3 bg-white border border-black/5 rounded-xl text-gray-300 cursor-not-allowed">
                    <ChevronRight size={16} className="rotate-180" />
                 </button>
                 <button className="p-3 bg-white border border-black/5 rounded-xl text-[#1A1A1A] hover:border-black transition-all shadow-sm">
                    <ChevronRight size={16} />
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
