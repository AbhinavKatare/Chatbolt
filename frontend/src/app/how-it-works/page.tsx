'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { HelpCircle, ArrowRight, Bot, Cpu, RotateCw, CheckCircle } from 'lucide-react'
import { getSession, api } from '@/lib/api'

export default function HowItWorksPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLaunchAutopilot = async () => {
    setLoading(true)
    const promptText = 'Scrape my landing page and generate CRO React variants'
    try {
      const session = await getSession()
      if (!session) {
        router.push(`/login?prompt=${encodeURIComponent(promptText)}`)
        return
      }

      // Auto-deploy target workflow
      const parsed = await api.workflows.parse(promptText)
      const created = await api.workflows.create({
        name: parsed.workflow_name || 'Autopilot CRO Variant Gen',
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

  const steps = [
    {
      num: '01',
      title: 'Describe Your Goal',
      desc: 'Describe what you want to build or automate in plain English. No coding or complex configuration required.',
      details: 'Our manager agent parse your prompt, identifies required tasks, and scaffolds the multi-agent pipeline.'
    },
    {
      num: '02',
      title: 'Manager Agent Plans',
      desc: 'The planner agent structures execution, provisions expert agents, and allocates compute budgets.',
      details: 'Tasks are dispatched sequentially or in parallel depending on dependency rules.'
    },
    {
      num: '03',
      title: 'Agents Self-Heal',
      desc: 'If an error occurs (such as failed builds or slow scraping), agents analyze logs and patch their code.',
      details: 'This closed-loop runtime guarantees completion and reduces human-in-the-loop dependencies.'
    },
    {
      num: '04',
      title: 'Acquire Verified Outputs',
      desc: 'View rich visual results, cited competitor spreadsheets, generated slides, or active GitHub PRs.',
      details: 'Full logs and runs details are securely synchronized with your workspace database.'
    }
  ]

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111111] font-sans antialiased flex flex-col justify-between selection:bg-black/10 relative overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pt-32 pb-24 space-y-16 z-10">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[#444]">
            <HelpCircle size={12} className="text-[#00E599]" /> Closed-Loop AI Orchestration
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#111111] tracking-tight font-medium">
            How Chatbolt OS works.
          </h1>
          <p className="text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
            Behind the clean chat console is a highly sophisticated agent planner network built for maximum visual feedback.
          </p>
        </div>

        {/* Steps Flow Vertical list */}
        <div className="space-y-6 pt-6">
          {steps.map((st, i) => (
            <div key={st.num} className="bg-white border border-[#EAEAEA] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start hover:border-black/10 transition-colors">
              <div className="text-3xl font-serif font-bold text-[#00E599] leading-none shrink-0 md:w-16">
                {st.num}
              </div>
              <div className="space-y-3 flex-1">
                <h3 className="text-base font-bold text-white uppercase tracking-tight">{st.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed font-semibold">{st.desc}</p>
                <div className="p-4 bg-[#070709] border border-white/[0.04] rounded-xl text-[11px] text-zinc-400 font-semibold leading-relaxed">
                  {st.details}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Launch Autopilot */}
        <div className="bg-white border-2 border-black rounded-3xl p-8 text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-serif font-bold text-[#111111]">Experience Closed-Loop Automation</h3>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
              Launch our prebuilt CRO variant generator to scrape a page and produce React Variants autonomously.
            </p>
          </div>

          <button
            onClick={handleLaunchAutopilot}
            disabled={loading}
            className="px-8 py-4 bg-black text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            {loading ? 'Initiating Autopilot...' : '🚀 Deploy Autopilot CRO Pipeline'}
          </button>
        </div>

      </main>

      <Footer />
    </div>
  )
}
