'use client'

import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Paperclip, Mic, ArrowUp } from 'lucide-react'
import { TERMINAL_STRINGS } from './strings'

export interface InputBarProps {
  onSend: (text: string) => void
  disabled?: boolean
  value: string
  onChange: (val: string) => void
  onFocus?: () => void
  onBlur?: () => void
  placeholder?: string
}

export interface InputBarRef {
  focus: () => void
  selectPlaceholder: () => void
}

const InputBar = forwardRef<InputBarRef, InputBarProps>(({ 
  onSend, 
  disabled, 
  value, 
  onChange,
  onFocus,
  onBlur,
  placeholder
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const inputHistory = useRef<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isFocused, setIsFocused] = useState(false)
  
  // File upload and parsing states
  const [fileContext, setFileContext] = useState<{ filename: string; content: string } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus()
    },
    selectPlaceholder: () => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      const text = textarea.value
      // Match brackets like [my product]
      const match = text.match(/\[.*?\]/)
      if (match && match.index !== undefined) {
        textarea.setSelectionRange(match.index, match.index + match[0].length)
      }
    }
  }))

  // Auto-resize textarea logic
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [value])

  // Ctrl+/ listener to focus textarea
  useEffect(() => {
    const handleFocusKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleFocusKey)
    return () => window.removeEventListener('keydown', handleFocusKey)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
      return
    }

    // Do not navigate history when the textarea contains multi-line content (newlines present)
    const hasNewlines = value.includes('\n')
    if (hasNewlines) {
      setHistoryIndex(-1)
      return
    }

    const textarea = textareaRef.current
    const cursorAtStart = textarea ? textarea.selectionStart === 0 : true

    if (e.key === 'ArrowUp') {
      if (value === '' || cursorAtStart) {
        e.preventDefault()
        if (inputHistory.current.length === 0) return

        let newIndex = historyIndex === -1 ? inputHistory.current.length - 1 : historyIndex - 1
        if (newIndex < 0) newIndex = 0

        setHistoryIndex(newIndex)
        onChange(inputHistory.current[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      if (value === '' || cursorAtStart) {
        e.preventDefault()
        if (historyIndex === -1) return

        let newIndex = historyIndex + 1
        if (newIndex >= inputHistory.current.length) {
          setHistoryIndex(-1)
          onChange('')
        } else {
          setHistoryIndex(newIndex)
          onChange(inputHistory.current[newIndex])
        }
      }
    } else if (e.key !== 'Process' && e.key !== 'Unidentified') {
      // Reset history index on any typing
      setHistoryIndex(-1)
    }
  }

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return

    let finalPrompt = trimmed
    if (fileContext) {
      finalPrompt = `[File context: ${fileContext.filename}\n${fileContext.content}]\n\n${trimmed}`
      setFileContext(null)
    }

    const history = inputHistory.current
    if (history.length === 0 || history[history.length - 1] !== trimmed) {
      history.push(trimmed)
      if (history.length > 20) {
        history.shift()
      }
    }

    onSend(finalPrompt)
    onChange('')
    setHistoryIndex(-1)
  }

  const handlePaperclipClick = () => {
    if (disabled || uploading) return
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)
    setFileContext(null)

    try {
      const token = localStorage.getItem('chatbolt_token')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${baseUrl}/multimodal/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`
        },
        body: formData
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload/parse file')
      }

      setFileContext({
        filename: file.name,
        content: data.text || data.content || ''
      })
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        className={`border transition-all duration-200 flex items-end gap-2 shadow-xl backdrop-blur-md bg-[var(--color-surface)]
          ${isFocused
            ? 'border-[#534AB7] shadow-[0_0_0_2px_rgba(83,74,183,0.35)]'
            : 'border-white/[0.06]'
          }`}
        style={{ borderRadius: '14px' }}
      >
        
        {/* File Attachment Button */}
        <button
          type="button"
          onClick={handlePaperclipClick}
          disabled={disabled || uploading}
          title={TERMINAL_STRINGS.attachButton}
          className="p-2.5 hover:bg-white/5 border border-transparent hover:border-white/[0.04] rounded-xl text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          <Paperclip size={18} />
        </button>

        {/* Auto-growing Textarea Input */}
        <textarea
          id="terminal-input"
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            setIsFocused(true)
            onFocus?.()
          }}
          onBlur={(e) => {
            setIsFocused(false)
            onBlur?.()
          }}
          placeholder={placeholder || TERMINAL_STRINGS.inputPlaceholder}
          disabled={disabled || uploading}
          className="flex-1 bg-transparent border-0 outline-none text-zinc-100 text-[13px] font-medium py-2 px-1 resize-none min-h-[36px] max-h-[120px] custom-scrollbar placeholder:text-zinc-500"
        />

        {/* Voice Input Button */}
        <button
          type="button"
          title={TERMINAL_STRINGS.voiceButton}
          disabled={disabled || uploading}
          className="p-2.5 hover:bg-white/5 border border-transparent hover:border-white/[0.04] rounded-xl text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          <Mic size={18} />
        </button>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || uploading || !value.trim()}
          className={`p-2.5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            value.trim() && !disabled && !uploading
              ? 'bg-[var(--color-accent)] text-white hover:scale-[1.02] shadow-[0_0_12px_rgba(83,74,183,0.4)]'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          <ArrowUp size={16} />
        </button>
        
      </div>

      {/* File chip and inline error messages */}
      {(fileContext || uploading || uploadError) && (
        <div className="flex flex-col gap-1 px-1">
          {uploading && (
            <div className="text-[10px] text-zinc-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-ping" />
              Uploading and parsing file...
            </div>
          )}
          {fileContext && (
            <div className="flex items-center gap-1.5 bg-[var(--color-accent)]/10 border border-[#534AB7]/20 rounded-lg px-2.5 py-1.5 max-w-xs text-white">
              <span className="text-[11px] text-zinc-300 truncate max-w-[180px] font-medium">📎 {fileContext.filename}</span>
              <button 
                onClick={() => setFileContext(null)} 
                className="ml-auto text-zinc-500 hover:text-red-400 transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
          )}
          {uploadError && (
            <div className="text-[10px] text-red-400 font-medium">
              ⚠️ {uploadError}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

InputBar.displayName = 'InputBar'

export default InputBar
