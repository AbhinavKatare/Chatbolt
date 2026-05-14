'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function AgentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('settings') // settings, knowledge, deploy

  useEffect(() => {
    api.agents.get(id as string).then(r => {
      setAgent(r.agent)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="p-20 text-center text-sm-muted italic">Loading agent configuration...</div>
  if (!agent) return <div className="p-20 text-center text-sm-muted italic">Agent not found.</div>

  const agentTypeLabel = agent.persona?.agent_type?.replace('_', ' ') || 'AI Assistant'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#00DFB8]/10 border border-[#00DFB8]/20 rounded-xl flex items-center justify-center text-2xl">
            {agent.persona?.icon || '🤖'}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="display-title text-2xl text-[#1A1A1A]">{agent.name}</h1>
              <span className="px-2 py-0.5 rounded bg-black/5 text-[9px] text-[#555555] font-bold uppercase tracking-widest border border-black/5">
                {agentTypeLabel}
              </span>
            </div>
            <p className="text-sm-muted mt-1">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary py-2 px-4">Pause Agent</button>
          <button className="btn btn-primary py-2 px-6">Save Changes</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-black/5">
        {['settings', 'knowledge', 'deploy'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${tab === t ? 'text-[#00DFB8] border-[#00DFB8]' : 'text-[#444] border-transparent hover:text-[#555555]'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {tab === 'settings' && (
            <div className="card p-8 space-y-8">
              <div>
                <label className="text-label block mb-4">Core Identity (System Prompt)</label>
                <textarea 
                  className="w-full bg-[#FDFDFB] border border-black/5 rounded-lg p-4 text-sm text-[#555555] focus:border-[#00DFB8]/40 outline-none transition-all h-64 resize-none leading-relaxed"
                  defaultValue={agent.system_prompt}
                />
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-label block mb-4">Response Tone</label>
                  <select className="w-full bg-[#FDFDFB] border border-black/5 rounded-lg p-3 text-sm text-[#1A1A1A] focus:border-[#00DFB8]/40 outline-none">
                    <option>Professional</option>
                    <option>Friendly</option>
                    <option>Concise</option>
                    <option>Casual</option>
                  </select>
                </div>
                <div>
                  <label className="text-label block mb-4">Creativity Level</label>
                  <input type="range" className="w-full accent-[#00DFB8]" />
                  <div className="flex justify-between text-[10px] text-[#444] mt-2 font-mono uppercase tracking-widest">
                    <span>Precision</span>
                    <span>Creativity</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-label block mb-4">Escalation Triggers</label>
                <div className="flex flex-wrap gap-2">
                  {agent.escalation_rules?.keywords?.map((kw: string) => (
                    <span key={kw} className="px-3 py-1 bg-black/5 border border-black/5 rounded text-[11px] text-[#555555]">
                      {kw}
                    </span>
                  ))}
                  <button className="px-3 py-1 border border-dashed border-black/10 rounded text-[11px] text-[#444] hover:text-[#00DFB8] hover:border-[#00DFB8]/40">
                    + Add Keyword
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'knowledge' && (
            <div className="card">
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <h3 className="display-title text-lg text-[#1A1A1A]">Knowledge Base</h3>
                <button className="btn btn-primary py-2 px-4 text-xs">+ Add Source</button>
              </div>
              <div className="p-20 text-center flex flex-col items-center">
                <div className="text-5xl mb-6">📚</div>
                <h3 className="display-title text-xl text-[#1A1A1A] mb-2">Feed your agent</h3>
                <p className="text-sm-muted max-w-sm mb-10">Upload PDFs, paste website URLs, or add raw text. Your agent learns your business in seconds.</p>
                <div className="flex gap-4">
                  <button className="btn btn-secondary px-6 py-2 text-[10px] no-underline hover:no-underline border-black/10 text-[#1A1A1A]">Upload PDF</button>
                  <button className="btn btn-secondary px-6 py-2 text-[10px] no-underline hover:no-underline border-black/10 text-[#1A1A1A]">Crawl Website</button>
                </div>
                <p className="text-[10px] text-[#444] mt-8 uppercase tracking-[0.2em]">Supports PDF, DOCX, CSV, TXT, and URLs</p>
              </div>
            </div>
          )}

          {tab === 'deploy' && (
            <div className="space-y-6">
              <div className="card p-8">
                <h3 className="display-title text-lg text-[#1A1A1A] mb-6">Website Widget</h3>
                <div className="bg-black/40 rounded-lg p-6 border border-black/5 relative group">
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-[10px] text-[#00DFB8] font-bold uppercase tracking-widest">Copy Code</button>
                  </div>
                  <pre className="text-xs text-[#00DFB8]/60 font-mono overflow-x-auto">
                    {`<script 
  src="https://chatbolt.io/widget.js" 
  data-agent-id="${agent.id}" 
  defer
></script>`}
                  </pre>
                </div>
              </div>
              
              <div className="card p-8">
                <h3 className="display-title text-lg text-[#1A1A1A] mb-6">WhatsApp Integration</h3>
                <p className="text-sm-muted mb-6">Connect your business WhatsApp number to this agent.</p>
                <button className="btn btn-secondary w-full py-3">Connect WhatsApp via Twilio →</button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-label mb-6">Usage Stats</h3>
            <div className="space-y-6">
              <div>
                <div className="text-2xl font-bold text-[#1A1A1A]">{agent.conversation_count || 0}</div>
                <div className="text-[10px] text-[#444] uppercase tracking-widest mt-1">Total Chats</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#1A1A1A]">0</div>
                <div className="text-[10px] text-[#444] uppercase tracking-widest mt-1">Leads Captured</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#1A1A1A]">0%</div>
                <div className="text-[10px] text-[#444] uppercase tracking-widest mt-1">Resolution Rate</div>
              </div>
            </div>
          </div>

          <div className="card p-6 bg-[#00DFB8]/5 border-[#00DFB8]/10">
            <h3 className="text-label mb-4 text-[#00DFB8]">Agent Health</h3>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#00DFB8] animate-pulse" />
              <span className="text-xs text-[#1A1A1A] font-semibold">Online & Monitoring</span>
            </div>
            <p className="text-[11px] text-[#555555] leading-relaxed">
              This agent is actively processing queries and monitoring for escalation keywords.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
