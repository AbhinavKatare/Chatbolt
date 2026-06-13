'use client'

import React, { useState, useEffect } from 'react'
import { Sparkles, Search, PenTool, MessageSquare, Layers, ArrowRight, Trash2, Heart } from 'lucide-react'
import { api } from '@/lib/api'

interface TemplateLibraryProps {
  onSelectTemplate: (templateText: string) => void
  visible: boolean
}

type Category = 'Research' | 'Writing' | 'Communication' | 'Productivity' | 'My templates'

const TEMPLATE_CATEGORIES: Record<Exclude<Category, 'My templates'>, { icon: React.ReactNode; templates: string[] }> = {
  Research: {
    icon: <Search size={14} className="text-blue-400" />,
    templates: [
      "Research the top 5 competitors to [my product] and build a comparison table",
      "Find recent news about [topic] and summarize the key developments",
      "Analyze [company name] — what do they do, who are their customers, and how are they doing?",
      "What are the most common customer complaints about [product or service]?",
      "Research pricing models used by [industry] companies and make a spreadsheet"
    ]
  },
  Writing: {
    icon: <PenTool size={14} className="text-purple-400" />,
    templates: [
      "Write a professional bio for me based on what you know about me",
      "Draft a [formal/casual] email to [recipient] about [topic]",
      "Write a LinkedIn post about [topic or achievement]",
      "Create a one-page project brief for [project name and description]",
      "Summarize this long document into 5 key bullet points: [paste text]"
    ]
  },
  Communication: {
    icon: <MessageSquare size={14} className="text-yellow-400" />,
    templates: [
      "Check my emails and tell me what needs my attention today",
      "Draft replies to my 3 most important unread emails",
      "Post a status update to [Slack channel] saying [message]",
      "Schedule a [duration] meeting with [name] for [timeframe] and send an invite",
      "Write a follow-up message to [name] about our last conversation"
    ]
  },
  Productivity: {
    icon: <Layers size={14} className="text-emerald-400" />,
    templates: [
      "Look at my calendar this week and tell me where I have free time",
      "Take these notes and turn them into a structured action plan: [paste notes]",
      "Build me a weekly task tracker spreadsheet for [project or goal]",
      "Create a presentation summarizing [topic] in 8 slides",
      "Save this file to my Google Drive: [describe file or paste content]"
    ]
  }
}

export default function TemplateLibrary({ onSelectTemplate, visible }: TemplateLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('Research')
  const [personalTemplates, setPersonalTemplates] = useState<any[]>([])

  useEffect(() => {
    if (visible) {
      loadPersonalTemplates()
    }
  }, [visible])

  async function loadPersonalTemplates() {
    try {
      const res = await api.templates.list()
      setPersonalTemplates(res.templates || [])
    } catch (err) {
      // Fail silently
    }
  }

  async function handleDeleteTemplate(id: string) {
    try {
      await api.templates.delete(id)
      setPersonalTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      // Fail silently
    }
  }

  if (!visible) return null

  const isPersonalTab = activeCategory === 'My templates'
  
  const categories: Category[] = [
    'Research',
    'Writing',
    'Communication',
    'Productivity',
    'My templates'
  ]

  const getIcon = (cat: Category) => {
    if (cat === 'My templates') return <Heart size={14} className="text-[#00E599]" />
    return TEMPLATE_CATEGORIES[cat].icon
  }

  const templatesToRender = isPersonalTab
    ? personalTemplates.map(t => ({ id: t.id, name: t.name, prompt: t.prompt, description: t.description }))
    : TEMPLATE_CATEGORIES[activeCategory as Exclude<Category, 'My templates'>].templates.map(tpl => ({ id: tpl, name: '', prompt: tpl, description: '' }))

  return (
    <div className="w-full mt-4 bg-zinc-950/40 border border-zinc-800/60 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 border-b border-zinc-900 pb-3 flex-wrap">
        {categories.map(cat => {
          const isActive = cat === activeCategory
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border
                ${isActive 
                  ? 'bg-zinc-900 border-zinc-700 text-white' 
                  : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
            >
              {getIcon(cat)}
              <span>{cat}</span>
            </button>
          )
        })}
      </div>

      {/* Grid of templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {isPersonalTab && templatesToRender.length === 0 ? (
          <div className="col-span-1 md:col-span-2 p-8 text-center text-zinc-500 italic text-[11px] uppercase tracking-wider font-bold">
            Your personal templates will appear here after you save them.
          </div>
        ) : (
          templatesToRender.map((tpl, idx) => {
            // Highlight brackets for preview styling
            const renderedText = tpl.prompt.split(/(\[.*?\])/g).map((part: string, pIdx: number) => {
              if (part.startsWith('[') && part.endsWith(']')) {
                return (
                  <span key={pIdx} className="text-[#00E599] font-bold bg-[#00E599]/10 px-1 rounded">
                    {part}
                  </span>
                )
              }
              return <React.Fragment key={pIdx}>{part}</React.Fragment>
            })

            return (
              <div
                key={tpl.id || idx}
                className="group relative flex flex-col justify-between p-3.5 bg-zinc-900/50 hover:bg-zinc-900 border border-white/[0.03] hover:border-[#00E599]/30 rounded-xl transition-all duration-200"
              >
                <div className="flex-1 cursor-pointer" onClick={() => onSelectTemplate(tpl.prompt)}>
                  {tpl.name && (
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#00E599] mb-1.5">{tpl.name}</h4>
                  )}
                  <p className="text-[11px] font-medium leading-relaxed text-zinc-300 group-hover:text-white">
                    {renderedText}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.01]">
                  {isPersonalTab ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTemplate(tpl.id)
                      }}
                      className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer border border-transparent hover:border-red-500/20"
                      title="Delete Template"
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : (
                    <div />
                  )}
                  <div 
                    className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" 
                    onClick={() => onSelectTemplate(tpl.prompt)}
                  >
                    <span className="text-[9px] font-black text-[#00E599] uppercase tracking-wider mr-1.5">Use Template</span>
                    <ArrowRight size={12} className="text-[#00E599]" />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
