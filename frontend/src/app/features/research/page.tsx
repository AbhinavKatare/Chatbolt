'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Radar, Shield, Code, ChevronRight } from 'lucide-react'
import { getSession, api } from '@/lib/api'

export default function ResearchFeaturePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLaunch = async () => {
    setLoading(true)
    const promptText = 'Run a deep dive research report on latest generative search engine trends and cite all sources.'
    try {
      const session = await getSession()
      if (!session) {
        router.push(`/login?prompt=${encodeURIComponent(promptText)}`)
        return
      }

      // Auto-deploy target workflow
      const parsed = await api.workflows.parse(promptText)
      const created = await api.workflows.create({
        name: parsed.workflow_name || 'Autonomous Research Engine',
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

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111111] font-sans antialiased flex flex-col justify-between selection:bg-black/10 relative overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pt-32 pb-24 space-y-12 z-10">
        
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-[#EAEAEA]/40 pb-6">
          <div className="w-12 h-12 bg-[#00E599]/10 rounded-2xl border border-[#00E599]/20 flex items-center justify-center text-[#00E599]">
            <Radar size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Autonomous Personnel</span>
            <h1 className="text-3xl font-serif font-bold text-[#111111] tracking-tight">Deep Parallel Research Engine</h1>
          </div>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
          Scour the web, compile competitor analyses, extract data sheets, and auto-generate beautifully cited ledgers using parallel research fleets.
        </p>

        {/* Capabilities card */}
        <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#00E599]">Agent Deliverables</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-zinc-600 font-bold">
            <div className="flex items-center gap-2">• Multi-source concurrent searches indexing</div>
            <div className="flex items-center gap-2">• Rigorous inline markdown citations link sets</div>
            <div className="flex items-center gap-2">• Deep competitor cost comparison matrices</div>
            <div className="flex items-center gap-2">• Automated report exports in Markdown & PDF</div>
          </div>
        </div>

        {/* CTA Launch */}
        <div className="bg-white border-2 border-black rounded-3xl p-8 text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-serif font-bold text-[#111111]">Deploy Parallel Research Swarm</h3>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
              Let the agent parse complex keyword matrices and draft compiled analysis documents cited end-to-end.
            </p>
          </div>

          <button
            onClick={handleLaunch}
            disabled={loading}
            className="px-8 py-4 bg-black text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
          >
            {loading ? 'Deploying Pipeline...' : '🚀 Launch Research Engine Swarm'}
          </button>
        </div>

      </main>

      <Footer />
    </div>
  )
}
