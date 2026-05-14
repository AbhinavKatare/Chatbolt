'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Sparkles, BarChart3, Activity, Database, Zap } from 'lucide-react'

const steps = [
  { id: '01', title: 'Connect & Train', desc: 'Securely upload PDFs, crawl websites, or connect your database. Chatbolt vectorizes your knowledge base instantly.' },
  { id: '02', title: 'Configure Agents', desc: 'Define personas, set system prompts, and choose your preferred Chatbolt high-performance model.' },
  { id: '03', title: 'Agent Solves Problems', desc: 'Agents handle complex queries with semantic precision, ensuring every answer is grounded in your facts.' },
  { id: '04', title: 'Automation & Hooks', desc: 'Trigger workflows, update CRM records, or book appointments automatically through intelligent tool calling.' },
  { id: '05', title: 'Monitor & Scale', desc: 'Analyze performance in real-time. Scale from one agent to an entire autonomous workforce with one click.' }
]

const tabs = [
  { id: 'playground', label: 'Playground', img: '/playground-mock.png', icon: Sparkles },
  { id: 'analytics', label: 'Analytics', img: '/analytics-mock.png', icon: BarChart3 },
  { id: 'activity', label: 'Activity', img: '/analytics-mock.png', icon: Activity },
  { id: 'sources', label: 'Sources', img: '/sources-mock.png', icon: Database },
  { id: 'actions', label: 'Actions', img: '/playground-mock.png', icon: Zap },
]

export default function ProductShowcase() {
  const [activeStep, setActiveStep] = useState(0)
  const [activeTab, setActiveTab] = useState('playground')

  return (
    <div className="bg-[#FDFDFB] py-32 overflow-hidden">
      
      {/* SECTION 1: INTERACTIVE WALKTHROUGH */}
      <section className="container mx-auto px-6 mb-40">
        <div className="text-center mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/5 border border-black/10 rounded-full mb-8">
            <span className="text-[10px] font-bold text-[#1A1A1A] uppercase tracking-widest">Platform Walkthrough</span>
          </div>
          <h2 className="display-title text-4xl md:text-6xl text-[#1A1A1A] tracking-tighter">Your bridge to business autonomy.</h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-20 items-center">
          {/* Left: Steps */}
          <div className="w-full lg:w-1/3 space-y-4">
            {steps.map((step, idx) => (
              <motion.div 
                key={step.id}
                onClick={() => setActiveStep(idx)}
                className={`p-8 border rounded-xl cursor-pointer transition-all duration-500 ${activeStep === idx ? 'border-[#00DFB8]/40 bg-[#00DFB8]/5 shadow-sm' : 'border-black/5 bg-white hover:border-black/10'}`}
              >
                <div className="flex items-center gap-6 mb-4">
                  <span className={`text-xs font-black uppercase tracking-widest ${activeStep === idx ? 'text-[#00DFB8]' : 'text-[#555555]'}`}>Step {step.id}</span>
                  <div className={`h-px flex-1 transition-all duration-700 ${activeStep === idx ? 'bg-[#00DFB8]/40 w-full' : 'bg-black/5 w-0'}`} />
                </div>
                <h3 className={`display-title text-xl mb-3 transition-colors ${activeStep === idx ? 'text-[#1A1A1A]' : 'text-[#444]'}`}>{step.title}</h3>
                <AnimatePresence mode="wait">
                  {activeStep === idx && (
                    <motion.p 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="text-[12px] text-[#555] font-medium leading-relaxed overflow-hidden"
                    >
                      {step.desc}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {/* Right: Dynamic Preview (Animated Video Mock) */}
          <div className="w-full lg:w-2/3">
            <div className="rounded-2xl p-2 bg-gradient-to-tr from-[#00DFB8]/20 to-transparent relative overflow-hidden aspect-video shadow-xl">
              <div className="bg-white w-full h-full p-12 relative overflow-hidden rounded-xl border border-black/5">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeStep}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.5 }}
                    className="w-full h-full flex items-center justify-center"
                  >
                    {/* Animated Pipeline Simulation */}
                    <div className="relative w-full h-full">
                      {/* Central Node */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-[#00DFB8]/30 rounded-2xl flex items-center justify-center bg-[#FDFDFB]">
                        <div className="w-16 h-16 bg-[#00DFB8] rounded-xl flex items-center justify-center text-[#1A1A1A] shadow-lg shadow-[#00DFB8]/30">
                          <Zap size={28} />
                        </div>
                      </div>

                      {/* Surrounding Nodes */}
                      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                        <div key={deg} className="absolute top-1/2 left-1/2" style={{ transform: `rotate(${deg}deg) translateX(160px)` }}>
                          <motion.div 
                            animate={{ 
                              scale: activeStep === i ? 1.2 : 1,
                              borderColor: activeStep === i ? '#00DFB8' : 'rgba(0,0,0,0.05)'
                            }}
                            className="w-14 h-14 border bg-white rounded-full flex items-center justify-center shadow-sm"
                            style={{ transform: `rotate(-${deg}deg)` }}
                          >
                             <div className={`w-6 h-6 rounded-full transition-colors ${activeStep === i ? 'bg-[#00DFB8]' : 'bg-black/5'}`} />
                          </motion.div>
                          
                          {/* Pipeline Connection */}
                          <div className="absolute top-1/2 right-full w-[100px] h-px bg-gradient-to-r from-[#00DFB8]/40 to-transparent origin-right -translate-y-1/2" />
                          
                          {activeStep === i && (
                            <motion.div 
                              animate={{ x: [-100, 0] }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="absolute top-1/2 right-full w-2 h-2 rounded-full bg-[#00DFB8] -translate-y-1/2"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="absolute bottom-6 right-6 text-[10px] font-black text-black/20 uppercase tracking-[0.4em]">SYSTEM_AUTOPILOT_v2.0</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: DISCOVER PLATFORM */}
      <div className="container mx-auto px-6 pt-20 border-t border-black/5">
        <div className="mb-20">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 border border-[#00DFB8]/20 rounded-full w-fit mb-8">
            <div className="w-1.5 h-1.5 bg-[#00DFB8] rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-widest">Explore</span>
          </div>
          
          <h2 className="text-5xl md:text-7xl font-bold text-[#1A1A1A] tracking-tight mb-16 display-title">
            Discover the Chatbolt platform
          </h2>

          <div className="flex flex-wrap gap-8 border-b border-black/5 pb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 transition-all duration-300 relative group`}
              >
                <tab.icon 
                  size={18} 
                  className={`transition-colors ${activeTab === tab.id ? 'text-[#1A1A1A]' : 'text-gray-400 group-hover:text-gray-700'}`} 
                />
                <span className={`text-sm font-bold tracking-tight transition-colors ${activeTab === tab.id ? 'text-[#1A1A1A]' : 'text-gray-400 group-hover:text-gray-700'}`}>
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTabUnderline"
                    className="absolute -bottom-[25px] left-0 right-0 h-[2px] bg-[#1A1A1A] z-20"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="relative group mt-10">
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#00DFB8]/5 to-transparent pointer-events-none opacity-50 blur-3xl" />
          
          <div className="relative rounded-2xl border border-black/5 bg-white overflow-hidden shadow-2xl shadow-black/5 aspect-[16/9]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.02, y: -10 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full relative"
              >
                <Image 
                  src={tabs.find(t => t.id === activeTab)?.img || ''} 
                  alt={activeTab}
                  fill
                  className="object-contain p-4 md:p-8"
                  priority
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
