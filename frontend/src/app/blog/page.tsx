'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Newspaper, ChevronRight, Play, Zap, Bot, ShieldAlert } from 'lucide-react'
import { getSession, api } from '@/lib/api'

export default function BlogPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLaunchCaseStudyWorkflow = async (promptText: string) => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) {
        router.push(`/login?prompt=${encodeURIComponent(promptText)}`)
        return
      }

      // Auto-deploy research & outreach pipeline based on the case study
      const parsed = await api.workflows.parse(promptText)
      const created = await api.workflows.create({
        name: parsed.workflow_name || 'Blog Automated Drip Outbound',
        workflow_type: parsed.workflow_type || 'sequential',
        original_prompt: promptText,
        agents: parsed.agents || []
      })
      await api.workflows.run(created.workflow.id, {})
      router.push('/dashboard/workspace')
    } catch {
      router.push(`/login?prompt=${encodeURIComponent(promptText)}`)
    } finally {
      setLoading(false)
    }
  }

  const posts = [
    {
      title: 'The Future of Autonomous Support & Fleets',
      desc: 'Why persistent agent fleets are replacing static customer service structures forever, and how to calibrate your CRM pipelines.',
      tag: 'INSIGHTS',
      date: 'Jan 12, 2026',
      prompt: 'Setup a cold outbound drip campaign for marketing directors'
    },
    {
      title: 'How ShipDash reduced support cost by 73%',
      desc: 'A deep dive into how a logistics giant integrated our Playwright browser web crawler to automate lead tracking and bulk company enrichments.',
      tag: 'CASE STUDY',
      date: 'Jan 08, 2026',
      prompt: 'Enrich target business competitors and log signals'
    },
    {
      title: 'Introducing Chatbolt Autopilot',
      desc: 'Create an entire digital agent workforce with just one prompt. Explore our advanced manager agent planners and self-healing compilers.',
      tag: 'PRODUCT',
      date: 'Jan 05, 2026',
      prompt: 'Run a deep dive research report on latest generative search engine optimization trends'
    }
  ]

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111111] font-sans antialiased flex flex-col justify-between selection:bg-black/10 relative overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pt-32 pb-24 space-y-16 z-10">
        
        {/* Title */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[#444]">
            <Newspaper size={12} className="text-[#00E599]" /> Editorial Blog & case studies
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#111111] tracking-tight font-medium">
            AI and the Modern Founder.
          </h1>
          <p className="text-sm text-zinc-500 max-w-md leading-relaxed">
            Discover best practices, product releases, and comparative matrices about deploying autonomous AI workforces.
          </p>
        </div>

        {/* Blog Posts list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
          {posts.map(post => (
            <div key={post.title} className="bg-white border border-[#EAEAEA] rounded-3xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-zinc-400">
                  <span className="text-[#00E599]">{post.tag}</span>
                  <span>{post.date}</span>
                </div>
                <h3 className="text-base font-bold text-[#111111] tracking-tight">{post.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed font-semibold">{post.desc}</p>
              </div>

              <div className="pt-6 border-t border-[#EAEAEA] mt-6 flex items-center justify-between">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Bot size={11} className="text-zinc-600" /> Pre-built Workflow
                </span>
                <button
                  onClick={() => handleLaunchCaseStudyWorkflow(post.prompt)}
                  disabled={loading}
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#00E599] hover:text-[#111111] transition-all bg-transparent border-none outline-none cursor-pointer"
                >
                  Deploy Pipeline <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

      </main>

      <Footer />
    </div>
  )
}
