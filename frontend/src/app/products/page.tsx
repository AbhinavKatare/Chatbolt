'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Box, ChevronRight, Globe, Wand2, FileText, Bot } from 'lucide-react'
import { getSession, api } from '@/lib/api'

export default function ProductsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLaunchProduct = async (promptText: string) => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) {
        router.push(`/login?prompt=${encodeURIComponent(promptText)}`)
        return
      }

      // Auto-deploy target workflow
      const parsed = await api.workflows.parse(promptText)
      const created = await api.workflows.create({
        name: parsed.workflow_name || 'Product Autonomous Run',
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

  const catalog = [
    {
      title: 'Chatbolt Browser Operator',
      desc: 'Lend a secure, isolated cloud tab to Chatbolt. Scrape directories, map lists, and automate logins.',
      icon: Globe,
      prompt: 'Open a clean web browser, search the web, and find me the official YouTube channel of Andrej Karpathy and cite its handle'
    },
    {
      title: 'AI Fullstack Web Builder',
      desc: 'Generate complete, highly polished Next.js App Router projects styled with Tailwind CSS autonomously.',
      icon: Wand2,
      prompt: 'Build a premium responsive Next.js portfolio website with HSL tailored dark mode, Outfit typography, and floating micro-animations'
    },
    {
      title: 'Nano Banana Pro Slides',
      desc: 'Structure concept ideas and compile presentable, highly functional slides markdown ledgers.',
      icon: FileText,
      prompt: 'Create a slide presentation explaining Chatbolt business capabilities, multi-agent fleet operations, and ROI for enterprise sales'
    }
  ]

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111111] font-sans antialiased flex flex-col justify-between selection:bg-black/10 relative overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pt-32 pb-24 space-y-16 z-10">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[#444]">
            <Box size={12} className="text-[#00E599]" /> Product Offerings
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#111111] tracking-tight font-medium">
            Deploy active digital tools.
          </h1>
          <p className="text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
            Select a specialized autonomous software product below to prime and launch its execution pipeline instantly.
          </p>
        </div>

        {/* Product List */}
        <div className="space-y-6 pt-6">
          {catalog.map(item => {
            const Icon = item.icon
            return (
              <div 
                key={item.title}
                className="bg-white border border-[#EAEAEA] rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-black/10 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#00E599]/10 rounded-2xl border border-[#00E599]/20 flex items-center justify-center text-[#00E599] shrink-0">
                    <Icon size={22} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white uppercase tracking-tight">{item.title}</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed font-semibold max-w-lg">{item.desc}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleLaunchProduct(item.prompt)}
                  disabled={loading}
                  className="px-5 py-3 bg-black text-white font-black uppercase text-[9px] tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  Deploy Product <ChevronRight size={12} />
                </button>
              </div>
            )
          })}
        </div>

      </main>

      <Footer />
    </div>
  )
}
