"use client"

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Bot, Check, CheckCircle2, Loader2, Sparkles, Share2, FileText, FileSpreadsheet, Paperclip, Link as LinkIcon, Edit3 } from 'lucide-react'

type Phase = 'idle' | 'thinking' | 'collecting' | 'building' | 'running' | 'completed'

interface Agent {
  id: string
  name: string
  role: string
  description: string
  status: 'pending' | 'configuring' | 'ready' | 'running' | 'completed' | 'error'
  outputPreview?: string
}

interface LogEntry {
  time: string
  agent: string
  text: string
  type: 'normal' | 'success' | 'warning' | 'error'
}

interface MissingInfo {
  id: string
  question: string
  type: 'file' | 'text' | 'choice'
  options?: string[]
  answer?: string
}

export default function WorkflowsPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [prompt, setPrompt] = useState('')
  const [thinkingStream, setThinkingStream] = useState<string[]>([])
  
  // Phase 2 State
  const [missingInfoQueue, setMissingInfoQueue] = useState<MissingInfo[]>([])
  const [currentInfoIndex, setCurrentInfoIndex] = useState(0)

  // Phase 3 & 4 State
  const [agents, setAgents] = useState<Agent[]>([])
  const [activityLog, setActivityLog] = useState<LogEntry[]>([])
  
  // Refs
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activityLog])

  // Phase 1: Thinking
  const startThinking = () => {
    setPhase('thinking')
    const thoughts = [
      "Analyzing your request...",
      "",
      ` "${prompt}"`,
      "",
      " → Identifying task type: content + communication workflow",
      " → Detecting required capabilities: web research, writing, bulk email",
      " → Checking for missing information: subscriber list, sender email",
      " → Determining optimal agent count: 3",
      " → Selecting models: Qwen3 free (research + writing), SMTP (email dispatch)",
      " → Estimating runtime: ~45 seconds",
      " → Complexity: moderate",
      "",
      "Ready to build."
    ]

    let i = 0
    setThinkingStream([])
    const interval = setInterval(() => {
      if (i < thoughts.length) {
        setThinkingStream(prev => [...prev, thoughts[i]])
        i++
      } else {
        clearInterval(interval)
        setTimeout(() => startCollecting(), 1000)
      }
    }, 250)
  }

  // Phase 2: Info Collection
  const startCollecting = () => {
    setPhase('collecting')
    setMissingInfoQueue([
      {
        id: 'subscribers',
        question: 'To send your newsletter, I need your subscriber list.',
        type: 'file',
        options: ['Upload CSV', 'Google Sheet', 'Paste emails']
      },
      {
        id: 'sender',
        question: 'What email address should this newsletter be sent from?',
        type: 'choice',
        options: ['marketing@company.com', 'founders@company.com', 'Add new sender...']
      }
    ])
    setCurrentInfoIndex(0)
  }

  const handleAnswerInfo = (answer: string) => {
    setMissingInfoQueue(prev => {
      const updated = [...prev]
      updated[currentInfoIndex].answer = answer
      return updated
    })

    if (currentInfoIndex < missingInfoQueue.length - 1) {
      setTimeout(() => setCurrentInfoIndex(prev => prev + 1), 600)
    } else {
      setTimeout(() => startBuilding(), 800)
    }
  }

  // Phase 3: Building Pipeline
  const startBuilding = () => {
    setPhase('building')
    
    const newAgents: Agent[] = [
      { id: '1', name: 'News Hunter', role: 'RESEARCHER', description: 'Searches web for AI news weekly', status: 'pending' },
      { id: '2', name: 'Content Synthesizer', role: 'WRITER', description: 'Drafts newsletter from research', status: 'pending' },
      { id: '3', name: 'Outreach Manager', role: 'EMAIL_SENDER', description: 'Dispatches emails via SMTP', status: 'pending' },
    ]
    setAgents(newAgents)

    setTimeout(() => updateAgentStatus(0, 'configuring'), 300)
    setTimeout(() => updateAgentStatus(0, 'ready'), 1000)
    
    setTimeout(() => updateAgentStatus(1, 'configuring'), 1500)
    setTimeout(() => updateAgentStatus(1, 'ready'), 2200)

    setTimeout(() => updateAgentStatus(2, 'configuring'), 2700)
    setTimeout(() => updateAgentStatus(2, 'ready'), 3400)
  }

  const updateAgentStatus = (index: number, status: Agent['status'], outputPreview?: string) => {
    setAgents(prev => {
      const updated = [...prev]
      if (updated[index]) {
        updated[index] = { ...updated[index], status, outputPreview: outputPreview || updated[index].outputPreview }
      }
      return updated
    })
  }

  // Phase 4: Execution
  const runWorkflow = () => {
    setPhase('running')
    setActivityLog([])

    const addLog = (agent: string, text: string, type: LogEntry['type'] = 'normal') => {
      const time = new Date().toLocaleTimeString([], { hour12: false })
      setActivityLog(prev => [...prev, { time, agent, text, type }])
    }

    updateAgentStatus(0, 'running')
    addLog('Agent 1', 'Starting web research')
    setTimeout(() => addLog('Agent 1', 'Query: "AI news past 7 days"'), 1000)
    setTimeout(() => addLog('Agent 1', 'Fetching: techcrunch.com/ai'), 2000)
    setTimeout(() => addLog('Agent 1', 'Processing 5 articles...'), 4000)
    setTimeout(() => {
      addLog('Agent 1', '✓ Complete — 5 stories found', 'success')
      updateAgentStatus(0, 'completed', '5 stories found')
      
      updateAgentStatus(1, 'running')
      addLog('Agent 2', 'Received research report')
      addLog('Agent 2', 'Writing newsletter draft...')
    }, 6000)

    setTimeout(() => {
      addLog('Agent 2', '✓ Complete — 847 words', 'success')
      updateAgentStatus(1, 'completed', 'Draft: 847 words')
      
      updateAgentStatus(2, 'running')
      addLog('Agent 3', 'Loading 847 subscribers...')
      addLog('Agent 3', 'Sending batch 1/17 (50 emails)')
    }, 10000)

    setTimeout(() => addLog('Agent 3', 'Sending batch 2/17 (50 emails)'), 12000)
    setTimeout(() => addLog('Agent 3', 'Sending batch 3/17 (50 emails)'), 14000)
    
    setTimeout(() => {
      addLog('Agent 3', '✓ Complete — 847 sent, 0 failed', 'success')
      updateAgentStatus(2, 'completed', '847 emails sent')
      setPhase('completed')
    }, 16000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    startThinking()
  }

  return (
    <div className={`min-h-[calc(100vh-4rem)] w-full transition-colors duration-1000 ${phase === 'idle' || phase === 'thinking' || phase === 'collecting' ? 'bg-[#FAFAFA]' : 'bg-[#0A0A0A]'}`}>
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-24 h-full flex flex-col items-center justify-center">
        
        {/* Phase 1: Idle & Thinking */}
        {(phase === 'idle' || phase === 'thinking') && (
          <div className="max-w-3xl mx-auto w-full transition-all duration-700">
            {phase === 'idle' && (
              <div className="text-center mb-10 animate-fade-in-down">
                <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 tracking-tight">What do you want to automate?</h1>
                <p className="text-gray-500 mt-4 text-lg">Just describe the goal. ChatAI handles the rest.</p>
              </div>
            )}

            <div className={`w-full transition-all duration-500 ${phase === 'thinking' ? 'scale-105' : 'scale-100'}`}>
              {phase === 'idle' ? (
                <form onSubmit={handleSubmit} className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                  <div className="relative flex items-center bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden focus-within:border-gray-300 focus-within:ring-4 focus-within:ring-gray-100/50 transition-all">
                    <div className="pl-6 text-gray-400">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <input 
                      type="text" 
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="e.g. Send a weekly newsletter about AI news to my list..."
                      className="w-full py-5 px-4 text-lg text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
                      autoFocus
                    />
                    <button 
                      type="submit"
                      disabled={!prompt.trim()}
                      className="mr-3 p-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-gray-900 transition-colors"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="w-full bg-[#FAFAFA] border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm font-mono text-sm leading-relaxed text-gray-600 text-left min-h-[320px]">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center animate-pulse">
                      <Bot className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="font-semibold text-gray-900">ChatAI Thinking...</span>
                  </div>
                  
                  <div className="space-y-2">
                    {thinkingStream.map((line, i) => (
                      <div key={i} className={`opacity-0 animate-fade-in ${line.startsWith(' →') ? 'pl-4 italic text-gray-500' : 'text-gray-700'}`}>
                        {line}
                      </div>
                    ))}
                    {thinkingStream.length > 0 && thinkingStream[thinkingStream.length - 1] !== 'Ready to build.' && (
                      <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse"></span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase 2: Info Collection */}
        {phase === 'collecting' && (
          <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 py-10">
            {missingInfoQueue.map((info, idx) => {
              // Only show if it's the current question or already answered
              if (idx > currentInfoIndex) return null
              
              const isAnswered = !!info.answer

              return (
                <div key={info.id} className="flex flex-col gap-3 animate-fade-in-up">
                  {/* AI Bubble */}
                  {isAnswered ? (
                    <div className="self-start bg-gray-100 text-gray-600 px-5 py-3 rounded-2xl rounded-tl-sm text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>{info.id === 'subscribers' ? 'Subscriber list loaded' : 'Sender email confirmed'} — <span className="font-medium text-gray-900">{info.answer}</span></span>
                    </div>
                  ) : (
                    <div className="self-start bg-gray-900 text-white px-6 py-4 rounded-2xl rounded-tl-sm shadow-md max-w-[85%]">
                      <div className="flex items-center gap-2 mb-2 text-gray-300">
                        <Bot className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">ChatAI</span>
                      </div>
                      <p className="text-lg leading-snug">{info.question}</p>
                    </div>
                  )}

                  {/* Options Bubble */}
                  {!isAnswered && info.options && (
                    <div className="self-start ml-8 flex flex-wrap gap-2 mt-1">
                      {info.options.map((opt, oIdx) => (
                        <button 
                          key={oIdx}
                          onClick={() => handleAnswerInfo(opt)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm transition-all text-sm font-medium"
                        >
                          {opt === 'Upload CSV' && <Paperclip className="w-4 h-4 text-gray-400" />}
                          {opt === 'Google Sheet' && <LinkIcon className="w-4 h-4 text-gray-400" />}
                          {opt === 'Paste emails' && <Edit3 className="w-4 h-4 text-gray-400" />}
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            
            {/* Typing indicator for the next question */}
            {currentInfoIndex < missingInfoQueue.length && !missingInfoQueue[currentInfoIndex]?.answer && (
              <div className="self-start bg-gray-100 text-gray-400 px-5 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1 mt-2 animate-fade-in">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              </div>
            )}
          </div>
        )}

        {/* Phase 3, 4, 5: Pipeline Canvas */}
        {(phase === 'building' || phase === 'running' || phase === 'completed') && (
          <div className="flex flex-col items-center justify-center w-full max-w-5xl mx-auto min-h-[60vh] relative z-10 transition-all duration-700 animate-fade-in">
            
            {phase === 'completed' && (
              <div className="absolute top-0 left-0 w-full flex justify-center -mt-20 z-50 animate-fade-in-down">
                <h2 className="text-3xl font-light text-white tracking-tight">
                  Done. <span className="text-[#B8FF00] font-medium">847 newsletters</span> delivered.
                </h2>
              </div>
            )}

            <div className={`flex flex-col md:flex-row items-center justify-center gap-10 md:gap-20 w-full relative pt-10 ${phase === 'completed' ? 'scale-[0.9] opacity-80' : 'scale-100'} transition-transform duration-1000`}>
              {/* Connecting SVG Lines */}
              <div className="absolute inset-0 pointer-events-none hidden md:block">
                <svg className="w-full h-full" style={{ minHeight: '200px' }}>
                  <defs>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {agents.length >= 2 && (
                    <>
                      <path d="M 30% 50% L 50% 50%" stroke="#333" strokeWidth="2" fill="none" 
                        className={`transition-opacity duration-500 ${agents[1].status === 'pending' ? 'opacity-0' : 'opacity-100'}`} />
                      <path d="M 30% 50% L 50% 50%" stroke="#B8FF00" strokeWidth="2" fill="none" 
                        strokeDasharray="100%" strokeDashoffset={agents[1].status === 'pending' ? '100%' : '0'} 
                        className="transition-all duration-1000 ease-in-out" />
                      {agents[1].status !== 'pending' && <text x="40%" y="45%" fill="#888" fontSize="12" textAnchor="middle" className="animate-fade-in">research report</text>}
                      {(phase === 'running' || phase === 'building') && agents[0].status === 'completed' && agents[1].status !== 'completed' && (
                        <circle r="4" fill="#B8FF00" filter="url(#glow)">
                          <animateMotion dur="1.5s" repeatCount="indefinite" path="M 30% 50% L 50% 50%" />
                        </circle>
                      )}
                      {phase === 'completed' && <circle r="4" fill="#B8FF00" filter="url(#glow)" cx="50%" cy="50%" />}
                    </>
                  )}

                  {agents.length >= 3 && (
                    <>
                      <path d="M 50% 50% L 70% 50%" stroke="#333" strokeWidth="2" fill="none" 
                        className={`transition-opacity duration-500 ${agents[2].status === 'pending' ? 'opacity-0' : 'opacity-100'}`} />
                      <path d="M 50% 50% L 70% 50%" stroke="#B8FF00" strokeWidth="2" fill="none" 
                        strokeDasharray="100%" strokeDashoffset={agents[2].status === 'pending' ? '100%' : '0'} 
                        className="transition-all duration-1000 ease-in-out" />
                      {agents[2].status !== 'pending' && <text x="60%" y="45%" fill="#888" fontSize="12" textAnchor="middle" className="animate-fade-in">newsletter HTML</text>}
                      {(phase === 'running' || phase === 'building') && agents[1].status === 'completed' && agents[2].status !== 'completed' && (
                        <circle r="4" fill="#B8FF00" filter="url(#glow)">
                          <animateMotion dur="1.5s" repeatCount="indefinite" path="M 50% 50% L 70% 50%" />
                        </circle>
                      )}
                      {phase === 'completed' && <circle r="4" fill="#B8FF00" filter="url(#glow)" cx="70%" cy="50%" />}
                    </>
                  )}
                </svg>
              </div>

              {/* Agent Cards */}
              {agents.map((agent, i) => {
                const isVisible = agent.status !== 'pending'
                const isReady = agent.status === 'ready' || agent.status === 'running' || agent.status === 'completed'
                const isRunning = agent.status === 'running'
                const isCompleted = agent.status === 'completed'
                
                return (
                  <div 
                    key={agent.id} 
                    className={`w-[220px] h-[150px] rounded-xl bg-[#1A1A1A] border transition-all duration-500 flex flex-col justify-between p-4 relative z-10
                      ${!isVisible ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}
                      ${isRunning ? 'border-[#B8FF00] shadow-[0_0_20px_rgba(184,255,0,0.2)]' : isCompleted ? 'border-[#B8FF00]/40' : isReady ? 'border-gray-700' : 'border-gray-800'}
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-mono tracking-wider text-gray-500 uppercase">{agent.role}</span>
                      {isRunning && <Loader2 className="w-3 h-3 text-[#B8FF00] animate-spin" />}
                      {isCompleted && <CheckCircle2 className="w-4 h-4 text-[#B8FF00]" />}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">{agent.name}</h3>
                      <p className="text-gray-400 text-xs mt-1 leading-tight">{agent.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[#B8FF00] animate-pulse' : isCompleted ? 'bg-[#B8FF00]/50' : isReady ? 'bg-gray-500' : 'bg-gray-700'}`} />
                      <span className={`text-xs ${isRunning ? 'text-[#B8FF00]' : isCompleted ? 'text-[#B8FF00]/70' : 'text-gray-500'}`}>
                        {agent.status === 'configuring' ? 'Configuring...' : 
                         agent.status === 'ready' ? 'Ready ✓' : 
                         agent.status === 'running' ? 'Running...' : 
                         agent.status === 'completed' ? agent.outputPreview : 'Pending'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Action Bar (Building phase) */}
            {phase === 'building' && agents.every(a => a.status === 'ready') && (
              <div className="mt-16 animate-fade-in-up bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row items-center gap-6 z-20 w-full max-w-2xl">
                <div className="flex-1">
                  <p className="text-white font-medium">3 agents configured <span className="text-gray-500 mx-2">·</span> Runs every Monday</p>
                  <p className="text-gray-400 text-sm mt-1">First run: in ~2 minutes</p>
                </div>
                <div className="flex gap-3">
                  <button className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">
                    View pipeline
                  </button>
                  <button 
                    onClick={runWorkflow}
                    className="px-6 py-2 bg-[#B8FF00] text-black font-semibold rounded-lg hover:bg-[#a3e600] transition-all shadow-[0_0_15px_rgba(184,255,0,0.3)] hover:shadow-[0_0_25px_rgba(184,255,0,0.5)] transform hover:-translate-y-0.5"
                  >
                    Run now
                  </button>
                </div>
              </div>
            )}

            {/* Activity Log (Running phase) */}
            {(phase === 'running' || phase === 'completed') && (
              <div className="mt-12 w-full max-w-3xl animate-fade-in-up z-20">
                <div className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                  <div className="bg-[#1A1A1A] px-4 py-2 border-b border-gray-800 flex justify-between items-center">
                    <span className="text-xs font-mono text-gray-500">ACTIVITY LOG</span>
                    {phase === 'running' && <span className="text-xs text-[#B8FF00] animate-pulse">● LIVE</span>}
                  </div>
                  <div className="p-4 font-mono text-sm h-64 overflow-y-auto flex flex-col gap-1 scrollbar-hide">
                    {activityLog.map((log, i) => (
                      <div key={i} className={`flex gap-4 ${log.type === 'success' ? 'text-[#B8FF00]' : log.type === 'error' ? 'text-[#ff5050]' : log.type === 'warning' ? 'text-[#ffb400]' : 'text-gray-300'}`}>
                        <span className="text-gray-600 shrink-0">{log.time}</span>
                        <span className="text-gray-500 shrink-0">[{log.agent}]</span>
                        <span>{log.text}</span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Phase 5: Results Card */}
        {phase === 'completed' && (
          <div className="w-full max-w-lg mx-auto animate-slide-up-fade relative z-50 -mt-10">
            <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#B8FF00] to-transparent opacity-50"></div>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#B8FF00]/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#B8FF00]" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Workflow Successful</h3>
                  <p className="text-gray-400 text-sm">Completed in 16.4 seconds</p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-[#B8FF00]" />
                  <span>847 emails sent successfully</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-[#B8FF00]" />
                  <span>0 failures recorded</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-[#B8FF00]" />
                  <span>Next run scheduled: Monday 8:00 AM</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors border border-gray-800 hover:border-gray-700">
                  <FileText className="w-4 h-4" /> View Preview
                </button>
                <button className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors border border-gray-800 hover:border-gray-700">
                  <FileSpreadsheet className="w-4 h-4" /> Subscribers
                </button>
              </div>

              <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-[#B8FF00] text-black font-semibold hover:bg-[#a3e600] transition-colors mt-6">
                <Share2 className="w-4 h-4" /> Share this Workflow
              </button>
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
        @keyframes fade-in-down { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-down { animation: fade-in-down 0.5s ease-out forwards; }
        @keyframes slide-up-fade { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up-fade { animation: slide-up-fade 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  )
}
