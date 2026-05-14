'use client'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import HowItWorks from '@/components/HowItWorks'
import FinalCTA from '@/components/FinalCTA'

export default function HowItWorksPage() {
  return (
    <div className="bg-[#FDFDFB] min-h-screen">
      <Navbar />
      <main className="pt-32">
        <section className="py-24 px-6 border-b border-black/5">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.4em] mb-6">The Methodology</div>
            <h1 className="display-title text-5xl md:text-7xl text-[#1A1A1A] mb-8 tracking-tighter">Automate complexity in three simple steps.</h1>
            <p className="text-xl text-[#555555] font-medium leading-relaxed max-w-2xl mx-auto">
              Our architecture is designed to handle high-volume business data while maintaining precision and speed.
            </p>
          </div>
        </section>

        <HowItWorks />
        
        {/* Technical Architecture Section */}
        <section className="py-24 px-6 bg-[#FFFFFF]">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <div className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.4em] mb-6">Technical Architecture</div>
              <h2 className="display-title text-4xl text-[#1A1A1A] mb-6">Powered by Chatbolt Proprietary Models</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { t: 'Ingestion', d: 'Securely upload PDFs, CSVs, or crawl your website. Data is vectorized using high-performance embedding models.' },
                { t: 'Retrieval', d: 'Our semantic search engine finds the most relevant information for every query in milliseconds.' },
                { t: 'Generation', d: 'Our context-aware proprietary AI models synthesize the perfect response, grounded in your business knowledge base.' }
              ].map((item, i) => (
                <div key={i} className="card p-10 glass-panel">
                  <div className="text-[10px] font-black text-[#00DFB8] uppercase tracking-[0.3em] mb-6">Phase 0{i + 1}</div>
                  <h3 className="display-title text-xl text-[#1A1A1A] mb-4">{item.t}</h3>
                  <p className="text-[11px] text-[#555555] leading-relaxed font-bold uppercase tracking-widest">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}

