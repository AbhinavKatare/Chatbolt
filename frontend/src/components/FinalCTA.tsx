'use client'
import Link from 'next/link'

export default function FinalCTA() {
  return (
    <section className="py-48 bg-[#FDFDFB] relative overflow-hidden border-t border-black/5">
      <div className="container mx-auto px-6 relative z-10 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="display-title text-6xl md:text-9xl text-[#1A1A1A] mb-10 tracking-tighter leading-[0.8]">
            Your workforce is <span className="text-[#00DFB8]">ready.</span>
          </h2>
          <p className="text-2xl text-[#555555] mb-16 font-medium">
            500 free credits. No credit card. Live in 30 minutes.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-8 justify-center items-center">
            <Link href="/signup" className="btn btn-primary px-16 py-6 text-sm no-underline hover:no-underline shadow-2xl shadow-black/50">
              Start building free →
            </Link>
            <Link href="/pricing" className="btn btn-secondary px-12 py-6 text-sm no-underline hover:no-underline">
              View Pricing
            </Link>
          </div>

          <div className="mt-32 flex flex-wrap justify-center gap-16 opacity-30 grayscale">
            {['SOC 2 TYPE II', 'GDPR COMPLIANT', '14-DAY FREE TRIAL', 'CANCEL ANYTIME'].map(badge => (
              <div key={badge} className="text-[10px] font-bold text-[#1A1A1A] uppercase tracking-[0.5em]">{badge}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

