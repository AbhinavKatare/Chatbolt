'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  ArrowRight,
  Search,
  Sparkles,
  Bot,
  Database,
  Mail,
  Zap,
  Code2,
  LineChart,
  Users,
  Briefcase,
  HelpCircle,
  Terminal,
  Play,
  History,
  Settings,
  ChevronRight,
  Workflow as WorkflowIcon,
  Upload,
  Activity,
  Map,
  Smartphone,
  Shield,
  Cloud,
  Scale,
  Layout
} from 'lucide-react'
import { api, getSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PipelineVisualizer } from '@/components/dashboard/PipelineVisualizer'
import { ActivityLog, LogEntry } from '@/components/dashboard/ActivityLog'

const CATEGORIES = ['All', 'Research', 'Security', 'CloudOps', 'Legal', 'Product', 'Marketing', 'Productivity', 'Coding', 'Data']

const WORKFLOW_CARDS = [
  { category: 'Security', title: 'Automated SAST Security Audit', desc: 'Scan a GitHub repository for OWASP Top 10 vulnerabilities (SQLi, XSS) and autonomously generate code patches.', icon: Shield, platforms: ['GitHub', 'Code'] },
  { category: 'CloudOps', title: 'FinOps Cost Optimization', desc: 'Analyze AWS/GCP usage metrics and architecture to recommend cost-saving downscaling and resource cleanup.', icon: Cloud, platforms: ['AWS', 'GCP'] },
  { category: 'Legal', title: 'SOC2 & GDPR Compliance Scan', desc: 'Analyze enterprise contracts and policies against GDPR/SOC2 frameworks to identify risks and missing clauses.', icon: Scale, platforms: ['Google Docs', 'PDF'] },
  { category: 'Marketing', title: 'Programmatic SEO Generation', desc: 'Generate highly optimized, semantic HTML landing pages based on targeted keywords and competitor analysis.', icon: Search, platforms: ['Web', 'HTML'] },
  { category: 'Marketing', title: 'Viral Trend & Social Sentiment', desc: 'Track brand sentiment on Twitter/LinkedIn and autonomously draft viral response posts and threads.', icon: Zap, platforms: ['Twitter', 'LinkedIn'] },
  { category: 'Product', title: 'CRO A/B Test Generator', desc: 'Scrape a live webpage to find UX bottlenecks and generate React/Tailwind code variants to improve conversions.', icon: Layout, platforms: ['React', 'Next.js'] },
  { category: 'Marketing', title: 'Automated CSV Email Forwarder', desc: 'Read target accounts from a CSV and execute a mass email forward sequence.', icon: Mail, platforms: ['Google Sheets', 'Gmail'] },
  { category: 'Coding', title: 'Self-Healing CI/CD Pipeline', desc: 'Analyze failed build logs, fetch the broken file, and push a fixed commit back to the branch.', icon: Code2, platforms: ['GitHub', 'Terminal'] },
  { category: 'Research', title: 'Deep dive competitor research', desc: 'Search the web, read sources, compile a structured report with citations into a Google Doc.', icon: Sparkles, platforms: ['Web Search', 'Google Docs'] },
]

