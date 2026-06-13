'use client'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, Save, Share, Settings, Sparkles, Plus, Search, ZoomIn, ZoomOut, Maximize, AlertTriangle, X } from 'lucide-react'
import { api, getSession } from '@/lib/api'
import { AgentNode } from './AgentNode'
import { ConnectionLines } from './ConnectionLines'
import { EditAgentModal } from './EditAgentModal'
import { DetailsPanel } from './DetailsPanel'
import { TestPanel } from './TestPanel'
import { OutputPanel } from './OutputPanel'
import { useToast } from '@/components/ui/Toast'

interface PlaygroundMainProps {
  initialWorkflowId?: string
}

function calculatePositions(agentCount: number, canvasW: number, canvasH: number) {
  const w = 200, h = 160, hGap = 80, vGap = 60
  const pos = []
  if (agentCount <= 3) {
    const startX = (canvasW - (agentCount * w + (agentCount - 1) * hGap)) / 2
    for (let i = 0; i < agentCount; i++) pos.push({ x: startX + i * (w + hGap), y: (canvasH - h) / 2 })
  } else if (agentCount === 4) {
    const startX = (canvasW - (2 * w + hGap)) / 2
    const startY = (canvasH - (2 * h + vGap)) / 2
    pos.push({ x: startX, y: startY })
    pos.push({ x: startX + w + hGap, y: startY })
    pos.push({ x: startX, y: startY + h + vGap })
    pos.push({ x: startX + w + hGap, y: startY + h + vGap })
  } else {
    const cols = 3
    for (let i = 0; i < agentCount; i++) {
      const col = i % cols, row = Math.floor(i / cols)
      const colsInRow = Math.min(agentCount - row * cols, cols)
      const startX = (canvasW - (colsInRow * w + (colsInRow - 1) * hGap)) / 2
      pos.push({ x: startX + col * (w + hGap), y: (canvasH - (Math.ceil(agentCount/cols) * h + (Math.ceil(agentCount/cols)-1)*vGap)) / 2 + row * (h + vGap) })
    }
  }
  return pos
}

