import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function ResourcesPage() {
  const resources = [
    { type: 'Guide', title: 'The 2024 AI Safety Report', date: 'March 12, 2024' },
    { type: 'Case Study', title: 'Scaling Moderation at GlobeX', date: 'February 28, 2024' },
    { type: 'Technical', title: 'Implementing RAG for Support', date: 'January 15, 2024' },
    { type: 'Video', title: 'Platform Walkthrough v2.0', date: 'December 10, 2023' }
  ]

  return (
    <main className="min-h-screen">
      <Navbar />
      
      <section className="pt-40 pb-24 border-b border-black/5">
        <div className="container mx-auto px-6">
          <div className="badge mb-8">Knowledge Base</div>
          <h1 className="display-title text-6xl md:text-7xl tracking-tighter mb-8">
            Expert <span className="text-[#00DFB8]">Insights</span> <br /> & Documentation
          </h1>
          <p className="text-[#555555] text-xl max-w-2xl leading-relaxed">
            Stay updated with the latest in AI trust and safety. Expert analysis, technical documentation, and customer success stories.
          </p>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="space-y-4">
            {resources.map((r) => (
              <div key={r.title} className="card p-8 flex flex-col md:flex-row items-center justify-between group hover:bg-black/[0.02] transition-all cursor-pointer">
                <div className="flex items-center gap-8 mb-4 md:mb-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#444] w-24">{r.type}</span>
                  <h3 className="display-title text-xl text-[#1A1A1A] group-hover:text-[#00DFB8] transition-colors">{r.title}</h3>
                </div>
                <div className="flex items-center gap-8">
                  <span className="text-xs text-[#444] font-mono">{r.date}</span>
                  <div className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center group-hover:border-[#00DFB8]/40 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#1A1A1A] group-hover:text-[#00DFB8] transition-colors">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

