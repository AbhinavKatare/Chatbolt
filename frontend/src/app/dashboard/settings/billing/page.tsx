'use client'

import React, { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  CreditCard,
  ArrowUpRight,
  Zap,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Check,
  ToggleLeft,
  ToggleRight,
  Shield,
  Key,
  Layers,
  Users,
  Activity,
  Cpu,
  Building2,
  Lock,
  ExternalLink,
  ChevronRight
} from 'lucide-react'

export default function BillingSettingsPage() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly')
  
  const [subData, setSubData] = useState<any>(null)
  const [usageData, setUsageData] = useState<any>(null)
  const [entitlementsData, setEntitlementsData] = useState<any>(null)
  const [overageEnabled, setOverageEnabled] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  
  // Digital license activation modal state
  const [licenseInput, setLicenseInput] = useState('')
  const [showLicenseModal, setShowLicenseModal] = useState(false)
  const [licenseActivating, setLicenseActivating] = useState(false)

  const loadBillingInfo = async () => {
    setLoading(true)
    try {
      const [sub, usage, ent, nudgeRes] = await Promise.all([
        api.billing.subscription().catch(() => null),
        api.billing.usage().catch(() => null),
        api.billing.entitlements().catch(() => null),
        api.billing.checkAnnualNudge().catch(() => ({ eligible: false }))
      ])

      setSubData(sub)
      setOverageEnabled(sub?.subscription?.overage_enabled || false)
      setUsageData(usage)
      setEntitlementsData(ent)
      setShowNudge(nudgeRes?.eligible || false)
    } catch (err: any) {
      toastError('Failed to load billing information', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBillingInfo()
  }, [])

  const handleManageSubscription = async () => {
    setActionLoading(true)
    try {
      const res = await api.billing.portal()
      if (res && res.url) {
        window.location.href = res.url
      } else {
        toastError('Failed to redirect', 'Stripe portal url not returned.')
      }
    } catch (err: any) {
      toastError('Error opening Stripe billing portal', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpgrade = async (plan: string) => {
    setActionLoading(true)
    try {
      const res = await api.billing.checkout(plan, billingInterval)
      if (res && res.url) {
        window.location.href = res.url
      } else {
        toastError('Checkout error', 'Stripe checkout url not returned.')
      }
    } catch (err: any) {
      toastError('Failed to create checkout session', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleOverage = async () => {
    setActionLoading(true)
    try {
      const targetState = !overageEnabled
      const res = await api.billing.toggleOverage(targetState)
      setOverageEnabled(res.overage_enabled)
      toastSuccess('Overage Settings Updated', `Pay-as-you-go overages are now ${res.overage_enabled ? 'enabled' : 'disabled'}.`)
    } catch (err: any) {
      toastError('Failed to update overage settings', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDismissNudge = async () => {
    try {
      await api.billing.dismissAnnualNudge()
      setShowNudge(false)
      toastInfo('Nudge Dismissed', 'You can upgrade to an annual plan anytime.')
    } catch (err: any) {
      toastError('Failed to dismiss nudge', err.message)
    }
  }

  const handleActivateDigitalLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!licenseInput.trim()) return

    setLicenseActivating(true)
    try {
      const res = await api.billing.activateLicense(licenseInput.trim())
      toastSuccess('Enterprise License Activated', res.message || 'Enterprise capabilities unlocked.')
      setShowLicenseModal(false)
      setLicenseInput('')
      await loadBillingInfo()
    } catch (err: any) {
      toastError('License Activation Failed', err.message)
    } finally {
      setLicenseActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 bg-[#050507] text-[#EDEDED] flex flex-col items-center justify-center min-h-[500px]">
        <div className="animate-spin text-[#00E599] mb-4">
          <RefreshCw size={24} />
        </div>
        <p className="text-xs text-zinc-500 font-mono">Verifying server-side entitlements & billing status...</p>
      </div>
    )
  }

  const planName = (entitlementsData?.plan || subData?.plan || 'free').toUpperCase()
  const tasksUsed = usageData?.tasks?.current || 0
  const tasksLimit = usageData?.tasks?.limit || 20
  const isFree = planName === 'FREE' || planName === 'NONE'
  const isEnterprise = planName === 'ENTERPRISE' || entitlementsData?.isEnterpriseLicensed
  const nextBilling = subData?.subscription?.current_period_end 
    ? new Date(subData.subscription.current_period_end).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : (isEnterprise && entitlementsData?.source === 'digital_key' ? 'Perpetual / Commercial Key' : 'N/A')

  const taskPercent = tasksLimit > 0 ? Math.min(100, Math.round((tasksUsed / tasksLimit) * 100)) : 0

  const tiers = [
    {
      id: 'free',
      name: 'Free',
      priceMonthly: 0,
      priceAnnual: 0,
      description: 'Test autonomous agent workflows on local hardware.',
      features: [
        '20 tasks / month',
        '2 connected integrations',
        '1 team seat',
        '2 active automations',
        'Concurrency limit: 3 agents',
        'Community support'
      ],
      current: planName === 'FREE'
    },
    {
      id: 'pro',
      name: 'Pro',
      priceMonthly: 29,
      priceAnnual: 290,
      description: 'For professionals automating high-value recurring operations.',
      features: [
        '500 tasks / month',
        'Unlimited standard integrations',
        '1 team seat',
        '20 active automations',
        'Concurrency limit: 8 agents',
        'ReAct reasoning engine access',
        'Pay-as-you-go task overages'
      ],
      highlight: true,
      current: planName === 'PRO'
    },
    {
      id: 'team',
      name: 'Team',
      priceMonthly: 99,
      priceAnnual: 990,
      description: 'Collaborative autonomous squads with TeamLead coordination.',
      features: [
        '2,000 tasks / month',
        'Unlimited integrations',
        '10 team seats',
        'Unlimited automations',
        'Concurrency limit: 20 agents',
        'Multi-agent Squads (Mktg/Tech/Ops)',
        'Team-scoped Shared Memory',
        'Human-in-the-loop intervention'
      ],
      current: planName === 'TEAM'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      priceMonthly: 499,
      priceAnnual: 4990,
      description: 'Simulated company orchestration, SLAs, and compliance.',
      features: [
        'Unlimited tasks & automations',
        'Unlimited team seats',
        'Concurrency limit: 50+ agents',
        'Cross-Team Company DAGs',
        'Automated 5-Whys Post-Mortems',
        '4-Tier Autonomy Matrix Gate',
        'SOC2 / HIPAA / GDPR audit export',
        'Bring-your-own LLM keys & models',
        'Air-gapped digital license option'
      ],
      badge: 'Commercial',
      current: planName === 'ENTERPRISE'
    }
  ]

  return (
    <div className="flex-1 p-6 bg-[#050507] text-[#EDEDED] overflow-y-auto custom-scrollbar space-y-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.06] pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/20">
              Stripe Secure Billing
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Server-Side Gated</span>
          </div>
          <h1 className="text-2xl font-serif text-white tracking-tight font-medium">Billing & Plan Entitlements</h1>
          <p className="text-xs text-zinc-400 mt-1">Manage subscription tiers, team seats, resource quotas, and commercial enterprise licenses.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLicenseModal(true)}
            className="px-3 py-2 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Key size={14} className="text-[#00E599]" />
            <span>Enter License Key</span>
          </button>
          
          {subData?.subscription?.stripe_customer_id && (
            <button
              onClick={handleManageSubscription}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl border border-white/[0.08] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <CreditCard size={14} />
              <span>Stripe Portal</span>
              <ExternalLink size={12} className="text-zinc-400" />
            </button>
          )}

          <button
            onClick={loadBillingInfo}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer border border-transparent hover:border-white/[0.06]"
            title="Refresh billing data"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ANNUAL NUDGE BANNER */}
      {showNudge && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#00E599]/10 to-transparent border border-[#00E599]/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#00E599] font-bold uppercase tracking-wider">
              <Sparkles size={14} className="animate-pulse" />
              <span>Annual Switch Discount</span>
            </div>
            <h3 className="text-sm font-bold text-white">Save 20% on Annual Pro</h3>
            <p className="text-xs text-zinc-400">Lock in your autonomous workflow capacity and save $58 every year with annual billing.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleDismissNudge}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl border border-white/[0.05] transition-all cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={() => handleUpgrade('pro')}
              disabled={actionLoading}
              className="px-4 py-2 bg-[#00E599] hover:bg-[#00c885] text-black text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-[#00E599]/10"
            >
              Switch to Annual <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* OVERVIEW METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CURRENT PLAN CARD */}
        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-6 flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Active Tier</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-widest ${
                isEnterprise 
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' 
                  : planName === 'TEAM' 
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                  : planName === 'PRO'
                  ? 'bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30'
                  : 'bg-zinc-800 text-zinc-400 border border-white/[0.06]'
              }`}>
                {planName}
              </span>
            </div>
            
            <div className="text-2xl font-serif font-bold text-white">
              {planName === 'ENTERPRISE' ? 'Simulated Company Enterprise' : planName === 'TEAM' ? 'Team Workforce Squad' : planName === 'PRO' ? 'Professional Automation' : 'Free Sandbox Tier'}
            </div>
            
            <p className="text-xs text-zinc-400">
              Source: <strong className="text-zinc-200 capitalize">{entitlementsData?.source?.replace('_', ' ') || 'Default'}</strong>
            </p>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-white/[0.04]">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-zinc-500">Subscription Status</span>
              <span className="text-emerald-400 font-semibold capitalize flex items-center gap-1">
                <CheckCircle2 size={12} />
                {subData?.subscription?.status || 'Active'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-zinc-500">Renewal / Cycle Date</span>
              <span className="text-white font-mono">{nextBilling}</span>
            </div>
          </div>
        </div>

        {/* RESOURCE USAGE CARD */}
        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-6 md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Monthly Usage Quotas</span>
            <span className="text-xs text-zinc-500 font-mono">Resets automatically each billing cycle</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-zinc-300 flex items-center gap-1.5">
                  <Zap size={14} className="text-[#00E599]" />
                  Tasks Executed This Month
                </span>
                <span className="text-zinc-400 font-mono">
                  {tasksUsed} / {tasksLimit === -1 ? '∞ Unlimited' : tasksLimit}
                </span>
              </div>
              <div className="h-2 bg-zinc-900 border border-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    taskPercent >= 100 ? 'bg-red-500' : taskPercent >= 80 ? 'bg-amber-500' : 'bg-[#00E599]'
                  }`}
                  style={{ width: `${tasksLimit === -1 ? 0 : taskPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/[0.04]">
              <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Integrations</p>
                <p className="text-base font-serif font-bold text-white mt-1">
                  {usageData?.integrations?.current || 0} / {usageData?.integrations?.limit === -1 ? '∞' : (usageData?.integrations?.limit || 2)}
                </p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Team Seats</p>
                <p className="text-base font-serif font-bold text-white mt-1">
                  {usageData?.team_members?.current || 0} / {usageData?.team_members?.limit === -1 ? '∞' : (usageData?.team_members?.limit || 1)}
                </p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Automations</p>
                <p className="text-base font-serif font-bold text-white mt-1">
                  {usageData?.automations?.current || 0} / {usageData?.automations?.limit === -1 ? '∞' : (usageData?.automations?.limit || 2)}
                </p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">API Calls</p>
                <p className="text-base font-serif font-bold text-white mt-1">
                  {usageData?.api_calls?.current || 0} / {usageData?.api_calls?.limit === -1 ? '∞' : (usageData?.api_calls?.limit || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SERVER-SIDE ENTITLEMENTS STATUS */}
      <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[#00E599]" />
            <h2 className="text-sm font-bold text-white">Server-Side Feature Entitlements</h2>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            Verified {entitlementsData?.verifiedAt ? new Date(entitlementsData.verifiedAt).toLocaleTimeString() : 'Live'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { key: 'company_orchestration', label: 'Cross-Team Company DAGs', tier: 'Enterprise' },
            { key: 'sla_post_mortem', label: '5-Whys Incident Post-Mortems', tier: 'Enterprise' },
            { key: 'team_workforce', label: 'Multi-Agent Teams & TeamLead', tier: 'Team / Ent' },
            { key: 'team_shared_memory', label: 'Team Shared Memory Persistence', tier: 'Team / Ent' },
            { key: 'high_concurrency_pool', label: 'High-Concurrency Agent Pools (20+)', tier: 'Team / Ent' },
            { key: 'soc2_audit_export', label: 'SOC2 & Compliance Audit Export', tier: 'Enterprise' }
          ].map(feat => {
            const isUnlocked = entitlementsData?.features?.[feat.key] || false
            return (
              <div
                key={feat.key}
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isUnlocked
                    ? 'bg-[#00E599]/5 border-[#00E599]/20 text-white'
                    : 'bg-white/[0.01] border-white/[0.04] text-zinc-500'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isUnlocked ? (
                    <CheckCircle2 size={16} className="text-[#00E599] shrink-0" />
                  ) : (
                    <Lock size={16} className="text-zinc-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-semibold">{feat.label}</div>
                    <div className="text-[9px] uppercase tracking-wider font-mono text-zinc-500">Requires {feat.tier}</div>
                  </div>
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isUnlocked ? 'bg-[#00E599]/10 text-[#00E599]' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {isUnlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* PLAN COMPARISON & STRIPE CHECKOUT TIERS */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.06] pb-4 gap-4">
          <div>
            <h2 className="text-lg font-serif font-medium text-white">Subscription Plans</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Scale your autonomous workforce with flexible flat pricing.</p>
          </div>

          {/* INTERVAL TOGGLE */}
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl shrink-0">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                billingInterval === 'monthly'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('annual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                billingInterval === 'annual'
                  ? 'bg-[#00E599] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Annual</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/20 font-black">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map(tier => {
            const price = billingInterval === 'annual' ? tier.priceAnnual : tier.priceMonthly
            const isCurrent = tier.current

            return (
              <div
                key={tier.id}
                className={`bg-[#0D0D11] border rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 relative ${
                  tier.highlight
                    ? 'border-[#00E599] shadow-[0_0_24px_rgba(0,229,153,0.12)]'
                    : isCurrent
                    ? 'border-white/20 bg-white/[0.02]'
                    : 'border-white/[0.06] hover:border-white/10'
                }`}
              >
                {tier.highlight && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-[#00E599] text-black text-[9px] font-black uppercase tracking-widest rounded-bl-xl shadow-md">
                    Recommended
                  </div>
                )}
                {tier.badge && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-purple-500 text-white text-[9px] font-black uppercase tracking-widest rounded-bl-xl">
                    {tier.badge}
                  </div>
                )}

                <div className="space-y-5 flex-1">
                  <div>
                    <h3 className="text-base font-bold text-white">{tier.name}</h3>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{tier.description}</p>
                  </div>

                  <div className="py-3 border-y border-white/[0.04]">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">${price}</span>
                      <span className="text-xs text-zinc-500">
                        {tier.id === 'free' ? '/ forever' : billingInterval === 'annual' ? '/ year' : '/ month'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {tier.features.map(f => (
                      <div key={f} className="flex items-start gap-2 text-xs text-zinc-300">
                        <Check size={14} className="text-[#00E599] mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  {isCurrent ? (
                    <div className="w-full py-2.5 bg-white/[0.04] text-zinc-400 text-xs font-bold rounded-xl text-center border border-white/[0.06]">
                      Current Plan
                    </div>
                  ) : tier.id === 'free' ? (
                    <div className="w-full py-2.5 bg-zinc-900 text-zinc-500 text-xs font-bold rounded-xl text-center">
                      Included
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(tier.id)}
                      disabled={actionLoading}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        tier.highlight
                          ? 'bg-[#00E599] hover:bg-[#00c885] text-black shadow-md shadow-[#00E599]/10'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08]'
                      }`}
                    >
                      <span>Upgrade to {tier.name}</span>
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* PAY-AS-YOU-GO OVERAGES */}
      {!isFree && (
        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Billing Settings</span>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Pay-as-you-go Task Overages</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/20 font-bold uppercase">Opt-in</span>
            </h3>
            <p className="text-xs text-zinc-400 max-w-2xl">
              Prevent operational disruptions when your team exceeds monthly quotas. 
              Extra tasks are billed at a flat rate of <strong className="text-[#00E599]">$0.05 per task</strong> added directly to your upcoming Stripe invoice.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {subData?.subscription?.overage_tasks_this_month > 0 && (
              <div className="text-right">
                <div className="text-[10px] font-bold text-zinc-500 uppercase">Unbilled Overages</div>
                <div className="text-sm font-bold text-white">
                  {subData.subscription.overage_tasks_this_month} (${(subData.subscription.overage_tasks_this_month * 0.05).toFixed(2)})
                </div>
              </div>
            )}
            <button
              onClick={handleToggleOverage}
              disabled={actionLoading}
              className="p-1 text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              {overageEnabled ? (
                <ToggleRight className="text-[#00E599]" size={36} />
              ) : (
                <ToggleLeft className="text-zinc-600" size={36} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* DIGITAL ENTERPRISE LICENSE KEY MODAL */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0D11] border border-white/[0.1] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div className="flex items-center gap-2 text-white">
                <Key size={18} className="text-[#00E599]" />
                <h3 className="text-base font-bold">Activate Enterprise License Key</h3>
              </div>
              <button
                onClick={() => setShowLicenseModal(false)}
                className="text-zinc-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              If your organization has purchased an on-premise or air-gapped commercial license, enter your cryptographically signed license key (<code className="text-zinc-200">CB-ENT-V1...</code>) below.
            </p>

            <form onSubmit={handleActivateDigitalLicense} className="space-y-4">
              <textarea
                value={licenseInput}
                onChange={e => setLicenseInput(e.target.value)}
                placeholder="CB-ENT-V1.eyJ0ZW5hbnRJZCI6...abc1234"
                rows={4}
                className="w-full p-3 bg-black/40 border border-white/[0.08] rounded-xl text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E599] transition-all resize-none"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLicenseModal(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl border border-white/[0.06] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={licenseActivating || !licenseInput.trim()}
                  className="px-4 py-2 bg-[#00E599] hover:bg-[#00c885] text-black text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-[#00E599]/10 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {licenseActivating ? 'Verifying HMAC...' : 'Activate License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
