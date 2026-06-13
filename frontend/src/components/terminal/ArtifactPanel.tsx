import React, { useState, useEffect } from 'react'
import { X, Download, ExternalLink, FileText, Copy, Check } from 'lucide-react'
import { TERMINAL_STRINGS } from './strings'

interface Artifact {
  id: string
  name: string
  type: string
  content?: string
  downloadUrl?: string
}

interface ArtifactPanelProps {
  artifact: Artifact | null
  onClose: () => void
}

export default function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const [copied, setCopied] = useState(false)
  const [csvRows, setCsvRows] = useState<string[][]>([])

  useEffect(() => {
    if (artifact?.type === 'csv' && artifact.content) {
      const rows = artifact.content
        .split('\n')
        .map(row => row.split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim()))
        .filter(row => row.some(cell => cell.length > 0))
      setCsvRows(rows)
    }
  }, [artifact])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!artifact) return null

  const handleCopy = () => {
    if (!artifact.content) return
    navigator.clipboard.writeText(artifact.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isHtml = artifact.type === 'html' || artifact.type === 'web' || artifact.name.endsWith('.html')
  const isCsv = artifact.type === 'csv' || artifact.name.endsWith('.csv')
  const isImage = artifact.type === 'screenshot' || artifact.type === 'image' || artifact.name.endsWith('.png') || artifact.name.endsWith('.jpg') || artifact.name.endsWith('.jpeg')

  return (
    <div className="artifact-panel h-full bg-[#0C0C0E] border-l border-white/[0.06] flex flex-col animate-in slide-in-from-right duration-300">
      <style>{`
        @media (max-width: 768px) {
          .artifact-panel {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 60vh !important;
            border-left: none !important;
            border-top: 1px border border-white/[0.06] !important;
            border-top-left-radius: 1rem !important;
            border-top-right-radius: 1rem !important;
            z-index: 100 !important;
            transform: translateY(0) !important;
            animation: slideUp 300ms ease-out forwards !important;
          }
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        }
      `}</style>
      
      {/* Mobile Drag Handle */}
      <div 
        className="hidden max-md:flex justify-center py-2 shrink-0 cursor-pointer hover:bg-white/[0.02] border-b border-white/[0.03]" 
        onClick={onClose}
        title="Dismiss panel"
      >
        <div className="w-12 h-1 bg-zinc-700 rounded-full" />
      </div>

      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <FileText className="text-[#00E599]" size={16} />
          <h4 className="text-[12px] font-bold text-white truncate max-w-[200px]" title={artifact.name}>
            {artifact.name}
          </h4>
        </div>

        <div className="flex items-center gap-3">
          {artifact.downloadUrl && (
            <a
              href={artifact.downloadUrl}
              download
              title={TERMINAL_STRINGS.download}
              className="p-1.5 hover:bg-white/5 border border-white/[0.04] hover:border-white/[0.08] rounded-lg text-zinc-400 hover:text-white transition-all"
            >
              <Download size={14} />
            </a>
          )}
          {isHtml && artifact.downloadUrl && (
            <a
              href={artifact.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={TERMINAL_STRINGS.openInNewTab}
              className="p-1.5 hover:bg-white/5 border border-white/[0.04] hover:border-white/[0.08] rounded-lg text-zinc-400 hover:text-white transition-all flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2"
            >
              <ExternalLink size={11} />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 border border-transparent rounded-lg text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Renderers content area */}
      <div className="flex-1 overflow-auto p-5 custom-scrollbar min-h-0 bg-[#070709]">
        
        {/* Sandboxed HTML Frame */}
        {isHtml && (
          <div className="w-full h-full border border-white/[0.06] rounded-xl overflow-hidden bg-white">
            <iframe
              srcDoc={artifact.content}
              title={artifact.name}
              sandbox="allow-scripts"
              className="w-full h-full border-0"
            />
          </div>
        )}

        {/* CSV Render Table */}
        {isCsv && csvRows.length > 0 && (
          <div className="w-full border border-white/[0.06] rounded-xl overflow-hidden bg-[#0C0C0E] max-h-full overflow-auto custom-scrollbar">
            <table className="w-full border-collapse text-left text-[11px] text-zinc-300">
              <thead className="bg-[#141418] text-white font-bold sticky top-0 border-b border-white/[0.06]">
                <tr>
                  {csvRows[0].map((header, idx) => (
                    <th key={idx} className="p-3 border-r border-white/[0.04] font-black tracking-wider uppercase text-[9px]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {csvRows.slice(1).map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/[0.01]">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3 border-r border-white/[0.03]">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Image / Screenshot Viewer */}
        {isImage && (
          <div className="w-full h-full flex items-center justify-center border border-white/[0.06] rounded-xl overflow-hidden bg-[#0C0C0E] p-2">
            <img
              src={artifact.content}
              alt={artifact.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        )}

        {/* Code / Text Viewer */}
        {!isHtml && !isCsv && !isImage && (
          <div className="relative border border-white/[0.06] rounded-xl bg-[#0C0C0E] p-4.5 font-mono text-[11px] text-zinc-300 overflow-auto leading-relaxed custom-scrollbar">
            {artifact.content && (
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 p-1.5 bg-[#141418] hover:bg-zinc-800 border border-white/[0.06] rounded-lg text-zinc-400 hover:text-white transition-all flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={11} className="text-[#00E599]" />
                    <span className="text-[#00E599]">{TERMINAL_STRINGS.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>{TERMINAL_STRINGS.copyCode}</span>
                  </>
                )}
              </button>
            )}
            <pre className="whitespace-pre-wrap font-mono">{artifact.content || 'Empty file'}</pre>
          </div>
        )}

      </div>
    </div>
  )
}
