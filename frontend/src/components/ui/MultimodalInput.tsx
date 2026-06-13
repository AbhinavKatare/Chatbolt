'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, Mic, MicOff, Paperclip, X, Loader2, Image as ImageIcon, FileText, Globe } from 'lucide-react'

export type MultimodalAttachment = {
  type: 'url' | 'file' | 'image' | 'transcript'
  label: string
  content: string
  metadata?: Record<string, any>
}

interface MultimodalInputProps {
  onAttach: (attachment: MultimodalAttachment) => void
  onRemove: () => void
  attachment: MultimodalAttachment | null
  disabled?: boolean
}

type SpeechRecognitionEvent = {
  results: { [key: number]: { [key: number]: { transcript: string } } }
}

const ACCEPT_TYPES = 'text/plain,text/markdown,text/csv,application/json,.txt,.md,.csv,.json,.pdf'

export function MultimodalInput({ onAttach, onRemove, attachment, disabled }: MultimodalInputProps) {
  const [urlInput, setUrlInput] = useState('')
  const [showUrlBar, setShowUrlBar] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const urlRef = useRef<HTMLInputElement>(null)

  // Focus URL input when bar opens
  useEffect(() => {
    if (showUrlBar) setTimeout(() => urlRef.current?.focus(), 50)
  }, [showUrlBar])

  // ── URL Scraper ────────────────────────────────────────────────────
  const scrapeUrl = useCallback(async (url: string) => {
    if (!url) return
    setFetching(true)
    try {
      const res = await fetch('/multimodal/scrape-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('chatbolt_token')}`,
        },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load URL')

      onAttach({
        type: 'url',
        label: data.title || new URL(url).hostname,
        content: data.content,
        metadata: { url, domain: data.domain, word_count: data.word_count },
      })
      setUrlInput('')
      setShowUrlBar(false)
    } catch (err: any) {
      console.error('[MultimodalInput] URL scrape error:', err.message)
    } finally {
      setFetching(false)
    }
  }, [onAttach])

  // ── File Reader ────────────────────────────────────────────────────
  const readFile = useCallback((file: File) => {
    const isImage = file.type.startsWith('image/')
    const reader = new FileReader()

    if (isImage) {
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        // Try to get vision description
        try {
          const res = await fetch('/multimodal/describe-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('chatbolt_token')}`,
            },
            body: JSON.stringify({
              image_base64: base64,
              mime_type: file.type,
              prompt: 'Describe this image in detail, including any text, charts, or data you see.',
            }),
          })
          const data = await res.json()
          onAttach({
            type: 'image',
            label: file.name,
            content: data.description || 'Image attached',
            metadata: { filename: file.name, size: file.size, mime_type: file.type },
          })
        } catch {
          onAttach({
            type: 'image',
            label: file.name,
            content: `[Image: ${file.name}]`,
            metadata: { filename: file.name },
          })
        }
      }
      reader.readAsDataURL(file)
    } else {
      reader.onload = () => {
        const text = reader.result as string
        const truncated = text.length > 8000 ? text.slice(0, 8000) + '\n\n[File truncated for length]' : text
        onAttach({
          type: 'file',
          label: file.name,
          content: truncated,
          metadata: { filename: file.name, size: file.size, type: file.type },
        })
      }
      reader.readAsText(file)
    }
  }, [onAttach])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) readFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Drag & Drop ────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(file)
  }, [readFile])

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  // ── Voice Input ────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      if (voiceTranscript) {
        onAttach({
          type: 'transcript',
          label: 'Voice input',
          content: voiceTranscript,
          metadata: { source: 'microphone' },
        })
        setVoiceTranscript('')
      }
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < Object.keys(event.results).length; i++) {
        transcript += event.results[i][0].transcript
      }
      setVoiceTranscript(transcript)
    }

    recognition.onerror = () => { setIsListening(false) }
    recognition.onend = () => { setIsListening(false) }

    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }, [isListening, voiceTranscript, onAttach])

  const hasSpeechAPI = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative transition-all ${isDragging ? 'ring-2 ring-[#00E599]/60 ring-offset-2 ring-offset-[#050507] rounded-xl' : ''}`}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-[#00E599]/10 border-2 border-dashed border-[#00E599]/60 pointer-events-none">
          <p className="text-sm font-semibold text-[#00E599]">Drop file here</p>
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 max-w-xs">
            {attachment.type === 'url' && <Globe className="w-3 h-3 text-blue-400 shrink-0" />}
            {attachment.type === 'file' && <FileText className="w-3 h-3 text-green-400 shrink-0" />}
            {attachment.type === 'image' && <ImageIcon className="w-3 h-3 text-purple-400 shrink-0" />}
            {attachment.type === 'transcript' && <Mic className="w-3 h-3 text-[#00E599] shrink-0" />}
            <span className="text-[11px] text-zinc-300 truncate max-w-[180px]">{attachment.label}</span>
            {attachment.metadata?.word_count && (
              <span className="text-[10px] text-zinc-600 shrink-0">({attachment.metadata.word_count} words)</span>
            )}
            <button onClick={onRemove} className="ml-1 text-zinc-500 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Voice transcript preview */}
      {isListening && voiceTranscript && (
        <div className="mb-2 px-2 py-1.5 bg-[#00E599]/10 border border-[#00E599]/20 rounded-lg">
          <p className="text-xs text-[#00E599]">🎤 {voiceTranscript}</p>
        </div>
      )}

      {/* URL bar */}
      {showUrlBar && !attachment && (
        <div className="mb-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2">
            <Globe className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <input
              ref={urlRef}
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') scrapeUrl(urlInput); if (e.key === 'Escape') setShowUrlBar(false) }}
              placeholder="Paste a URL to include its content..."
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
            />
            {fetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400 shrink-0" />}
          </div>
          <button
            onClick={() => scrapeUrl(urlInput)}
            disabled={fetching || !urlInput}
            className="px-3 py-2 bg-[#00E599] text-black text-xs font-bold rounded-xl disabled:opacity-40 transition-all hover:bg-[#00E599]/90"
          >
            Load
          </button>
          <button onClick={() => { setShowUrlBar(false); setUrlInput('') }} className="p-2 text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toolbar buttons */}
      {!attachment && (
        <div className="flex items-center gap-1">
          {/* File/Image attachment */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Attach file or image"
            className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>

          {/* URL input */}
          <button
            type="button"
            onClick={() => setShowUrlBar(v => !v)}
            disabled={disabled}
            title="Include a webpage"
            className={`p-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40 ${showUrlBar ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Link className="w-3.5 h-3.5" />
          </button>

          {/* Voice input */}
          {hasSpeechAPI && (
            <button
              type="button"
              onClick={toggleVoice}
              disabled={disabled}
              title={isListening ? 'Stop recording (click to confirm)' : 'Voice input'}
              className={`p-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40 ${isListening ? 'text-[#00E599] animate-pulse' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_TYPES}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
