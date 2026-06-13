'use client'
import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ShieldCheck, Lock, Eye, AlertCircle } from 'lucide-react'

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111111] font-sans antialiased flex flex-col justify-between selection:bg-black/10 relative overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pt-32 pb-24 space-y-16 z-10">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[#444]">
            <ShieldCheck size={12} className="text-[#00E599]" /> Compliance & Trust Center
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#111111] tracking-tight font-medium">
            Privacy, security, and terms.
          </h1>
          <p className="text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
            At Chatbolt, security isn't an afterthought. We ensure SOC2 compliance, data encryption, and transparent agreements.
          </p>
        </div>

        {/* Content segments */}
        <div className="space-y-8 bg-white border border-[#EAEAEA] rounded-3xl p-8 shadow-sm">
          
          <div className="space-y-3">
            <h3 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Lock size={16} className="text-[#00E599]" /> 1. Data Protection & Encryption
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
              All credentials, API tokens, and session context cookies are encrypted locally at rest using industry-standard **AES-256** vault configurations. Keys are loaded strictly in-memory during agent execution runs and wiped immediately on task completions.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Eye size={16} className="text-[#00E599]" /> 2. LLM Data Privacy Policies
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
              Chatbolt routes all pipeline execution calls through secure OpenAI, Anthropic, or custom BYOK clusters. Your company data is never used to train baseline LLM models, ensuring complete compliance with proprietary code and business trade secrets.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#00E599]" /> 3. SOC2 Type II Assurance
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
              Our infrastructure is continuously audited by independent third-party cybersecurity teams to maintain active **SOC2 Type II** certifications. Active penetration tests are automatically triggered monthly to verify sandbox isolations.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <AlertCircle size={16} className="text-[#00E599]" /> 4. Terms of Workspace Usage
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
              By deploying agents on the Chatbolt platform, you agree to comply with cloud provider terms. Users are responsible for procuring secure third-party credentials (Slack, Gmail, GitHub) required for automated API dispatching.
            </p>
          </div>

        </div>

      </main>

      <Footer />
    </div>
  )
}
