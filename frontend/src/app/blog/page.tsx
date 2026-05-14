'use client'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import FinalCTA from '@/components/FinalCTA'

export default function BlogPage() {
  const posts = [
    {
      title: 'The Future of Autonomous Support',
      desc: 'Why LLMs are changing customer service forever and how to prepare your business.',
      tag: 'INSIGHTS',
      date: 'Jan 12, 2025'
    },
    {
      title: 'How ShipDash reduced support cost by 73%',
      desc: 'A deep dive into how a logistics giant automated their WhatsApp support with Chatbolt.',
      tag: 'CASE STUDY',
      date: 'Jan 08, 2025'
    },
    {
      title: 'Introducing Chatbolt Autopilot',
      desc: 'Create an entire AI workforce with just one form. Our biggest feature yet.',
      tag: 'PRODUCT',
      date: 'Jan 05, 2025'
    }
  ]

  return (
    <div className="bg-[#FDFDFB] min-h-screen">
      <Navbar />
      <main className="pt-24">
        <section className="py-32">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mb-24">
              <div className="inline-flex items-center gap-3 px-3 py-1 bg-[#00DFB8]/10 border border-[#00DFB8]/20 mb-8">
                <span className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.3em]">Blog</span>
              </div>
              <h1 className="display-title text-5xl md:text-8xl text-[#1A1A1A] mb-10 tracking-tighter leading-none">
                AI and the <br /><span className="text-[#00DFB8]">Modern Founder.</span>
              </h1>
              <p className="text-xl text-[#555555] font-medium leading-relaxed max-w-2xl">
                Insights, product updates, and case studies on how businesses are using autonomous AI to scale.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {posts.map((post) => (
                <div key={post.title} className="group cursor-pointer">
                  <div className="aspect-[16/10] bg-[#FFFFFF] border border-black/5 mb-8 overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-[#00DFB8]/10 to-transparent group-hover:scale-105 transition-transform duration-700" />
                  </div>
                  <div className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.3em] mb-4">{post.tag}</div>
                  <h3 className="text-2xl font-bold text-[#1A1A1A] mb-4 tracking-tight group-hover:text-[#00DFB8] transition-colors">{post.title}</h3>
                  <p className="text-[#555555] text-sm font-medium leading-relaxed mb-6">
                    {post.desc}
                  </p>
                  <div className="text-[10px] font-bold text-[#444] uppercase tracking-[0.2em]">{post.date}</div>
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

