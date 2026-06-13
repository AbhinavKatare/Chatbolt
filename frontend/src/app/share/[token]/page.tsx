'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Download, ExternalLink, FileText, Calendar, Clock, ArrowRight, ShieldAlert, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

export default function PublicSharePage() {
  const { token } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api.shares.get(token as string)
      .then(res => {
        setData(res)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Share link not found or expired.')
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-8 h-8 text-[#534AB7] animate-spin mb-4" />
        <p className="text-zinc-500 text-sm font-medium">Retrieving shared task details...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white border border-zinc-200/80 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-zinc-900 mb-2">Unable to load share link</h1>
          <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
            {error || 'This link may have expired (links expire after 7 days) or does not exist.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-5 py-2.5 text-sm font-semibold text-white bg-[#534AB7] rounded-xl hover:bg-[#433A9F] active:scale-95 transition-all shadow-sm shadow-[#534AB7]/10"
          >
            Go to Chatbolt Home
          </Link>
        </div>
      </div>
    )
  }

  const durationSec = data.duration_ms ? (data.duration_ms / 1000).toFixed(1) : null
  const formattedDate = data.completed_at 
    ? new Date(data.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-zinc-800 font-sans flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200/50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#534AB7] flex items-center justify-center text-white font-black text-lg shadow-sm shadow-[#534AB7]/20 group-hover:scale-105 transition-transform">
              C
            </div>
            <span className="font-bold text-lg text-zinc-900 tracking-tight">Chatbolt</span>
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#534AB7] border border-[#534AB7]/20 rounded-lg hover:bg-[#534AB7]/5 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 space-y-8">
        {/* Receipt Header Card */}
        <div className="bg-white border border-zinc-200/60 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-5">
            <div>
              <span className="text-[10px] font-bold text-[#534AB7] uppercase tracking-wider bg-[#534AB7]/5 px-2.5 py-1 rounded-full border border-[#534AB7]/10">
                Shared Task Result
              </span>
              <h1 className="text-xl md:text-2xl font-extrabold text-zinc-900 mt-2.5 tracking-tight">
                {data.name || 'Autonomous Task'}
              </h1>
            </div>
            {/* Status Pills */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Completed
              </span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
            <div>
              <span className="text-xs text-zinc-400 block font-medium">Completed On</span>
              <span className="text-zinc-700 font-semibold mt-1 inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-zinc-400" />
                {formattedDate || 'Recent'}
              </span>
            </div>
            {durationSec && (
              <div>
                <span className="text-xs text-zinc-400 block font-medium">Execution Duration</span>
                <span className="text-zinc-700 font-semibold mt-1 inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  {durationSec} seconds
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Prompt & Plain-English Receipt */}
        <div className="bg-white border border-zinc-200/60 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Original Request</h2>
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-zinc-700 text-sm leading-relaxed italic">
              "{data.prompt}"
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">Summary of Accomplishments</h2>
            <p className="text-zinc-700 text-base leading-relaxed">
              {data.receipt || 'The task completed successfully and output files have been generated.'}
            </p>
          </div>
        </div>

        {/* Output Artifacts Section */}
        {data.artifacts && data.artifacts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Generated Assets & Documents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.artifacts.map((art: any, idx: number) => (
                <div key={idx} className="bg-white border border-zinc-200/60 rounded-xl p-5 shadow-sm hover:border-zinc-300 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#534AB7]/5 text-[#534AB7] rounded-lg flex items-center justify-center border border-[#534AB7]/10">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-zinc-800 font-bold text-sm block truncate max-w-[180px]">
                        {art.name}
                      </span>
                      <span className="text-zinc-400 text-xs uppercase font-semibold tracking-wider">
                        {art.type}
                      </span>
                    </div>
                  </div>
                  {art.download_url && (
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${art.download_url}`}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
                    >
                      Download <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Try Chatbolt CTA block */}
        <div className="bg-gradient-to-br from-[#534AB7] to-[#433A9F] border border-[#534AB7]/30 rounded-3xl p-8 md:p-12 text-center text-white shadow-xl relative overflow-hidden">
          {/* Subtle decorative background circles */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-2xl" />

          <div className="relative z-10 max-w-xl mx-auto space-y-6">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Automate complex browser, slide, and data tasks.
            </h2>
            <p className="text-zinc-100/90 text-sm md:text-base leading-relaxed">
              Connect your tools, configure background processes, and run multi-step actions. Get started free with 500 monthly credits.
            </p>
            <div className="pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-[#534AB7] hover:bg-zinc-50 active:scale-95 transition-all text-sm font-bold rounded-xl shadow-lg shadow-[#433A9F]/20 group"
              >
                Build Your First Process
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200/50 py-8 text-center text-xs text-zinc-400">
        <p>© {new Date().getFullYear()} Chatbolt. All rights reserved.</p>
      </footer>
    </div>
  )
}
