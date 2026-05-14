'use client'
import { 
  Send, 
  Globe, 
  Code2, 
  Smartphone, 
  MessageCircle, 
  Copy, 
  Check, 
  ChevronRight, 
  ExternalLink, 
  ShieldCheck,
  Zap,
  Sparkles,
  Phone,
  MessageSquare
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
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-6xl w-full mx-auto p-10 space-y-12 pb-32">
        
        {/* HEADER */}
        <div className="space-y-2">
           <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
              <Rocket size={12} /> Deployment
           </div>
           <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Channel Activation</h1>
           <p className="text-[#888] text-sm">Deploy your AI workforce across web, mobile, and social channels.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
           {/* LEFT COLUMN */}
           <div className="space-y-10">
              <section className="bg-white border border-black/5 p-10 rounded-[2.5rem] shadow-xl shadow-black/5 space-y-8 relative overflow-hidden group">
                 <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center text-[#00DFB8] group-hover:bg-[#00DFB8] group-hover:text-[#1A1A1A] transition-all transform group-hover:rotate-6 shadow-sm">
                       <Globe size={24} />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-[#1A1A1A]">Website Widget</h3>
                       <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest mt-1 italic">Floating Customer Interface</p>
                    </div>
                 </div>
                 <p className="text-sm text-[#555] leading-relaxed relative z-10">
                    Copy and paste this production-ready script tag into your site's HTML to activate your AI support agent instantly.
                 </p>
                 <div className="relative group/code z-10">
                    <div className="bg-[#1A1A1A] p-8 rounded-2xl font-mono text-[11px] text-[#00DFB8] break-all border border-black shadow-inner leading-relaxed pr-16">
                       {scriptTag}
                    </div>
                    <button 
                      onClick={copy}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white border border-white/5 hover:border-black rounded-xl flex items-center justify-center transition-all text-white/40 hover:text-black shadow-lg backdrop-blur-md"
                    >
                       {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    </button>
                 </div>
                 
                 <div className="flex items-center gap-3 pt-4 opacity-60">
                    <ShieldCheck size={14} className="text-green-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#1A1A1A]">CDN Optimized · SSL Secure</span>
                 </div>
                 
                 {/* Background Glow */}
                 <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-[#00DFB8]/5 rounded-full blur-3xl -z-0" />
              </section>

              <section className="bg-white border border-black/5 p-10 rounded-[2.5rem] shadow-xl shadow-black/5 space-y-8 group transition-all hover:border-[#00DFB8]/30">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center text-[#25D366] group-hover:bg-[#25D366] group-hover:text-white transition-all transform group-hover:-rotate-6 shadow-sm">
                       <MessageCircle size={24} />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-[#1A1A1A]">WhatsApp Bridge</h3>
                       <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest mt-1 italic">Direct Social Engagement</p>
                    </div>
                 </div>
                 <p className="text-sm text-[#555] leading-relaxed">
                    Connect your Twilio or WhatsApp Business API account to handle messages automatically via Chatbolt orchestration.
                 </p>
                 <button className="w-full py-5 border-2 border-dashed border-black/5 text-[#888] text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:border-[#25D366] hover:text-[#25D366] transition-all bg-black/[0.01]">
                    Configure WhatsApp Integration
                 </button>
              </section>
           </div>

           {/* RIGHT COLUMN */}
           <div className="space-y-10">
              <section className="bg-white border border-black/5 p-10 rounded-[2.5rem] shadow-xl shadow-black/5 space-y-8 group">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white transition-all transform group-hover:rotate-12 shadow-sm">
                       <Code2 size={24} />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-[#1A1A1A]">Headless API</h3>
                       <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest mt-1 italic">Custom Infrastructure</p>
                    </div>
                 </div>
                 <p className="text-sm text-[#555] leading-relaxed">
                    Use our REST API to build custom experiences, mobile apps, or integrate agent logic into your existing internal tools.
                 </p>
                 <button className="flex items-center justify-center gap-3 w-full py-5 bg-[#1A1A1A] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-black transition-all">
                    Generate API Keys <ChevronRight size={16} />
                 </button>
              </section>

              <div className="bg-[#1A1A1A] p-10 rounded-[2.5rem] shadow-2xl space-y-8 relative overflow-hidden border border-black">
                 <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3 text-[#00DFB8]">
                       <Sparkles size={20} />
                       <h3 className="text-sm font-black uppercase tracking-widest">Premium Support</h3>
                    </div>
                    <p className="text-sm text-[#888] leading-relaxed font-medium">
                       Deploying across complex infrastructure? Our enterprise implementation specialists can handle your custom integration needs.
                    </p>
                    <div className="space-y-4 pt-4">
                       <button className="flex items-center gap-3 text-[10px] font-black text-white uppercase tracking-[0.2em] border-b-2 border-[#00DFB8] pb-1 hover:text-[#00DFB8] transition-colors">
                          Book Implementation Call <ExternalLink size={14} />
                       </button>
                    </div>
                 </div>
                 
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#00DFB8]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              </div>

              <div className="bg-white border border-black/5 p-8 rounded-3xl shadow-xl shadow-black/5 flex items-center gap-6">
                 <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                    <Phone size={24} />
                 </div>
                 <div>
                    <h4 className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-widest">Voice Engine Beta</h4>
                    <p className="text-[10px] text-[#888] font-bold leading-relaxed mt-1">
                       Deploy voice-enabled agents via Twilio Voice. <span className="text-[#00DFB8] cursor-pointer">Request Access →</span>
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}

function Rocket({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3" />
      <path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5" />
      <line x1="10" x2="8" y1="10" y2="8" />
    </svg>
  )
}
