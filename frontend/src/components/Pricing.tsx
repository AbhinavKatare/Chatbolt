'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  const plans = [
    {
      name: 'Pro',
      price: billingCycle === 'monthly' ? '₹2,100' : '₹1,680',
      usd: billingCycle === 'monthly' ? '$25' : '$20',
      tagline: 'Serious automation for professionals',
      features: [
        '3 AI Agents',
        '2,500 message credits/month',
        'Web research capabilities',
        'WhatsApp + Email automation',
        'Salesforce integration',
        'Full analytics dashboard',
        'Standard support'
      ],
      cta: 'Choose Pro',
      featured: true
    },
    {
      name: 'Premium',
      price: billingCycle === 'monthly' ? '₹4,900' : '₹3,920',
      usd: billingCycle === 'monthly' ? '$59' : '$47',
      tagline: 'The ultimate agent workforce',
      features: [
        '10 AI Agents',
        '10,000 message credits/month',
        'Custom workflow builder',
        'White-label options',
        'Team collaboration (3 seats)',
        'API & Webhook access',
        'Priority support',
        'Dedicated account manager'
      ],
      cta: 'Go Premium',
      featured: false
    }
  ]

  return (
    <section id="pricing" className="py-32 bg-[#FDFDFB]">
      <div className="container mx-auto px-6">
        <div className="text-center mb-24">
          <div className="mt-12 inline-flex items-center p-1 bg-black/5 rounded-none border border-black/10">
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={`px-8 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all ${billingCycle === 'monthly' ? 'bg-[#00DFB8] text-[#FDFDFB]' : 'text-[#555555] hover:text-[#1A1A1A]'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('annual')}
              className={`px-8 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${billingCycle === 'annual' ? 'bg-[#00DFB8] text-[#FDFDFB]' : 'text-[#555555] hover:text-[#1A1A1A]'}`}
            >
              Annual <span className="text-[9px] opacity-70">(-20%)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div 
              key={plan.name} 
              className={`p-12 border transition-all duration-500 flex flex-col group ${plan.featured ? 'border-[#00DFB8] bg-black/[0.02] -translate-y-4 shadow-2xl shadow-black/50' : 'border-black/5 bg-[#FFFFFF] hover:border-[#8A9A97]/30'}`}
            >
              <div className="mb-12">
                <div className="text-[11px] font-bold text-[#00DFB8] uppercase tracking-[0.3em] mb-6">{plan.name}</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="display-title text-6xl text-[#1A1A1A] tracking-tighter">{plan.price}</span>
                  <span className="text-[#444] text-xs font-bold uppercase tracking-widest">/mo</span>
                </div>
                <div className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-6">
                  or {plan.usd}/mo
                </div>
                <div className="text-xs font-bold text-[#555555] uppercase tracking-widest">{plan.tagline}</div>
              </div>

              <div className="flex-1 mb-12">
                <ul className="space-y-5 list-none p-0">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-4 text-[12px] font-medium text-[#555555] leading-tight group-hover:text-[#1A1A1A] transition-colors">
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className="text-[#00DFB8] flex-shrink-0 mt-0.5">
                        <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Link 
                href="/signup" 
                className={`btn ${plan.featured ? 'btn-primary' : 'btn-secondary'} w-full py-5 text-[11px] font-bold uppercase tracking-[0.2em] no-underline hover:no-underline`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

