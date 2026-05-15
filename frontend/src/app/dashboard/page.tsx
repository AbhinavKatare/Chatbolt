'use client'
import React, { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Sparkles, Activity, Users, Workflow, ArrowRight, Clock, Zap, MessageSquare } from 'lucide-react'
import Link from 'next/link'

export default function OverviewPage() {
  const { error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [recentWorkflows, setRecentWorkflows] = useState<any[]>([])
  const [recentAgents, setRecentAgents] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const [statRes, wfRes, agRes] = await Promise.all([
          api.analytics.overview().catch(() => ({ total_conversations: 0, active_agents: 0, credits_used: 0 })),
          api.workflows.list().catch(() => ({ workflows: [] })),
          api.agents.list().catch(() => ({ agents: [] }))
        ])
        
        setStats(statRes)
        setRecentWorkflows(wfRes.workflows.slice(0, 4))
        setRecentAgents(agRes.agents.slice(0, 4))
      } catch (err: any) {
        toastError('Failed to load overview data', err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FAFAFA]">
        <div className="w-6 h-6 border-2 border-black/10 border-t-[#B8FF00] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] font-sans selection:bg-[#B8FF00]/30 overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto w-full px-8 py-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-[#111] tracking-tight">System Overview</h1>
          <p className="text-xs text-gray-400 mt-1 font-medium">Real-time status of your autonomous architecture.</p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 bg-black text-[#B8FF00] rounded-xl flex items-center justify-center mb-4">
              <Activity size={18} />
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Interactions</div>
            <div className="text-3xl font-bold text-[#111]">{stats?.total_conversations || 0}</div>
          </div>
          
          <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 bg-black text-[#B8FF00] rounded-xl flex items-center justify-center mb-4">
              <Users size={18} />
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Active Agents</div>
            <div className="text-3xl font-bold text-[#111]">{stats?.active_agents || recentAgents.length || 0}</div>
          </div>

          <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 bg-black text-[#B8FF00] rounded-xl flex items-center justify-center mb-4">
              <Workflow size={18} />
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Active Workflows</div>
            <div className="text-3xl font-bold text-[#111]">{recentWorkflows.length}</div>
          </div>

          <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 bg-black text-[#B8FF00] rounded-xl flex items-center justify-center mb-4">
              <Zap size={18} />
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Credits Used</div>
            <div className="text-3xl font-bold text-[#111]">{stats?.credits_used || 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Workflows */}
          <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#111]">
                <Workflow size={14} className="text-[#00DFB8]" /> Recent Workflows
              </div>
              <Link href="/dashboard/workflows" className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors flex items-center gap-1">
                View All <ArrowRight size={10} />
              </Link>
            </div>
            <div className="flex-1 p-2">
              {recentWorkflows.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-gray-300">
                  <Workflow size={24} className="mb-2 opacity-50" />
                  <div className="text-[10px] font-bold uppercase tracking-widest">No workflows yet</div>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentWorkflows.map(wf => (
                    <Link key={wf.id} href={`/dashboard/playground/${wf.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#B8FF00]/20 group-hover:text-[#111] transition-colors">
                          <Zap size={14} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#111]">{wf.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{wf.agent_count} Agents • {wf.type}</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-300 font-medium">{new Date(wf.created_at).toLocaleDateString()}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Agents */}
          <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#111]">
                <Users size={14} className="text-[#00DFB8]" /> Top Agents
              </div>
              <Link href="/dashboard/agents" className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors flex items-center gap-1">
                View All <ArrowRight size={10} />
              </Link>
            </div>
            <div className="flex-1 p-2">
              {recentAgents.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-gray-300">
                  <Users size={24} className="mb-2 opacity-50" />
                  <div className="text-[10px] font-bold uppercase tracking-widest">No agents deployed</div>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentAgents.map(agent => (
                    <div key={agent.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-[#111] text-[#B8FF00] flex items-center justify-center shadow-lg shadow-black/10 group-hover:scale-105 transition-transform">
                          <MessageSquare size={12} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#111]">{agent.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5 uppercase font-bold tracking-wider">{agent.model}</div>
                        </div>
                      </div>
                      <div className="px-2 py-1 rounded bg-green-50 text-green-600 text-[9px] font-black uppercase tracking-widest border border-green-100">
                        Online
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
