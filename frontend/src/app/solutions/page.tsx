'use client'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import FinalCTA from '@/components/FinalCTA'

export default function SolutionsPage() {
  const industries = [
    { title: 'E-commerce', desc: '5 pre-built templates. Handle order tracking, returns, and product queries across Website and WhatsApp.', icon: '🛍️' },
    { title: 'SaaS', desc: '6 pre-built templates. Automate technical support, documentation search, and feature explanation for your users.', icon: '⚙️' },
    { title: 'Healthcare', desc: '10 pre-built templates. Automate appointment booking and answer common patient queries securely.', icon: '🏥' },
    { title: 'Legal', desc: '5 pre-built templates. Process client intakes and answer procedural questions grounded in your firm\'s knowledge base.', icon: '⚖️' },
    { title: 'Real Estate', desc: '8 pre-built templates. Qualify leads for properties and book viewing appointments automatically.', icon: '🏠' },
    { title: 'Education', desc: '3 pre-built templates. Handle student admissions, course FAQs, and support across multiple languages.', icon: '🎓' }
  ]

  return (
    <div className="bg-[#FDFDFB] min-h-screen">
      <Navbar />
      <main className="pt-24">
        <section className="py-32">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mb-24">
              <div className="inline-flex items-center gap-3 px-3 py-1 bg-[#00DFB8]/10 border border-[#00DFB8]/20 mb-8">
                <span className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.3em]">Solutions</span>
              </div>
              <h1 className="display-title text-5xl md:text-8xl text-[#1A1A1A] mb-10 tracking-tighter leading-none">
                Built for <span className="text-[#00DFB8]">every industry.</span>
              </h1>
              <p className="text-xl text-[#555555] font-medium leading-relaxed">
                Chatbolt is designed to be industry-agnostic. Whether you sell physical products or complex software, our RAG-powered agents learn your specific business logic in minutes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {industries.map((industry) => (
                <div key={industry.title} className="p-10 bg-[#FFFFFF] border border-black/5 hover:border-[#00DFB8]/30 transition-all group">
                  <div className="text-4xl mb-8 group-hover:scale-110 transition-transform duration-300">{industry.icon}</div>
                  <h3 className="text-2xl font-bold text-[#1A1A1A] mb-4 tracking-tight">{industry.title}</h3>
                  <p className="text-[#555555] text-sm font-medium leading-relaxed mb-8">
                    {industry.desc}
                  </p>
                  <button className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.3em] hover:text-[#1A1A1A] transition-colors">
                    Learn more →
                  </button>
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

