'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Wand2, Shield, Code, ChevronRight } from 'lucide-react'
import { getSession, api } from '@/lib/api'

export default function DesignFeaturePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLaunch = async () => {
    setLoading(true)
    const promptText = 'Design a dynamic dark-mode color dashboard palette for enterprise tools with premium glassmorphism and Outfit fonts.'
    try {
      const session = await getSession()
      if (!session) {
        router.push(`/login?prompt=${encodeURIComponent(promptText)}`)
        return
      }

      // Auto-deploy target workflow
      const parsed = await api.workflows.parse(promptText)
      const created = await api.workflows.create({
        name: parsed.workflow_name || 'Autonomous Design Engine',
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
            <Wand2 size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Autonomous Personnel</span>
            <h1 className="text-3xl font-serif font-bold text-[#111111] tracking-tight">AI Brand & UX Designer</h1>
          </div>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
          Curate premium HSL tailored design systems, component tokens guides, typography grids, and color systems dynamically to fuel full-stack web and mobile generation runs.
        </p>

        {/* Capabilities card */}
        <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#00E599]">Agent Deliverables</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-zinc-600 font-bold">
            <div className="flex items-center gap-2">• Curation of dynamic light and dark HSL tokens</div>
            <div className="flex items-center gap-2">• Harmonious typography ratios & margins grids</div>
            <div className="flex items-center gap-2">• Glassmorphic styling definitions and shadows</div>
            <div className="flex items-center gap-2">• Reusable brand sheets config exports</div>
          </div>
        </div>

        {/* CTA Launch */}
        <div className="bg-white border-2 border-black rounded-3xl p-8 text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-serif font-bold text-[#111111]">Deploy Enterprise UX Palette</h3>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
              Let the agent construct a visual branding guide structured around glassmorphic components and Outfit fonts.
            </p>
          </div>

          <button
            onClick={handleLaunch}
            disabled={loading}
            className="px-8 py-4 bg-black text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
          >
            {loading ? 'Deploying Pipeline...' : '🚀 Launch Brand Designer Swarm'}
          </button>
        </div>

      </main>

      <Footer />
    </div>
  )
}
