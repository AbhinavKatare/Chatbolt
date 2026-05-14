'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  return (
    <div className="min-h-screen bg-[#FDFDFB] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <div className="w-10 h-10 bg-[#B8FF00] rounded-sm flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
              <path d="M3 9C3 5.686 5.686 3 9 3s6 2.686 6 6-2.686 6-6 6H3V9z" fill="#0A0A0A"/>
              <circle cx="9" cy="9" r="2" fill="#B8FF00"/>
            </svg>
          </div>
        </div>

        <div className="card p-10 bg-[#FFFFFF] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-black/5">
            <div className="h-full bg-[#B8FF00] transition-all duration-500" style={{ width: `${(step/3)*100}%` }} />
          </div>

          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <h2 className="display-title text-2xl text-[#1A1A1A] mb-2">Welcome to Chatbolt</h2>
                <p className="text-sm-muted">Let's set up your business workspace.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-label block mb-2">Workspace Name</label>
                  <input className="w-full bg-[#FDFDFB] border border-black/5 rounded-lg p-3 text-[#1A1A1A] focus:border-[#B8FF00]/40 outline-none" placeholder="e.g. Acme Corp" />
                </div>
                <div>
                  <label className="text-label block mb-2">Industry</label>
                  <select className="w-full bg-[#FDFDFB] border border-black/5 rounded-lg p-3 text-[#1A1A1A] focus:border-[#B8FF00]/40 outline-none">
                    <option>E-commerce</option>
                    <option>SaaS</option>
                    <option>Agency</option>
                    <option>Healthcare</option>
                    <option>Real Estate</option>
                  </select>
                </div>
              </div>
              <button onClick={() => setStep(2)} className="btn btn-primary w-full py-4">Continue →</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center">
                <h2 className="display-title text-2xl text-[#1A1A1A] mb-2">Primary Goal</h2>
                <p className="text-sm-muted">How should your AI agents help you first?</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { title: 'Support & Helpdesk', icon: '🛟' },
                  { title: 'Sales & Lead Gen', icon: '🎯' },
                  { title: 'Booking & Meetings', icon: '📅' },
                ].map(g => (
                  <button key={g.title} className="flex items-center gap-4 p-4 rounded-lg bg-[#FDFDFB] border border-black/5 hover:border-[#B8FF00]/40 transition-all text-left group">
                    <span className="text-xl">{g.icon}</span>
                    <span className="text-sm text-[#555555] group-hover:text-[#1A1A1A] font-semibold">{g.title}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">Back</button>
                <button onClick={() => setStep(3)} className="btn btn-primary flex-[2]">Almost Done →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#B8FF00]/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 border border-[#B8FF00]/20">
                  🚀
                </div>
                <h2 className="display-title text-2xl text-[#1A1A1A] mb-2">Ready for Autopilot?</h2>
                <p className="text-sm-muted">Would you like us to automatically build your first 5 agents based on your industry?</p>
              </div>
              <div className="space-y-3">
                <Link href="/dashboard/autopilot" className="btn btn-primary w-full py-4 no-underline hover:no-underline">Yes, Launch Autopilot →</Link>
                <Link href="/dashboard" className="btn btn-secondary w-full py-4 no-underline hover:no-underline">I'll set them up manually</Link>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-[#444] mt-8 uppercase tracking-[0.2em] font-bold">
          Empowering your business with Chatbolt
        </p>
      </div>
    </div>
  )
}

