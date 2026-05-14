'use client'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Features from '@/components/Features'
import FinalCTA from '@/components/FinalCTA'

export default function FeaturesPage() {
  return (
    <div className="bg-[#FDFDFB] min-h-screen">
      <Navbar />
      <main className="pt-32">
        <section className="py-24 px-6 border-b border-black/5">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.4em] mb-6">Core Capabilities</div>
            <h1 className="display-title text-5xl md:text-7xl text-[#1A1A1A] mb-8 tracking-tighter">Everything you need to automate your customer operations.</h1>
            <p className="text-xl text-[#555555] font-medium leading-relaxed max-w-2xl mx-auto">
              Chatbolt connects your business data to high-performance AI models, creating a seamless bridge between customer needs and resolution.
            </p>
          </div>
        </section>

        <Features />
        
        {/* Deep Dive Section */}
        <section className="py-24 px-6 bg-[#FFFFFF]">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <div className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.4em] mb-6">Data Sovereignty</div>
                <h2 className="display-title text-4xl text-[#1A1A1A] mb-6">Your data. Your rules.</h2>
                <p className="text-sm-muted mb-8">
                  Unlike general-purpose chatbots, Chatbolt agents are strictly grounded in your provided knowledge base. We use advanced RAG (Retrieval-Augmented Generation) to ensure every response is accurate, cited, and safe.
                </p>
                <div className="space-y-4">
                  {[
                    'End-to-end encryption for all uploaded documents',
                    'Customizable system prompts for persona control',
                    'Real-time citation tracking for every answer',
                    'Automatic PII masking for sensitive conversations'
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 bg-[#00DFB8] rounded-full" />
                      <span className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-widest">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-1 shine-gradient">
                <div className="bg-[#FDFDFB] p-12 h-full">
                  <div className="flex flex-col gap-8">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-6 animate-fade-in" style={{ animationDelay: `${i * 0.2}s` }}>
                        <div className="w-10 h-10 bg-black/5 border border-black/10 flex items-center justify-center text-xs font-bold text-[#00DFB8]">0{i}</div>
                        <div className="flex-1 space-y-2">
                          <div className="h-2 bg-black/10 w-1/3 rounded-full" />
                          <div className="h-2 bg-black/5 w-full rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}

