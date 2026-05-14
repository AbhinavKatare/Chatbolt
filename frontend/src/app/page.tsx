'use client'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import TrustedBy from '@/components/TrustedBy'
import ProductShowcase from '@/components/ProductShowcase'
import AutopilotShowcase from '@/components/AutopilotShowcase'
import Testimonials from '@/components/Testimonials'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'

export default function HomePage() {
  return (
    <div className="bg-[#FDFDFB] min-h-screen selection:bg-[#00DFB8] selection:text-[#FDFDFB]">
      <Navbar />
      <main>
        <Hero />
        <TrustedBy />
        
        {/* Interactive Platform Showcase */}
        <ProductShowcase />
        
        <AutopilotShowcase />
        
        {/* Social Proof Numbers Section */}
        <section className="py-24 bg-[#FFFFFF] border-y border-black/5">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-12">
              {[
                { val: '10,000+', label: 'Businesses' },
                { val: '94%', label: 'Resolution Rate' },
                { val: '₹0', label: 'Cost/Message' },
                { val: '30 min', label: 'Setup Time' },
                { val: '80+', label: 'Languages' },
                { val: '24/7', label: 'Always On' }
              ].map((stat, i) => (
                <div key={i} className="text-center group">
                  <div className="display-title text-3xl md:text-4xl text-[#1A1A1A] mb-2 group-hover:text-[#00DFB8] transition-colors">{stat.val}</div>
                  <div className="text-[10px] font-bold text-[#444] uppercase tracking-[0.2em]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}

