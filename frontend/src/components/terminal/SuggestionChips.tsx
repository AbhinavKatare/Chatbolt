'use client'

import { useState, useEffect } from 'react'
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react'

interface SuggestionChip {
  label: string
  prompt: string
  icon?: string
}

interface SuggestionChipsProps {
  taskOutput?: string
  taskName?: string
  onSuggestionClick: (prompt: string) => void
  className?: string
}

// Predefined suggestion templates based on task type keywords
function generateLocalSuggestions(taskName: string, taskOutput: string): SuggestionChip[] {
  const combined = (taskName + ' ' + taskOutput).toLowerCase()
  const chips: SuggestionChip[] = []

  if (combined.includes('research') || combined.includes('analyz') || combined.includes('report')) {
    chips.push(
      { label: 'Send to Slack', prompt: `Share the research results in Slack`, icon: '💬' },
      { label: 'Save to Drive', prompt: `Save this report to Google Drive as a PDF`, icon: '📁' },
      { label: 'Email Summary', prompt: `Email me a summary of these findings`, icon: '✉️' }
    )
  } else if (combined.includes('email') || combined.includes('draft') || combined.includes('message')) {
    chips.push(
      { label: 'Schedule follow-up', prompt: `Schedule a follow-up reminder for next week`, icon: '📅' },
      { label: 'Add to calendar', prompt: `Add a meeting based on this email thread to my calendar`, icon: '🗓️' }
    )
  } else if (combined.includes('code') || combined.includes('build') || combined.includes('script')) {
    chips.push(
      { label: 'Run tests', prompt: `Run unit tests on the generated code`, icon: '🧪' },
      { label: 'Create docs', prompt: `Generate documentation for this code`, icon: '📄' },
      { label: 'Deploy it', prompt: `Deploy this to staging environment`, icon: '🚀' }
    )
  } else if (combined.includes('spreadsheet') || combined.includes('data') || combined.includes('csv')) {
    chips.push(
      { label: 'Create chart', prompt: `Create a visualization chart from this data`, icon: '📊' },
      { label: 'Email report', prompt: `Email this spreadsheet as an attachment`, icon: '✉️' },
      { label: 'Save to Drive', prompt: `Upload this to Google Drive`, icon: '📁' }
    )
  } else {
    chips.push(
      { label: 'Tell me more', prompt: `Expand on the results with more detail`, icon: '🔍' },
      { label: 'Save results', prompt: `Save these results to a file`, icon: '💾' }
    )
  }

  return chips.slice(0, 3)
}

export default function SuggestionChips({
  taskOutput = '',
  taskName = '',
  onSuggestionClick,
  className = ''
}: SuggestionChipsProps) {
  const [chips, setChips] = useState<SuggestionChip[]>([])
  const [visible, setVisible] = useState(false)
  const [clicked, setClicked] = useState<string | null>(null)

  useEffect(() => {
    if (!taskName && !taskOutput) return
    // Generate contextual suggestions
    const generated = generateLocalSuggestions(taskName, taskOutput)
    setChips(generated)

    // Animate in after a short delay
    const timer = setTimeout(() => setVisible(true), 300)
    return () => clearTimeout(timer)
  }, [taskName, taskOutput])

  if (chips.length === 0) return null

  const handleClick = (chip: SuggestionChip) => {
    setClicked(chip.label)
    onSuggestionClick(chip.prompt)
    setTimeout(() => {
      setChips([])
      setVisible(false)
    }, 400)
  }

  return (
    <div
      className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${className}`}
    >
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Sparkles size={12} className="text-[#534AB7]" />
          <span>What's next?</span>
        </div>
        {chips.map((chip) => (
          <button
            key={chip.label}
            onClick={() => handleClick(chip)}
            disabled={clicked === chip.label}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              bg-zinc-900 border border-zinc-700 text-zinc-300
              hover:border-[#534AB7]/50 hover:text-[#534AB7] hover:bg-[#534AB7]/5
              active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            {chip.icon && <span>{chip.icon}</span>}
            {chip.label}
            <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
          </button>
        ))}
      </div>
    </div>
  )
}
