'use client'
import { 
  Globe, 
  Code2, 
  MessageCircle, 
  Copy, 
  Check, 
  ChevronRight, 
  ShieldCheck,
  Zap,
  Sparkles,
  Phone,
  Rocket,
  Search,
  ExternalLink,
  Cpu,
  Activity,
  Server
} from 'lucide-react'
import { useState } from 'react'

export default function DeployPage() {
  const [copied, setCopied] = useState(false)
  const scriptTag = `<script src="https://cdn.chatbolt.ai/widget.js" data-id="agent_123"></script>`

  const copy = () => {
    navigator.clipboard.writeText(scriptTag)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <Server size={14} className="text-[#00DFB8]" /> Environment Manager
           </div>
           <div className="h-4 w-px bg-black/[0.05]" />
           <div className="flex items-center gap-4">
              <button className="text-[10px] font-bold text-black uppercase tracking-widest border-b border-black">Production</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Staging</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Edge Hooks</button>
           </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-black text-gray-300 uppercase tracking-widest">
           <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#00DFB8]" /> All Systems Operational</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-8 py-10 space-y-10">
          
          <div className="flex justify-between items-end">
             <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-bold uppercase tracking-widest">
                   <Rocket size={10} /> Active Deployment
                </div>
                <h1 className="text-3xl font-semibold text-[#1A1A1A] tracking-tight">Channel Activation</h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest max-w-xl leading-relaxed">
                   Provision your AI workforce across web, mobile, and social endpoints via secure orchestration tunnels.
                </p>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* LEFT COLUMN: PRIMARY CHANNELS */}
            <div className="lg:col-span-7 space-y-8">
              <section className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-6 group">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-gray-50 border border-black/[0.03] rounded-xl flex items-center justify-center text-[#00DFB8]">
                          <Globe size={20} />
                       </div>
                       <div>
                          <h3 className="text-xs font-bold text-[#1A1A1A]">Website Runtime</h3>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Floating CDN Interface</p>
                       </div>
                    </div>
                    <div className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[8px] font-black uppercase tracking-widest">Live</div>
                 </div>

                 <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                    Integrate the production runtime script into your application's root manifest. This provides a direct tunnel to your agent workforce.
                 </p>

                 <div className="relative group/code">
                    <div className="bg-[#1A1A1A] p-6 rounded-xl font-mono text-[11px] text-[#00DFB8] break-all border border-black shadow-inner leading-relaxed pr-12">
                       {scriptTag}
                    </div>
                    <button 
                      onClick={copy}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/5 hover:bg-white border border-white/5 hover:border-black rounded-lg flex items-center justify-center transition-all text-white/40 hover:text-black shadow-sm"
                    >
                       {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                 </div>
                 
                 <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-1.5 text-[8px] font-black text-gray-300 uppercase tracking-[0.2em]">
                       <ShieldCheck size={10} className="text-[#00DFB8]" /> SSL Verified
                    </div>
                    <div className="flex items-center gap-1.5 text-[8px] font-black text-gray-300 uppercase tracking-[0.2em]">
                       <Zap size={10} className="text-[#00DFB8]" fill="currentColor" /> CDN Optimized
                    </div>
                 </div>
              </section>

              <section className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-6 group opacity-75 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-gray-50 border border-black/[0.03] rounded-xl flex items-center justify-center text-[#25D366]">
                          <MessageCircle size={20} />
                       </div>
                       <div>
                          <h3 className="text-xs font-bold text-[#1A1A1A]">WhatsApp Bridge</h3>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Direct Social Orchestration</p>
                       </div>
                    </div>
                 </div>

                 <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                    Bridge your autonomous units with WhatsApp Business API. Handle conversations via the centralized workforce logic.
                 </p>

                 <button className="w-full py-4 border-2 border-dashed border-black/[0.03] text-gray-300 text-[9px] font-black uppercase tracking-[0.3em] rounded-xl hover:border-[#25D366] hover:text-[#25D366] transition-all bg-black/[0.01]">
                    Establish Social Bridge
                 </button>
              </section>
            </div>

            {/* RIGHT COLUMN: INFRASTRUCTURE & API */}
            <div className="lg:col-span-5 space-y-8">
              <section className="bg-white border border-black/[0.03] p-8 rounded-2xl shadow-sm space-y-6 group">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-50 border border-black/[0.03] rounded-xl flex items-center justify-center text-[#1A1A1A]">
                       <Code2 size={20} />
                    </div>
                    <div>
                       <h3 className="text-xs font-bold text-[#1A1A1A]">Headless SDK</h3>
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Core Infrastructure API</p>
                    </div>
                 </div>

                 <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                    Integrate agent logic directly into your internal tooling or mobile applications via our secure REST endpoints.
                 </p>

                 <button className="flex items-center justify-center gap-2 w-full py-4 bg-[#1A1A1A] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-black transition-all active:scale-[0.98]">
                    Generate API Credentials <ChevronRight size={14} />
                 </button>
              </section>

              <div className="bg-[#1A1A1A] p-8 rounded-2xl shadow-xl space-y-6 border border-black relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Sparkles size={80} className="text-white" />
                 </div>
                 <div className="flex items-center gap-2 text-[#00DFB8]">
                    <Activity size={16} />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Enterprise Guard</h3>
                 </div>
                 <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                    Deploying across distributed corporate infrastructure? Our implementation architects provide high-fidelity integration support.
                 </p>
                 <button className="flex items-center gap-2 text-[9px] font-black text-[#00DFB8] uppercase tracking-[0.2em] border-b border-[#00DFB8]/30 pb-0.5 hover:border-[#00DFB8] transition-all">
                    Request Implementation Audit <ExternalLink size={12} />
                 </button>
              </div>

              <div className="bg-white border border-black/[0.03] p-6 rounded-2xl shadow-sm flex items-center gap-5 grayscale opacity-60">
                 <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
                    <Phone size={18} />
                 </div>
                 <div className="space-y-0.5">
                    <h4 className="text-[9px] font-black text-[#1A1A1A] uppercase tracking-widest">Voice Protocol Beta</h4>
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
                       Coming to <span className="text-black">Twilio / SIP</span>
                    </p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