export function PlaygroundMain({ initialWorkflowId }: PlaygroundMainProps) {
  const router = useRouter()
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast()
  const canvasRef = useRef<HTMLDivElement>(null)
  
  const [workflowId, setWorkflowId] = useState<string | null>(initialWorkflowId || null)
  const [workflowName, setWorkflowName] = useState('Untitled Workflow')
  const [prompt, setPrompt] = useState('')
  const [agents, setAgents] = useState<any[]>([])
  const [missingInputs, setMissingInputs] = useState<any[]>([])
  const [userInputs, setUserInputs] = useState<Record<string, string>>({})
  
  const [runState, setRunState] = useState<'idle' | 'generating' | 'running' | 'complete' | 'error'>('idle')
  const [logs, setLogs] = useState<any[]>([])
  const [agentSteps, setAgentSteps] = useState<Record<string, any>>({})
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [openPanel, setOpenPanel] = useState<'edit' | 'details' | 'test' | null>(null)
  
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [dragNode, setDragNode] = useState<{ id: string, startX: number, startY: number } | null>(null)
  const [validationModal, setValidationModal] = useState<{ isOpen: boolean, missing: any[] }>({ isOpen: false, missing: [] })


  // Load existing
  useEffect(() => {
    if (initialWorkflowId) {
      api.workflows.get(initialWorkflowId).then(res => {
        setWorkflowName(res.workflow.name)
        setAgents(res.agents)
        // Set missing inputs if needed (would need to derive from schema or saved state)
      }).catch(err => toastError('Failed to load workflow', err.message))
    }
  }, [initialWorkflowId])

  // Derive connections
  const connections = useMemo(() => {
    const conns: any[] = []
    if (agents.length <= 1) return conns
    if (agents.length === 4) {
      // 2x2 grid specific connections
      conns.push({ fromPos: agents[0], toPos: agents[1], status: agentSteps[agents[0].id]?.status === 'running' ? 'active' : agentSteps[agents[0].id]?.status === 'completed' ? 'complete' : 'idle' })
      conns.push({ fromPos: agents[1], toPos: agents[3], status: agentSteps[agents[1].id]?.status === 'running' ? 'active' : agentSteps[agents[1].id]?.status === 'completed' ? 'complete' : 'idle' })
      conns.push({ fromPos: agents[0], toPos: agents[2], status: agentSteps[agents[0].id]?.status === 'running' ? 'active' : agentSteps[agents[0].id]?.status === 'completed' ? 'complete' : 'idle' })
      conns.push({ fromPos: agents[2], toPos: agents[3], status: agentSteps[agents[2].id]?.status === 'running' ? 'active' : agentSteps[agents[2].id]?.status === 'completed' ? 'complete' : 'idle' })
    } else {
      // Sequential
      for (let i = 0; i < agents.length - 1; i++) {
        conns.push({ 
          fromPos: agents[i], 
          toPos: agents[i+1],
          status: agentSteps[agents[i].id]?.status === 'running' ? 'active' : agentSteps[agents[i].id]?.status === 'completed' ? 'complete' : 'idle'
        })
      }
    }
    return conns
  }, [agents, agentSteps])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setRunState('generating')
    try {
      const res = await api.workflows.parse(prompt)
      setWorkflowName(res.workflow_name)
      setMissingInputs(res.missing_inputs || [])
      
      const canvasW = canvasRef.current?.clientWidth || 800
      const canvasH = canvasRef.current?.clientHeight || 600
      const pos = calculatePositions(res.agents.length, canvasW, canvasH)
      
      const newAgents = res.agents.map((a: any, i: number) => ({
        ...a, id: `temp-${i}`, x: pos[i].x, y: pos[i].y
      }))
      setAgents(newAgents)
      setRunState('idle')
    } catch (err: any) {
      toastError('Generation failed', err.message)
      setRunState('idle')
    }
  }

  const handleRun = async () => {
    // Check for missing required inputs
    const missing = missingInputs.filter(input => input.required && !userInputs[input.field]);
    if (missing.length > 0) {
      const fieldNames = missing.map(m => m.question || m.field).join(', ');
      setLogs(p => [...p, { 
        id: `err-${Date.now()}`, 
        timestamp: new Date().toLocaleTimeString(), 
        type: 'workflow_error', 
        message: `Execution blocked: Missing required input(s): ${fieldNames}` 
      }]);
      setValidationModal({ isOpen: true, missing });
      toastError('Data Required', 'Some required information is missing.');
      setRunState('error');
      return;
    }

    if (!workflowId) {
      // Create first
      try {
        const res = await api.workflows.create({ name: workflowName, prompt, type: 'custom', agents })
        setWorkflowId(res.workflow.id)
        setAgents(res.agents.map((a: any, i: number) => ({ ...a, x: agents[i].x, y: agents[i].y })))
        startExecution(res.workflow.id)
      } catch (err: any) {
        toastError('Failed to save workflow', err.message)
      }
    } else {
      startExecution(workflowId)
    }
  }

  const startExecution = async (wId: string) => {
    setRunState('running')
    setLogs([{ id: 'start', timestamp: new Date().toLocaleTimeString(), type: 'workflow_start', message: 'Workflow initialized' }])
    setAgentSteps({})
    
    try {
      const { run_id } = await api.workflows.run(wId, userInputs)
      setActiveRunId(run_id)
      const session = await getSession()
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const eventSource = new EventSource(`${baseUrl}/workflows/${wId}/runs/${run_id}/stream?token=${session?.token || ''}`, { withCredentials: true })

      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data)
        setLogs(p => [...p, { id: Math.random().toString(36).substr(2), timestamp: new Date().toLocaleTimeString(), type: data.type, message: data.message }])

        if (data.type === 'agent_start') {
          setAgentSteps(p => ({ ...p, [data.agent_id]: { status: 'running' } }))
        } else if (data.type === 'agent_screenshot') {
          setAgentSteps(p => ({ ...p, [data.agent_id]: { ...p[data.agent_id], screenshot: data.screenshot } }))
        } else if (data.type === 'agent_done') {
          setAgentSteps(p => ({ ...p, [data.agent_id]: { ...p[data.agent_id], status: 'completed', duration_ms: data.duration_ms, outputSummary: data.output_summary } }))
        } else if (data.type === 'agent_error') {
          setAgentSteps(p => ({ ...p, [data.agent_id]: { status: 'failed' } }))
        } else if (data.type === 'workflow_done') {
          setRunState('complete')
          eventSource.close()
        } else if (data.type === 'workflow_error') {
          setRunState('error')
          eventSource.close()
        }
      }
      eventSource.onerror = () => { eventSource.close(); setRunState('error') }
    } catch (err: any) {
      toastError('Execution failed', err.message)
      setRunState('error')
    }
  }

  // Pan & Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setTransform(p => ({ ...p, scale: Math.max(0.2, Math.min(2, p.scale - e.deltaY * 0.01)) }))
    } else {
      setTransform(p => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }))
    }
  }

  // Node Dragging
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSelectedAgentId(id)
    setDragNode({ id, startX: e.clientX, startY: e.clientY })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragNode) {
        setAgents(p => p.map(a => a.id === dragNode.id 
          ? { ...a, x: a.x + (e.clientX - dragNode.startX) / transform.scale, y: a.y + (e.clientY - dragNode.startY) / transform.scale } 
          : a))
        setDragNode({ id: dragNode.id, startX: e.clientX, startY: e.clientY })
      } else if (isPanning) {
        setTransform(p => ({ ...p, x: p.x + e.movementX, y: p.y + e.movementY }))
      }
    }
    const handleMouseUp = () => {
      if (dragNode && workflowId && !dragNode.id.startsWith('temp-')) {
        const agent = agents.find(a => a.id === dragNode.id)
        if (agent) api.workflows.saveAgentPosition(workflowId, agent.id, agent.x, agent.y).catch(()=>{})
      }
      setDragNode(null)
      setIsPanning(false)
    }
    if (dragNode || isPanning) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [dragNode, isPanning, transform.scale, agents, workflowId])

  const selectedAgent = agents.find(a => a.id === selectedAgentId)

  return (
    <div className="flex flex-col h-screen bg-[#050507] font-sans selection:bg-[#00E599]/30 overflow-hidden text-[#EDEDED]">
      {/* Topbar */}
      <div className="h-[52px] bg-[#09090B] border-b border-white/[0.04] flex items-center justify-between px-4 shrink-0 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/workflows')} className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Workflows / Playground</div>
          <div className="w-px h-4 bg-white/10 mx-2" />
          <input 
            value={workflowName} 
            onChange={e => setWorkflowName(e.target.value)}
            className="text-sm font-bold text-white bg-transparent border-none focus:outline-none hover:bg-white/5 px-2 py-1 rounded transition-colors w-48"
          />
          <div className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-zinc-400">
            {runState}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg border border-transparent transition-all">
            <Save size={12} /> Save
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg border border-transparent transition-all">
            <Share size={12} /> Share
          </button>
          <button className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors">
            <Settings size={14} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button 
            onClick={handleRun}
            disabled={runState === 'running'}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#00E599] text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#00cc88] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(0,229,153,0.35)]">
            <Play size={12} fill="currentColor" /> {runState === 'running' ? 'Running...' : 'Run Workflow'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Left Panel */}
        <div className="w-[300px] bg-[#09090B] border-r border-white/[0.04] flex flex-col shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.3)]">
          <div className="p-5 flex flex-col gap-4 border-b border-white/[0.04]">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white">Describe your task</div>
              <div className="text-[10px] text-zinc-500 mt-1">Type what you want agents to do</div>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. Research top 10 AI tools this week and write a LinkedIn post about them"
              className="w-full h-32 bg-white/[0.02] border border-white/[0.08] rounded-[10px] p-3 text-[13px] text-white resize-y focus:outline-none focus:border-[#00E599] focus:bg-white/[0.04] transition-all placeholder:text-zinc-600"
            />
            <button 
              onClick={handleGenerate}
              disabled={runState === 'generating' || !prompt.trim()}
              className="w-full py-3 bg-[#00E599] text-black rounded-[10px] text-[10px] font-black uppercase tracking-widest hover:bg-[#00cc88] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_12px_rgba(0,229,153,0.25)]">
              {runState === 'generating' ? <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Sparkles size={12} />}
              {runState === 'generating' ? 'Thinking...' : 'Generate Agents →'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px bg-white/5 flex-1" />
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Needs for each agent</div>
              <div className="h-px bg-white/5 flex-1" />
            </div>

            {missingInputs.length === 0 ? (
              <div className="text-center py-8 text-zinc-600">
                <Search size={24} className="mx-auto mb-2 opacity-35" />
                <div className="text-[10px] font-bold uppercase tracking-wider">No inputs required</div>
              </div>
            ) : (
              <div className="space-y-3">
                {missingInputs.map((input: any, i: number) => (
                  <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 shadow-inner">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1">{input.question}</div>
                    <div className="text-[9px] text-zinc-500 mb-2">For: {input.agentName || 'Agent'}</div>
                    <input 
                      value={userInputs[input.field] || ''}
                      onChange={e => setUserInputs(p => ({ ...p, [input.field]: e.target.value }))}
                      placeholder={`Enter ${input.field}...`}
                      className="w-full bg-[#050507] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00E599] transition-colors placeholder:text-zinc-600"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Canvas */}
        <div 
          className="flex-1 relative overflow-hidden bg-[#050507]" 
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={() => { setIsPanning(true); setSelectedAgentId(null) }}
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        >
          {/* Grid Background */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`,
              backgroundPosition: `${transform.x}px ${transform.y}px`
            }}
          />

          <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0', width: '100%', height: '100%' }}>
            {agents.length === 0 && runState !== 'generating' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center p-6 text-center bg-[#0D0D11]/65 backdrop-blur-md">
                  <div className="w-12 h-12 bg-[#00E599]/10 border border-[#00E599]/20 rounded-2xl flex items-center justify-center mb-4 text-[#00E599]">
                    <Sparkles size={24} />
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Your agents will appear here</div>
                  <div className="text-[10px] text-zinc-500">Type a task and click Generate agents to start</div>
                </div>
              </div>
            )}

            {runState === 'generating' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl p-6 shadow-2xl max-w-[300px] w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-6 h-6 border-2 border-white/10 border-t-[#00E599] rounded-full animate-spin" />
                    <div className="text-xs font-bold text-white">Analyzing request...</div>
                  </div>
                  <div className="space-y-2 text-[10px] font-mono text-zinc-500">
                    <div>→ Identifying task type...</div>
                    <div>→ Selecting agents...</div>
                    <div className="animate-pulse">→ Configuring pipeline...</div>
                  </div>
                </div>
              </div>
            )}

            <ConnectionLines connections={connections} canvasW={2000} canvasH={2000} />

            {agents.map((agent, i) => (
              <AgentNode
                key={agent.id}
                agent={agent}
                position={i + 1}
                x={agent.x}
                y={agent.y}
                status={agentSteps[agent.id]?.status || 'idle'}
                outputSummary={agentSteps[agent.id]?.outputSummary}
                selected={selectedAgentId === agent.id}
                onMouseDown={(e) => handleNodeMouseDown(e, agent.id)}
                onEdit={() => { setSelectedAgentId(agent.id); setOpenPanel('edit') }}
                onDetails={() => { setSelectedAgentId(agent.id); setOpenPanel('details') }}
                onTest={() => { setSelectedAgentId(agent.id); setOpenPanel('test') }}
              />
            ))}
          </div>

          {/* Canvas Controls */}
          <div className="absolute bottom-6 left-6 flex items-center gap-2 z-10">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#0D0D11] border border-white/10 rounded-2xl shadow-lg text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all text-white">
              <Plus size={14} /> Add Agent
            </button>
          </div>
          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
            <div className="flex flex-col bg-[#0D0D11] border border-white/10 rounded-xl shadow-lg overflow-hidden">
              <button onClick={() => setTransform(p => ({ ...p, scale: p.scale + 0.1 }))} className="p-2 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"><ZoomIn size={16} /></button>
              <div className="w-full h-px bg-white/5" />
              <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.2, p.scale - 0.1) }))} className="p-2 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"><ZoomOut size={16} /></button>
              <div className="w-full h-px bg-white/5" />
              <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="p-2 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"><Maximize size={16} /></button>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <OutputPanel 
          logs={logs} 
          agents={agents} 
          agentSteps={agentSteps} 
          runStatus={runState === 'generating' ? 'idle' : runState}
          workflowId={workflowId || undefined}
          runId={activeRunId || undefined}
        />

        {/* Overlays */}
        {openPanel === 'edit' && selectedAgent && (
          <EditAgentModal 
            agent={selectedAgent} 
            workflowId={workflowId || 'temp'}
            onClose={() => setOpenPanel(null)}
            onSaved={(updated) => setAgents(p => p.map(a => a.id === updated.id ? updated : a))}
          />
        )}
        
        {openPanel === 'details' && selectedAgent && (
          <DetailsPanel 
            agent={selectedAgent}
            workflowId={workflowId || 'temp'}
            stepData={agentSteps[selectedAgent.id]}
            onClose={() => setOpenPanel(null)}
            onEdit={() => setOpenPanel('edit')}
          />
        )}

        {openPanel === 'test' && selectedAgent && (
          <TestPanel 
            agent={selectedAgent}
            workflowId={workflowId || 'temp'}
            userInputs={userInputs}
            onClose={() => setOpenPanel(null)}
          />
        )}

        {/* Validation Modal */}
        {validationModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setValidationModal(p => ({ ...p, isOpen: false }))} />
            <div className="relative bg-[#0E0E12] border border-white/[0.08] rounded-[32px] shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
              <button 
                onClick={() => setValidationModal(p => ({ ...p, isOpen: false }))}
                className="absolute top-6 right-6 p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
              
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-6 text-amber-500">
                <AlertTriangle size={32} />
              </div>
              
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Data Required</h2>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                We need a bit more information before we can start this workflow. Please provide the following:
              </p>
              
              <div className="space-y-4 mb-8">
                {validationModal.missing.map((input, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <div className="w-5 h-5 bg-[#00E599] rounded-full flex items-center justify-center text-[10px] font-black text-black shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-wider text-white">{input.question}</div>
                      <div className="text-[10px] text-zinc-500">Agent: {input.agentName || 'Workflow'}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setValidationModal(p => ({ ...p, isOpen: false }))}
                className="w-full py-4 bg-[#00E599] text-black rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-[#00cc88] transition-all shadow-[0_0_12px_rgba(0,229,153,0.3)]">
                Got it, let me add that
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

