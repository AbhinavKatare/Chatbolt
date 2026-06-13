'use client'
import { useEffect, useState } from 'react'
import { api, getSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
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
    features: ['3 Orchestrated Assistants', '2,500 Neural Credits/mo', 'Web Research capabilities', 'WhatsApp + Email Engine', 'Standard API Access', 'Standard Support'], 
    highlight: true,
    desc: 'Professional grade automation.'
  },
  { 
    id: 'premium', 
    name: 'Premium', 
    price: 59, 
    credits: '10,000', 
    agents: 10, 
    features: ['10 Elite Assistants', '10,000 Neural Credits/mo', 'Custom Process Builder', 'Full API & Webhooks', 'Team Collaboration (3 seats)', 'Dedicated Success Manager'],
    desc: 'Enterprise workforce logic.'
  },
]

export default function BillingPage() {
  const { error: toastError, success: toastSuccess } = useToast()
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
    } catch (err: any) { 
      toastError('Checkout failed', err.message)
    } finally { 
      setLoading('') 
    }
  }

  async function openPortal() {
    try {
      const r = await api.billing.portal()
      window.location.href = r.url
    } catch (err: any) { 
      toastError('Failed to open billing portal', err.message)
    }
  }

  const currentPlan = credits?.plan || tenant?.plan || 'hobby'
  const used = (credits?.credits_monthly || 500) - (credits?.credits_remaining || 0)
  const pct = Math.min(100, Math.round((used / (credits?.credits_monthly || 500)) * 100))

  return (
    <div className="flex flex-col h-full bg-[#050507] text-[#EDEDED] overflow-y-auto custom-scrollbar">
      
      {/* TOOLBAR */}
      <div className="h-14 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
              <CreditCard size={14} className="text-[#00E599]" /> Neural Economics
           </div>
           <div className="h-4 w-px bg-white/[0.06]" />
           <div className="flex items-center gap-4">
              <button className="text-[10px] font-black text-white uppercase tracking-widest border-b-2 border-[#00E599] pb-4 mt-4">Subscription</button>
              <button className="text-[10px] font-bold text-zinc-500 hover:text-zinc-200 transition-colors uppercase tracking-widest">Invoices</button>
              <button className="text-[10px] font-bold text-zinc-500 hover:text-zinc-200 transition-colors uppercase tracking-widest">Payment Methods</button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={openPortal}
             className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[9px] font-black uppercase tracking-widest text-white hover:text-[#00E599] hover:border-[#00E599]/30 transition-all shadow-sm flex items-center gap-1.5"
           >
              Stripe Dashboard <ExternalLink size={11} />
           </button>
        </div>
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          
          <div className="flex justify-between items-end">
             <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-[#00E599]/10 text-[#00E599] rounded-full text-[9px] font-black uppercase tracking-widest border border-[#00E599]/20">
                   <ShieldCheck size={10} /> Secure Ledger
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Billing & Neural Capital</h1>
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
                   Manage your subscription tier and monitor the allocation of neural credits across your autonomous workforce.
                </p>
             </div>
          </div>

          {/* RESOURCE UTILIZATION CARD */}
          <div className="bg-[#0D0D11] border border-white/[0.06] p-8 rounded-2xl shadow-2xl relative overflow-hidden group">
             <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
                <div className="col-span-1 md:col-span-7 space-y-6">
                   <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center text-white">
                         <PieChart size={18} />
                      </div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-widest">Neural Quota Manifest</h3>
                   </div>
                   <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.2em] leading-relaxed max-w-md">
                      Monthly credit allotment fuels real-time inference and vector processing. Auto-cycles every 30 days.
                   </p>
                   <div className="flex gap-12">
                      <div>
                         <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Injected</div>
                         <div className="text-xl font-bold text-white">{(credits?.credits_monthly ?? 0).toLocaleString()} <span className="text-[10px] font-black text-zinc-500">Credits</span></div>
                      </div>
                      <div>
                         <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">State</div>
                         <div className={`inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${pct > 90 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-[#00E599] border-[#00E599]/20'}`}>
                            {pct > 90 ? 'Depleted' : 'Nominal'}
                         </div>
                      </div>
                   </div>
                </div>

                <div className="col-span-1 md:col-span-5 md:text-right space-y-6">
                   <div className="space-y-1">
                      <div className="text-5xl font-bold text-[#00E599] tracking-tighter">{(credits?.credits_remaining ?? 0).toLocaleString()}</div>
                      <div className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Available Inference Units</div>
                   </div>
                   <div className="space-y-2">
                      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.06]">
                         <div 
                           className={`h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_6px_currentColor] ${pct > 80 ? 'bg-amber-400 text-amber-400' : 'bg-[#00E599] text-[#00E599]'}`}
                           style={{ width: `${pct}%` }}
                         />
                      </div>
                      <div className="flex justify-between text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                         <span>{pct}% Consumed</span>
                         <span>Resets in 12 days</span>
                      </div>
                   </div>
                </div>
             </div>
             <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none" aria-hidden>
                <Activity size={100} className="text-white" />
             </div>
          </div>

          {/* PRICING PLANS */}
          <div className="space-y-6">
             <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Workforce Scaling Options</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                   <Gem size={12} className="text-amber-500" />
                   <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Current:</span>
                   <span className="text-[8px] font-black text-[#00E599] uppercase tracking-widest">{currentPlan} Tier</span>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(p => (
                  <div 
                    key={p.id} 
                    className={`relative flex flex-col bg-[#0D0D11] border p-8 rounded-2xl transition-all duration-300 ${
                      p.highlight 
                      ? 'border-[#00E599] shadow-2xl' 
                      : 'border-white/[0.06] hover:border-white/10 shadow-xl'
                    }`}
                  >
                    {p.highlight && (
                      <div className="absolute top-0 right-0 px-3 py-1 bg-[#00E599] text-black text-[8px] font-black uppercase tracking-widest rounded-bl-xl shadow-[0_0_8px_rgba(0,229,153,0.4)]">
                         Standard Deploy
                      </div>
                    )}

                    <div className="space-y-6 flex-1">
                       <div className="space-y-1">
                          <h3 className="text-sm font-bold text-white uppercase tracking-widest">{p.name} Tier</h3>
                          <p className="text-[9px] font-medium text-zinc-500 uppercase tracking-[0.1em]">{p.desc}</p>
                       </div>

                       <div className="flex items-baseline gap-1 py-4 border-y border-white/[0.04]">
                          <span className="text-3xl font-bold text-white tracking-tighter">${p.price}</span>
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">/ Month</span>
                       </div>

                       <div className="space-y-3">
                          {p.features.map(f => (
                            <div key={f} className="flex items-start gap-2">
                               <Check size={12} className="text-[#00E599] mt-0.5 shrink-0" />
                               <span className="text-[10px] font-medium text-zinc-400 leading-snug">{f}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    <button 
                      className={`w-full py-3 mt-8 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all shadow-sm flex items-center justify-center gap-2 ${
                        p.highlight 
                        ? 'bg-[#00E599] text-black hover:bg-[#00E599]/90 shadow-[0_0_12px_rgba(0,229,153,0.2)]' 
                        : 'bg-white/[0.02] border border-white/[0.06] text-white hover:border-[#00E599]/30 hover:text-[#00E599]'
                      }`}
                      disabled={!!loading} 
                      onClick={() => checkout(p.id)}
                    >
                       {loading === p.id ? 'Establishing...' : <><ArrowUpRight size={14} /> Provision {p.name}</>}
                    </button>
                  </div>
                ))}
                
                {/* ENTERPRISE CARD */}
                <div className="bg-[#0D0D11] border border-white/[0.06] p-8 rounded-2xl shadow-2xl flex flex-col justify-between relative overflow-hidden group hover:border-[#00E599]/30 transition-all duration-300">
                   <div className="space-y-4 relative z-10">
                      <div className="flex items-center gap-2 text-[#00E599]">
                         <Cpu size={16} />
                         <h3 className="text-xs font-bold uppercase tracking-widest">Custom Cluster</h3>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-relaxed uppercase font-medium tracking-widest">
                         High-volume distributed architecture with dedicated neural nodes and priority inference.
                      </p>
                   </div>
                   <button onClick={() => toastSuccess('Contact initiated')} className="w-full py-3 mt-8 bg-white/[0.02] border border-white/[0.06] text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:border-white/10 hover:bg-white/[0.04] transition-all relative z-10">
                      Contact Architect
                   </button>
                   <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-all" aria-hidden>
                      <Zap size={80} className="text-[#00E599]" />
                   </div>
                </div>
             </div>
          </div>

          {/* FINANCIAL HISTORY */}
          <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden">
             <div className="p-6 border-b border-white/[0.04] flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-3">
                   <div className="w-9 h-9 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center text-white shadow-sm">
                      <History size={16} />
                   </div>
                   <div>
                      <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Economic Transaction Ledger</h3>
                      <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Audit log of resource injections</p>
                   </div>
                </div>
                <button className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:text-white transition-colors">
                   <Download size={12} /> Bulk Invoices
                </button>
             </div>
             
             <div className="divide-y divide-white/[0.03]">
                {history.length === 0 ? (
                  <div className="p-16 text-center space-y-3 opacity-20">
                     <TrendingUp size={24} className="mx-auto" />
                     <p className="text-[9px] font-black uppercase tracking-widest">No transaction history detected</p>
                  </div>
                ) : history.slice(0, 5).map((h, i) => (
                  <div key={i} className="px-8 py-4 flex items-center justify-between hover:bg-white/[0.01] transition-all group">
                     <div className="flex items-center gap-5">
                        <div className="w-10 h-10 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center text-white group-hover:bg-white/[0.04] transition-all shadow-sm">
                           {h.amount > 0 ? <Zap size={16} className="text-[#00E599]" /> : <Crown size={16} className="text-zinc-400" />}
                        </div>
                        <div>
                           <div className="text-[11px] font-bold text-white tracking-tight">{h.description}</div>
                           <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">{new Date(h.created_at).toLocaleDateString()}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-8">
                        <div className={`text-sm font-bold ${h.amount > 0 ? 'text-[#00E599]' : 'text-white'}`}>
                           {h.amount > 0 ? '+' : ''}{h.amount.toLocaleString()}
                           <span className="text-[8px] uppercase tracking-widest ml-1.5 opacity-30 font-black">Credits</span>
                        </div>
                        <ChevronRight size={14} className="text-zinc-600 group-hover:text-white transition-all" />
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
