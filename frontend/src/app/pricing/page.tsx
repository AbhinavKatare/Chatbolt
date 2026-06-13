'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Check, Zap, Shield, Sparkles, HelpCircle } from 'lucide-react'
import { getSession, api } from '@/lib/api'

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    getSession().then(setSession).catch(() => {})
  }, [])

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'free') {
      router.push('/signup?plan=free')
      return
    }
    if (planId === 'enterprise') {
      router.push('mailto:sales@chatbolt.io?subject=Chatbolt%20Enterprise%20Inquiry')
      return
    }

    setLoading(true)
    try {
      if (!session) {
        router.push(`/signup?plan=${planId}&interval=${billingPeriod}`)
      } else {
        const res = await api.billing.checkout(planId)
        if (res && res.url) {
          window.location.href = res.url
        } else {
          router.push(`/dashboard/settings/billing`)
        }
      }
    } catch (err) {
      router.push(`/signup?plan=${planId}&interval=${billingPeriod}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans antialiased flex flex-col justify-between selection:bg-[#534AB7]/10 relative overflow-x-hidden">
      
      {/* Radial Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(83,74,183,0.03)_0,white_60%)] pointer-events-none z-0" />

      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-32 pb-24 space-y-16 z-10">
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#534AB7]/5 border border-[#534AB7]/10 text-xs font-bold text-[#534AB7]">
            <Zap size={11} className="fill-current animate-pulse" />
            <span>Pricing Options</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-zinc-900 tracking-tight font-medium">
            Simple, flexible pricing.
          </h1>
          <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed font-medium">
            Provision autonomous agent fleets and let your digital workers execute multi-step operations 24/7.
          </p>
        </div>

        {/* Monthly/Annual Toggle */}
        <div className="flex items-center justify-center gap-4">
          <span className={`text-xs font-bold ${billingPeriod === 'monthly' ? 'text-[#534AB7]' : 'text-zinc-400'}`}>Monthly</span>
          <button
            onClick={() => setBillingPeriod(prev => prev === 'monthly' ? 'annual' : 'monthly')}
            className="w-11 h-6 bg-zinc-200 hover:bg-zinc-300 rounded-full p-1 transition-colors relative flex items-center"
          >
            <div
              className={`w-4 h-4 bg-white rounded-full shadow-md transition-all transform ${
                billingPeriod === 'annual' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-bold ${billingPeriod === 'annual' ? 'text-[#534AB7]' : 'text-zinc-400'}`}>Annually</span>
            <span className="px-2 py-0.5 rounded-full bg-[#00E599]/10 border border-[#00E599]/20 text-[9px] font-black text-[#00E599] uppercase tracking-wider">Save 16%</span>
          </div>
        </div>

        {/* Pricing Cards Grid (4 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
          {/* Free */}
          <div className="bg-[#F9F9FB] border border-zinc-200/80 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            <div className="space-y-6">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Free Tier</span>
                <h3 className="text-2xl font-serif font-bold text-zinc-900 mt-2">Free</h3>
                <p className="text-[11px] text-zinc-500 mt-1 font-semibold leading-normal">Enough to experience the product, not to depend on it.</p>
              </div>

              <div className="w-full h-[1px] bg-zinc-200/60" />

              <ul className="space-y-3 text-xs text-zinc-650 font-medium">
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>20 tasks per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>2 active integrations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>1 team member limit</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>2 automations limit</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-400 line-through">
                  <span>API access</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSelectPlan('free')}
              disabled={loading}
              className="w-full py-2.5 mt-8 bg-zinc-100 text-zinc-800 font-bold uppercase text-[9px] tracking-widest rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer border border-zinc-200"
            >
              Get started free
            </button>
          </div>

          {/* Pro */}
          <div className="bg-white border-2 border-[#534AB7] rounded-2xl p-6 flex flex-col justify-between shadow-lg relative transform hover:scale-[1.01] transition-all">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#534AB7] text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
              Most Popular
            </span>
            <div className="space-y-6">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#534AB7] flex items-center gap-1">
                  <Sparkles size={10} fill="currentColor" /> Premium Fleet
                </span>
                <h3 className="text-2xl font-serif font-bold text-zinc-900 mt-2">
                  ${billingPeriod === 'monthly' ? '19' : '190'}
                  <span className="text-xs text-zinc-500 font-sans font-medium"> / {billingPeriod === 'monthly' ? 'month' : 'year'}</span>
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1 font-semibold leading-normal">Unlocks multi-agent persistent task runner workloads.</p>
              </div>

              <div className="w-full h-[1px] bg-zinc-250" />

              <ul className="space-y-3 text-xs text-zinc-650 font-medium">
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>500 tasks per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>All integrations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>1 team member limit</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>20 automations limit</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>500 API calls limit</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSelectPlan('pro')}
              disabled={loading}
              className="w-full py-2.5 mt-8 bg-[#534AB7] text-white font-bold uppercase text-[9px] tracking-widest rounded-xl hover:bg-[#43399F] transition-colors shadow-md cursor-pointer"
            >
              Upgrade to Pro
            </button>
          </div>

          {/* Team */}
          <div className="bg-[#F9F9FB] border border-zinc-200/80 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            <div className="space-y-6">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Collaboration</span>
                <h3 className="text-2xl font-serif font-bold text-zinc-900 mt-2">
                  ${billingPeriod === 'monthly' ? '49' : '490'}
                  <span className="text-xs text-zinc-500 font-sans font-medium"> / {billingPeriod === 'monthly' ? 'month' : 'year'}</span>
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1 font-semibold leading-normal">For collaborative workspaces and automated teams.</p>
              </div>

              <div className="w-full h-[1px] bg-zinc-200/60" />

              <ul className="space-y-3 text-xs text-zinc-650 font-medium">
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>2,000 tasks per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>All integrations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>Up to 10 team members</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>Unlimited automations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>2,000 API calls limit</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSelectPlan('team')}
              disabled={loading}
              className="w-full py-2.5 mt-8 bg-zinc-950 text-white font-bold uppercase text-[9px] tracking-widest rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Upgrade to Team
            </button>
          </div>

          {/* Enterprise */}
          <div className="bg-[#F9F9FB] border border-zinc-200/80 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            <div className="space-y-6">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Scale</span>
                <h3 className="text-2xl font-serif font-bold text-zinc-900 mt-2">Custom</h3>
                <p className="text-[11px] text-zinc-500 mt-1 font-semibold leading-normal">Dedicated processing units and custom governance SLAs.</p>
              </div>

              <div className="w-full h-[1px] bg-zinc-200/60" />

              <ul className="space-y-3 text-xs text-zinc-650 font-medium">
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>Unlimited tasks</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>All integrations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>Unlimited team members</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>Single Sign-On (SSO)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#00E599]" />
                  <span>Custom agents registry</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSelectPlan('enterprise')}
              className="w-full py-2.5 mt-8 bg-zinc-100 text-zinc-800 font-bold uppercase text-[9px] tracking-widest rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer border border-zinc-200"
            >
              Contact Sales
            </button>
          </div>
        </div>

        {/* Security Alert Badge */}
        <div className="max-w-xl mx-auto bg-zinc-50 border border-zinc-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <Shield size={24} className="text-[#534AB7] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-900 tracking-tight">Enterprise Compliance Assured</h4>
            <p className="text-[11px] text-zinc-500 leading-relaxed font-semibold">
              All credentials tokens are stored locally and encrypted using AES-256 vault configurations. We strictly adhere to SOC2 Type II compliance frameworks.
            </p>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  )
}
