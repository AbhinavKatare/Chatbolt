'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ShieldCheck, Cpu, HardDrive, Key, CheckCircle, Zap } from 'lucide-react'
import { getSession, api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

export default function BusinessPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDeployEnterprise = async () => {
    setLoading(true)
    const promptText = 'Configure a custom secure workflow for enterprise contract compliance auditing'
    try {
      const session = await getSession()
      if (!session) {
        router.push(`/login?prompt=${encodeURIComponent(promptText)}`)
        return
      }

      // Auto-deploy compliance pipeline
      const parsed = await api.workflows.parse(promptText)
      const created = await api.workflows.create({
        name: parsed.workflow_name || 'Enterprise Compliance Audit',
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

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pt-32 pb-24 space-y-16 z-10">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[#444]">
            <ShieldCheck size={12} className="text-[#00E599]" /> Chatbolt for Enterprise
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#111111] tracking-tight font-medium">
            Compliance & scale, secured.
          </h1>
          <p className="text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
            Run autonomous agent fleets with private VPC isolations, single sign-on (SSO), and strictly zero retention LLM data policies.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 space-y-4">
            <div className="w-10 h-10 bg-[#00E599]/10 rounded-2xl flex items-center justify-center text-[#00E599]">
              <HardDrive size={20} />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">Isolated Agent VPC</h3>
            <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
              Provision virtual networks for isolated execution nodes. Safely run Playwright browser crawlers with dedicated proxy routing and static IPs.
            </p>
          </div>

          <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 space-y-4">
            <div className="w-10 h-10 bg-[#00E599]/10 rounded-2xl flex items-center justify-center text-[#00E599]">
              <Key size={20} />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">SSO & SAML Security</h3>
            <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
              Integrate enterprise directory providers (Okta, Azure AD) with ease. Enforce role-based access control (RBAC) and audit log tracking.
            </p>
          </div>

          <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 space-y-4">
            <div className="w-10 h-10 bg-[#00E599]/10 rounded-2xl flex items-center justify-center text-[#00E599]">
              <Cpu size={20} />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">Bring Your Own Keys (BYOK)</h3>
            <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
              Calibrate the platform to route all LLM calls through your own secure OpenAI or Anthropic gateways. Keep data completely within your domain.
            </p>
          </div>

          <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 space-y-4">
            <div className="w-10 h-10 bg-[#00E599]/10 rounded-2xl flex items-center justify-center text-[#00E599]">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">AES-256 Vault encryption</h3>
            <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
              Securely integrate third-party connector tokens (Slack, Gmail, GitHub). Keys are decrypted strictly in-memory during agent execution.
            </p>
          </div>
        </div>

        {/* CTA Deploy Segment */}
        <div className="bg-white border-2 border-black rounded-3xl p-8 text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-serif font-bold text-[#111111]">Ready to Audit Contract Compliance?</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Deploy our pre-calibrated Enterprise Compliance Auditor Agent to scan contracts against GDPR and SOC2 frameworks immediately.
            </p>
          </div>

          <button
            onClick={handleDeployEnterprise}
            disabled={loading}
            className="px-8 py-4 bg-black text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/20"
          >
            {loading ? 'Initiating Pipeline...' : '🚀 Initiate Compliance Audit Pipeline'}
          </button>
        </div>

      </main>

      <Footer />
    </div>
  )
}
