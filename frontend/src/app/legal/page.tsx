'use client'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function LegalPage() {
  return (
    <div className="bg-[#FDFDFB] min-h-screen">
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.4em] mb-6">Legal Framework</div>
          <h1 className="display-title text-5xl text-[#1A1A1A] mb-16 tracking-tighter">Privacy & Terms</h1>
          
          <div className="space-y-16">
            <section>
              <h2 className="text-[#1A1A1A] text-xl font-bold mb-6 uppercase tracking-widest">Privacy Policy</h2>
              <div className="prose prose-invert max-w-none text-[#555555] text-sm leading-relaxed space-y-4">
                <p>At Chatbolt, we take your data privacy seriously. This policy outlines how we collect, use, and protect your information when you use our AI customer support platform.</p>
                <p>We do not sell your data to third parties. All business documents uploaded for agent training are encrypted and used solely for your specific agents.</p>
              </div>
            </section>

            <section>
              <h2 className="text-[#1A1A1A] text-xl font-bold mb-6 uppercase tracking-widest">Terms of Service</h2>
              <div className="prose prose-invert max-w-none text-[#555555] text-sm leading-relaxed space-y-4">
                <p>By using Chatbolt, you agree to comply with our acceptable use policy. You are responsible for the content your agents generate and the data you provide for training.</p>
              </div>
            </section>

            <section>
              <h2 className="text-[#1A1A1A] text-xl font-bold mb-6 uppercase tracking-widest">Security Standards</h2>
              <div className="prose prose-invert max-w-none text-[#555555] text-sm leading-relaxed space-y-4">
                <p>Our platform is built on enterprise-grade infrastructure. We employ SOC 2 Type II compliant processes and regular security audits to ensure your business operations remain secure.</p>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

