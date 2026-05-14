import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function ProductsPage() {
  const products = [
    { title: 'Platform Overview', desc: 'The unified control plane for all your AI safety operations.' },
    { title: 'AI Moderation', desc: 'Real-time text, image, and video moderation at scale.' },
    { title: 'Risk Investigation', desc: 'Augment your human team with AI-driven investigative tools.' },
    { title: 'Safety Reports', desc: 'Instant compliance and audit-ready reporting for regulators.' }
  ]

  return (
    <main className="min-h-screen">
      <Navbar />
      
      <section className="pt-40 pb-24 border-b border-black/5">
        <div className="container mx-auto px-6">
          <div className="badge mb-8">Product Ecosystem</div>
          <h1 className="display-title text-6xl md:text-7xl tracking-tighter mb-8">
            Advanced <span className="text-[#00DFB8]">Safety</span> <br /> Infrastructure
          </h1>
          <p className="text-[#a1a1a1] text-xl max-w-2xl leading-relaxed">
            Everything you need to build, scale, and secure your digital community. One platform, infinite possibilities.
          </p>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {products.map((p) => (
              <div key={p.title} className="card p-12 group hover:border-[#00DFB8]/40 transition-all">
                <h3 className="display-title text-2xl text-[#1A1A1A] mb-6 group-hover:text-[#00DFB8] transition-colors">{p.title}</h3>
                <p className="text-[#a1a1a1] leading-relaxed mb-8">{p.desc}</p>
                <Link href="#" className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] hover:text-[#00DFB8] transition-colors no-underline">Learn More →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

