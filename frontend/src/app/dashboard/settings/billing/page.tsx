'use client'

import React, { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { CreditCard, ArrowUpRight, Zap, RefreshCw, AlertCircle, CheckCircle2, Sparkles, Check, HelpCircle, ToggleLeft, ToggleRight } from 'lucide-react'

export default function BillingSettingsPage() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  
  const [subData, setSubData] = useState<any>(null)
  const [usageData, setUsageData] = useState<any>(null)
  const [overageEnabled, setOverageEnabled] = useState(false)
  const [showNudge, setShowNudge] = useState(false)

  const loadBillingInfo = async () => {
    setLoading(true)
    try {
      const sub = await api.billing.subscription()
      setSubData(sub)
      setOverageEnabled(sub?.subscription?.overage_enabled || false)
      
      const usage = await api.billing.usage()
      setUsageData(usage)
      
      // Check for annual nudge eligibility
      const nudgeRes = await api.billing.checkAnnualNudge()
      setShowNudge(nudgeRes.eligible)
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

  const handleUpgrade = async (plan: string, interval: 'monthly' | 'annual' = 'monthly') => {
    setActionLoading(true)
    try {
      const res = await api.billing.checkout(plan, interval)
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

  if (loading) {
    return (
      <div className="flex-1 p-6 bg-[#050507] text-[#EDEDED] flex flex-col items-center justify-center min-h-[500px]">
        <div className="animate-spin text-[#00E599] mb-4">
          <RefreshCw size={24} />
        </div>
        <p className="text-xs text-zinc-500 font-mono">Loading billing details...</p>
      </div>
    )
  }

  const planName = (subData?.plan || 'Free').toUpperCase()
  const tasksUsed = usageData?.tasks?.current || 0
  const tasksLimit = usageData?.tasks?.limit || 20
  const isFree = planName === 'FREE' || planName === 'NONE'
  const nextBilling = subData?.subscription?.current_period_end 
    ? new Date(subData.subscription.current_period_end).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'N/A'

  const taskPercent = tasksLimit > 0 ? Math.min(100, Math.round((tasksUsed / tasksLimit) * 100)) : 0

  return (
    <div className="flex-1 p-6 bg-[#050507] text-[#EDEDED] overflow-y-auto custom-scrollbar space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
        <div>
          <h1 className="text-xl font-serif text-white tracking-tight font-medium">Billing & Plan</h1>
          <p className="text-xs text-zinc-500 mt-1">Manage your subscriptions, limits, and team seats.</p>
        </div>
        <button
          onClick={loadBillingInfo}
          className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-white/[0.04] transition-all cursor-pointer"
          title="Refresh statistics"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Annual Nudge Banner */}
      {showNudge && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-[#00E599]/5 border border-[#00E599]/25 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#00E599] font-bold uppercase tracking-wider">
              <Sparkles size={13} className="animate-pulse" />
              <span>Special Offer</span>
            </div>
            <h3 className="text-sm font-bold text-white">Save $38 this year with Annual Pro</h3>
            <p className="text-xs text-zinc-400">Switch your monthly Pro subscription to annual and enjoy uninterrupted service at discounted rates.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleDismissNudge}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl border border-white/[0.05] transition-all cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={() => handleUpgrade('pro', 'annual')}
              disabled={actionLoading}
              className="px-4 py-2 bg-[#00E599] hover:bg-[#00c885] text-black text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-[#00E599]/10"
            >
              Accept Offer <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan Card */}
        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Current Plan</span>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-widest ${
                isFree ? 'bg-zinc-800 text-zinc-400' : 'bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/20'
              }`}>
                {planName}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-2 font-medium">
              {isFree 
                ? 'Enough to experience the product, upgrade to depend on it.' 
                : 'Enjoy unlimited integration and higher execution limits.'}
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/[0.04]">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-zinc-500">Status</span>
              <span className="text-white capitalize">{subData?.subscription?.status || 'Active'}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-zinc-500">Renewal Date</span>
              <span className="text-white">{nextBilling}</span>
            </div>
          </div>

          {!isFree ? (
            <button
              onClick={handleManageSubscription}
              disabled={actionLoading}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 text-white font-bold uppercase text-[9px] tracking-widest rounded-xl transition-all cursor-pointer border border-white/[0.08]"
            >
              {actionLoading ? 'Loading...' : 'Manage subscription'}
            </button>
          ) : (
            <button
              onClick={() => handleUpgrade('pro')}
              disabled={actionLoading}
              className="w-full py-2.5 bg-[#00E599] hover:bg-[#00f7cc] text-black font-black uppercase text-[9px] tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              Upgrade to Pro <ArrowUpRight size={12} />
            </button>
          )}
        </div>

        {/* Usage Card */}
        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-6 md:col-span-2 space-y-6">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Monthly Usage</span>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-zinc-300 flex items-center gap-1.5">
                  <Zap size={13} className="text-[#00E599]" />
                  Tasks Run
                </span>
                <span className="text-zinc-400">
                  {tasksUsed} / {tasksLimit === -1 ? '∞' : tasksLimit}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-900 border border-white/[0.03] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    taskPercent >= 100 ? 'bg-red-500' : taskPercent >= 80 ? 'bg-amber-500' : 'bg-[#00E599]'
                  }`}
                  style={{ width: `${tasksLimit === -1 ? 0 : taskPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.04]">
              <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Connected Integrations</p>
                <p className="text-lg font-serif font-bold text-white mt-1">
                  {usageData?.integrations?.current || 0} / {usageData?.integrations?.limit === -1 ? '∞' : (usageData?.integrations?.limit || 2)}
                </p>
              </div>
              <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Teammates Invited</p>
                <p className="text-lg font-serif font-bold text-white mt-1">
                  {usageData?.team_members?.current || 0} / {usageData?.team_members?.limit === -1 ? '∞' : (usageData?.team_members?.limit || 1)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pay-as-you-go Overage Card */}
      {!isFree && (
        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Billing Settings</span>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Pay-as-you-go Overage</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/20 font-bold uppercase">Opt-in</span>
            </h3>
            <p className="text-xs text-zinc-400 max-w-xl">
              Enable task overages to avoid hard-blocks if you exceed your monthly task limit. 
              Overage tasks are billed at a flat rate of <strong style={{ color: '#00E599' }}>$0.05 per task</strong>, added to your upcoming Stripe invoice line items.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {subData?.subscription?.overage_tasks_this_month > 0 && (
              <div className="text-right">
                <div className="text-[10px] font-bold text-zinc-500 uppercase">Overage Tasks This Month</div>
                <div className="text-sm font-bold text-white">{subData.subscription.overage_tasks_this_month} (${(subData.subscription.overage_tasks_this_month * 0.05).toFixed(2)})</div>
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
    </div>
  )
}
