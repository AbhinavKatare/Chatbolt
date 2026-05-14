'use client'
import Navbar from '@/components/Navbar'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'

export default function PricingPage() {
  return (
    <div className="bg-[#FDFDFB] min-h-screen">
      <Navbar />
      <main className="pt-24">
        <div className="container mx-auto px-6 py-24 text-center">
          <h1 className="display-title text-5xl md:text-8xl text-[#1A1A1A] mb-8 tracking-tighter">
            Pricing that <span className="text-[#00DFB8]">scales.</span>
          </h1>
          <p className="text-xl text-[#555555] max-w-2xl mx-auto font-medium">
            Transparent, predictable pricing for teams of all sizes. No hidden fees.
          </p>
        </div>
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}

