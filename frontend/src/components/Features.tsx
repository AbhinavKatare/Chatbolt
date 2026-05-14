'use client'

export default function Features() {
  const features = [
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/>
        </svg>
      ),
      tag: 'KNOWLEDGE BASE',
      title: 'Train on your data',
      body: 'Upload PDFs, paste URLs, or connect your helpdesk. Chatbolt learns your business in minutes with absolute accuracy.'
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
      tag: 'CHANNELS',
      title: 'Deploy everywhere',
      body: 'Plug into WhatsApp, Slack, Zendesk, and your website with a single click. Your agent works where your customers are.'
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      tag: 'AUTOMATION',
      title: 'Take real actions',
      body: 'Update orders, issue refunds, and book appointments. Chatbolt agents don\'t just talk — they perform actual work.'
    }
  ]

  return (
    <section id="features" className="py-40 bg-[#FDFDFB] relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mb-32">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 border border-[#00DFB8]/20 mb-8">
            <span className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.3em]">Core Features</span>
          </div>
          <h2 className="display-title text-4xl md:text-7xl text-[#1A1A1A] mb-8 tracking-tighter leading-none">
            Everything you need <br /> to <span className="text-[#00DFB8]">automate support.</span>
          </h2>
          <p className="text-xl text-[#555555] font-medium leading-relaxed max-w-2xl">
            A complete suite of AI tools designed to handle every customer touchpoint with zero manual effort.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {features.map((f, i) => (
            <div key={i} className="p-12 bg-[#FFFFFF] border border-black/5 hover:border-[#00DFB8]/30 transition-all group">
              <div className="text-[#00DFB8] mb-10 group-hover:scale-110 transition-transform duration-300 inline-block">
                {f.icon}
              </div>
              <div className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] mb-4">{f.tag}</div>
              <h3 className="text-2xl font-bold text-[#1A1A1A] mb-6 tracking-tight">{f.title}</h3>
              <p className="text-[#555555] text-sm font-medium leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

