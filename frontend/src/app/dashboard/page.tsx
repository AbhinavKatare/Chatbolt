'use client'
import { useState, useRef } from 'react'
import { 
  Sparkles, 
  Workflow,
  Wand2,
  ShieldAlert,
  FileText,
  Users,
  CheckCircle2,
  Bot,
  ArrowRight,
  Code2,
  Server,
  Zap,
  LayoutGrid,
  Send,
  Database,
  Link2,
  Info,
  Maximize2,
  X,
  Plus,
  Play,
  Settings,
  Trash2,
  FileCode,
  Upload,
  Mail,
  MoreVertical,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'

// Hardcoded Templates based on user request
const WORKFLOW_TEMPLATES = [
  {
    id: 'onboarding',
    title: 'Customer Onboarding & Retention Pipeline',
    description: 'Reduce early churn, accelerate time-to-value, and personalize activation.',
    icon: Users,
    requirements: ['CRM Access', 'Twilio WhatsApp API', 'Email SMTP'],
    agents: [
      { name: 'Lead Qualifier', role: 'Scores & routes inbound leads', icon: Users },
      { name: 'Onboarding Assistant', role: 'Creates personalized setup plans', icon: FileText },
      { name: 'Churn Prevention Agent', role: 'Monitors engagement & triggers interventions', icon: ShieldAlert }
    ],
    codeSnippet: `// Vercel Edge Runtime Compatible
import { getAgentResponse, queueAgentTask } from '@/lib/orchestrator';

export async function POST(req: Request) {
  const { leadData } = await req.json();
  
  // Step 1: Qualify
  const qualification = await getAgentResponse('lead-qualifier', { leadData });
  
  if (qualification.lead_score >= 80) {
    // Step 2: Onboard
    await getAgentResponse('onboarding-assistant', { 
      customerId: leadData.id,
      priority: 'high'
    });
    
    // Step 3: Monitor Churn (Scheduled Task)
    await queueAgentTask('churn-prevention', { 
      customerId: leadData.id, 
      schedule: 'daily' 
    });
    
    return Response.json({ status: 'deployed' });
  }
  
  return Response.json({ status: 'archived' });
}`
  },
  {
    id: 'contract-to-cash',
    title: 'Contract-to-Cash Automation',
    description: 'Accelerate deal velocity, ensure compliance, and automate billing & collections.',
    icon: FileText,
    requirements: ['Google Sheets', 'Stripe API', 'DocuSign Webhook'],
    agents: [
      { name: 'Contract Review Agent', role: 'Extracts terms, flags risks', icon: ShieldAlert },
      { name: 'Billing Management Agent', role: 'Generates invoices, tracks payments', icon: Database },
      { name: 'Compliance Monitor', role: 'Audits comms & data handling', icon: CheckCircle2 }
    ],
    codeSnippet: `// Automated Revenue Pipeline
const contractTerms = await getAgentResponse('contract-reviewer', { contractUrl });

if (contractTerms.approval_recommendation === 'approve_as_is') {
  // Generate Invoice via Billing Agent
  const invoice = await getAgentResponse('billing-manager', { 
    terms: contractTerms.key_terms,
    gateway: 'stripe'
  });
  
  // Log for Compliance
  await getAgentResponse('compliance-monitor', { 
    action: 'invoice_generated',
    dataTypes: ['billing', 'pii'] 
  });
}`
  },
  {
    id: 'security-response',
    title: 'IT Security Incident Response',
    description: 'Rapid threat containment, user communication, and compliance logging.',
    icon: ShieldAlert,
    requirements: ['Slack Webhook', 'PagerDuty API', 'Auth0 Logs'],
    agents: [
      { name: 'Security Monitor', role: 'Analyzes alerts, calculates risk', icon: ShieldAlert },
      { name: 'IT Helpdesk Agent', role: 'Executes remediation, notifies users', icon: Bot },
      { name: 'Compliance Monitor', role: 'Validates secure comms, logs for audit', icon: FileText }
    ],
    codeSnippet: `// Critical Threat Orchestration
const risk = await getAgentResponse('security-monitor', { threatIndicators });

if (risk.risk_level === 'critical') {
  // Execute Containment
  const remediation = await getAgentResponse('it-helpdesk', { 
    severity: 'critical',
    action: 'isolate_endpoint'
  });
  
  // Notify Stakeholders & Audit
  await getAgentResponse('compliance-monitor', { 
    communication: remediation.message,
    incident_id: risk.id
  });
}`
  }
]

export default function PlaygroundPage() {
  const [workflowPrompt, setWorkflowPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeWorkflow, setActiveWorkflow] = useState<any | null>(null)
  const [fullscreenCode, setFullscreenCode] = useState(false)
  const [activeAgentDetails, setActiveAgentDetails] = useState<any | null>(null)
  const [showInputForm, setShowInputForm] = useState(false)
  const [formData, setFormData] = useState<any>({})

  const selectTemplate = (template: any) => {
    setActiveWorkflow(template)
  }

  const handleGenerateWorkflow = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!workflowPrompt) return
    setIsGenerating(true)
    
    setTimeout(() => {
      setActiveWorkflow({
        title: 'Custom Business Pipeline',
        description: `Autonomous logic synthesized for: "${workflowPrompt}"`,
        requirements: ['Twilio SMS', 'Google Sheets Integration', 'Supabase DB'],
        agents: [
          { name: 'Request Processor', role: 'Initial intent extraction', icon: Bot },
          { name: 'Integration Engine', role: 'Twilio & Sheets coordination', icon: Zap },
          { name: 'Ops Reporter', role: 'Success validation & logging', icon: FileText },
        ],
        codeSnippet: `// Orchestrator generated for: ${workflowPrompt}
export async function POST(req: Request) {
  const data = await req.json();
  
  // 1. Process Input
  const { intent } = await getAgentResponse('request-processor', { data });
  
  // 2. Execute Integration via specialized agent
  const execution = await getAgentResponse('integration-engine', { 
    intent,
    channel: 'twilio_sms',
    storage: 'google_sheets'
  });
  
  // 3. Finalize and Log
  await getAgentResponse('ops-reporter', { execution_results: execution });
  
  return Response.json({ success: true });
}`
      })
      setIsGenerating(false)
    }, 2500)
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-hidden">
      <div className="flex-1 overflow-y-auto relative">
        <div className="max-w-6xl w-full mx-auto p-10 space-y-12 pb-48">
          
          {/* AI CHATBAR HEADER */}
          <div className="space-y-10 text-center max-w-4xl mx-auto pt-12">
            <div className="space-y-4">
               <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-2 animate-pulse">
                  <Server size={12} /> Digital Workforce Orchestrator
               </div>
               <h1 className="text-5xl font-black text-[#1A1A1A] tracking-tighter leading-[0.9]">
                  Architect your <span className="text-[#00DFB8]">Autonomous Pipeline</span>.
               </h1>
               <p className="text-gray-400 text-lg font-medium leading-relaxed max-w-2xl mx-auto">
                  Describe a workflow, and Chatbolt will chain specialized agents, connect real integrations, and generate the Vercel-ready orchestration logic.
               </p>
            </div>

            <form onSubmit={handleGenerateWorkflow} className="relative group max-w-3xl mx-auto">
               <div className="absolute inset-0 bg-gradient-to-r from-[#00DFB8]/30 to-blue-500/30 rounded-3xl blur-2xl group-hover:blur-3xl transition-all opacity-40" />
               <div className="relative bg-white border border-black/5 rounded-3xl shadow-2xl flex items-center p-3 gap-2">
                  <div className="w-14 h-14 flex items-center justify-center shrink-0 bg-[#FAFAFA] rounded-2xl">
                    <Sparkles size={24} className="text-[#00DFB8]" />
                  </div>
                  <input 
                    className="flex-1 bg-transparent border-none text-lg text-[#1A1A1A] font-bold placeholder-gray-300 outline-none pr-4"
                    placeholder="e.g. Automate sales follow-ups via WhatsApp and track results in a sheet..."
                    value={workflowPrompt}
                    onChange={(e) => setWorkflowPrompt(e.target.value)}
                  />
                  <button 
                    type="submit"
                    disabled={isGenerating || !workflowPrompt}
                    className="px-10 py-4 bg-[#1A1A1A] text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-black transition-all flex items-center gap-3 disabled:opacity-50 shrink-0 shadow-lg shadow-black/10 hover:shadow-[#00DFB8]/20"
                  >
                    {isGenerating ? 'Synthesizing...' : <><Zap size={16} className="text-[#00DFB8]" /> Build Flow</>}
                  </button>
               </div>
            </form>
          </div>

          {activeWorkflow ? (
            <div className="animate-in slide-in-from-bottom-8 fade-in duration-1000 space-y-12">
              <div className="flex items-center justify-between border-b border-black/5 pb-8">
                 <div className="space-y-1">
                    <h2 className="text-3xl font-black text-[#1A1A1A] tracking-tight flex items-center gap-4">
                       <CheckCircle2 size={32} className="text-[#00DFB8]" />
                       {activeWorkflow.title}
                    </h2>
                    <p className="text-[#888] font-bold uppercase text-[10px] tracking-widest">{activeWorkflow.description}</p>
                 </div>
                 <button 
                   onClick={() => setActiveWorkflow(null)} 
                   className="px-6 py-2.5 bg-white border border-black/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#888] hover:text-[#1A1A1A] transition-all shadow-sm"
                 >
                    Reset Architecture
                 </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                 {/* WORKFLOW VISUALIZATION (LEFT) */}
                 <div className="lg:col-span-7 space-y-10">
                    <div className="space-y-6">
                       <div className="flex items-center gap-3 text-[#1A1A1A]">
                          <Workflow size={20} />
                          <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Agent Orchestration Chain</h4>
                       </div>
                        <div className="space-y-4 relative">
                           {activeWorkflow.agents.map((agent: any, i: number) => (
                             <div key={i} className="relative">
                                <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-xl shadow-black/5 flex items-center gap-6 relative z-10 hover:border-[#00DFB8]/30 transition-all group">
                                   <div className="w-14 h-14 bg-[#FAFAFA] border border-black/5 rounded-2xl flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white transition-all transform group-hover:rotate-6 shadow-sm">
                                      <agent.icon size={24} />
                                   </div>
                                   <div className="flex-1">
                                      <div className="text-sm font-black text-[#1A1A1A] mb-1">Agent {i+1}: {agent.name}</div>
                                      <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest">{agent.role}</p>
                                   </div>
                                   
                                   {/* AGENT ACTION BUTTONS */}
                                   <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => setShowInputForm(true)}
                                        className="p-2.5 bg-[#00DFB8]/10 text-[#00DFB8] rounded-xl hover:bg-[#00DFB8] hover:text-[#1A1A1A] transition-all shadow-sm group/btn relative"
                                      >
                                         <Play size={14} />
                                         <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-black text-white text-[9px] font-black uppercase rounded-lg opacity-0 group-hover/btn:opacity-100 transition-all">Run</span>
                                      </button>
                                      <button 
                                        onClick={() => setActiveAgentDetails(agent)}
                                        className="p-2.5 bg-[#FAFAFA] text-[#1A1A1A] border border-black/5 rounded-xl hover:bg-[#1A1A1A] hover:text-white transition-all shadow-sm group/btn relative"
                                      >
                                         <Info size={14} />
                                         <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-black text-white text-[9px] font-black uppercase rounded-lg opacity-0 group-hover/btn:opacity-100 transition-all">Details</span>
                                      </button>
                                      <div className="h-8 w-px bg-black/5 mx-1" />
                                      <button className="p-2.5 text-gray-300 hover:text-[#1A1A1A] transition-all">
                                         <Settings size={14} />
                                      </button>
                                      <button className="p-2.5 text-gray-300 hover:text-red-500 transition-all">
                                         <Trash2 size={14} />
                                      </button>
                                   </div>
                                </div>
                                {i < activeWorkflow.agents.length - 1 && (
                                  <div className="w-px h-10 bg-black/5 ml-[44px] relative z-0">
                                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-[#00DFB8] rounded-full shadow-[0_0_8px_#00DFB8]" />
                                  </div>
                                )}
                             </div>
                           ))}
                        </div>
                    </div>

                    <div className="bg-[#1A1A1A] p-10 rounded-[2.5rem] border border-black shadow-2xl space-y-8 relative overflow-hidden">
                       <div className="relative z-10 space-y-6">
                          <div className="flex items-center gap-3 text-[#00DFB8]">
                             <Zap size={20} />
                             <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Integration Requirements</h4>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                             {activeWorkflow.requirements.map((req: string, i: number) => (
                               <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-3 group hover:bg-white/10 transition-all cursor-pointer">
                                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/50 group-hover:text-[#00DFB8]">
                                     <Link2 size={14} />
                                  </div>
                                  <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">{req}</span>
                               </div>
                             ))}
                             <button className="bg-white/5 border border-dashed border-white/20 p-4 rounded-2xl flex items-center gap-3 text-white/30 hover:border-white/50 hover:text-white transition-all">
                                <Plus size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Connect Tool</span>
                             </button>
                          </div>
                       </div>
                       <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-[#00DFB8]/5 rounded-full blur-3xl -z-0" />
                    </div>
                 </div>

                 {/* CODE ARCHITECTURE (RIGHT) */}
                 <div className="lg:col-span-5">
                    <div className="sticky top-10 space-y-6">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-[#1A1A1A]">
                             <Code2 size={20} />
                             <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Vercel Deployment Logic</h4>
                          </div>
                          <button onClick={() => setFullscreenCode(true)} className="p-2 bg-black/5 rounded-lg text-gray-400 hover:text-black transition-all">
                             <Maximize2 size={16} />
                          </button>
                       </div>
                       <div className="bg-[#1A1A1A] rounded-[2rem] border border-black shadow-2xl overflow-hidden h-[600px] flex flex-col group">
                          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500/20" />
                                <div className="w-2 h-2 rounded-full bg-amber-500/20" />
                                <div className="w-2 h-2 rounded-full bg-green-500/20" />
                                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-3 font-mono">orchestrator.ts</span>
                             </div>
                             <div className="px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[8px] font-black uppercase tracking-widest">
                                Production Ready
                             </div>
                          </div>
                          <div className="flex-1 p-8 overflow-auto font-mono text-[11px] leading-relaxed relative">
                             <pre className="text-gray-400 whitespace-pre-wrap">
                                <code dangerouslySetInnerHTML={{ 
                                  __html: activeWorkflow.codeSnippet
                                    .replace(/\/\/.*/g, '<span class="text-gray-600 italic">$&</span>')
                                    .replace(/import|from|export|async|await|const|if|return/g, '<span class="text-[#00DFB8] font-bold">$&</span>')
                                    .replace(/'[^']*'/g, '<span class="text-amber-300">$&</span>')
                                }} />
                             </pre>
                             <div className="absolute bottom-8 right-8">
                                <button className="p-4 bg-white/5 hover:bg-white text-[#1A1A1A] rounded-2xl shadow-xl transition-all font-black text-[10px] uppercase tracking-widest group-hover:scale-110">
                                   Deploy to Vercel
                                </button>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="space-y-10 animate-in fade-in duration-1000 pt-12">
               <div className="flex items-center justify-center gap-4">
                  <div className="h-px w-20 bg-black/5" />
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.4em]">Corporate Archetypes</span>
                  <div className="h-px w-20 bg-black/5" />
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {WORKFLOW_TEMPLATES.map((template) => (
                   <div 
                     key={template.id}
                     onClick={() => selectTemplate(template)}
                     className="bg-white p-10 rounded-[2.5rem] border border-black/5 shadow-xl shadow-black/5 hover:border-[#00DFB8] hover:shadow-2xl hover:shadow-[#00DFB8]/10 transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden"
                   >
                     <div className="w-16 h-16 bg-[#FAFAFA] border border-black/5 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-[#1A1A1A] group-hover:text-white transition-all transform group-hover:rotate-6">
                        <template.icon size={28} />
                     </div>
                     <h4 className="text-xl font-black text-[#1A1A1A] mb-3">{template.title}</h4>
                     <p className="text-sm text-[#888] font-medium leading-relaxed flex-1 italic">
                        "{template.description}"
                     </p>
                     
                     <div className="mt-10 pt-8 border-t border-black/5 space-y-4">
                        <div className="flex items-center gap-2">
                           <div className="flex -space-x-2">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="w-7 h-7 rounded-full bg-white border-2 border-[#FAFAFA] flex items-center justify-center text-[#1A1A1A] shadow-sm">
                                   <Bot size={12} />
                                </div>
                              ))}
                           </div>
                           <span className="text-[9px] font-black text-[#888] uppercase tracking-widest ml-2">3 Agents Optimized</span>
                        </div>
                        <div className="flex items-center justify-between group-hover:translate-x-1 transition-transform">
                           <span className="text-[10px] font-black text-[#00DFB8] uppercase tracking-[0.2em]">Deploy Template</span>
                           <ArrowRight size={16} className="text-[#00DFB8]" />
                        </div>
                     </div>
                     
                     <div className="absolute top-0 right-0 w-24 h-24 bg-black/5 rounded-bl-[4rem] translate-x-12 -translate-y-12 transition-all group-hover:bg-[#00DFB8]/10" />
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      </div>

      {/* FULLSCREEN CODE OVERLAY */}
      {fullscreenCode && (
        <div className="fixed inset-0 z-[100] bg-black p-10 flex flex-col space-y-8 animate-in zoom-in-95 duration-300">
           <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-[#00DFB8]">
                    <Code2 size={24} />
                 </div>
                 <div>
                    <h3 className="text-2xl font-black tracking-tight">Full Orchestration Logic</h3>
                    <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest">Synthesized Infrastructure for {activeWorkflow?.title}</p>
                 </div>
              </div>
              <button onClick={() => setFullscreenCode(false)} className="w-12 h-12 rounded-full bg-white/5 hover:bg-white hover:text-black flex items-center justify-center transition-all">
                 <X size={24} />
              </button>
           </div>
           <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-12 overflow-auto font-mono text-sm leading-loose">
              <pre className="text-gray-400">
                 <code dangerouslySetInnerHTML={{ 
                    __html: activeWorkflow?.codeSnippet
                      .replace(/\/\/.*/g, '<span class="text-gray-600 italic">$&</span>')
                      .replace(/import|from|export|async|await|const|if|return/g, '<span class="text-[#00DFB8] font-bold">$&</span>')
                      .replace(/'[^']*'/g, '<span class="text-amber-300">$&</span>')
                 }} />
              </pre>
           </div>
           <div className="flex justify-center gap-8">
              <button className="px-12 py-5 bg-[#00DFB8] text-[#1A1A1A] rounded-2xl font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:scale-105 transition-all">
                 Copy Production Bundle
              </button>
              <button className="px-12 py-5 bg-white text-[#1A1A1A] rounded-2xl font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:scale-105 transition-all">
                 Deploy to Vercel
              </button>
           </div>
        </div>
      )}

      {/* DYNAMIC INPUT FORM MODAL */}
      {showInputForm && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
           <div className="bg-white rounded-[3rem] p-12 max-w-2xl w-full space-y-10 shadow-2xl relative border border-black/5 overflow-hidden animate-in zoom-in-95 duration-300">
              <button onClick={() => setShowInputForm(false)} className="absolute top-8 right-8 text-gray-300 hover:text-black transition-all">
                <X size={24} />
              </button>
              
              <div className="space-y-3">
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-black uppercase tracking-widest">
                    <Workflow size={12} /> Workflow Trigger
                 </div>
                 <h2 className="text-4xl font-black text-[#1A1A1A] tracking-tighter">Enter Execution Details</h2>
                 <p className="text-xs text-[#888] font-bold uppercase tracking-[0.2em]">Validate inputs for "{activeWorkflow?.title}"</p>
              </div>

              <div className="grid grid-cols-1 gap-8 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-[#888] uppercase tracking-widest flex items-center gap-2">
                       <Mail size={12} /> Contact Email Address
                    </label>
                    <input 
                      type="email"
                      className="w-full bg-[#FAFAFA] border border-black/5 rounded-2xl px-6 py-4 text-sm font-bold focus:border-[#00DFB8] outline-none transition-all shadow-inner"
                      placeholder="customer@company.com"
                    />
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-[#888] uppercase tracking-widest flex items-center gap-2">
                       <Upload size={12} /> Upload Data Batch (CSV/PDF)
                    </label>
                    <div className="w-full border-4 border-dashed border-black/5 rounded-[2rem] p-10 flex flex-col items-center justify-center space-y-4 hover:border-[#00DFB8]/30 transition-all cursor-pointer bg-[#FAFAFA] group">
                       <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-gray-300 group-hover:text-[#00DFB8] transition-all shadow-sm">
                          <Upload size={24} />
                       </div>
                       <div className="text-center">
                          <div className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest">Drop files here</div>
                          <div className="text-[9px] font-bold text-[#888] uppercase tracking-tight">Supports XLSX, CSV, PDF</div>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-[#888] uppercase tracking-widest flex items-center gap-2">
                       <ShieldCheck size={12} /> Idempotency Guard
                    </label>
                    <div className="bg-[#FAFAFA] p-4 rounded-xl border border-black/5 flex items-center justify-between">
                       <span className="text-[10px] font-bold text-[#888] uppercase">Secure Action Gateway</span>
                       <div className="w-10 h-5 bg-[#00DFB8] rounded-full relative p-1 cursor-pointer">
                          <div className="w-3 h-3 bg-white rounded-full ml-auto shadow-sm" />
                       </div>
                    </div>
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <button 
                   onClick={() => setShowInputForm(false)}
                   className="flex-1 py-5 bg-[#1A1A1A] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3"
                 >
                   Execute Pipeline <Zap size={16} className="text-[#00DFB8]" />
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* AGENT DETAILS MODAL */}
      {activeAgentDetails && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-lg flex items-center justify-center p-6">
           <div className="bg-[#1A1A1A] rounded-[3rem] border border-white/10 p-12 max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 shadow-2xl relative animate-in slide-in-from-bottom-12 duration-500">
              <button onClick={() => setActiveAgentDetails(null)} className="absolute top-8 right-8 text-white/20 hover:text-white transition-all">
                <X size={24} />
              </button>
              
              <div className="space-y-8">
                 <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-[#00DFB8] border border-white/10 shadow-2xl">
                    <activeAgentDetails.icon size={48} />
                 </div>
                 <div className="space-y-3">
                    <h2 className="text-4xl font-black text-white tracking-tighter">{activeAgentDetails.name}</h2>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-black uppercase tracking-widest">
                       Persona Configuration
                    </div>
                 </div>
                 <p className="text-white/60 font-medium leading-relaxed italic">
                    "{activeAgentDetails.role}"
                 </p>
                 
                 <div className="space-y-4 pt-8">
                    <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Core Directive</div>
                    <div className="p-6 bg-white/5 border border-white/5 rounded-2xl text-white/80 text-xs font-mono leading-loose">
                       Maintain strictly typed JSON outputs. Pass state via shared context. Human escalation threshold: 0.75.
                    </div>
                 </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-10 space-y-10 overflow-y-auto">
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Extended Knowledge</h4>
                    <div className="space-y-3">
                       <button className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-[#00DFB8]/30 transition-all">
                          <div className="flex items-center gap-4">
                             <FileCode size={20} className="text-[#00DFB8]" />
                             <div className="text-left">
                                <div className="text-[10px] font-black text-white uppercase tracking-widest">Knowledge Base</div>
                                <div className="text-[9px] font-bold text-white/40 uppercase">3 CSVs, 1 PDF Synced</div>
                             </div>
                          </div>
                          <ChevronRight size={16} className="text-white/20 group-hover:text-[#00DFB8]" />
                       </button>
                       <button className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-[#00DFB8]/30 transition-all">
                          <div className="flex items-center gap-4">
                             <Mail size={20} className="text-blue-400" />
                             <div className="text-left">
                                <div className="text-[10px] font-black text-white uppercase tracking-widest">Routing Email</div>
                                <div className="text-[9px] font-bold text-white/40 uppercase">agents@company.com</div>
                             </div>
                          </div>
                          <ChevronRight size={16} className="text-white/20 group-hover:text-[#00DFB8]" />
                       </button>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Security Guardrails</h4>
                    <div className="space-y-3">
                       {[
                          { label: 'PII Scrubbing', status: 'Enabled', icon: ShieldCheck },
                          { label: 'Audit Logging', status: 'Enabled', icon: FileText },
                          { label: 'Action Gateway', status: 'Active', icon: Zap }
                       ].map((g, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                             <div className="flex items-center gap-3">
                                <g.icon size={14} className="text-[#00DFB8]" />
                                <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">{g.label}</span>
                             </div>
                             <div className="text-[9px] font-black text-[#00DFB8] uppercase">{g.status}</div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
