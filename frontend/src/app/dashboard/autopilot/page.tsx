'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { 
  Sparkles, 
  Rocket, 
  CheckCircle2, 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Zap, 
  ArrowRight,
  Bot,
  Building2,
  Target,
  FileText,
  ChevronRight,
  Plus
} from 'lucide-react'

export default function AutopilotPage() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: Form, 2: Progress, 3: Success
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    company_type: '',
    description: '',
    goals: ''
  })
  const [generatedAgents, setGeneratedAgents] = useState<any[]>([])
  const [progressIndex, setProgressIndex] = useState(0)

  const progressSteps = [
    { title: 'Neural Blueprinting', desc: 'Analyzing business architecture via Qwen3' },
    { title: 'Agent Synthesis', desc: 'Assembling specialized support personas' },
    { title: 'Knowledge Injection', desc: 'Mapping operational data to vector nodes' },
    { title: 'Integration Bridge', desc: 'Linking CRM and communication channels' },
    { title: 'Final Deployment', desc: 'Activating autonomous commerce engine' }
  ]

  useEffect(() => {
    if (step === 2) {
      const interval = setInterval(() => {
        setProgressIndex(i => {
          if (i >= progressSteps.length - 1) {
            clearInterval(interval)
            return i
          }
          return i + 1
        })
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [step])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setStep(2)
    
    try {
      const result = await api.autopilot.generate(form)
      setGeneratedAgents(result.agents)
      
      setTimeout(() => {
        setStep(3)
      }, 25000) 
    } catch (err: any) {
      setError(err.message || 'Failed to build AI team')
      setStep(1)
      setLoading(false)
    }
  }

  if (step === 1) {
    return (
      <div className="min-h-full bg-[#FAFAFA] flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-8">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-black uppercase tracking-widest">
                <Sparkles size={12} /> Autopilot
             </div>
             <h1 className="text-5xl font-black text-[#1A1A1A] tracking-tighter leading-[0.9]">
                Assemble your <span className="text-[#00DFB8]">Digital Workforce</span>.
             </h1>
             <p className="text-lg text-[#888] font-medium leading-relaxed">
                Describe your business in seconds. Our orchestration engine will build, train, and deploy a team of 5 specialized AI agents to handle your operations.
             </p>
             
             <div className="space-y-4 pt-8">
                {[
                  { icon: Bot, text: 'Customized Support Agents' },
                  { icon: Target, text: 'Automated Lead Qualification' },
                  { icon: Zap, text: 'Instant Integration Mapping' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 group">
                     <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#00DFB8] group-hover:border-[#00DFB8] transition-all">
                        <item.icon size={18} />
                     </div>
                     <span className="text-xs font-black text-[#1A1A1A] uppercase tracking-widest">{item.text}</span>
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-white border border-black/5 p-10 rounded-[2.5rem] shadow-2xl shadow-black/5 relative overflow-hidden">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-black uppercase tracking-widest">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em] flex items-center gap-2">
                   <Building2 size={12} /> Company Profile
                </label>
                <input 
                  className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all shadow-inner"
                  placeholder="e.g. Modern D2C Fashion Brand"
                  value={form.company_type}
                  onChange={e => setForm(f => ({ ...f, company_type: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em] flex items-center gap-2">
                   <FileText size={12} /> Business Logic
                </label>
                <textarea 
                  className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all h-28 resize-none shadow-inner"
                  placeholder="What does your company do on a daily basis?"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#888] uppercase tracking-[0.2em] flex items-center gap-2">
                   <Target size={12} /> Workforce Objectives
                </label>
                <textarea 
                  className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-[#1A1A1A] text-sm font-bold focus:border-[#00DFB8] outline-none transition-all h-28 resize-none shadow-inner"
                  placeholder="What goals should your AI agents achieve?"
                  value={form.goals}
                  onChange={e => setForm(f => ({ ...f, goals: e.target.value }))}
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-5 bg-[#1A1A1A] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3 group"
              >
                {loading ? 'Initializing Build...' : <><Rocket size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> Launch Autopilot</>}
              </button>
            </form>
            
            {/* Background Accent */}
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#00DFB8]/5 rounded-full blur-3xl -z-0" />
          </div>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="min-h-full bg-[#FAFAFA] flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-[#1A1A1A] rounded-[3rem] p-16 shadow-2xl relative overflow-hidden border border-black">
          
          {/* Animated Progress Bar */}
          <div className="absolute top-0 left-0 h-1.5 bg-[#00DFB8] transition-all duration-[5s] ease-linear shadow-[0_0_20px_#00DFB8]" style={{ width: `${(progressIndex + 1) * 20}%` }} />
          
          <div className="text-center mb-16">
            <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center text-[#00DFB8] mx-auto mb-8 animate-spin-slow border border-white/10 shadow-2xl">
              <Cpu size={40} />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">Assembling Workforce</h2>
            <p className="text-[10px] text-[#888] font-black uppercase tracking-[0.3em]">Orchestrating via NVIDIA NIM Cluster</p>
          </div>

          <div className="space-y-8">
            {progressSteps.map((s, i) => (
              <div key={i} className={`flex items-start gap-6 transition-all duration-700 ${i <= progressIndex ? 'opacity-100 translate-x-0' : 'opacity-10 translate-x-4'}`}>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                  i < progressIndex 
                  ? 'bg-[#00DFB8] border-[#00DFB8] text-[#1A1A1A]' 
                  : i === progressIndex ? 'border-[#00DFB8] text-[#00DFB8] animate-pulse' : 'border-white/10 text-white/20'
                }`}>
                  {i < progressIndex ? <CheckCircle2 size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                </div>
                <div>
                   <div className={`text-[11px] font-black uppercase tracking-widest ${i === progressIndex ? 'text-white' : 'text-[#888]'}`}>{s.title}</div>
                   <div className="text-[10px] font-bold text-[#555] uppercase tracking-tight mt-1">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 p-6 bg-white/5 border border-white/5 rounded-2xl text-[9px] text-[#888] font-black uppercase tracking-[0.25em] text-center">
            Neural link established. Do not disconnect.
          </div>
          
          {/* Subtle Glow */}
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#00DFB8]/5 rounded-full blur-[100px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#FAFAFA] flex flex-col items-center py-20 px-8 overflow-y-auto">
      <div className="max-w-5xl w-full text-center space-y-8 mb-20 animate-in fade-in zoom-in duration-1000">
        <div className="w-24 h-24 bg-[#00DFB8] text-[#1A1A1A] rounded-[2rem] flex items-center justify-center text-5xl mx-auto shadow-2xl shadow-[#00DFB8]/20 rotate-12">
          <Zap size={48} />
        </div>
        <div className="space-y-4">
           <h1 className="text-6xl font-black text-[#1A1A1A] tracking-tighter">Workforce Online.</h1>
           <p className="text-xl text-[#888] font-medium max-w-2xl mx-auto">
             We've successfully deployed 5 specialized AI agents tailored to your business model. They are now initialized and ready for training.
           </p>
        </div>
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
        {generatedAgents.map((a, idx) => (
          <div key={a.id || idx} className="bg-white border border-black/5 p-10 rounded-[2.5rem] shadow-xl shadow-black/5 hover:border-[#00DFB8]/30 transition-all group animate-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: `${idx * 150}ms` }}>
            <div className="w-14 h-14 bg-[#FAFAFA] border border-black/5 rounded-2xl flex items-center justify-center text-3xl mb-8 group-hover:bg-[#00DFB8] group-hover:text-[#1A1A1A] transition-all transform group-hover:rotate-6">
               {a.icon || <Bot size={28} />}
            </div>
            <h3 className="text-xl font-black text-[#1A1A1A] mb-3 group-hover:text-[#00DFB8] transition-colors">{a.name}</h3>
            <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest leading-relaxed line-clamp-3 mb-8 italic">
               "{a.description}"
            </p>
            <div className="flex items-center justify-between pt-6 border-t border-black/5">
               <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00DFB8]" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#1A1A1A]">Ready</span>
               </div>
               <ChevronRight size={16} className="text-gray-300 group-hover:text-[#00DFB8] transition-all" />
            </div>
          </div>
        ))}
        
        <div className="bg-[#1A1A1A] p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center text-center space-y-6 group cursor-pointer border border-black animate-in slide-in-from-bottom-8 duration-1000">
           <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-[#00DFB8] border border-white/10 group-hover:scale-110 transition-all shadow-inner">
              <Plus size={32} />
           </div>
           <div className="space-y-1">
              <div className="text-xs font-black text-white uppercase tracking-[0.2em]">Add Custom Agent</div>
              <div className="text-[9px] font-bold text-[#888] uppercase tracking-widest">Scale your capacity</div>
           </div>
        </div>
      </div>

      <div className="flex justify-center pb-20">
        <Link href="/dashboard/agents" className="inline-flex items-center gap-4 px-12 py-5 bg-[#1A1A1A] text-white no-underline hover:no-underline rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:scale-105 transition-all">
          Management Console <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  )
}
