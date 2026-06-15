'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Compass, Clock, Terminal, Shield, Keyboard, X, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectShortcut: (prompt: string, autoSubmit: boolean) => void
  onOpenHistory: () => void
}

interface PaletteItem {
  id: string
  label: string
  category: 'Actions' | 'Recent' | 'Quick access'
  icon: React.ReactNode
  prompt?: string
  action?: () => void
  autoSubmit?: boolean
}

export default function CommandPalette({
  isOpen,
  onClose,
  onSelectShortcut,
  onOpenHistory
}: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentRuns, setRecentRuns] = useState<any[]>([])
  const [connectedServices, setConnectedServices] = useState<string[]>([])
  const containerRef = useFocusTrap(isOpen) as React.MutableRefObject<HTMLDivElement | null>
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch integrations and history runs
  useEffect(() => {
    if (!isOpen) return
    
    // Reset query & index
    setQuery('')
    setSelectedIndex(0)

    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100)

    const fetchData = async () => {
      try {
        const intRes = await api.integrations.list().catch(() => ({ integrations: [] }))
        const connected = (intRes.integrations || [])
          .filter((i: any) => i.connected)
          .map((i: any) => i.service)
        setConnectedServices(connected)

        const runRes = await api.workflows.listRuns({ limit: 5 }).catch(() => ({ runs: [] }))
        setRecentRuns(runRes.runs || [])
      } catch (err) {
        console.warn('[Command Palette] Failed to load metadata:', err)
      }
    }

    fetchData()
  }, [isOpen])

  // Quick actions list
  const actions: PaletteItem[] = useMemo(() => [
    {
      id: 'action-new',
      label: 'New task',
      category: 'Actions',
      icon: <Terminal size={14} className="text-[var(--color-accent)]" />,
      action: () => {
        onSelectShortcut('', false)
        onClose()
      }
    },
    {
      id: 'action-integrations',
      label: 'Open plugins',
      category: 'Actions',
      icon: <Compass size={14} className="text-blue-400" />,
      action: () => {
        router.push('/dashboard/plugins')
        onClose()
      }
    },
    {
      id: 'action-memory',
      label: 'View memory',
      category: 'Actions',
      icon: <Shield size={14} className="text-purple-400" />,
      action: () => {
        router.push('/dashboard/memory')
        onClose()
      }
    },
    {
      id: 'action-history',
      label: 'View history',
      category: 'Actions',
      icon: <Clock size={14} className="text-zinc-400" />,
      action: () => {
        onOpenHistory()
        onClose()
      }
    }
  ], [router, onSelectShortcut, onOpenHistory, onClose])

  // Integration shortcuts
  const shortcuts: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = []
    
    if (connectedServices.includes('gmail')) {
      list.push({
        id: 'shortcut-gmail',
        label: 'Check Gmail',
        category: 'Quick access',
        icon: <span>✉️</span>,
        prompt: 'What emails do I need to reply to today?',
        autoSubmit: true
      })
    }
    
    if (connectedServices.includes('slack')) {
      list.push({
        id: 'shortcut-slack',
        label: 'Post to Slack',
        category: 'Quick access',
        icon: <span>💬</span>,
        prompt: 'Post a status update in #general saying that I am working on completion sprint.',
        autoSubmit: false
      })
    }

    if (connectedServices.includes('google-calendar') || connectedServices.includes('google_calendar')) {
      list.push({
        id: 'shortcut-calendar',
        label: 'Check calendar today',
        category: 'Quick access',
        icon: <span>📅</span>,
        prompt: 'What is on my calendar for today?',
        autoSubmit: true
      })
    }

    return list
  }, [connectedServices])

  // Recent tasks items
  const recentItems: PaletteItem[] = useMemo(() => {
    return recentRuns.map((run, idx) => ({
      id: `recent-${run.id}-${idx}`,
      label: run.prompt || run.workflow_name || 'Autonomous Task',
      category: 'Recent',
      icon: <Clock size={14} className="text-zinc-600" />,
      prompt: run.prompt || '',
      autoSubmit: false
    }))
  }, [recentRuns])

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    const all = [...actions, ...shortcuts, ...recentItems]
    if (!query) return all
    return all.filter(item => 
      item.label.toLowerCase().includes(query.toLowerCase()) || 
      item.category.toLowerCase().includes(query.toLowerCase())
    )
  }, [actions, shortcuts, recentItems, query])

  // Adjust selection index bounds when filtering
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selectedItem = filteredItems[selectedIndex]
        if (selectedItem) {
          handleSelect(selectedItem)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredItems, selectedIndex, onClose])

  const handleSelect = (item: PaletteItem) => {
    if (item.action) {
      item.action()
    } else if (item.prompt !== undefined) {
      onSelectShortcut(item.prompt, item.autoSubmit || false)
      onClose()
    }
  }

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        ref={containerRef}
        className="w-full max-w-[560px] min-h-[400px] max-h-[80vh] bg-[var(--color-surface)] border border-zinc-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4">
          <Search size={18} className="text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent py-4 text-sm text-white focus:outline-none placeholder-zinc-500 font-medium"
          />
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider">ESC</span>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-zinc-500 gap-2">
              <Compass size={24} className="text-zinc-600" />
              <p className="text-xs font-semibold">No results found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Group items by category */}
              {['Actions', 'Quick access', 'Recent'].map(cat => {
                const catItems = filteredItems.filter(item => item.category === cat)
                if (catItems.length === 0) return null

                return (
                  <div key={cat} className="space-y-1">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 py-1.5">
                      {cat}
                    </h4>
                    {catItems.map((item) => {
                      const absoluteIndex = filteredItems.findIndex(fi => fi.id === item.id)
                      const isSelected = absoluteIndex === selectedIndex

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all duration-150
                            ${isSelected 
                              ? 'bg-zinc-900 border border-zinc-800 text-white shadow-md' 
                              : 'border border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="shrink-0 flex items-center justify-center w-5 h-5 rounded bg-zinc-950/50">
                              {item.icon}
                            </div>
                            <span className="truncate pr-4">{item.label}</span>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-wide">Select</span>
                              <Check size={12} className="text-[var(--color-accent)]" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/60 bg-zinc-950/40 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Keyboard size={10} /> Arrow Keys to navigate
            </span>
            <span className="flex items-center gap-1">
              ↵ Enter to select
            </span>
          </div>
          <span>Chatbolt Commands</span>
        </div>
      </div>
    </div>
  )
}
