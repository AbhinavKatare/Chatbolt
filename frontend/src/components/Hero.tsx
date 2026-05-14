'use client'
import Link from 'next/link'

export default function Hero() {
  return (
    <section className="relative pt-48 pb-32 overflow-hidden bg-[#FDFDFB]">
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-none bg-black/[0.03] border border-black/5 mb-10">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00DFB8] animate-pulse" />
            <span className="text-[10px] font-bold text-[#555555] uppercase tracking-[0.3em]">The AI Workforce for Founders</span>
          </div>
          
          <h1 className="display-title text-6xl md:text-8xl text-[#1A1A1A] mb-10 tracking-tighter leading-[0.9] glow-text">
            AI support, <br />
            <span className="text-[#00DFB8]">the smarter way.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-[#555555] max-w-2xl mb-12 font-medium leading-relaxed">
            Train once. Deploy everywhere. Handle everything. Chatbolt automates your customer operations so you can focus on building.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-6 mb-24">
            <Link href="/signup" className="btn btn-primary px-12 py-5 text-sm no-underline hover:no-underline shadow-2xl shadow-[#00DFB8]/10 shine-gradient">
              Get Started Free →
            </Link>
            <Link href="/pricing" className="btn btn-secondary px-10 py-5 text-sm no-underline hover:no-underline glass-panel">
              View Pricing
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pt-16 border-t border-black/5">
            {[
              { val: '24/7', label: 'Availability' },
              { val: '98%', label: 'Accuracy' },
              { val: '80+', label: 'Languages' },
              { val: '0s', label: 'Response Time' },
            ].map((stat, i) => (
              <div key={i} className="group">
                <div className="display-title text-3xl md:text-4xl text-[#1A1A1A] mb-2 group-hover:text-[#00DFB8] transition-colors">{stat.val}</div>
                <div className="text-[10px] font-bold text-[#444] uppercase tracking-[0.2em]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Dashboard Preview (Visual Only) */}
      <div className="hidden lg:block absolute top-48 right-0 w-1/3 h-[600px] bg-[#FFFFFF] border-l border-y border-black/5 rounded-l-2xl translate-x-12 p-8 shadow-2xl shadow-black/50 overflow-hidden group hover:translate-x-0 transition-transform duration-700 shine-gradient">
        <div className="gloss-overlay absolute inset-0 pointer-events-none" />
        <div className="flex items-center gap-2 mb-8 opacity-50">
          <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
        </div>
        <div className="space-y-6">
          <div className="h-4 bg-black/5 rounded w-1/2" />
          <div className="h-24 bg-black/[0.02] rounded w-full border border-black/5" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-black/[0.02] rounded border border-black/5" />
            <div className="h-32 bg-black/[0.02] rounded border border-black/5" />
          </div>
          <div className="h-40 bg-black/[0.02] rounded border border-black/5 flex flex-col items-center justify-center gap-3">
             <div className="w-12 h-12 rounded bg-[#00DFB8]/10 border border-[#00DFB8]/20 flex items-center justify-center text-xl">🤖</div>
             <div className="h-2 bg-[#00DFB8]/30 rounded w-1/3" />
          </div>
        </div>
      </div>
    </section>
  )
}

