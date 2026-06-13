'use client'
import React, { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  FileText, 
  Calendar, 
  Activity, 
  Zap, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Download,
  ShieldCheck,
  ChevronRight,
  Database,
  BarChart3,
  TrendingUp,
  Cpu,
  Layers
} from 'lucide-react'

export default function ReportsPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchReports()
  }, [])

  async function fetchReports() {
    try {
      setLoading(true)
      const res = await api.reports.list()
      setReports(res.reports || [])
    } catch (err: any) {
      setError(err.message)
      toastError('Failed to load reports', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    try {
      setGenerating(true)
      await api.reports.generate()
      toastSuccess('Executive report generated successfully')
      await fetchReports()
    } catch (err: any) {
      setError(err.message)
      toastError('Failed to generate report', err.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#050507] text-[#EDEDED] overflow-y-auto custom-scrollbar">
      
      {/* TOOLBAR */}
      <div className="h-14 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
              <Database size={14} className="text-[#00E599]" /> Operations Ledger
           </div>
           <div className="h-4 w-px bg-white/[0.06]" />
           <div className="flex items-center gap-4">
              <button className="text-[10px] font-black text-white uppercase tracking-widest border-b-2 border-[#00E599] pb-4 mt-4">Daily Digests</button>
              <button className="text-[10px] font-bold text-zinc-500 hover:text-zinc-200 transition-colors uppercase tracking-widest">Compliance</button>
              <button className="text-[10px] font-bold text-zinc-500 hover:text-zinc-200 transition-colors uppercase tracking-widest">Token Audits</button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={handleGenerate}
             disabled={generating}
             className="bg-[#00E599] text-black px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#00E599]/90 transition-all shadow-[0_0_12px_rgba(0,229,153,0.3)] disabled:opacity-50"
           >
              {generating ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} fill="currentColor" />}
              {generating ? 'Processing' : 'Generate Manifest'}
           </button>
        </div>
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          
          <div className="flex justify-between items-end">
             <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-[#00E599]/10 text-[#00E599] rounded-full text-[9px] font-black uppercase tracking-widest border border-[#00E599]/20">
                   <ShieldCheck size={10} /> Certified Audit Trail
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Executive Operations Reports</h1>
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
                   High-fidelity automated daily digests of your autonomous workforce's architectural performance and resource consumption.
                </p>
             </div>
          </div>

          {error && (
            <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-2xl text-red-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500" /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
               <RefreshCw className="w-8 h-8 text-[#00E599] animate-spin" />
               <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Querying Ledger...</div>
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-16 text-center shadow-2xl">
               <div className="w-12 h-12 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-6 text-zinc-600">
                 <FileText size={24} />
               </div>
               <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-2">No Reports Generated</h3>
               <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest max-w-md mx-auto mb-8 leading-loose">
                 Automated architecture digests are scheduled for midnight cycles. Initialize a manual generation to see your performance metrics.
               </p>
               <button 
                 onClick={handleGenerate}
                 className="px-6 py-2.5 bg-white/[0.03] border border-white/[0.08] text-white hover:text-[#00E599] hover:border-[#00E599]/30 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm"
               >
                 Initialize First Audit
               </button>
            </div>
          ) : (
            <div className="space-y-6">
              {reports.map((report) => (
                <div key={report.id} className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-8 shadow-2xl group hover:border-[#00E599]/30 transition-all duration-300">
                  <div className="flex items-center justify-between mb-8 border-b border-white/[0.04] pb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/[0.02] text-[#00E599] rounded-xl flex items-center justify-center border border-white/[0.06]">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                          {new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h3>
                        <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1">
                          Platform Infrastructure Digest
                        </div>
                      </div>
                    </div>
                    <div className="px-2.5 py-1 bg-emerald-500/10 text-[#00E599] rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-[#00E599]/20">
                      <CheckCircle2 size={10} /> Delivered to Ops
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="col-span-1 md:col-span-7 space-y-4">
                      <div className="text-[12px] font-medium text-zinc-300 leading-relaxed whitespace-pre-line border-l-2 border-[#00E599]/40 pl-6 italic">
                        {report.summary}
                      </div>
                      <div className="pt-4">
                         <button className="text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:text-[#00E599] flex items-center gap-1 transition-colors">
                            Inspect Full Transaction Logs <ChevronRight size={12} />
                         </button>
                      </div>
                    </div>
                    
                    <div className="col-span-1 md:col-span-5 bg-white/[0.01] rounded-2xl p-6 border border-white/[0.04] space-y-6">
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                         <h4 className="text-[9px] font-black text-white uppercase tracking-widest">Metrics Snapshot</h4>
                         <Activity size={12} className="text-[#00E599]" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                             <Layers size={12} className="text-blue-400" /> Workflows
                           </div>
                           <div className="text-xs font-bold text-white">{report.metrics?.workflows?.total_runs || 0} Runs</div>
                        </div>
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                             <Cpu size={12} className="text-purple-400" /> API Usage
                           </div>
                           <div className="text-xs font-bold text-white">{report.metrics?.workflows?.api_calls_used || 0} Calls</div>
                        </div>
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                             <TrendingUp size={12} className="text-emerald-400" /> Reliability
                           </div>
                           <div className="text-xs font-bold text-[#00E599]">
                             {(report.metrics?.workflows?.success_rate || 0).toFixed(1)}%
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-center pt-8">
             <button className="flex items-center gap-2 px-6 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl text-[9px] font-black text-zinc-400 hover:text-white uppercase tracking-widest shadow-2xl transition-all">
                <Download size={12} /> Archival Export (PDF)
             </button>
          </div>
        </div>
      </div>
    </div>
  )
}
