'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Zap, ArrowRight, Shield, RefreshCw, Mail, MessageSquare, BookOpen, Layers, CheckCircle2 } from 'lucide-react'
import { getSession } from '@/lib/api'

export default function HomePage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'pro' | 'teams' | 'devs'>('pro')
  const [referralCode, setReferralCode] = useState<string | null>(null)

  useEffect(() => {
    getSession().then(setSession).catch(() => {})
    
    // Referral tracking
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const ref = urlParams.get('ref')
      if (ref) {
        localStorage.setItem('referral_code', ref)
        setReferralCode(ref)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans antialiased flex flex-col justify-between selection:bg-[#534AB7]/10 relative overflow-x-hidden">
      
      {/* Radial Gradient Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(83,74,183,0.04)_0,white_70%)] pointer-events-none z-0" />

      {/* Sticky Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-36 pb-20 px-6 max-w-5xl mx-auto w-full text-center space-y-8 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#534AB7]/5 border border-[#534AB7]/10 text-xs font-bold text-[#534AB7] animate-in fade-in duration-700">
          <Zap size={12} className="fill-current animate-pulse" />
          <span>Meet the future of autonomous work</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-serif tracking-tight font-medium text-zinc-900 leading-[1.1] max-w-4xl mx-auto">
          Your AI work assistant that <span className="text-[#534AB7] italic">actually</span> finishes the job
        </h1>
        
        <p className="text-base md:text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed font-medium">
          Connect your tools. Say what you need. Chatbolt researches, writes, builds, and sends — completely autonomously in the background.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href={session ? '/dashboard/terminal' : '/signup'}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#534AB7] hover:bg-[#43399F] text-white font-bold rounded-xl text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#534AB7]/20 hover:scale-[1.02] active:scale-95 no-underline"
          >
            Start for free <ArrowRight size={14} />
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-8 py-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-xl text-xs uppercase tracking-widest inline-flex items-center justify-center transition-all cursor-pointer border border-zinc-200 no-underline"
          >
            See how it works
          </a>
        </div>

        {/* Polished Visual Showcase */}
        <div className="pt-12 max-w-4xl mx-auto">
          <div className="bg-[#09090B] border border-white/[0.08] rounded-2xl p-4 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <div className="text-[10px] font-mono text-zinc-500">terminal.chatbolt.io</div>
              <div className="w-8" />
            </div>
            
            <div className="text-left font-mono space-y-3 text-xs md:text-sm">
              <p className="text-zinc-500">&gt; Ask Chatbolt to run a competitor research report and email it to my manager.</p>
              <p className="text-[#00E599]">⚡ SWOT Analysis Swarm initialized...</p>
              <p className="text-purple-400">✔ Step 1: Researched 12 competitive profiles via web scraper.</p>
              <p className="text-teal-400">✔ Step 2: Formatted structured spreadsheet artifact with ROI metrics.</p>
              <p className="text-amber-400">✔ Step 3: Drafted and sent executive summary email via Gmail API.</p>
              <p className="text-white bg-[#534AB7]/20 border border-[#534AB7]/30 p-2.5 rounded-lg inline-block mt-2 font-sans font-medium text-xs leading-normal">
                Goal outcome completed successfully. Verification digest dispatched to slack channel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Strip */}
      <section className="bg-zinc-50 border-y border-zinc-100 py-12 px-6 z-10">
        <div className="max-w-4xl mx-auto w-full">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center mb-8">Works with the tools you use daily</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-xs font-bold text-zinc-500">
            <div className="flex items-center justify-center gap-2 bg-white border border-zinc-200 py-3 rounded-xl shadow-sm">
              <span>✉️ Gmail</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-white border border-zinc-200 py-3 rounded-xl shadow-sm">
              <span>💬 Slack</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-white border border-zinc-200 py-3 rounded-xl shadow-sm">
              <span>📄 Notion</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-white border border-zinc-200 py-3 rounded-xl shadow-sm">
              <span>📂 Google Drive</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 px-6 max-w-5xl mx-auto w-full space-y-16 z-10">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-serif tracking-tight font-medium text-zinc-900">How Chatbolt gets it done</h2>
          <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">Three simple steps to automate your business processes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-6 text-center space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-[#534AB7]/5 border border-[#534AB7]/10 rounded-full flex items-center justify-center text-sm font-black text-[#534AB7] mx-auto">1</div>
            <h3 className="text-base font-bold text-zinc-900">Connect your tools</h3>
            <p className="text-xs text-zinc-500 leading-relaxed font-medium">Link Gmail, Slack, Notion, or any of our 12 integrations in under 2 minutes.</p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-6 text-center space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-[#534AB7]/5 border border-[#534AB7]/10 rounded-full flex items-center justify-center text-sm font-black text-[#534AB7] mx-auto">2</div>
            <h3 className="text-base font-bold text-zinc-900">Say what you need</h3>
            <p className="text-xs text-zinc-500 leading-relaxed font-medium">Type a plain-English request. No commands, no code, no complex setups.</p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-6 text-center space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-[#534AB7]/5 border border-[#534AB7]/10 rounded-full flex items-center justify-center text-sm font-black text-[#534AB7] mx-auto">3</div>
            <h3 className="text-base font-bold text-zinc-900">Get it done</h3>
            <p className="text-xs text-zinc-500 leading-relaxed font-medium">Chatbolt coordinates, writes, and executes. You review, approve, and move on.</p>
          </div>
        </div>
      </section>

      {/* Use Cases (Tabs) */}
      <section className="py-20 bg-zinc-50 border-y border-zinc-150 px-6 z-10">
        <div className="max-w-4xl mx-auto w-full space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-serif tracking-tight font-medium text-zinc-900">Built for every scenario</h2>
            <p className="text-zinc-500 max-w-md mx-auto text-sm">See how users leverage Chatbolt to accelerate daily operations.</p>
          </div>

          {/* Tab controllers */}
          <div className="flex justify-center border-b border-zinc-200 max-w-md mx-auto p-1 bg-zinc-100 rounded-xl">
            <button
              onClick={() => setActiveTab('pro')}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'pro' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-950'
              }`}
            >
              For Professionals
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'teams' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-950'
              }`}
            >
              For Teams
            </button>
            <button
              onClick={() => setActiveTab('devs')}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'devs' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-950'
              }`}
            >
              For Developers
            </button>
          </div>

          {/* Tab content */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm max-w-2xl mx-auto space-y-4 min-h-[160px]">
            {activeTab === 'pro' && (
              <ul className="space-y-3.5 text-sm text-zinc-700 font-medium">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#534AB7]" />
                  <span>"Check my emails and draft replies to the 3 most urgent"</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#534AB7]" />
                  <span>"Research competitors and build a comparison spreadsheet"</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#534AB7]" />
                  <span>"Schedule a meeting with my client and send a Slack update"</span>
                </li>
              </ul>
            )}
            {activeTab === 'teams' && (
              <ul className="space-y-3.5 text-sm text-zinc-700 font-medium">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#534AB7]" />
                  <span>"Run a weekly competitor news report for the whole team"</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#534AB7]" />
                  <span>"Keep our Notion workspace updated automatically"</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#534AB7]" />
                  <span>"Post daily standup summaries to Slack"</span>
                </li>
              </ul>
            )}
            {activeTab === 'devs' && (
              <ul className="space-y-3.5 text-sm text-zinc-700 font-medium">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#534AB7]" />
                  <span>Call our API to run tasks from any external app</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#534AB7]" />
                  <span>Embed Chatbolt in your product with one script tag</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#534AB7]" />
                  <span>Build custom triggers from webhooks or automation tools</span>
                </li>
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section className="py-24 px-6 max-w-4xl mx-auto w-full space-y-16 z-10">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-serif tracking-tight font-medium text-zinc-900">Simple plans. Flexible scale.</h2>
          <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">Choose the tier that matches your workflow needs.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Free Tier</span>
              <h3 className="text-2xl font-serif font-bold text-zinc-900">$0</h3>
              <p className="text-xs text-zinc-500 font-semibold">Explore autonomous tasks with zero cost commitment.</p>
              <div className="w-full h-[1px] bg-zinc-100" />
              <ul className="space-y-2 text-xs text-zinc-600 font-medium">
                <li>• 20 tasks per month</li>
                <li>• 2 active integrations</li>
                <li>• 1 teammate limit</li>
              </ul>
            </div>
            <Link
              href="/signup"
              className="w-full text-center py-2.5 mt-8 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold uppercase text-[9px] tracking-widest rounded-xl transition-colors no-underline"
            >
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-white border-2 border-[#534AB7] rounded-2xl p-6 flex flex-col justify-between shadow-lg relative transform hover:scale-[1.01] transition-all">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#534AB7] text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
              Most Popular
            </span>
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#534AB7]">Pro Workspace</span>
              <h3 className="text-2xl font-serif font-bold text-zinc-900">$19<span className="text-xs text-zinc-500 font-sans"> / mo</span></h3>
              <p className="text-xs text-zinc-500 font-semibold">Perfect for individuals and heavy task automation.</p>
              <div className="w-full h-[1px] bg-zinc-100" />
              <ul className="space-y-2 text-xs text-zinc-600 font-medium">
                <li>• 500 tasks per month</li>
                <li>• All integrations</li>
                <li>• 20 active automations</li>
              </ul>
            </div>
            <Link
              href="/pricing"
              className="w-full text-center py-2.5 mt-8 bg-[#534AB7] hover:bg-[#43399F] text-white font-bold uppercase text-[9px] tracking-widest rounded-xl transition-colors no-underline shadow-md"
            >
              Upgrade to Pro
            </Link>
          </div>

          {/* Team */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Team Workspace</span>
              <h3 className="text-2xl font-serif font-bold text-zinc-900">$49<span className="text-xs text-zinc-500 font-sans"> / mo</span></h3>
              <p className="text-xs text-zinc-500 font-semibold">Collaborative multi-user automation environments.</p>
              <div className="w-full h-[1px] bg-zinc-100" />
              <ul className="space-y-2 text-xs text-zinc-600 font-medium">
                <li>• 2,000 tasks per month</li>
                <li>• Unlimited automations</li>
                <li>• Up to 10 team members</li>
              </ul>
            </div>
            <Link
              href="/pricing"
              className="w-full text-center py-2.5 mt-8 bg-zinc-900 hover:bg-zinc-800 text-white font-bold uppercase text-[9px] tracking-widest rounded-xl transition-colors no-underline"
            >
              Upgrade to Team
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-zinc-50 border-t border-zinc-150 py-20 px-6 text-center space-y-6 z-10">
        <h2 className="text-3xl font-serif font-medium text-zinc-900">Start for free. No credit card required.</h2>
        <p className="text-zinc-500 text-sm font-medium">Free includes 20 tasks per month. Upgrade or cancel anytime.</p>
        <div className="pt-2">
          <Link
            href="/signup"
            className="px-8 py-3.5 bg-[#534AB7] hover:bg-[#43399F] text-white font-bold rounded-xl text-xs uppercase tracking-widest inline-flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#534AB7]/20 no-underline"
          >
            Create your account <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
