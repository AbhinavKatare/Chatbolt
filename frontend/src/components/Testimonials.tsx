'use client'

export default function Testimonials() {
  const testimonials = [
    {
      name: 'Priya Menon',
      role: 'Founder, GlowBox India',
      quote: 'Chatbolt handled 80% of our WhatsApp queries in the first week. The lead qualifier is a game changer for D2C brands.',
      date: 'Jan 2025'
    },
    {
      name: 'Arjun Kapoor',
      role: 'CTO, ShipDash',
      quote: 'The accuracy of the RAG pipeline is remarkable. It handles complex logistics questions better than our human team.',
      date: 'Jan 2025'
    },
    {
      name: 'Sneha Rathore',
      role: 'Head of Ops, UrbanFit',
      quote: 'Setting up 5 agents at once with the autopilot feature saved us months of work. Highly recommended for any scaling startup.',
      date: 'Jan 2025'
    }
  ]

  return (
    <section id="testimonials" className="py-40 bg-[#FDFDFB] relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="mb-32">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 border border-[#00DFB8]/20 mb-8">
            <span className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.3em]">Success Stories</span>
          </div>
          <h2 className="display-title text-4xl md:text-7xl text-[#1A1A1A] mb-10 tracking-tighter leading-none">
            Scale without <br /><span className="text-[#00DFB8]">scaling headcount.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {testimonials.map((t, i) => (
            <div key={i} className="p-12 bg-[#FFFFFF] border border-black/5 hover:border-[#00DFB8]/30 transition-all group flex flex-col justify-between">
              <div>
                <div className="flex gap-1 mb-8">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="16" height="16" viewBox="0 0 14 14" fill="#00DFB8">
                      <path d="M7 1L8.854 4.757L13 5.364L10 8.286L10.708 12.414L7 10.463L3.292 12.414L4 8.286L1 5.364L5.146 4.757L7 1Z" />
                    </svg>
                  ))}
                </div>
                <p className="text-xl text-[#1A1A1A] leading-relaxed font-medium mb-12 italic">
                  "{t.quote}"
                </p>
              </div>
              
              <div className="pt-8 border-t border-black/5">
                <div className="text-[#1A1A1A] font-bold text-base tracking-tight">{t.name}</div>
                <div className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] mt-1">{t.role}</div>
                <div className="text-[9px] font-bold text-[#00DFB8] uppercase tracking-[0.3em] mt-4">{t.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

