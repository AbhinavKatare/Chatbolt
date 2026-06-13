'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, getSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  ShieldCheck, AlertCircle, BarChart2, RefreshCw, 
  CheckCircle2, Activity, Database, Users, AlertTriangle 
} from 'lucide-react'

export default function AdminDashboardPage() {
  const router = useRouter()
  const { error: toastError, success: toastSuccess } = useToast()
  
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)

  const checkAuthAndLoadStats = async () => {
    setLoading(true)
    try {
      const sess = await getSession()
      setSession(sess)
      if (!sess || !sess.tenant || !sess.tenant.is_admin) {
        toastError('Access Denied', 'Admin privileges required.')
        router.replace('/dashboard')
        return
      }
      
      const adminData = await api.analytics.adminStats()
      setStats(adminData)
    } catch (err: any) {
      toastError('Failed to load admin stats', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuthAndLoadStats()
  }, [])

  if (loading) {
    return (
      <div className="flex-1 p-6 bg-[#050507] text-[#EDEDED] flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin text-[#00E599] mb-4">
          <RefreshCw size={24} />
        </div>
        <p className="text-xs text-zinc-500 font-mono">Verifying admin access...</p>
      </div>
    )
  }

  if (!session?.tenant?.is_admin || !stats) {
    return null
  }

  const { liveStats, failureLog, integrationHealth, topTasks } = stats

  return (
    <div className="flex-1 p-6 bg-[#050507] text-[#EDEDED] overflow-y-auto min-h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-[#00E599]" size={20} />
            <h1 className="text-xl font-serif text-white tracking-tight font-medium">Admin Control Center</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">Global platform metrics, health logs, and active integrations.</p>
        </div>
        <button
          onClick={checkAuthAndLoadStats}
          className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-white/[0.04] transition-all"
          title="Refresh metrics"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Grid: Live Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-black uppercase tracking-widest">Total Runs</span>
            <Activity size={14} className="text-[#00E599]" />
          </div>
          <p className="text-2xl font-serif font-bold text-white">{liveStats.totalRuns}</p>
          <p className="text-[10px] text-zinc-500">All-time executed processes</p>
        </div>

        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-black uppercase tracking-widest">Total Conversations</span>
            <Users size={14} className="text-indigo-400" />
          </div>
          <p className="text-2xl font-serif font-bold text-white">{liveStats.totalConversations}</p>
          <p className="text-[10px] text-zinc-500">User chat sessions</p>
        </div>

        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-black uppercase tracking-widest">Active Tenants</span>
            <Database size={14} className="text-amber-400" />
          </div>
          <p className="text-2xl font-serif font-bold text-white">{liveStats.activeTenants}</p>
          <p className="text-[10px] text-zinc-500">Registered active businesses</p>
        </div>

        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-black uppercase tracking-widest">Success Rate</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-serif font-bold text-white">{liveStats.successRate}%</p>
          <p className="text-[10px] text-zinc-500">Completed without failure</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Failure Log (Spans 2) */}
        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
            <h2 className="text-sm font-semibold text-white">Recent Failures Log</h2>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-950/40 text-red-400 border border-red-900/30">
              Live Issues
            </span>
          </div>

          <div className="overflow-x-auto">
            {failureLog.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">No recent process failures logged.</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04] text-zinc-500">
                    <th className="pb-2 font-medium">Task</th>
                    <th className="pb-2 font-medium">Tenant</th>
                    <th className="pb-2 font-medium">Error Message</th>
                    <th className="pb-2 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {failureLog.map((log: any) => (
                    <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3 pr-3 text-white font-medium">{log.workflow_name}</td>
                      <td className="py-3 pr-3 text-zinc-400 font-mono text-[10px]">{log.tenant_email}</td>
                      <td className="py-3 pr-3 text-red-400 max-w-xs truncate" title={log.error_message}>
                        {log.error_message || 'Unknown execution error'}
                      </td>
                      <td className="py-3 text-right text-zinc-500 text-[10px]">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Col: Integration Health & Top Tasks */}
        <div className="space-y-6">
          {/* Integration Health */}
          <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white border-b border-white/[0.04] pb-3">Integration Hub</h2>
            {integrationHealth.length === 0 ? (
              <div className="py-4 text-center text-xs text-zinc-500">No active integrations connected.</div>
            ) : (
              <div className="space-y-3">
                {integrationHealth.map((item: any) => (
                  <div key={item.service} className="flex items-center justify-between text-xs py-1">
                    <span className="font-mono text-zinc-300 capitalize">{item.service}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500">{item.count} connection(s)</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Tasks */}
          <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white border-b border-white/[0.04] pb-3">Top Processes</h2>
            {topTasks.length === 0 ? (
              <div className="py-4 text-center text-xs text-zinc-500">No processes executed yet.</div>
            ) : (
              <div className="space-y-3">
                {topTasks.map((item: any) => (
                  <div key={item.task_type} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-zinc-300 font-medium">{item.task_type}</span>
                      <span className="text-zinc-500">{item.count} runs</span>
                    </div>
                    <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ 
                          width: `${Math.min(100, (item.count / Math.max(...topTasks.map((t: any) => t.count))) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
