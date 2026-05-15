'use client'
import { useEffect, useState } from 'react'
import { api, getSession } from '@/lib/api'
import { 
  CreditCard, 
  Check, 
  ArrowUpRight, 
  History, 
  PieChart, 
  Zap, 
  Crown, 
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Gem,
  Bot,
  Activity,
  Cpu,
  Download,
  ExternalLink
} from 'lucide-react'

const plans = [
  { 
    id: 'pro', 
    name: 'Pro', 
    price: 25, 
    credits: '2,500', 
    agents: 3, 
    features: ['3 Orchestrated Agents', '2,500 Neural Credits/mo', 'Web Research capabilities', 'WhatsApp + Email Engine', 'Standard API Access', 'Standard Support'], 
    highlight: true,
    desc: 'Professional grade automation.'
  },
  { 
    id: 'premium', 
    name: 'Premium', 
    price: 59, 
    credits: '10,000', 
    agents: 10, 
    features: ['10 Elite Agents', '10,000 Neural Credits/mo', 'Custom Workflow Builder', 'Full API & Webhooks', 'Team Collaboration (3 seats)', 'Dedicated Success Manager'],
    desc: 'Enterprise workforce logic.'
  },
]

export default function BillingPage() {
  const [credits, setCredits] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState('')

  useEffect(() => {
    getSession().then(s => setTenant(s?.tenant))
    api.billing.credits().then(r => { setCredits(r); setHistory(r.history || []) }).catch(() => {})
  }, [])

  async function checkout(plan: string) {
    setLoading(plan)
    try {
      const r = await api.billing.checkout(plan)
      window.location.href = r.url
    } catch (err: any) { console.error(err) }
    finally { setLoading('') }
  }

  async function openPortal() {
    try {
      const r = await api.billing.portal()
      window.location.href = r.url
    } catch (err: any) { console.error(err) }
  }

  const currentPlan = credits?.plan || tenant?.plan || 'hobby'
  const used = (credits?.credits_monthly || 500) - (credits?.credits_remaining || 0)
  const pct = Math.min(100, Math.round((used / (credits?.credits_monthly || 500)) * 100))

  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              <CreditCard size={14} className="text-[#00DFB8]" /> Neural Economics
           </div>
           <div className="h-4 w-px bg-black/[0.05]" />
           <div className="flex items-center gap-4">
              <button className="text-[10px] font-bold text-black uppercase tracking-widest border-b border-black">Subscription</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Invoices</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Payment Methods</button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={openPortal}
             className="px-3 py-1.5 bg-white border border-black/[0.05] rounded-lg text-[9px] font-black uppercase tracking-widest text-black hover:bg-black hover:text-white transition-all shadow-sm"
           >
              Stripe Dashboard <ExternalLink size={12} className="inline ml-1" />
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
          
          <div className="flex justify-between items-end">
             <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-black uppercase tracking-widest">
                   <ShieldCheck size={10} /> Secure Ledger
                </div>
                <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">Billing & Neural Capital</h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
                   Manage your subscription tier and monitor the allocation of neural credits across your autonomous agent workforce.
                </p>
             </div>
          </div>

          {/* RESOURCE UTILIZATION CARD */}
          <div className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm relative overflow-hidden group">
             <div className="grid grid-cols-12 gap-8 items-center relative z-10">
                <div className="col-span-7 space-y-6">
                   <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-[#1A1A1A]">
                         <PieChart size={18} />
                      </div>
                      <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-widest">Neural Quota Manifest</h3>
                   </div>
                   <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] leading-relaxed max-w-md">
                      Monthly credit allotment fuels real-time inference and vector processing. Auto-cycles every 30 days.
                   </p>
                   <div className="flex gap-12">
                      <div>
                         <div className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Injected</div>
                         <div className="text-xl font-bold text-[#1A1A1A]">{(credits?.credits_monthly ?? 0).toLocaleString()} <span className="text-[10px] font-black text-gray-300">Credits</span></div>
                      </div>
                      <div>
                         <div className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">State</div>
                         <div className={`inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${pct > 90 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                            {pct > 90 ? 'Depleted' : 'Nominal'}
                         </div>
                      </div>
                   </div>
                </div>

                <div className="col-span-5 text-right space-y-6">
                   <div className="space-y-1">
                      <div className="text-5xl font-bold text-[#00DFB8] tracking-tighter">{(credits?.credits_remaining ?? 0).toLocaleString()}</div>
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Available Inference Units</div>
                   </div>
                   <div className="space-y-2">
                      <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden border border-black/[0.03]">
                         <div 
                           className={`h-full transition-all duration-1000 ease-out ${pct > 80 ? 'bg-amber-400' : 'bg-[#00DFB8]'}`}
                           style={{ width: `${pct}%` }}
                         />
                      </div>
                      <div className="flex justify-between text-[8px] font-black text-gray-300 uppercase tracking-widest">
                         <span>{pct}% Consumed</span>
                         <span>Resets in 12 days</span>
                      </div>
                   </div>
                </div>
             </div>
             <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
                <Activity size={100} className="text-black" />
             </div>
          </div>

          {/* PRICING PLANS */}
          <div className="space-y-6">
             <div className="flex items-center justify-between border-b border-black/[0.03] pb-4">
                <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Workforce Scaling Options</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-white border border-black/[0.05] rounded-lg">
                   <Gem size={12} className="text-amber-500" />
                   <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Current:</span>
                   <span className="text-[8px] font-black text-black uppercase tracking-widest">{currentPlan} Tier</span>
                </div>
             </div>

             <div className="grid grid-cols-3 gap-6">
                {plans.map(p => (
                  <div 
                    key={p.id} 
                    className={`relative flex flex-col bg-white border p-8 rounded-2xl transition-all ${
                      p.highlight 
                      ? 'border-[#00DFB8] shadow-lg shadow-[#00DFB8]/5' 
                      : 'border-black/[0.03] hover:border-black/[0.1] shadow-sm'
                    }`}
                  >
                    {p.highlight && (
                      <div className="absolute top-0 right-0 px-3 py-1 bg-[#00DFB8] text-[#1A1A1A] text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
                         Standard Deploy
                      </div>
                    )}

                    <div className="space-y-6 flex-1">
                       <div className="space-y-1">
                          <h3 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-widest">{p.name} Tier</h3>
                          <p className="text-[9px] font-medium text-gray-400 uppercase tracking-[0.1em]">{p.desc}</p>
                       </div>

                       <div className="flex items-baseline gap-1 py-4 border-y border-black/[0.03]">
                          <span className="text-3xl font-bold text-[#1A1A1A] tracking-tighter">${p.price}</span>
                          <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">/ Month</span>
                       </div>

                       <div className="space-y-3">
                          {p.features.map(f => (
                            <div key={f} className="flex items-start gap-2">
                               <Check size={12} className="text-[#00DFB8] mt-0.5 shrink-0" />
                               <span className="text-[10px] font-medium text-gray-500 leading-snug">{f}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    <button 
                      className={`w-full py-3 mt-8 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all shadow-sm flex items-center justify-center gap-2 ${
                        p.highlight 
                        ? 'bg-[#1A1A1A] text-white hover:bg-black' 
                        : 'bg-white border border-black/[0.05] text-[#1A1A1A] hover:border-black'
                      }`}
                      disabled={!!loading} 
                      onClick={() => checkout(p.id)}
                    >
                       {loading === p.id ? 'Establishing...' : <><ArrowUpRight size={14} /> Provision {p.name}</>}
                    </button>
                  </div>
                ))}
                
                {/* ENTERPRISE CARD */}
                <div className="bg-[#1A1A1A] border border-black p-8 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden">
                   <div className="space-y-4 relative z-10">
                      <div className="flex items-center gap-2 text-[#00DFB8]">
                         <Cpu size={16} />
                         <h3 className="text-xs font-bold uppercase tracking-widest">Custom Cluster</h3>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed uppercase font-medium tracking-widest">
                         High-volume distributed architecture with dedicated neural nodes and priority inference.
                      </p>
                   </div>
                   <button className="w-full py-3 mt-8 bg-white/5 border border-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all">
                      Contact Architect
                   </button>
                   <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Zap size={80} className="text-[#00DFB8]" />
                   </div>
                </div>
             </div>
          </div>

          {/* FINANCIAL HISTORY */}
          <div className="bg-white border border-black/[0.03] rounded-2xl shadow-sm overflow-hidden">
             <div className="p-6 border-b border-black/[0.03] flex items-center justify-between bg-black/[0.01]">
                <div className="flex items-center gap-3">
                   <div className="w-9 h-9 rounded-xl bg-white border border-black/[0.05] flex items-center justify-center text-[#1A1A1A] shadow-sm">
                      <History size={16} />
                   </div>
                   <div>
                      <h3 className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest">Economic Transaction Ledger</h3>
                      <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest mt-0.5">Audit log of resource injections</p>
                   </div>
                </div>
                <button className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-black transition-colors">
                   <Download size={12} /> Bulk Invoices
                </button>
             </div>
             
             <div className="divide-y divide-black/[0.03]">
                {history.length === 0 ? (
                  <div className="p-16 text-center space-y-3 opacity-20">
                     <TrendingUp size={24} className="mx-auto" />
                     <p className="text-[9px] font-black uppercase tracking-widest">No transaction history detected</p>
                  </div>
                ) : history.slice(0, 5).map((h, i) => (
                  <div key={i} className="px-8 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-all group">
                     <div className="flex items-center gap-5">
                        <div className="w-10 h-10 bg-gray-50 border border-black/[0.03] rounded-xl flex items-center justify-center text-[#1A1A1A] group-hover:bg-white transition-all shadow-sm">
                           {h.amount > 0 ? <Zap size={16} className="text-[#00DFB8]" /> : <Crown size={16} />}
                        </div>
                        <div>
                           <div className="text-[11px] font-bold text-[#1A1A1A] tracking-tight">{h.description}</div>
                           <div className="text-[8px] font-black text-gray-300 uppercase tracking-widest mt-0.5">{new Date(h.created_at).toLocaleDateString()}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-8">
                        <div className={`text-sm font-bold ${h.amount > 0 ? 'text-[#00DFB8]' : 'text-[#1A1A1A]'}`}>
                           {h.amount > 0 ? '+' : ''}{h.amount.toLocaleString()}
                           <span className="text-[8px] uppercase tracking-widest ml-1.5 opacity-30 font-black">Credits</span>
                        </div>
                        <ChevronRight size={14} className="text-gray-200 group-hover:text-black transition-all" />
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
