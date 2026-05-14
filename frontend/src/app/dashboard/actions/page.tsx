'use client'
import { Zap, Plus, ExternalLink, Shield, Code, Settings2, Box, Cpu, Workflow, MessageSquare, Database, Globe, X } from 'lucide-react'
import { useState } from 'react'

const actions = [
  { name: 'Book Appointment', tool: 'Google Calendar', type: 'Integration', status: 'active', icon: MessageSquare },
  { name: 'Update Lead Status', tool: 'Salesforce CRM', type: 'CRM', status: 'active', icon: Database },
  { name: 'Send Order Update', tool: 'WhatsApp / Twilio', type: 'Notification', status: 'active', icon: Zap },
  { name: 'Calculate Shipping', tool: 'Custom Webhook', type: 'Webhook', status: 'standby', icon: Globe },
  { name: 'Inventory Sync', tool: 'Shopify API', type: 'E-commerce', status: 'active', icon: Box },
  { name: 'Fraud Detection', tool: 'Internal Logic', type: 'Security', status: 'active', icon: Shield },
]

export default function ActionsPage() {
  const [isAddingTool, setIsAddingTool] = useState(false)
  const [newTool, setNewTool] = useState({ name: '', url: '', auth: 'none' })

  const handleAddTool = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulated add
    alert(`Tool ${newTool.name} added!`)
    setIsAddingTool(false)
    setNewTool({ name: '', url: '', auth: 'none' })
  }
  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-6xl w-full mx-auto p-10 space-y-10 pb-32">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
           <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-bold uppercase tracking-widest mb-2">
                <Cpu size={12} /> Agent Capabilities
              </div>
              <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Actions & Tools</h1>
              <p className="text-[#888] text-sm">Define what your AI agents can do in the real world. Connect third-party APIs and custom functions.</p>
           </div>
           <button className="flex items-center gap-3 px-6 py-4 bg-[#1A1A1A] text-white rounded-2xl shadow-xl hover:bg-black transition-all text-xs font-bold uppercase tracking-[0.2em] transform hover:-translate-y-1">
             <Plus size={18} /> Connect New Tool
           </button>
        </div>

        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {[
              { label: 'Active Tools', value: '14', icon: Zap, color: 'text-[#00DFB8]' },
              { label: 'Total Calls', value: '1.2k', icon: Workflow, color: 'text-blue-500' },
              { label: 'Avg Latency', value: '240ms', icon: Cpu, color: 'text-purple-500' },
              { label: 'Safety Score', value: '100%', icon: Shield, color: 'text-green-500' },
           ].map((stat, i) => (
              <div key={i} className="bg-white border border-black/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                 <div className="flex items-center gap-2 text-[#888] mb-3">
                    <stat.icon size={14} className={stat.color} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                 </div>
                 <div className="text-2xl font-black text-[#1A1A1A]">{stat.value}</div>
              </div>
           ))}
        </div>

        {/* TOOLS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {actions.map((action, i) => (
            <div key={i} className="bg-white border border-black/5 p-8 rounded-3xl hover:border-[#00DFB8]/30 transition-all group cursor-pointer relative overflow-hidden shadow-xl shadow-black/5">
               {/* STATUS INDICATOR */}
               <div className="absolute top-0 right-0 p-6">
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                    action.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${action.status === 'active' ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
                    {action.status}
                  </div>
               </div>

               <div className="flex flex-col h-full">
                  <div className="w-16 h-16 bg-[#FAFAFA] rounded-2xl flex items-center justify-center text-[#1A1A1A] mb-8 border border-black/5 group-hover:scale-110 group-hover:rotate-3 transition-all">
                     <action.icon size={32} />
                  </div>
                  
                  <div className="space-y-1 mb-8">
                     <h3 className="text-xl font-black text-[#1A1A1A] group-hover:text-[#00DFB8] transition-colors">{action.name}</h3>
                     <p className="text-[10px] font-bold text-[#888] uppercase tracking-[0.15em]">{action.type} · {action.tool}</p>
                  </div>

                  <div className="mt-auto flex items-center gap-6 pt-6 border-t border-black/5">
                     <button className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest hover:text-[#00DFB8] transition-all flex items-center gap-2">
                       Configure <Settings2 size={12} />
                     </button>
                     <button className="text-[10px] font-black text-[#888] uppercase tracking-widest hover:text-[#1A1A1A] transition-all flex items-center gap-2">
                       Docs <ExternalLink size={12} />
                     </button>
                  </div>
               </div>
            </div>
          ))}
          
          {/* ADD NEW PLACEHOLDER */}
          <div 
            onClick={() => setIsAddingTool(true)}
            className="border-4 border-dashed border-black/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 hover:border-[#00DFB8]/20 transition-all cursor-pointer group bg-black/[0.01]"
          >
             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-gray-300 group-hover:text-[#00DFB8] transition-all shadow-sm">
                <Plus size={32} />
             </div>
             <div className="space-y-1">
                <div className="text-sm font-black text-[#1A1A1A] uppercase tracking-widest">Add Custom Tool</div>
                <div className="text-[10px] font-bold text-[#888] uppercase tracking-widest leading-relaxed">
                   Connect internal APIs or<br />third-party services.
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* ADD TOOL MODAL */}
      {isAddingTool && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <div className="bg-white rounded-[2.5rem] p-12 max-w-lg w-full space-y-10 shadow-2xl relative border border-black/5">
              <button onClick={() => setIsAddingTool(false)} className="absolute top-8 right-8 text-gray-300 hover:text-black transition-all">
                <X size={24} />
              </button>
              <div className="space-y-2">
                 <h2 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Connect Custom API</h2>
                 <p className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em]">Extend your agent capabilities</p>
              </div>
              <form onSubmit={handleAddTool} className="space-y-8">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Tool Name</label>
                    <input 
                      className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-sm font-bold focus:border-[#00DFB8] outline-none transition-all"
                      placeholder="e.g. Stripe Billing API"
                      value={newTool.name}
                      onChange={e => setNewTool(n => ({ ...n, name: e.target.value }))}
                      required
                    />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Endpoint URL</label>
                    <input 
                      className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-sm font-bold focus:border-[#00DFB8] outline-none transition-all"
                      placeholder="https://api.stripe.com/v1/..."
                      value={newTool.url}
                      onChange={e => setNewTool(n => ({ ...n, url: e.target.value }))}
                      required
                    />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Authentication</label>
                    <select 
                      className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-sm font-bold focus:border-[#00DFB8] outline-none transition-all appearance-none cursor-pointer"
                      value={newTool.auth}
                      onChange={e => setNewTool(n => ({ ...n, auth: e.target.value }))}
                    >
                       <option value="none">None / Public</option>
                       <option value="bearer">Bearer Token</option>
                       <option value="apikey">API Key Header</option>
                       <option value="basic">Basic Auth</option>
                    </select>
                 </div>
                 <button className="w-full py-5 bg-[#1A1A1A] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl shadow-black/10">
                   Securely Connect Tool
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  )
}
