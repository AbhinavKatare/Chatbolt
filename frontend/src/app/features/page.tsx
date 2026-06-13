'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Sparkles, Globe, Smartphone, Wand2, FileText, Chrome, Radar, Mail, Puzzle, ChevronRight } from 'lucide-react'
import { getSession, api } from '@/lib/api'

export default function FeaturesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLaunchFeature = async (promptText: string) => {
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
        name: parsed.workflow_name || 'Features Autonomous Action',
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
    { id: 'webapp', title: 'Web App Engine', desc: 'Scaffold responsive Next.js apps structured with Tailwind CSS.', icon: Globe, prompt: 'Build a premium responsive Next.js portfolio website with Outfit typography' },
    { id: 'mobileapp', title: 'Mobile App builder', desc: 'Build native iOS and Android Expo codebases dynamically.', icon: Smartphone, prompt: 'Generate a native React Native Expo application for tracking workouts' },
    { id: 'design', title: 'AI brand Designer', desc: 'Create cohesive branding tokens and design sheets autonomously.', icon: Wand2, prompt: 'Design a dynamic color dashboard palette for enterprise tools' },
    { id: 'slides', title: 'Nano Banana Slides', desc: 'Synthesize concept notes and generate exportable slide outline decks.', icon: FileText, prompt: 'Create a slide presentation explaining Chatbolt business capabilities' },
    { id: 'browser', title: 'Browser Operator', desc: 'Trigger Playwright cloud browsers to scrap records and bypass logins.', icon: Chrome, prompt: 'Open a clean web browser, search the web, and find me the official YouTube channel of Andrej Karpathy' },
    { id: 'research', title: 'Parallel Researcher', desc: 'Initiate deep concurrent search swarms with citations.', icon: Radar, prompt: 'Run a deep dive research report on latest generative search engine optimization trends' },
    { id: 'mail', title: 'Email Forwarder', desc: 'Auto-compose email drip outlines and forward HubSpot accounts.', icon: Mail, prompt: 'Setup a cold outbound drip campaign for marketing directors' },
    { id: 'skills', title: 'Skills Injector', desc: 'Equip persistent agents with custom API integrations and prompts.', icon: Puzzle, prompt: 'Configure a custom secure workflow for enterprise contract compliance auditing' }
  ]

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111111] font-sans antialiased flex flex-col justify-between selection:bg-black/10 relative overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-32 pb-24 space-y-16 z-10">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[#444]">
            <Sparkles size={12} className="text-[#00E599]" fill="currentColor" /> Chatbolt OS Capabilities
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#111111] tracking-tight font-medium">
            Autonomous fleet capabilities.
          </h1>
          <p className="text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
            Every feature on Chatbolt is backed by a dedicated autonomous agent running closed-loop execution loops.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
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
                    onClick={() => router.push(`/features/${item.id}`)}
                    className="text-[9px] font-bold text-zinc-400 hover:text-[#111111] uppercase tracking-widest bg-transparent border-none outline-none cursor-pointer flex items-center gap-1"
                  >
                    Details <ChevronRight size={10} />
                  </button>
                  <button
                    onClick={() => handleLaunchFeature(item.prompt)}
                    disabled={loading}
                    className="text-[9px] font-black text-[#00E599] hover:text-[#111111] uppercase tracking-widest bg-transparent border-none outline-none cursor-pointer"
                  >
                    Deploy Workflow
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
