'use client'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-[#FDFDFB] pt-40 pb-12 border-t border-black/5">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-24 mb-32">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 group no-underline mb-10">
              <div className="w-9 h-9 bg-[#00DFB8] rounded-none flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10C4 6.686 6.686 4 10 4s6 2.686 6 6-2.686 6-6 6H4V10z" fill="#FDFDFB"/>
                  <rect x="9" y="9" width="2" height="2" fill="#00DFB8"/>
                </svg>
              </div>
              <span className="display-title text-2xl text-[#1A1A1A] tracking-tighter uppercase">Chatbolt</span>
            </Link>
            <p className="text-xl text-[#555555] max-w-sm mb-12 font-medium leading-relaxed">
              The AI workforce for businesses that are serious about scale.
            </p>
            <div className="flex gap-4">
              <div className="text-[9px] font-bold text-[#444] uppercase tracking-[0.4em] px-3 py-1 border border-black/5">SOC 2 TYPE II</div>
              <div className="text-[9px] font-bold text-[#444] uppercase tracking-[0.4em] px-3 py-1 border border-black/5">GDPR COMPLIANT</div>
            </div>
          </div>

          <div>
            <h4 className="text-[#1A1A1A] font-bold text-[11px] uppercase tracking-[0.3em] mb-10">Product</h4>
            <ul className="space-y-5 list-none p-0">
              {[
                { n: 'Features', h: '/features' },
                { n: 'Pricing', h: '/pricing' },
                { n: 'Docs', h: '/docs' },
                { n: 'Quick Start', h: '/docs/quick-start' },
                { n: 'Solutions', h: '/solutions' },
                { n: 'Blog', h: '/blog' }
              ].map(item => (
                <li key={item.n}>
                  <Link href={item.h} className="text-[#555555] hover:text-[#1A1A1A] transition-colors text-sm no-underline font-medium">{item.n}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[#1A1A1A] font-bold text-[11px] uppercase tracking-[0.3em] mb-10">Solutions</h4>
            <ul className="space-y-5 list-none p-0">
              {['E-commerce', 'SaaS', 'Healthcare', 'Legal', 'Real Estate', 'Education'].map(item => (
                <li key={item}>
                  <Link href={`/solutions`} className="text-[#555555] hover:text-[#1A1A1A] transition-colors text-sm no-underline font-medium">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[#1A1A1A] font-bold text-[11px] uppercase tracking-[0.3em] mb-10">Legal</h4>
            <ul className="space-y-5 list-none p-0">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Refund Policy'].map(item => (
                <li key={item}>
                  <Link href={`/legal`} className="text-[#555555] hover:text-[#1A1A1A] transition-colors text-sm no-underline font-medium">{item}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-12 border-t border-black/5 flex flex-col md:flex-row justify-between gap-12">
          <div className="flex flex-wrap gap-x-12 gap-y-6">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Refund Policy'].map(item => (
              <Link key={item} href={`/${item.toLowerCase().replace(' ', '-')}`} className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] no-underline hover:text-[#1A1A1A] transition-colors">{item}</Link>
            ))}
          </div>
          <div className="flex items-center gap-8">
            <span className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em]">© 2025 Chatbolt Technologies Pvt. Ltd.</span>
            <span className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] flex items-center gap-2">
              Made in India 🇮🇳
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

