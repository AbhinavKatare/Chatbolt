'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Compass, ChevronRight, BookOpen, Newspaper, ShieldAlert, Bot } from 'lucide-react'
import { getSession, api } from '@/lib/api'

export default function ResourcesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLaunchResourceWorkflow = async (promptText: string) => {
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
        name: parsed.workflow_name || 'Resources Outreach Automation',
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

  const sections = [
    {
      title: 'Outbound Campaign Playbook',
      desc: 'Step-by-step documentation on how to auto-enrich B2B prospects, structure drip follow-ups, and sync accounts to HubSpot.',
      icon: BookOpen,
      prompt: 'Setup a cold outbound drip campaign for marketing directors'
    },
    {
      title: 'Competitor Tracking Guidelines',
      desc: 'Audit employee expansion, funding updates, and slow query directories on autopilot using parallel crawlers.',
      icon: Newspaper,
      prompt: 'Enrich target business competitors and log signals'
    },
    {
      title: 'Local Vault Security Center',
      desc: 'Learn about our military-grade local AES-256 secure encryption protocols for managing third-party connector tokens.',
      icon: ShieldAlert,
      prompt: 'Configure a custom secure workflow for enterprise contract compliance auditing'
    }
  ]

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111111] font-sans antialiased flex flex-col justify-between selection:bg-black/10 relative overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pt-32 pb-24 space-y-16 z-10">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[#444]">
            <Compass size={12} className="text-[#00E599]" /> Resources & Learning
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#111111] tracking-tight font-medium">
            Learn and deploy pipelines.
          </h1>
          <p className="text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
            Read B2B playbook documents and launch their pre-compiled operational pipeline scripts into your workspace.
          </p>
        </div>

        {/* Resources Cards list */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          {sections.map(sec => {
            const Icon = sec.icon
            return (
              <div 
                key={sec.title}
                className="bg-white border border-[#EAEAEA] rounded-3xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div className="space-y-4">
                  <div className="w-10 h-10 bg-[#00E599]/10 rounded-2xl flex items-center justify-center text-[#00E599] shrink-0">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-tight leading-snug">{sec.title}</h3>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-semibold">{sec.desc}</p>
                </div>

                <button
                  onClick={() => handleLaunchResourceWorkflow(sec.prompt)}
                  disabled={loading}
                  className="w-full mt-6 py-2.5 bg-zinc-100 hover:bg-[#00E599] hover:text-black text-black font-black uppercase text-[8px] tracking-widest rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  🚀 Run Playbook <ChevronRight size={10} />
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
