'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
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
  Database
} from 'lucide-react'

export default function ReportsPage() {
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
      setReports(res.reports)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    try {
      setGenerating(true)
      await api.reports.generate()
      await fetchReports()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              <Database size={14} className="text-[#00DFB8]" /> Operations Ledger
           </div>
           <div className="h-4 w-px bg-black/[0.05]" />
           <div className="flex items-center gap-4">
              <button className="text-[10px] font-bold text-black uppercase tracking-widest border-b border-black">Daily Digests</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Compliance</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Token Audits</button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={handleGenerate}
             disabled={generating}
             className="bg-[#1A1A1A] text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-sm disabled:opacity-50"
           >
              {generating ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} fill="currentColor" />}
              {generating ? 'Processing' : 'Generate Manifest'}
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-8 py-10 space-y-8">
          
          <div className="flex justify-between items-end">
             <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-black uppercase tracking-widest">
                   <ShieldCheck size={10} /> Certified Audit Trail
                </div>
                <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">Executive Operations Reports</h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
                   High-fidelity automated daily digests of your autonomous workforce's architectural performance and resource consumption.
                </p>
             </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
               <RefreshCw className="w-8 h-8 text-[#00DFB8] animate-spin" />
               <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Querying Ledger...</div>
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white border border-black/[0.03] rounded-2xl p-16 text-center shadow-sm">
               <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-6 text-gray-200">
                 <FileText size={24} />
               </div>
               <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-widest mb-2">No Reports Generated</h3>
               <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest max-w-md mx-auto mb-8 leading-loose">
                 Automated architecture digests are scheduled for midnight cycles. Initialize a manual generation to see your performance metrics.
               </p>
               <button 
                 onClick={handleGenerate}
                 className="px-6 py-2.5 bg-white border border-black/[0.05] text-[#1A1A1A] hover:border-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm"
               >
                 Initialize First Audit
               </button>
            </div>
          ) : (
            <div className="space-y-6">
              {reports.map((report) => (
                <div key={report.id} className="bg-white border border-black/[0.03] rounded-2xl p-8 shadow-sm group hover:border-[#00DFB8]/30 transition-all">
                  <div className="flex items-center justify-between mb-8 border-b border-black/[0.03] pb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 text-[#00DFB8] rounded-xl flex items-center justify-center border border-black/[0.03]">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-widest">
                          {new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h3>
                        <div className="text-[8px] font-black text-gray-300 uppercase tracking-widest mt-1">
                          Platform Infrastructure Digest
                        </div>
                      </div>
                    </div>
                    <div className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-green-100">
                      <CheckCircle2 size={10} /> Delivered to Ops
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-7 space-y-4">
                      <div className="text-[11px] font-medium text-gray-500 leading-relaxed whitespace-pre-line border-l border-[#00DFB8]/30 pl-6 italic">
                        {report.summary}
                      </div>
                      <div className="pt-4">
                         <button className="text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-black flex items-center gap-1 transition-colors">
                            Inspect Full Transaction Logs <ChevronRight size={12} />
                         </button>
                      </div>
                    </div>
                    
                    <div className="col-span-5 bg-black/[0.01] rounded-xl p-6 border border-black/[0.03] space-y-6">
                      <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
                         <h4 className="text-[9px] font-black text-[#1A1A1A] uppercase tracking-widest">Metrics Snapshot</h4>
                         <Activity size={12} className="text-[#00DFB8]" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2 text-[10px] font-black text-gray-300 uppercase tracking-widest">
                             <Zap size={12} /> Workflows
                           </div>
                           <div className="text-xs font-bold text-[#1A1A1A]">{report.metrics?.workflows?.total_runs || 0} Runs</div>
                        </div>
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2 text-[10px] font-black text-gray-300 uppercase tracking-widest">
                             <RefreshCw size={12} /> API Usage
                           </div>
                           <div className="text-xs font-bold text-[#1A1A1A]">{report.metrics?.workflows?.api_calls_used || 0} Calls</div>
                        </div>
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2 text-[10px] font-black text-gray-300 uppercase tracking-widest">
                             <CheckCircle2 size={12} /> Reliability
                           </div>
                           <div className="text-xs font-bold text-green-500">
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
             <button className="flex items-center gap-2 px-6 py-2.5 bg-white border border-black/[0.05] rounded-xl text-[9px] font-black text-gray-400 hover:text-black uppercase tracking-widest shadow-sm transition-all">
                <Download size={12} /> Archival Export (PDF)
             </button>
          </div>
        </div>
      </div>
    </div>
  )
}
