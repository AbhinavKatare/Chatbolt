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
  Bot
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
    desc: 'Serious automation for professionals.'
  },
  { 
    id: 'premium', 
    name: 'Premium', 
    price: 59, 
    credits: '10,000', 
    agents: 10, 
    features: ['10 Elite Agents', '10,000 Neural Credits/mo', 'Custom Workflow Builder', 'Full API & Webhooks', 'Team Collaboration (3 seats)', 'Dedicated Success Manager'],
    desc: 'The ultimate AI workforce for businesses.'
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
    } catch (err: any) { alert(err.message) }
    finally { setLoading('') }
  }

  async function openPortal() {
    try {
      const r = await api.billing.portal()
      window.location.href = r.url
    } catch (err: any) { alert(err.message) }
  }

  const currentPlan = credits?.plan || tenant?.plan || 'hobby'
  const used = (credits?.credits_monthly || 500) - (credits?.credits_remaining || 0)
  const pct = Math.min(100, Math.round((used / (credits?.credits_monthly || 500)) * 100))

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-6xl w-full mx-auto p-10 space-y-12 pb-32">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
           <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                <CreditCard size={12} /> Subscription
              </div>
              <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Billing & Plans</h1>
              <p className="text-[#888] text-sm">Scale your AI workforce and manage your neural resources.</p>
           </div>
           <button 
             onClick={openPortal}
             className="px-8 py-4 bg-white border border-black/5 text-[#1A1A1A] rounded-2xl shadow-sm hover:border-black transition-all text-[11px] font-black uppercase tracking-widest"
           >
              Customer Portal
           </button>
        </div>

        {/* RESOURCE UTILIZATION CARD */}
        <div className="bg-white border border-black/5 p-10 rounded-[2.5rem] shadow-xl shadow-black/5 overflow-hidden relative group">
           <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
              <div className="space-y-6 max-w-md">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-[#1A1A1A]">
                       <PieChart size={20} />
                    </div>
                    <h3 className="text-xl font-black text-[#1A1A1A]">Neural Resource Utilization</h3>
                 </div>
                 <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest leading-relaxed">
                    Your monthly credit allotment fuels agent inference and knowledge processing. Resets automatically every 30 days.
                 </p>
                 <div className="flex gap-8">
                    <div>
                       <div className="text-[10px] font-black text-[#888] uppercase tracking-widest mb-1">Consumed</div>
                       <div className="text-2xl font-black text-[#1A1A1A]">{used.toLocaleString()} <span className="text-[10px] text-[#888]">Credits</span></div>
                    </div>
                    <div>
                       <div className="text-[10px] font-black text-[#888] uppercase tracking-widest mb-1">Status</div>
                       <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${pct > 90 ? 'bg-red-50 text-red-500' : 'bg-[#00DFB8]/10 text-[#00DFB8]'}`}>
                          {pct > 90 ? 'Near Limit' : 'Stable'}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="flex-1 w-full lg:w-auto text-right space-y-6">
                 <div className="space-y-1">
                    <div className="text-6xl font-black text-[#00DFB8] tracking-tighter">{(credits?.credits_remaining ?? 0).toLocaleString()}</div>
                    <div className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-[0.2em]">Available Credits</div>
                 </div>
                 <div className="space-y-3">
                    <div className="h-4 bg-[#FAFAFA] rounded-full overflow-hidden border border-black/5 shadow-inner">
                       <div 
                         className={`h-full transition-all duration-1000 ease-out relative ${pct > 80 ? 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'bg-[#00DFB8] shadow-[0_0_15px_rgba(0,223,184,0.3)]'}`}
                         style={{ width: `${pct}%` }}
                       >
                          <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-white/20 to-transparent" />
                       </div>
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-[#888] uppercase tracking-widest">
                       <span>{pct}% Consumed</span>
                       <span>{(credits?.credits_monthly ?? 0).toLocaleString()} Max</span>
                    </div>
                 </div>
              </div>
           </div>
           
           {/* Decorative Background Element */}
           <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-[#00DFB8]/5 rounded-full blur-3xl -z-0 transition-all group-hover:bg-[#00DFB8]/10" />
        </div>

        {/* PRICING PLANS */}
        <div className="space-y-10">
           <div className="flex items-center justify-between border-b border-black/5 pb-8">
              <div>
                 <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tight">Scale Your Workforce</h2>
                 <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest mt-1">Select the tier that matches your operational volume.</p>
              </div>
              <div className="flex items-center gap-3 px-6 py-2 bg-white border border-black/5 rounded-2xl shadow-sm">
                 <Gem size={14} className="text-amber-500" />
                 <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">Active Plan:</span>
                 <span className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest">{currentPlan}</span>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {plans.map(p => (
                <div 
                  key={p.id} 
                  className={`relative flex flex-col bg-white border p-10 rounded-[2.5rem] transition-all overflow-hidden ${
                    p.highlight 
                    ? 'border-[#00DFB8] shadow-2xl shadow-[#00DFB8]/10 ring-4 ring-[#00DFB8]/5' 
                    : 'border-black/5 hover:border-black/10 shadow-xl shadow-black/5'
                  }`}
                >
                  {p.highlight && (
                    <div className="absolute top-0 right-0 px-6 py-2 bg-[#00DFB8] text-[#1A1A1A] text-[9px] font-black uppercase tracking-[0.2em] rounded-bl-2xl">
                       Most Deployed
                    </div>
                  )}

                  <div className="space-y-6 mb-10 flex-1">
                     <div className="space-y-1">
                        <h3 className="text-2xl font-black text-[#1A1A1A] tracking-tight">{p.name}</h3>
                        <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest italic">{p.desc}</p>
                     </div>

                     <div className="flex items-baseline gap-2 py-4 border-y border-black/5">
                        <span className="text-5xl font-black text-[#1A1A1A] tracking-tighter">${p.price}</span>
                        <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">/ Month</span>
                     </div>

                     <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-xl bg-[#FAFAFA] flex items-center justify-center text-[#1A1A1A]">
                              <Zap size={14} />
                           </div>
                           <div className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-widest">{p.credits.toLocaleString()} Credits</div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-xl bg-[#FAFAFA] flex items-center justify-center text-[#1A1A1A]">
                              <Bot size={14} />
                           </div>
                           <div className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-widest">{p.agents} Specialized Agent{p.agents > 1 ? 's' : ''}</div>
                        </div>
                     </div>

                     <div className="space-y-4 pt-8">
                        {p.features.map(f => (
                          <div key={f} className="flex items-start gap-3">
                             <Check size={14} className="text-[#00DFB8] mt-0.5 shrink-0" />
                             <span className="text-[11px] font-medium text-[#555] leading-snug">{f}</span>
                          </div>
                        ))}
                     </div>
                  </div>

                  {currentPlan === p.id ? (
                    <button 
                      className="w-full py-5 bg-[#FAFAFA] border border-black/5 text-[#1A1A1A] rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-sm hover:border-black transition-all"
                      onClick={openPortal}
                    >
                       Current Plan Settings
                    </button>
                  ) : (
                    <button 
                      className={`w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-xl flex items-center justify-center gap-3 group ${
                        p.highlight 
                        ? 'bg-[#1A1A1A] text-white hover:bg-black' 
                        : 'bg-white border border-black/5 text-[#1A1A1A] hover:border-black'
                      }`}
                      disabled={!!loading} 
                      onClick={() => checkout(p.id)}
                    >
                       {loading === p.id ? 'Processing...' : <><ArrowUpRight size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" /> Upgrade Tier</>}
                    </button>
                  )}
                </div>
              ))}
           </div>
        </div>

        {/* FINANCIAL HISTORY */}
        <div className="bg-white border border-black/5 rounded-[2.5rem] shadow-xl shadow-black/5 overflow-hidden">
           <div className="p-8 border-b border-black/5 flex items-center justify-between bg-[#FAFAFA]/50">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center text-[#1A1A1A] shadow-sm">
                    <History size={20} />
                 </div>
                 <div>
                    <h3 className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-[0.2em]">Financial Audit Log</h3>
                    <p className="text-[9px] font-bold text-[#888] uppercase mt-0.5">Recent transactions and resource injections</p>
                 </div>
              </div>
              <button className="text-[10px] font-black text-[#888] uppercase tracking-widest hover:text-[#1A1A1A] transition-colors">Download Invoices</button>
           </div>
           
           <div className="divide-y divide-black/5">
              {history.length === 0 ? (
                <div className="p-20 text-center space-y-4 italic opacity-40">
                   <TrendingUp size={32} className="mx-auto text-gray-200" />
                   <p className="text-[10px] font-black uppercase tracking-widest text-[#888]">No financial history available yet</p>
                </div>
              ) : history.slice(0, 10).map((h, i) => (
                <div key={i} className="p-8 flex items-center justify-between hover:bg-[#FAFAFA] transition-all group">
                   <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center text-[#1A1A1A] group-hover:bg-white transition-all shadow-sm">
                         {h.amount > 0 ? <Zap size={18} /> : <Crown size={18} />}
                      </div>
                      <div>
                         <div className="text-sm font-black text-[#1A1A1A] tracking-tight">{h.description}</div>
                         <div className="text-[9px] font-black text-[#888] uppercase tracking-[0.1em] mt-1">{new Date(h.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
                      </div>
                   </div>
                   <div className="flex items-center gap-8">
                      <div className={`text-xl font-black ${h.amount > 0 ? 'text-[#00DFB8]' : 'text-[#1A1A1A]'}`}>
                         {h.amount > 0 ? '+' : ''}{h.amount.toLocaleString()}
                         <span className="text-[9px] uppercase tracking-widest ml-2 opacity-50 font-bold">Credits</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-200 group-hover:text-black transition-all" />
                   </div>
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  )
}
