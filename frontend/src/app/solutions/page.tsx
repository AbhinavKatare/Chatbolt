'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { PieChart, User, LayoutGrid, Landmark, LineChart, ChevronRight, Sparkles } from 'lucide-react'
import { getSession, api } from '@/lib/api'

export default function SolutionsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLaunchSolution = async (promptText: string) => {
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
        name: parsed.workflow_name || 'Solutions Autonomous Action',
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
    { id: 'marketing', title: 'Marketing Operations', desc: 'Accelerate content loops using programmatic SEO and React CRO variant builders.', icon: PieChart, prompt: 'Generate 5 SEO landing pages for "AI workflows"' },
    { id: 'sales', title: 'Intelligent B2B Sales', desc: 'Enrich prospects and auto-sync high-intent targets into HubSpot or Salesforce.', icon: User, prompt: 'Enrich target business competitors and log outreach signals' },
    { id: 'product', title: 'Product Launch Orchestration', desc: 'Audit user journey heatmaps and scaffold product specifications automatically.', icon: LayoutGrid, prompt: 'Scrape my landing page to find UX bottlenecks and generate React variant' },
    { id: 'finance', title: 'FinOps Cloud cost auditing', desc: 'Analyze AWS cost logs and compile downscaling kost proposal decks.', icon: Landmark, prompt: 'Analyze AWS usage metrics and recommend downscaling cost proposals' },
    { id: 'analytics', title: 'advanced data decisions', desc: 'Query massive CSV ledgers and auto-generate beautifully cited reports.', icon: LineChart, prompt: 'Analyze the Q1 sales ledger CSV, query top regions, and compile Q1 report' }
  ]

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111111] font-sans antialiased flex flex-col justify-between selection:bg-black/10 relative overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-32 pb-24 space-y-16 z-10">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[#444]">
            <Sparkles size={12} className="text-[#00E599]" fill="currentColor" /> Chatbolt OS for Teams
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#111111] tracking-tight font-medium">
            Tailored industry solutions.
          </h1>
          <p className="text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
            Connect pre-compiled multi-agent swarms directly into your department's tools and workflows.
          </p>
        </div>

        {/* Solutions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
          {catalog.map(item => {
            const Icon = item.icon
            return (
              <div 
                key={item.id}
                className="bg-white border border-[#EAEAEA] rounded-3xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div className="space-y-4">
                  <div className="w-10 h-10 bg-[#00E599]/10 rounded-2xl border border-[#00E599]/20 flex items-center justify-center text-[#00E599] shrink-0">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-xs font-bold text-[#111111] uppercase tracking-tight leading-snug">{item.title}</h3>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-semibold">{item.desc}</p>
                </div>

                <div className="pt-6 border-t border-[#EAEAEA] mt-6 flex items-center justify-between">
                  <button
                    onClick={() => router.push(`/solutions/${item.id}`)}
                    className="text-[9px] font-bold text-zinc-400 hover:text-[#111111] uppercase tracking-widest bg-transparent border-none outline-none cursor-pointer flex items-center gap-1"
                  >
                    Explore <ChevronRight size={10} />
                  </button>
                  <button
                    onClick={() => handleLaunchSolution(item.prompt)}
                    disabled={loading}
                    className="text-[9px] font-black text-[#00E599] hover:text-[#111111] uppercase tracking-widest bg-transparent border-none outline-none cursor-pointer"
                  >
                    Build Pipeline
                  </button>
                </div>
              </div>
            )
          })}
        </div>

      </main>

      <Footer />
    </div>
  )
}
