'use client'
import Link from 'next/link'

export default function AutopilotShowcase() {
  const agents = [
    { 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ), 
      name: 'Customer Support', 
      desc: 'Instant resolutions 24/7' 
    },
    { 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>
        </svg>
      ), 
      name: 'Lead Qualifier', 
      desc: 'Automatic data extraction' 
    },
    { 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>
        </svg>
      ), 
      name: 'Outreach Manager', 
      desc: 'Personalized WhatsApp campaigns' 
    },
    { 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ), 
      name: 'Booking Agent', 
      desc: 'Handles every appointment' 
    },
    { 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
        </svg>
      ), 
      name: 'Ops Intelligence', 
      desc: 'Daily business reporting' 
    }
  ]

  return (
    <section className="py-40 bg-[#FDFDFB] relative overflow-hidden border-y border-black/5">
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-32">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 border border-[#00DFB8]/20 mb-8">
            <span className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.3em]">Business Autopilot</span>
          </div>
          <h2 className="display-title text-4xl md:text-7xl text-[#1A1A1A] mb-8 tracking-tighter leading-none">
            One form. <span className="text-[#00DFB8]">Five agents.</span>
          </h2>
          <p className="text-xl text-[#555555] font-medium leading-relaxed max-w-2xl mx-auto">
            Tell Chatbolt about your business. We automatically generate a fleet of 5 specialized agents that handle your entire customer lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          {/* Mock Form Visual */}
          <div className="p-12 bg-[#FFFFFF] border border-black/5 relative group">
            <div className="absolute -top-px -left-px w-12 h-px bg-[#00DFB8]" />
            <div className="absolute -top-px -left-px w-px h-12 bg-[#00DFB8]" />
            
            <div className="space-y-10">
              <div>
                <label className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] block mb-4">We are a...</label>
                <div className="p-5 bg-black/[0.02] border border-black/5 text-sm text-[#555555] font-medium tracking-tight">
                  "SaaS company in the fintech space"
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] block mb-4">Our goals...</label>
                <div className="p-5 bg-black/[0.02] border border-black/5 text-sm text-[#555555] font-medium tracking-tight">
                  "Onboard users, handle support, and book sales calls"
                </div>
              </div>
              <button className="w-full bg-[#00DFB8] text-[#FDFDFB] py-5 font-bold uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-black">
                Deploy AI Workforce
              </button>
            </div>
          </div>

          {/* Generated Agents List */}
          <div className="grid grid-cols-1 gap-4">
            {agents.map((agent, i) => (
              <div key={i} className="flex items-center gap-6 p-6 bg-black/[0.01] border border-black/5 hover:border-[#00DFB8]/40 transition-all group cursor-default">
                <div className="w-14 h-14 bg-black/[0.03] border border-black/10 flex items-center justify-center text-[#00DFB8] group-hover:bg-[#00DFB8] group-hover:text-[#FDFDFB] transition-all">
                  {agent.icon}
                </div>
                <div>
                  <h4 className="text-[#1A1A1A] font-bold text-base tracking-tight mb-1">{agent.name}</h4>
                  <p className="text-[10px] text-[#444] font-bold uppercase tracking-[0.2em]">{agent.desc}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00DFB8] animate-pulse" />
                  <span className="text-[9px] font-bold text-[#00DFB8] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

