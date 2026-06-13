'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { CheckCircle2, Loader2, Sparkles, Mail, Play, Calendar } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const { success: toastSuccess, error: toastError } = useToast()
  
  const [step, setStep] = useState(1)
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'premium' | null>(null)
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD')

  // Interstitial steps: 1 = Connect Gmail, 2 = Try Task, 3 = Morning Briefing
  const [interstitialStep, setInterstitialStep] = useState(1)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [completedMessage, setCompletedMessage] = useState(false)

  const plans = [
    { id: 'pro', name: 'Pro', usd: '$25', inr: '₹2,100', icon: '⚡' },
    { id: 'premium', name: 'Premium', usd: '$59', inr: '₹4,900', icon: '👑' },
  ]

  // Detect successful Gmail connection
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string' && event.data.startsWith('integration-connected:')) {
        const service = event.data.split(':')[1]
        if (service === 'gmail') {
          setGmailConnected(true)
          toastSuccess('Connected', 'Successfully connected Gmail workspace!')
          // Auto-advance to Step 2 after 1 second
          setTimeout(() => {
            setInterstitialStep(2)
          }, 1200)
        }
      }
    }
    
    window.addEventListener('message', handleOAuthMessage)
    return () => window.removeEventListener('message', handleOAuthMessage)
  }, [])

  const handleConnectGmail = async () => {
    setConnectingGmail(true)
    try {
      const res = await api.integrations.authUrl('gmail')
      const connectUrl = res.url
      
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      window.open(
        connectUrl,
        'connect_gmail',
        `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
      )
    } catch (err: any) {
      toastError('Connection Failed', err.message || 'Failed to retrieve auth URL.')
    } finally {
      setConnectingGmail(false)
    }
  }

  const handleAllSetRedirect = () => {
    setCompletedMessage(true)
    setTimeout(() => {
      router.push('/dashboard/terminal')
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-[#FDFDFB] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <div className="w-10 h-10 bg-[#00DFB8] rounded-none flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
              <path d="M3 9C3 5.686 5.686 3 9 3s6 2.686 6 6-2.686 6-6 6H3V9z" fill="#1A1A1A"/>
              <circle cx="9" cy="9" r="2" fill="#00DFB8"/>
            </svg>
          </div>
        </div>

        <div className="card p-10 bg-[#FFFFFF] relative overflow-hidden border border-black/5 shadow-xl shadow-black/5">
          <div className="absolute top-0 left-0 w-full h-1 bg-black/5">
            <div className="h-full bg-[#00DFB8] transition-all duration-500" style={{ width: `${(step/5)*100}%` }} />
          </div>

          {completedMessage ? (
            <div className="space-y-6 text-center py-6 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-[#00DFB8]/10 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border border-[#00DFB8]/20">
                <CheckCircle2 className="w-8 h-8 text-[#00DFB8]" />
              </div>
              <h2 className="display-title text-2xl text-[#1A1A1A] mb-2 tracking-tight">You're all set!</h2>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Redirecting you to the terminal...</p>
            </div>
          ) : step === 5 ? (
            /* ─── 3-Step Interstitial Flow ─── */
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {interstitialStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <span className="text-[9px] font-black bg-zinc-900/5 text-gray-500 border border-zinc-950/10 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">Step 1 of 3</span>
                    <h2 className="display-title text-xl text-[#1A1A1A] mt-3 mb-2 tracking-tight">Connect Gmail</h2>
                    <p className="text-xs text-gray-500 leading-relaxed">Connect your Gmail inbox so Chatbolt can check your emails.</p>
                  </div>
                  
                  <div className="flex justify-center py-4">
                    {gmailConnected ? (
                      <div className="flex flex-col items-center gap-2 text-[#00DFB8]">
                        <CheckCircle2 size={48} className="animate-bounce" />
                        <span className="text-xs font-bold uppercase tracking-wider">Gmail Connected</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleConnectGmail}
                        disabled={connectingGmail}
                        className="btn btn-primary w-full py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        {connectingGmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        Connect Gmail →
                      </button>
                    )}
                  </div>

                  <div className="text-center pt-2">
                    <button
                      onClick={() => setInterstitialStep(2)}
                      className="text-xs text-gray-400 hover:text-gray-600 underline font-semibold transition-all"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {interstitialStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <span className="text-[9px] font-black bg-zinc-900/5 text-gray-500 border border-zinc-950/10 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">Step 2 of 3</span>
                    <h2 className="display-title text-xl text-[#1A1A1A] mt-3 mb-2 tracking-tight">Try your first task</h2>
                    <p className="text-xs text-gray-500 leading-relaxed">See Chatbolt in action.</p>
                  </div>

                  <div className="py-4">
                    <button
                      onClick={() => router.push('/dashboard/terminal?prefill=What+emails+need+my+attention+today')}
                      className="btn btn-primary w-full py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Try it now →
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      onClick={() => setInterstitialStep(3)}
                      className="text-xs text-gray-400 hover:text-gray-600 underline font-semibold transition-all"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {interstitialStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <span className="text-[9px] font-black bg-zinc-900/5 text-gray-500 border border-zinc-950/10 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">Step 3 of 3</span>
                    <h2 className="display-title text-xl text-[#1A1A1A] mt-3 mb-2 tracking-tight">Set up morning briefing</h2>
                    <p className="text-xs text-gray-500 leading-relaxed">Get a daily briefing every morning.</p>
                  </div>

                  <div className="py-4">
                    <button
                      onClick={() => router.push('/dashboard/scheduled?prefill=briefing')}
                      className="btn btn-primary w-full py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      Set up briefing →
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      onClick={handleAllSetRedirect}
                      className="text-xs text-gray-400 hover:text-gray-600 underline font-semibold transition-all"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ─── Standard Onboarding Steps ─── */
            <>
              {step === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center">
                    <h2 className="display-title text-2xl text-[#1A1A1A] mb-2 tracking-tight">Welcome to Chatbolt</h2>
                    <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest">Let's set up your business workspace.</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-[#888] uppercase tracking-widest block mb-2">Workspace Name</label>
                      <input className="w-full bg-[#FAFAFA] border border-black/5 rounded-xl p-4 text-[#1A1A1A] font-bold text-sm outline-none focus:border-[#00DFB8] transition-all" placeholder="e.g. Acme Corp" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-[#888] uppercase tracking-widest block mb-2">Industry</label>
                      <select className="w-full bg-[#FAFAFA] border border-black/5 rounded-xl p-4 text-[#1A1A1A] font-bold text-sm outline-none focus:border-[#00DFB8] transition-all appearance-none">
                        <option>E-commerce</option>
                        <option>SaaS</option>
                        <option>Agency</option>
                        <option>Healthcare</option>
                        <option>Real Estate</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => setStep(2)} className="btn btn-primary w-full py-5 text-[11px] font-black uppercase tracking-widest">Continue →</button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="text-center">
                    <h2 className="display-title text-2xl text-[#1A1A1A] mb-2 tracking-tight">Select your plan</h2>
                    <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest">Mandatory for agent deployment</p>
                  </div>

                  <div className="flex justify-center mb-6">
                    <div className="inline-flex p-1 bg-black/5 rounded-xl border border-black/5">
                      <button onClick={() => setCurrency('USD')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${currency === 'USD' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-gray-400'}`}>USD</button>
                      <button onClick={() => setCurrency('INR')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${currency === 'INR' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-gray-400'}`}>INR</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {plans.map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => setSelectedPlan(p.id as any)}
                        className={`flex items-center justify-between p-6 rounded-2xl border transition-all ${selectedPlan === p.id ? 'border-[#00DFB8] bg-[#00DFB8]/5 ring-1 ring-[#00DFB8]' : 'border-black/5 bg-[#FAFAFA] hover:border-black/10'}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{p.icon}</span>
                          <div className="text-left">
                            <div className="text-sm font-black text-[#1A1A1A] uppercase tracking-tight">{p.name}</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{p.id === 'pro' ? '3 Agents' : '10 Agents'} included</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-[#1A1A1A]">{currency === 'USD' ? p.usd : p.inr}</div>
                          <div className="text-[9px] text-gray-400 font-bold uppercase">per month</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setStep(1)} className="btn btn-secondary flex-1 py-5 text-[10px] font-black uppercase tracking-widest">Back</button>
                    <button 
                      onClick={() => setStep(3)} 
                      disabled={!selectedPlan}
                      className="btn btn-primary flex-[2] py-5 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      Continue →
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="text-center">
                    <h2 className="display-title text-2xl text-[#1A1A1A] mb-2 tracking-tight">Primary Goal</h2>
                    <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest">How should your agents help you first?</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { title: 'Support & Helpdesk', icon: '🛟' },
                      { title: 'Sales & Lead Gen', icon: '🎯' },
                      { title: 'Booking & Meetings', icon: '📅' },
                    ].map(g => (
                      <button key={g.title} className="flex items-center gap-4 p-5 rounded-2xl bg-[#FAFAFA] border border-black/5 hover:border-[#00DFB8] transition-all text-left group">
                        <span className="text-xl">{g.icon}</span>
                        <span className="text-sm text-[#1A1A1A] font-black uppercase tracking-tight opacity-70 group-hover:opacity-100">{g.title}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setStep(2)} className="btn btn-secondary flex-1 py-5 text-[10px] font-black uppercase tracking-widest">Back</button>
                    <button onClick={() => setStep(4)} className="btn btn-primary flex-[2] py-5 text-[10px] font-black uppercase tracking-widest">Next Step →</button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-[#00DFB8]/10 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 border border-[#00DFB8]/20">
                      🚀
                    </div>
                    <h2 className="display-title text-2xl text-[#1A1A1A] mb-2 tracking-tight">Ready for Autopilot?</h2>
                    <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest leading-relaxed">Launch your AI workforce with 5 baseline agents tailored to your industry.</p>
                  </div>
                  <div className="space-y-3">
                    <button onClick={() => setStep(5)} className="btn btn-primary w-full py-5 text-[11px] font-black uppercase tracking-widest">Launch Autopilot →</button>
                    <button onClick={() => setStep(5)} className="btn btn-secondary w-full py-5 text-[11px] font-black uppercase tracking-widest">Manual Setup</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-[#444] mt-8 uppercase tracking-[0.2em] font-bold">
          Empowering your business with Chatbolt
        </p>
      </div>
    </div>
  )
}
