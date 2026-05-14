'use client'
import { useState } from 'react'

export default function FAQ() {
  const faqs = [
    {
      q: 'How long does setup take?',
      a: 'Most businesses are live in under 30 minutes. Create an account, upload your documents or paste your website URL, copy the embed code onto your site. That\'s it.'
    },
    {
      q: 'Do you use my data to train your AI models?',
      a: 'Never. Your data is exclusively used to power your own agent and is never shared with, sold to, or used to train any external models. We\'re SOC 2 Type II certified.'
    },
    {
      q: 'Which AI model powers Chatbolt?',
      a: 'We use a combination of NVIDIA Llama 3.1 and Nemotron models for the best balance of speed, accuracy, and enterprise-grade safety.'
    },
    {
      q: 'Can the agent take real actions?',
      a: 'Yes. With integrations like Shopify, Razorpay, and Salesforce, your agent can update orders, book appointments, and qualify leads without human intervention.'
    }
  ]

  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-40 bg-[#FDFDFB] border-t border-black/5">
      <div className="container mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-32">
          <div className="lg:w-1/3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 border border-[#00DFB8]/20 mb-8">
              <span className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.3em]">FAQ</span>
            </div>
            <h2 className="display-title text-4xl md:text-7xl text-[#1A1A1A] mb-10 tracking-tighter leading-none">
              Questions <br /> <span className="text-[#00DFB8]">answered.</span>
            </h2>
          </div>
          
          <div className="lg:w-2/3">
            <div className="divide-y divide-white/5">
              {faqs.map((faq, i) => (
                <div key={i} className="py-10">
                  <button 
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    className="w-full flex items-center justify-between text-left group"
                  >
                    <span className={`text-2xl font-bold transition-colors ${openIndex === i ? 'text-[#00DFB8]' : 'text-[#1A1A1A] group-hover:text-[#00DFB8]'}`}>
                      {faq.q}
                    </span>
                    <div className={`w-8 h-8 flex items-center justify-center transition-all ${openIndex === i ? 'rotate-45 text-[#00DFB8]' : 'text-[#444]'}`}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </button>
                  {openIndex === i && (
                    <div className="mt-8 text-[#555555] text-lg leading-relaxed font-medium max-w-2xl animate-fade-in">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

