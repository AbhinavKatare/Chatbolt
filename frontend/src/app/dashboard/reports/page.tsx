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
  RefreshCw
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
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto p-10 space-y-8 pb-32">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-bold uppercase tracking-widest mb-2">
              <FileText size={12} /> Executive Summary
            </div>
            <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Daily Ops Reports</h1>
            <p className="text-[#888] text-sm">Automated daily digests of your AI workforce's performance.</p>
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black transition-all group disabled:opacity-50"
          >
            {generating ? (
              <><RefreshCw size={14} className="animate-spin" /> Generating...</>
            ) : (
              <><Zap size={14} className="group-hover:text-[#00DFB8] transition-colors" /> Generate Now</>
            )}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
             <RefreshCw className="w-8 h-8 text-[#00DFB8] animate-spin" />
             <div className="text-[10px] font-black text-[#888] uppercase tracking-widest">Loading Reports...</div>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white border border-black/5 rounded-3xl p-16 text-center shadow-xl shadow-black/5">
             <div className="w-16 h-16 bg-[#FAFAFA] rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
               <FileText size={32} />
             </div>
             <h3 className="text-lg font-black text-[#1A1A1A] mb-2">No Reports Generated Yet</h3>
             <p className="text-[#888] text-sm max-w-md mx-auto mb-8">
               Daily reports summarize workflow executions, API usage, and agent performance. They are usually generated automatically at midnight.
             </p>
             <button 
               onClick={handleGenerate}
               className="px-8 py-3 bg-white border-2 border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
             >
               Run First Report
             </button>
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => (
              <div key={report.id} className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-xl shadow-black/5 hover:border-[#00DFB8]/30 transition-all group">
                <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#00DFB8]/10 text-[#00DFB8] rounded-2xl flex items-center justify-center">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-[#1A1A1A]">
                        {new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </h3>
                      <div className="text-[10px] font-bold text-[#888] uppercase tracking-widest mt-1">
                        System Digest
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-green-100">
                    <CheckCircle2 size={12} /> Delivered
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="text-sm font-medium text-gray-600 leading-relaxed whitespace-pre-line border-l-2 border-[#00DFB8] pl-4">
                      {report.summary}
                    </div>
                  </div>
                  
                  <div className="bg-[#FAFAFA] rounded-2xl p-6 border border-black/5">
                    <h4 className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-[0.2em] mb-4">Metrics Snapshot</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                         <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                           <Activity size={16} /> Workflows Run
                         </div>
                         <div className="text-base font-black text-[#1A1A1A]">{report.metrics?.workflows?.total_runs || 0}</div>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                         <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                           <Zap size={16} /> API Calls
                         </div>
                         <div className="text-base font-black text-[#1A1A1A]">{report.metrics?.workflows?.api_calls_used || 0}</div>
                      </div>
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                           <Clock size={16} /> Success Rate
                         </div>
                         <div className="text-base font-black text-green-500">
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
      </div>
    </div>
  )
}