export default function WorkflowsMainPage() {
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast()
  const [prompt, setPrompt] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [view, setView] = useState<'browse' | 'synthesizing' | 'review' | 'running'>('browse')
  
  // State for synthesis
  const [config, setConfig] = useState<any>(null)
  const [thinking, setThinking] = useState<string[]>([])
  
  // State for execution
  const [currentWorkflow, setCurrentWorkflow] = useState<any>(null)
  const [currentAgents, setCurrentAgents] = useState<any[]>([])
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [steps, setSteps] = useState<any[]>([])
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [finalOutput, setFinalOutput] = useState<Record<string, any> | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const activeWorkflowIdRef = useRef<string | null>(null) // persists across re-renders for RESTART


  const filteredCards = activeCategory === 'All' 
    ? WORKFLOW_CARDS 
    : WORKFLOW_CARDS.filter(c => c.category === activeCategory)

  // 1. Handle Synthesis
  const handleSynthesize = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;
    
    setView('synthesizing')
    setThinking([])
    
    try {
      const res = await api.workflows.parse(prompt)
      setConfig(res)
      
      // Simulate thinking lines
      const lines = res.thinking.split('\n').filter(l => l.includes('→'))
      for (let i = 0; i < lines.length; i++) {
        setThinking(prev => [...prev, lines[i]])
        await new Promise(r => setTimeout(r, 600))
      }
      
      setView('review')
    } catch (err: any) {
      toastError("Synthesis failed", err.message)
      setView('browse')
    }
  }

  // 2. Handle Creation
  const handleDeploy = async () => {
    // Validate all required inputs before deploy
    const missingRequired = (config?.missing_inputs || []).filter(
      (m: any) => m.required && !inputs[m.field]?.trim()
    )
    if (missingRequired.length > 0) {
      toastError('Missing Required Inputs', `Please fill: ${missingRequired.map((m: any) => m.field).join(', ')}`)
      return
    }
    try {
      const res = await api.workflows.create({
        name: config?.workflow_name || 'Untitled Workflow',
        prompt: prompt,
        type: config?.workflow_type || 'general',
        agents: config?.agents || []
      })
      setCurrentWorkflow(res.workflow)
      setCurrentAgents(res.agents)
      setView('running')
      if ((config?.missing_inputs?.length || 0) === 0 || Object.keys(inputs).length > 0) {
        handleRun(res.workflow.id)
      }
    } catch (err: any) {
      toastError('Deployment failed', err.message)
    }
  }

  // 3. Handle Execution & SSE
  const handleRun = async (workflowId: string) => {
    if (!workflowId) {
      toastError('No workflow', 'Cannot restart: workflow ID is missing.')
      return
    }
    activeWorkflowIdRef.current = workflowId // persist for RESTART
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    setLogs([])
    setSteps([])
    setFinalOutput(null) // clear previous output on each run
    setView('running')
    
    try {
      const { run_id } = await api.workflows.run(workflowId, inputs)
      setCurrentRunId(run_id)
      
      // Connect to SSE with token in query string (EventSource doesn't support headers)
      const session = await getSession()
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const streamUrl = `${baseUrl}/workflows/${workflowId}/runs/${run_id}/stream?token=${session?.token || ''}`
      
      const eventSource = new EventSource(streamUrl, {
        withCredentials: true
      })
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        // Add to logs
        const newLog: LogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          type: data.type === 'agent_error' ? 'error' : 
                data.type === 'agent_done' ? 'success' :
                data.type === 'agent_start' ? 'agent' : 'info',
          message: data.message,
          data: data.output_summary ? { summary: data.output_summary } : null
        }
        setLogs(prev => [...prev, newLog])

        // Update pipeline steps
        if (data.type === 'agent_start') {
          setSteps(prev => [...prev, { 
            agent_id: data.agent_id, 
            status: 'running', 
            step_number: data.step 
          }])
        } else if (data.type === 'agent_done') {
          setSteps(prev => prev.map(s => 
            s.agent_id === data.agent_id ? { ...s, status: 'completed', duration_ms: data.duration_ms } : s
          ))
        } else if (data.type === 'agent_error') {
          setSteps(prev => prev.map(s => 
            s.agent_id === data.agent_id ? { ...s, status: 'failed' } : s
          ))
        }

        if (data.type === 'workflow_done') {
          setFinalOutput(data.outputs || {})
          setLogs(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            type: 'success',
            message: data.message || '✅ Workflow complete',
            data: null
          }])
          eventSource.close()
        } else if (data.type === 'workflow_error') {
          setLogs(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            type: 'error',
            message: data.message || '✗ Workflow failed',
            data: null
          }])
          eventSource.close()
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
      }

    } catch (err: any) {
      toastError("Execution failed", err.message)
    }
  }

  // VIEW: SYNTHESIZING
  if (view === 'synthesizing') {
    return (
      <div className="flex flex-col h-full bg-[#0A0A0A] items-center justify-center space-y-12 p-8">
        <div className="relative">
           <div className="w-32 h-32 rounded-full border border-[#00DFB8]/10 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border-2 border-t-[#00DFB8] border-r-transparent border-b-transparent border-l-transparent animate-spin duration-[2s]" />
           </div>
           <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles size={32} className="text-[#00DFB8] animate-pulse" />
           </div>
        </div>

        <div className="text-center space-y-6 max-w-md w-full">
           <h2 className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Autonomous Orchestration</h2>
           <div className="space-y-2 text-left bg-white/[0.02] border border-white/5 p-6 rounded-xl min-h-[160px]">
              {thinking.map((line, i) => (
                <div key={i} className="text-[10px] font-mono text-[#00DFB8] animate-in slide-in-from-bottom-1 duration-500">
                  {line}
                </div>
              ))}
              <div className="w-2 h-3 bg-[#00DFB8] animate-pulse inline-block ml-1" />
           </div>
        </div>
      </div>
    )
  }

  // VIEW: REVIEW
  if (view === 'review' && config) {
    return (
      <div className="flex flex-col h-full bg-[#0A0A0A] p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in zoom-in-95 duration-700">
          <div className="flex items-center justify-between border-b border-white/5 pb-6">
             <div className="space-y-1">
                <div className="text-[10px] font-black text-[#00DFB8] uppercase tracking-[0.3em]">Manifest Ready</div>
                <h3 className="text-xl font-bold text-white">{config.workflow_name}</h3>
             </div>
             <button 
               onClick={() => setView('browse')}
               className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-all"
             >
                Discard
             </button>
          </div>
          
          <div className="grid grid-cols-3 gap-8">
             <div className="col-span-2 space-y-6">
                <div className="space-y-4">
                   <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Execution Pipeline</div>
                   <div className="space-y-3">
                      {config?.agents?.map((a: any) => (
                        <div key={a.position} className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl flex items-start gap-4 group hover:border-[#00DFB8]/30 transition-all">
                           <div className="w-10 h-10 rounded-xl bg-[#00DFB8]/10 flex items-center justify-center shrink-0">
                              <Bot size={20} className="text-[#00DFB8]" />
                           </div>
                           <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                 <div className="text-xs font-bold text-white uppercase tracking-tight">{a.name}</div>
                                 <div className="text-[9px] font-black text-[#00DFB8] uppercase tracking-widest">{a.role}</div>
                              </div>
                              <p className="text-[10px] text-gray-400 leading-relaxed">{a.description}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl space-y-6">
                   <div className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Settings size={12} className="text-[#00DFB8]" /> Signal Inputs
                   </div>
                                      {(config?.missing_inputs?.length || 0) > 0 ? (
                     <div className="space-y-4">
                        {config.missing_inputs.map((m: any) => {
                          const isMissing = m.required && !inputs[m.field]?.trim()
                          const isFileType = m.type === 'file' || m.question?.toLowerCase().includes('upload') || m.question?.toLowerCase().includes('csv') || m.question?.toLowerCase().includes('pdf')
                          return (
                          <div key={m.field} className="space-y-2">
                             <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-tight">
                               <span className={isMissing ? 'text-red-400' : 'text-gray-400'}>{m.question}</span>
                               {m.required && <span className="text-red-500">*</span>}
                             </label>
                             {isFileType ? (
                               <div className="relative group">
                                 <input 
                                   type="file"
                                   accept=".csv,.pdf,.xlsx,.txt,.docx"
                                   onChange={(e) => {
                                     const file = e.target.files?.[0]
                                     if (file) {
                                       const reader = new FileReader()
                                       reader.onload = () => setInputs(prev => ({ ...prev, [m.field]: reader.result as string, [`${m.field}_name`]: file.name }))
                                       reader.readAsDataURL(file)
                                     }
                                   }}
                                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                 />
                                 <div className={`w-full border border-dashed rounded-xl px-4 py-4 text-center transition-all flex flex-col items-center gap-2 ${isMissing ? 'border-red-500/50 bg-red-500/5' : 'border-white/20 group-hover:border-[#00DFB8]/50 bg-black/40'}`}>
                                   <Upload size={16} className={inputs[m.field] ? 'text-[#00DFB8]' : isMissing ? 'text-red-400' : 'text-gray-500'} />
                                   <span className={`text-xs font-bold ${inputs[`${m.field}_name`] ? 'text-[#00DFB8]' : isMissing ? 'text-red-400' : 'text-gray-500'}`}>
                                     {inputs[`${m.field}_name`] || 'Upload CSV, PDF, Excel or Text file'}
                                   </span>
                                   <span className="text-[9px] text-gray-600">csv · pdf · xlsx · txt · docx</span>
                                 </div>
                               </div>
                             ) : (
                               <input 
                                 value={inputs[m.field] || ''}
                                 onChange={(e) => setInputs(prev => ({ ...prev, [m.field]: e.target.value }))}
                                 className={`w-full bg-black/40 border rounded-xl px-4 py-2.5 text-white text-xs outline-none transition-all ${isMissing ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-[#00DFB8]/50'}`}
                                 placeholder={`Enter ${m.field}...`}
                               />
                             )}
                          </div>
                        )})}
                     </div>
                   ) : (
                     <div className="text-[10px] text-gray-500 font-medium italic">No manual inputs required. All signals autocalibrated.</div>
                   )}

                   {(config?.missing_inputs || []).some((m: any) => m.required && !inputs[m.field]?.trim()) && (
                     <div className="text-[9px] text-red-400 font-bold uppercase tracking-widest text-center mt-2">
                       Fill all required fields (*) before deploying
                     </div>
                   )}
                   <button 
                     onClick={handleDeploy}
                     className="w-full py-4 bg-[#00DFB8] text-black rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#00f7cc] transition-all shadow-xl shadow-[#00DFB8]/10 flex items-center justify-center gap-2 mt-4 disabled:opacity-40 disabled:cursor-not-allowed"
                   >
                      <Zap size={14} fill="currentColor" /> Initiate Deployment
                   </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    )
  }

  // VIEW: RUNNING
  if (view === 'running') {
    return (
      <div className="flex flex-col h-full bg-[#0A0A0A] p-8 overflow-hidden">
        <div className="max-w-6xl mx-auto w-full h-full flex flex-col space-y-8 animate-in fade-in duration-700">
           {/* HEADER */}
           <div className="flex items-center justify-between border-b border-white/5 pb-6 shrink-0">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-[#00DFB8] flex items-center justify-center">
                    <WorkflowIcon size={20} className="text-black" />
                 </div>
                 <div>
                    <div className="text-[10px] font-black text-[#00DFB8] uppercase tracking-[0.3em]">Live Pipeline</div>
                    <h3 className="text-lg font-bold text-white">{currentWorkflow?.name}</h3>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <button 
                   onClick={() => {
                     if (eventSourceRef.current) {
                       eventSourceRef.current.close()
                       eventSourceRef.current = null
                     }
                     setView('browse')
                   }}
                   className="px-6 py-2.5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:border-white/20 transition-all"
                 >
                    Exit Runtime
                 </button>
                  <button 
                    onClick={() => {
                      const wfId = activeWorkflowIdRef.current || currentWorkflow?.id
                      if (!wfId) { toastError('Error', 'Workflow not found — please re-deploy.'); return }
                      setFinalOutput(null)
                      handleRun(wfId)
                    }}
                    className="px-6 py-2.5 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center gap-2"
                  >
                     <Play size={12} fill="currentColor" /> Restart
                  </button>
              </div>
           </div>

           {/* VISUALIZER */}
           <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 shrink-0">
              <PipelineVisualizer agents={currentAgents} steps={steps} />
           </div>

           {/* LOGS */}
           <div className="flex-1 min-h-0">
              <ActivityLog logs={logs} />
           </div>

           {/* FINAL OUTPUT PANEL */}
           {finalOutput && Object.keys(finalOutput).length > 0 && (
             <div className="shrink-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="text-[10px] font-black text-[#00DFB8] uppercase tracking-[0.3em] flex items-center gap-2">
                 <Zap size={10} fill="currentColor" /> Final Output
               </div>
               {Object.entries(finalOutput).filter(([k]) => !k.startsWith('agent_')).map(([agentName, output]: [string, any]) => {
                 const content = output?.data?.content || output?.summary || ''
                 if (!content) return null
                 return (
                   <div key={agentName} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-3">
                     <div className="flex items-center justify-between">
                       <div className="text-[9px] font-black text-[#00DFB8] uppercase tracking-widest">{agentName}</div>
                       <button
                         onClick={() => { navigator.clipboard.writeText(content); toastSuccess('Copied!') }}
                         className="text-[8px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-all px-2 py-1 rounded-lg hover:bg-white/5"
                       >Copy</button>
                     </div>
                     <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{content}</p>
                   </div>
                 )
               })}
             </div>
           )}
        </div>
      </div>
    )
  }

  // VIEW: BROWSE
  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] text-white font-sans selection:bg-[#00DFB8]/30 overflow-y-auto custom-scrollbar">
      <div className="max-w-[1000px] mx-auto w-full px-6 py-24 space-y-20">
        
        {/* HERO */}
        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00DFB8]/10 border border-[#00DFB8]/20 text-[#00DFB8] text-[9px] font-black uppercase tracking-[0.3em] mb-4">
             <Zap size={10} fill="currentColor" /> Next Gen Autonomous Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white max-w-2xl mx-auto leading-tight">
            Deploy an autonomous workforce in seconds.
          </h1>
          <p className="text-gray-400 text-sm md:text-base font-medium max-w-xl mx-auto leading-relaxed">
            Describe your mission. We'll architect the logic, provision the agents, and execute the pipeline end-to-end.
          </p>

          <form onSubmit={handleSynthesize} className="relative max-w-3xl mx-auto mt-12 group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00DFB8]/20 to-purple-500/20 rounded-3xl blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative">
              <textarea
                className="w-full bg-[#111] border border-white/10 hover:border-white/20 focus:border-[#00DFB8]/50 rounded-3xl px-8 py-7 text-white text-base md:text-lg resize-none outline-none transition-all placeholder:text-gray-700 shadow-2xl min-h-[140px]"
                placeholder="Describe a mission for your AI team..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSynthesize();
                  }
                }}
              />
              <div className="absolute bottom-6 right-6 flex items-center gap-4">
                 <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest hidden sm:block">
                   Press Enter to Initiate
                 </div>
                 <button 
                   type="submit"
                   disabled={!prompt.trim()}
                   className="w-12 h-12 bg-[#00DFB8] hover:bg-[#00f7cc] disabled:bg-white/5 disabled:text-gray-700 text-black rounded-2xl flex items-center justify-center transition-all disabled:cursor-not-allowed shadow-lg shadow-[#00DFB8]/20"
                 >
                   <ArrowRight size={20} strokeWidth={3} />
                 </button>
              </div>
            </div>
          </form>
        </div>

        {/* TEMPLATES */}
        <div className="space-y-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="space-y-1">
                <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Mission Blueprints</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pre-calibrated orchestration templates</p>
             </div>
             <div className="flex flex-wrap items-center justify-center gap-2">
               {CATEGORIES.map(cat => (
                 <button
                   key={cat}
                   onClick={() => setActiveCategory(cat)}
                   className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                     activeCategory === cat 
                     ? 'bg-white text-black shadow-xl shadow-white/10' 
                     : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                   }`}
                 >
                   {cat}
                 </button>
               ))}
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCards.map((card, idx) => (
              <button 
                key={idx}
                onClick={() => setPrompt(card.desc)}
                className="group bg-white/[0.02] border border-white/5 hover:border-[#00DFB8]/30 rounded-3xl p-8 text-left transition-all duration-500 hover:bg-white/[0.04] flex flex-col h-full relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                   <ArrowRight size={16} className="text-[#00DFB8] -rotate-45" />
                </div>
                
                <div className="mb-6">
                   <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[#00DFB8]/10 group-hover:text-[#00DFB8] transition-all">
                      <card.icon size={20} />
                   </div>
                </div>

                <div className="space-y-3 mt-auto">
                   <div className="inline-flex text-[9px] font-black text-[#00DFB8] uppercase tracking-[0.2em]">{card.category}</div>
                   <h3 className="text-sm font-bold text-white group-hover:text-[#00DFB8] transition-colors">
                     {card.title}
                   </h3>
                   <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                     {card.desc}
                   </p>
                   {card.platforms && (
                     <div className="flex flex-wrap gap-1.5 pt-3">
                       {card.platforms.map(p => (
                         <span key={p} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-bold text-gray-400">
                           {p}
                         </span>
                       ))}
                     </div>
                   )}
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
