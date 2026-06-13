'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { BookOpen, ChevronRight, Terminal, Zap, Shield, Play, HelpCircle, Code2 } from 'lucide-react'
import { getSession, api } from '@/lib/api'

export default function DocsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<'quickstart' | 'concepts' | 'security'>('quickstart')

  const handleLaunchDocsWorkflow = async () => {
    setLoading(true)
    const promptText = 'Search and scrape latest tech job listings'
    try {
      const session = await getSession()
      if (!session) {
        router.push(`/login?prompt=${encodeURIComponent(promptText)}`)
        return
      }

      // Auto-deploy target workflow
      const parsed = await api.workflows.parse(promptText)
      const created = await api.workflows.create({
        name: parsed.workflow_name || 'Docs Scraper QuickStart',
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

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 pt-32 pb-24 z-10 flex flex-col md:flex-row gap-10">
        
        {/* Left Docs Navigation Sidebar */}
        <aside className="w-full md:w-56 shrink-0 space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 block">Guides</span>
            <button
              onClick={() => setActiveSection('quickstart')}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSection === 'quickstart' ? 'bg-black text-white' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Terminal size={14} /> Quick Start
            </button>
            <button
              onClick={() => setActiveSection('concepts')}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSection === 'concepts' ? 'bg-black text-white' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <BookOpen size={14} /> Core Concepts
            </button>
            <button
              onClick={() => setActiveSection('security')}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSection === 'security' ? 'bg-black text-white' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Shield size={14} /> Safety & Security
            </button>
          </div>
        </aside>

        {/* Right Docs Core Content panel */}
        <section className="flex-1 space-y-10">
          {activeSection === 'quickstart' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#00E599]">Deployment Guide</span>
                <h2 className="text-2xl font-serif font-bold text-[#111111] tracking-tight">Deploying Your First Swarm</h2>
                <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                  Get up and running with Chatbolt OS in under 60 seconds. Our manager agent parser automates the entire planning process for you.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">Step 1: Install Connector CLI</h4>
                <pre className="bg-[#070709] border border-white/[0.04] p-4 rounded-2xl text-[11px] text-[#00E599] font-mono leading-relaxed overflow-x-auto">
                  npm install -g @chatbolt/operator-cli<br />
                  chatbolt login --token YOUR_AES_KEY
                </pre>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">Step 2: Prime Scraper Test</h4>
                <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                  Execute a quick-start scraping task directly from your documentation panel. Let the browser operator search and index listings autonomously.
                </p>

                <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block">Pre-compiled Doc Workflow</span>
                    <h5 className="text-xs font-bold text-[#111111] tracking-tight">"Search and scrape latest tech job listings"</h5>
                  </div>

                  <button
                    onClick={handleLaunchDocsWorkflow}
                    disabled={loading}
                    className="px-5 py-3 bg-[#00E599] text-black font-black uppercase text-[9px] tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    {loading ? 'Running...' : '🚀 Execute QuickStart'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'concepts' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#00E599]">Core Architecture</span>
                <h2 className="text-2xl font-serif font-bold text-[#111111] tracking-tight">Understanding Swarm Concepts</h2>
                <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                  Explore how Chatbolt orchestrates complex workflows through specialized AI agents and persistent data pipelines.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="p-6 bg-white border border-[#EAEAEA] rounded-3xl space-y-2">
                  <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">Manager Agent Planner</h4>
                  <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
                    The core coordinator that parses natural language instructions, identifies dependencies, and structures the workflow DAG execution loops.
                  </p>
                </div>

                <div className="p-6 bg-white border border-[#EAEAEA] rounded-3xl space-y-2">
                  <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">Persistent Agent Fleet</h4>
                  <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
                    24/7 autonomous worker nodes that retain conversation context, allocate local compute budgets, and self-heal run crashes.
                  </p>
                </div>

                <div className="p-6 bg-white border border-[#EAEAEA] rounded-3xl space-y-2">
                  <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">Closed-Loop Self-Healing</h4>
                  <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
                    When browser operators or code compilers throw exceptions, our self-healing agent processes the call stack traces and commits patched code to resolve failures instantly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#00E599]">Securing Your Swarm</span>
                <h2 className="text-2xl font-serif font-bold text-[#111111] tracking-tight">Military-Grade Vault Compliance</h2>
                <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                  Understand our state-of-the-art security architectures designed to safeguard enterprise accounts.
                </p>
              </div>

              <div className="p-6 bg-white border border-[#EAEAEA] rounded-3xl space-y-4">
                <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-2">
                  <Zap size={14} className="text-[#00E599]" /> AES-256 Vault Encryption
                </h4>
                <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
                  Third-party OAuth tokens (GitHub, Slack, HubSpot) are encrypted locally using AES-256 protocols. Keys are strictly decrypted strictly in-memory during real runtime pipelines.
                </p>
              </div>

              <div className="p-6 bg-white border border-[#EAEAEA] rounded-3xl space-y-4">
                <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-2">
                  <Shield size={14} className="text-[#00E599]" /> Sandboxed Runtimes
                </h4>
                <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
                  All arbitrary Python code processor, SQL queries analyzer, and Playwright automation runs occur in isolated, ephemeral gRPC container instances. Your databases are protected from injection threats.
                </p>
              </div>
            </div>
          )}
        </section>

      </main>

      <Footer />
    </div>
  )
}
