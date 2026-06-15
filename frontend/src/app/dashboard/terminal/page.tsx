'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Sun, Moon, Sparkles, Bot, Loader2, Clock } from 'lucide-react'
import { api, getSession, saveSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import ChatThread from '@/components/terminal/ChatThread'
import InputBar from '@/components/terminal/InputBar'
import SuggestionChips from '@/components/terminal/SuggestionChips'
import TaskToast, { useTaskToast } from '@/components/terminal/TaskToast'
import { TERMINAL_STRINGS, sanitizeUserFacingText } from '@/components/terminal/strings'
import { MultimodalInput, MultimodalAttachment } from '@/components/ui/MultimodalInput'
import StreakBadge from '@/components/terminal/StreakBadge'
import { io } from 'socket.io-client'

const ArtifactPanel = dynamic(() => import('@/components/terminal/ArtifactPanel'), { ssr: false, loading: () => null })
const CommandPalette = dynamic(() => import('@/components/terminal/CommandPalette'), { ssr: false, loading: () => null })
const TemplateLibrary = dynamic(() => import('@/components/terminal/TemplateLibrary'), { ssr: false, loading: () => null })
const HistoryPanel = dynamic(() => import('@/components/terminal/HistoryPanel'), { ssr: false, loading: () => null })


interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content?: string
  isTask?: boolean
  taskConfig?: any
  runId?: string
  workflowId?: string
  status?: string
  steps?: any[]
  logs?: string[]
  progress?: number
  isTyping?: boolean
  taskReceipt?: string
  templateCandidate?: boolean
}

export default function TerminalPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const { toasts, addToast, dismissToast } = useTaskToast()
  
  // Theme Toggle: obsidian default vs arctic light mode
  const [theme, setTheme] = useState<'obsidian' | 'arctic'>('obsidian')
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  
  // Active artifact for right panel preview
  const [activeArtifact, setActiveArtifact] = useState<any | null>(null)
  
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null)

  const currentRunIdRef = useRef<string | null>(null)
  const currentWorkflowIdRef = useRef<string | null>(null)

  useEffect(() => {
    currentRunIdRef.current = currentRunId
  }, [currentRunId])

  useEffect(() => {
    currentWorkflowIdRef.current = currentWorkflowId
  }, [currentWorkflowId])

  const socketRef = useRef<any>(null)

  // Auto-loading created files upon workflow complete
  const loadArtifactsForRun = useCallback(async (runId: string) => {
    try {
      const wsRes = await api.workspaces.list()
      const wsList = wsRes.workspaces || []
      if (!wsList.length) return

      const projRes = await api.workspaces.listProjects(wsList[0].id)
      const projects = projRes.projects || []
      if (!projects.length) return

      const artRes = await api.artifacts.list(projects[0].id)
      const list = artRes.artifacts || []

      const match = list.find((a: any) => {
        const meta = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : (a.metadata || {})
        return meta.source_task === runId || meta.source_run_id === runId || meta.source_workflow === currentWorkflowIdRef.current
      })

      if (match) {
        setActiveArtifact(match)
        toastSuccess('Deliverable Ready', `Generated file "${match.name}" loaded.`)
      }
    } catch (err: any) {
      console.warn('Failed to load output artifact:', err.message)
    }
  }, [toastSuccess])

  const handleSocketConnect = useCallback(() => {
    if (socketRef.current && currentRunIdRef.current) {
      socketRef.current.emit('subscribe:run', { runId: currentRunIdRef.current })
    }
  }, [])

  const handleSocketTaskStart = useCallback((payload: any) => {
    setMessages(prev => prev.map(m => {
      if (m.runId !== payload.runId) return m
      return {
        ...m,
        status: 'planning',
        logs: ['⚡ Task execution pipeline initialized...']
      }
    }))
  }, [])

  const handleSocketTaskStep = useCallback((payload: any) => {
    const agentId = payload.agentId || payload.data?.agentId
    const role = payload.data?.role
    const name = payload.data?.name || agentId
    const msg = payload.data?.message
    const summary = payload.data?.summary
    const errorMsg = payload.data?.error

    setMessages(prev => prev.map(m => {
      if (m.runId !== payload.runId) return m

      const updatedLogs = [...(m.logs || [])]
      let updatedStatus = m.status || 'executing'
      let updatedSteps = [...(m.steps || [])]

      if (msg) {
        updatedLogs.push(`   ${msg}`)
      } else if (summary) {
        updatedSteps = updatedSteps.map(s => 
          s.id === agentId || s.role === role
            ? { ...s, status: 'completed' }
            : s
        )
        updatedLogs.push(`✔ Completed step: ${name}`)
      } else if (errorMsg) {
        updatedSteps = updatedSteps.map(s => 
          s.id === agentId || s.role === role
            ? { ...s, status: 'failed' }
            : s
        )
        updatedLogs.push(`✗ Error: ${errorMsg}`)
      } else {
        updatedSteps = updatedSteps.map(s => 
          s.id === agentId || s.role === role
            ? { ...s, status: 'running' }
            : s
        )
        updatedLogs.push(`▶ Starting step: ${name}`)
      }

      return {
        ...m,
        status: updatedStatus,
        steps: updatedSteps,
        logs: updatedLogs
      }
    }))
  }, [])

  const handleSocketTaskProgress = useCallback((payload: any) => {
    setMessages(prev => prev.map(m => {
      if (m.runId !== payload.runId) return m
      return {
        ...m,
        progress: payload.data?.progress
      }
    }))
  }, [])

  const handleSocketTaskCompleted = useCallback((payload: any) => {
    setMessages(prev => prev.map(m => {
      if (m.runId !== payload.runId) return m
      return {
        ...m,
        status: 'completed',
        progress: 100,
        taskReceipt: payload.data?.task_receipt,
        templateCandidate: payload.data?.template_candidate,
        logs: [...(m.logs || []), '🎉 Goal outcome completed successfully.']
      }
    }))
    if (payload.runId) {
      loadArtifactsForRun(payload.runId)
    }
  }, [loadArtifactsForRun])

  const handleSocketTaskFailed = useCallback((payload: any) => {
    setMessages(prev => prev.map(m => {
      if (m.runId !== payload.runId) return m
      return {
        ...m,
        status: 'failed',
        logs: [...(m.logs || []), `✗ Pipeline failed to complete: ${payload.data?.error || 'Unknown failure'}`]
      }
    }))
  }, [])

  const handleSocketPermissionRequired = useCallback((payload: any) => {
    setMessages(prev => prev.map(m => {
      if (m.runId !== payload.runId) return m
      return {
        ...m,
        status: 'waiting',
        logs: [...(m.logs || []), '⏳ Execution paused — awaiting client permission']
      }
    }))
  }, [])

  const handleSocketArtifactCreated = useCallback((payload: any) => {
    if (payload.runId) {
      loadArtifactsForRun(payload.runId)
    }
  }, [loadArtifactsForRun])

  const handleSocketActionJournaled = useCallback((payload: any) => {
    setMessages(prev => prev.map(m => {
      if (m.runId !== payload.runId) return m
      return {
        ...m,
        logs: [...(m.logs || []), `↩ Reversible action logged. Undo available for 120s.`]
      }
    }))
  }, [])

  const handleSocketBrowserScreenshot = useCallback((payload: any) => {
    if (payload.data?.screenshot) {
      setActiveArtifact({
        id: `screenshot-${payload.runId}`,
        name: 'Live Browser View',
        type: 'screenshot',
        content: payload.data.screenshot
      })
    }
  }, [])

  const handleSocketIntegrationRequired = useCallback((payload: any) => {
    setMessages(prev => prev.map(m => {
      if (m.runId !== payload.runId) return m
      return {
        ...m,
        status: 'integration_required',
        taskConfig: {
          service: payload.data?.service,
          userMessage: payload.data?.userMessage,
          actionUrl: payload.data?.actionUrl || '/dashboard/plugins'
        }
      }
    }))
  }, [])

  const handleSocketBackgroundModeStarted = useCallback((payload: any) => {
    setMessages(prev => prev.map(m => {
      if (m.runId !== payload.runId) return m
      return {
        ...m,
        logs: [...(m.logs || []), '⏳ Pipeline running in background mode...']
      }
    }))
  }, [])

  const handleSocketBillingRequired = useCallback((payload: any) => {
    setMessages(prev => prev.map(m => {
      if (m.runId !== payload.runId) return m
      return {
        ...m,
        status: 'billing_required',
        taskConfig: {
          userMessage: payload.data?.personalised_message || payload.data?.userMessage,
          actionUrl: payload.data?.upgrade_url || '/dashboard/settings/billing',
          taskType: payload.data?.task_type
        }
      }
    }))
  }, [])

  const handleSocketAnnualNudge = useCallback((payload: any) => {
    toastSuccess('Exclusive Offer', 'Upgrade to our annual plan and save 20%!')
  }, [toastSuccess])

  useEffect(() => {
    if (!session?.token) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'
    const socket = io(socketUrl, {
      auth: { token: session.token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    })

    socketRef.current = socket

    socket.on('connect', handleSocketConnect)
    socket.on('task:start', handleSocketTaskStart)
    socket.on('task:step', handleSocketTaskStep)
    socket.on('task:progress', handleSocketTaskProgress)
    socket.on('task:completed', handleSocketTaskCompleted)
    socket.on('task:failed', handleSocketTaskFailed)
    socket.on('permission:required', handleSocketPermissionRequired)
    socket.on('artifact:created', handleSocketArtifactCreated)
    socket.on('action:journaled', handleSocketActionJournaled)
    socket.on('browser:screenshot', handleSocketBrowserScreenshot)
    socket.on('integration_required', handleSocketIntegrationRequired)
    socket.on('background_mode_started', handleSocketBackgroundModeStarted)
    socket.on('billing_required', handleSocketBillingRequired)
    socket.on('annual_nudge', handleSocketAnnualNudge)

    return () => {
      socket.off('connect', handleSocketConnect)
      socket.off('task:start', handleSocketTaskStart)
      socket.off('task:step', handleSocketTaskStep)
      socket.off('task:progress', handleSocketTaskProgress)
      socket.off('task:completed', handleSocketTaskCompleted)
      socket.off('task:failed', handleSocketTaskFailed)
      socket.off('permission:required', handleSocketPermissionRequired)
      socket.off('artifact:created', handleSocketArtifactCreated)
      socket.off('action:journaled', handleSocketActionJournaled)
      socket.off('browser:screenshot', handleSocketBrowserScreenshot)
      socket.off('integration_required', handleSocketIntegrationRequired)
      socket.off('background_mode_started', handleSocketBackgroundModeStarted)
      socket.off('billing_required', handleSocketBillingRequired)
      socket.off('annual_nudge', handleSocketAnnualNudge)
      socket.disconnect()
      socketRef.current = null
    }
  }, [
    session?.token,
    handleSocketConnect,
    handleSocketTaskStart,
    handleSocketTaskStep,
    handleSocketTaskProgress,
    handleSocketTaskCompleted,
    handleSocketTaskFailed,
    handleSocketPermissionRequired,
    handleSocketArtifactCreated,
    handleSocketActionJournaled,
    handleSocketBrowserScreenshot,
    handleSocketIntegrationRequired,
    handleSocketBackgroundModeStarted,
    handleSocketBillingRequired,
    handleSocketAnnualNudge
  ])

  useEffect(() => {
    if (socketRef.current && currentRunId) {
      socketRef.current.emit('subscribe:run', { runId: currentRunId })
    }
  }, [currentRunId])


  // Gating & Palette Open state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const isAtBottomRef = useRef<boolean>(true)

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const threshold = 50
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
    isAtBottomRef.current = isAtBottom
  }, [])

  const inputBarRef = useRef<any>(null)

  // Multimodal attachment (file, URL, voice)
  const [attachment, setAttachment] = useState<MultimodalAttachment | null>(null)

  // Contextual Greeting & Subtitle Rotation
  const [subtitleIndex, setSubtitleIndex] = useState(0)
  const [connectedServices, setConnectedServices] = useState<string[]>([])

  const PLACEHOLDER_ROTATION = [
    "Upload a spreadsheet to analyse or start one from scratch",
    "What emails need your attention today?",
    "Tell me what to build, research, or send",
    "What should I handle first?",
    "Summarise the top stories from Hacker News",
  ]

  type ModeChip = 'web' | 'spreadsheet' | 'code' | 'email' | 'calendar' | null
  const [activeMode, setActiveMode] = useState<ModeChip>(null)

  const MODE_CHIPS: { id: ModeChip; label: string; placeholder: string }[] = [
    { id: 'web', label: '🌐 Web', placeholder: 'Search the web for...' },
    { id: 'spreadsheet', label: '📊 Spreadsheet', placeholder: 'Build a spreadsheet that...' },
    { id: 'code', label: '💻 Code', placeholder: 'Write a script that...' },
    { id: 'email', label: '✉️ Email', placeholder: 'Draft an email to...' },
    { id: 'calendar', label: '📅 Calendar', placeholder: 'Schedule a meeting for...' },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setSubtitleIndex(prev => (prev + 1) % PLACEHOLDER_ROTATION.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Caching utilities
  const getCached = useCallback((key: string, ttlSeconds = 300) => {
    if (typeof window === 'undefined') return null
    try {
      const dataStr = localStorage.getItem(`chatbolt_cache_${key}`)
      if (!dataStr) return null
      const entry = JSON.parse(dataStr)
      const ageSeconds = (Date.now() - entry.timestamp) / 1000
      if (ageSeconds < ttlSeconds) {
        return entry.value
      }
    } catch {}
    return null
  }, [])

  const setCached = useCallback((key: string, value: any) => {
    if (typeof window === 'undefined') return
    try {
      const entry = { value, timestamp: Date.now() }
      localStorage.setItem(`chatbolt_cache_${key}`, JSON.stringify(entry))
    } catch {}
  }, [])

  // Mount-time unified preloader with Promise.allSettled and Cache-First policy
  useEffect(() => {
    const runPrefetch = async () => {
      // 1. Resolve session first
      const s = await getSession()
      if (!s) return
      setSession(s)

      // 2. Load from cache first for instant rendering
      const cachedProfile = getCached('profile')
      const cachedIntegrations = getCached('integrations')
      const cachedActiveRun = getCached('activeRuns')

      if (cachedProfile) {
        setSession((prev: any) => prev ? { ...prev, tenant: cachedProfile.tenant } : null)
      }
      if (cachedIntegrations) {
        const active = (cachedIntegrations.plugins || cachedIntegrations.integrations || [])
          .filter((i: any) => i.connected)
          .map((i: any) => i.service_name || i.name)
        setConnectedServices(active)
      }
      if (cachedActiveRun && cachedActiveRun.run) {
        setCurrentRunId(cachedActiveRun.run.id)
        setCurrentWorkflowId(cachedActiveRun.run.workflow_id)
        setMessages(prev => prev.length === 0 ? [
          { id: 'rehydrated-user-msg', role: 'user', content: cachedActiveRun.run.prompt },
          {
            id: 'rehydrated-assistant-msg',
            role: 'assistant',
            isTask: true,
            status: cachedActiveRun.run.status,
            runId: cachedActiveRun.run.id,
            workflowId: cachedActiveRun.run.workflow_id,
            steps: cachedActiveRun.steps,
            logs: ['⚡ Re-connecting to active task pipeline…'],
            progress: cachedActiveRun.run.status === 'completed' ? 100 : 50,
            taskReceipt: cachedActiveRun.run.task_receipt
          }
        ] : prev)
      }

      // 3. Fire API calls in parallel (eliminates waterfall)
      try {
        const [historyRes, integrationsRes, billingRes, suggestionsRes, activeRunsRes, profileRes] = await Promise.allSettled([
          api.tasks.history(),
          api.plugins.list(),
          api.billing.usage(),
          api.suggestions.get(),
          api.tasks.active(),
          api.auth.me()
        ])

        // 4. Distribute and cache results
        if (historyRes.status === 'fulfilled') {
          setCached('history', historyRes.value)
        }
        if (integrationsRes.status === 'fulfilled') {
          const val = integrationsRes.value
          setCached('integrations', val)
          const active = (val.plugins || (val as any).integrations || [])
            .filter((i: any) => i.connected)
            .map((i: any) => i.service_name || i.name)
          setConnectedServices(active)
        }
        if (billingRes.status === 'fulfilled') {
          setCached('billing', billingRes.value)
        }
        if (suggestionsRes.status === 'fulfilled') {
          setCached('suggestions', suggestionsRes.value)
        }
        if (profileRes.status === 'fulfilled' && profileRes.value?.tenant) {
          const profile = profileRes.value
          setCached('profile', profile)
          setSession((prev: any) => prev ? { ...prev, tenant: profile.tenant } : null)
          saveSession(s.token, profile.tenant)
        }
        if (activeRunsRes.status === 'fulfilled') {
          const res = activeRunsRes.value
          setCached('activeRuns', res)
          if (res.run) {
            setCurrentRunId(res.run.id)
            setCurrentWorkflowId(res.run.workflow_id)
            setMessages([
              { id: 'rehydrated-user-msg', role: 'user', content: res.run.prompt },
              {
                id: 'rehydrated-assistant-msg',
                role: 'assistant',
                isTask: true,
                status: res.run.status,
                runId: res.run.id,
                workflowId: res.run.workflow_id,
                steps: res.steps,
                logs: ['⚡ Re-connecting to active task pipeline…'],
                progress: res.run.status === 'completed' ? 100 : 50,
                taskReceipt: res.run.task_receipt
              }
            ])

            const activeStatus = res.run.status.toLowerCase()
            if (activeStatus !== 'completed' && activeStatus !== 'failed' && activeStatus !== 'cancelled') {
              const controller = new AbortController()
              abortRef.current = controller
              const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
              const response = await fetch(`${baseUrl}/workflows/${res.run.workflow_id}/runs/${res.run.id}/stream`, {
                headers: { 'Authorization': `Bearer ${s.token}` },
                signal: controller.signal
              })
              if (response.ok) {
                processSSEStream(response, 'rehydrated-assistant-msg', (runId) => {
                  loadArtifactsForRun(runId)
                })
              }
            } else {
              loadArtifactsForRun(res.run.id)
            }
          }
        }
      } catch (err) {
        console.error('[Terminal Preload] Fetch error:', err)
      }
    }

    runPrefetch()
  }, [])

  const getUserGreetingName = () => {
    if (session?.tenant?.name) return session.tenant.name
    if (session?.tenant?.email) {
      const emailName = session.tenant.email.split('@')[0]
      return emailName.charAt(0).toUpperCase() + emailName.slice(1)
    }
    return ''
  }

  const getTimeBasedGreeting = () => {
    const hr = new Date().getHours()
    if (hr < 12) return 'Good morning'
    if (hr < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const getDynamicWelcomeSuggestions = () => {
    const suggestions: string[] = []
    
    if (connectedServices.includes('gmail')) {
      suggestions.push(
        "Read my latest unread emails and draft responses for review",
        "Check my inbox for emails from clients and summarize action items"
      )
    }
    if (connectedServices.includes('google-calendar') || connectedServices.includes('calendar')) {
      suggestions.push(
        "Look at my calendar events for tomorrow and prepare a prep report",
        "Schedule a follow-up session with team members for next Monday"
      )
    }
    if (connectedServices.includes('slack')) {
      suggestions.push(
        "Scan recent messages in my priority Slack channels for updates",
        "Draft a progress update message and send it to our team channel"
      )
    }
    if (connectedServices.includes('google-drive') || connectedServices.includes('drive')) {
      suggestions.push(
        "Search my Drive for the Q2 budget spreadsheet and analyze totals",
        "Create a new document summarizing recent competitor strategies"
      )
    }
    if (connectedServices.includes('notion')) {
      suggestions.push(
        "Retrieve my task backlog from Notion and list high priority items"
      )
    }
    if (connectedServices.includes('airtable')) {
      suggestions.push(
        "Pull lead lists from Airtable and check company domains"
      )
    }
    if (connectedServices.includes('jira')) {
      suggestions.push(
        "Check my assigned Jira issues and draft status updates for each"
      )
    }

    const defaults = [
      "Research top competitor startups and compile a spreadsheet comparison",
      "Filter failed items from this sales CSV and email a summary report",
      "Check our repository for security leaks and commit fixes"
    ]

    const combined = [...suggestions, ...defaults]
    return Array.from(new Set(combined)).slice(0, 3)
  }

  // Fetch session and check ?prefill query parameter on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const prefill = params.get('prefill')
      if (prefill) {
        setInputText(decodeURIComponent(prefill))
      }
    }
  }, [])

  // Load morning briefing on mount/session check if no messages (Phase 5)
  useEffect(() => {
    if (session && messages.length === 0) {
      // Check if briefing was already shown in this browser session
      const shownKey = `briefing-shown-${session.tenant?.id || 'default'}-${new Date().toDateString()}`
      if (sessionStorage.getItem(shownKey)) return

      const fetchBriefing = async () => {
        try {
          const res = await api.integrations.briefing()
          if (res.briefing) {
            sessionStorage.setItem(shownKey, 'true')
            const b = res.briefing
            const greetingText = `### ${b.greeting || 'Good morning'}\nToday is **${b.date}**.\n\n${b.summary || ''}\n\n`
            const sectionsText = (b.sections || []).map((s: any) => {
              return `#### ${s.icon} ${s.title}\n${s.content}`
            }).join('\n\n')
            const actionsText = b.suggested_actions && b.suggested_actions.length > 0
              ? `\n\n**Suggested actions for today:**\n` + b.suggested_actions.map((act: string) => `- ${act}`).join('\n')
              : ''
            
            const fullContent = greetingText + sectionsText + actionsText
            
            setMessages(() => [
              {
                id: 'morning-briefing',
                role: 'assistant',
                content: fullContent,
                isTyping: false
              }
            ])
          }
        } catch (err: any) {
          console.warn('[Briefing] Failed to fetch morning briefing:', err.message)
        }
      }
      fetchBriefing()
    }
  }, [session, messages.length])

  // Auto-scroll to bottom of thread on message update
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Global keydown listeners for Command Palette and Escape to Cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to toggle Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(prev => !prev)
      }

      // Escape to prompt task cancellation
      if (e.key === 'Escape') {
        const runningTask = messages.find(m => m.isTask && (m.status === 'executing' || m.status === 'planning' || m.status === 'waiting' || m.status === 'running'))
        if (runningTask && runningTask.runId) {
          e.preventDefault()
          setMessages(prev => {
            if (prev.some(m => m.id === 'cancel-confirmation')) return prev
            return [
              ...prev,
              {
                id: 'cancel-confirmation',
                role: 'assistant',
                content: 'Cancel this task?',
                isTask: true,
                status: 'cancel_confirmation',
                runId: runningTask.runId
              }
            ]
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [messages])

  // Custom SSE Streaming processor
  const processSSEStream = useCallback(async (
    response: Response,
    assistantMsgId: string,
    onSuccessCallback?: (runId: string) => void
  ) => {
    if (!response.body) throw new Error('Empty response stream.')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const dataStr = trimmed.slice(6)
        try {
          const data = JSON.parse(dataStr)

          switch (data.type) {
            case 'run_snapshot':
              setCurrentRunId(data.runId)
              setMessages(prev => {
                const userMsg = prev.find(m => m.role === 'user') || { id: 'user-msg', role: 'user', content: data.prompt || 'Autonomous Task' }
                return [
                  userMsg,
                  {
                    id: assistantMsgId,
                    role: 'assistant',
                    isTask: true,
                    status: data.status,
                    runId: data.runId,
                    progress: data.progress,
                    taskReceipt: data.task_receipt,
                    steps: data.steps,
                    logs: [`⚡ Connected to active task session (${data.status}).`]
                  }
                ]
              })
              break

            case 'delta':
              fullText += data.delta
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, content: fullText, isTyping: true }
                  : m
              ))
              break

            case 'done':
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, isTyping: false } : m
              ))
              break

            case 'needs_inputs':
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, isTask: true, status: 'needs_inputs', taskConfig: data.parsed_config }
                  : m
              ))
              break

            case 'integration_required':
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      isTask: true,
                      status: 'integration_required',
                      taskConfig: {
                        service: data.service,
                        userMessage: data.userMessage,
                        actionUrl: data.actionUrl || '/dashboard/plugins'
                      }
                    }
                  : m
              ))
            case 'billing_required':
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      isTask: true,
                      status: 'billing_required',
                      taskConfig: {
                        userMessage: data.personalised_message || data.userMessage,
                        actionUrl: data.upgrade_url || data.actionUrl || '/pricing',
                        taskType: data.task_type
                      }
                    }
                  : m
              ))
              break

            case 'task_launched':
              setCurrentRunId(data.run_id)
              setCurrentWorkflowId(data.workflow_id)
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      isTask: true,
                      isTyping: false,
                      status: 'planning',
                      runId: data.run_id,
                      workflowId: data.workflow_id,
                      steps: (data.agents || []).map((a: any) => ({
                        ...a,
                        status: 'pending'
                      })),
                      logs: ['⚡ Swarm execution pipeline initialized…']
                    }
                  : m
              ))
              break

            case 'task_event': {
              const event = data.event
              const evType = event.type
              const payload = event.data || {}
              const runId = event.runId

              if (evType === 'browser:screenshot' && payload.screenshot) {
                setActiveArtifact({
                  id: `screenshot-${runId}`,
                  name: 'Live Browser View',
                  type: 'screenshot',
                  content: payload.screenshot
                })
              }

              setMessages(prev => prev.map(m => {
                if (m.runId !== runId) return m

                const updatedLogs = [...(m.logs || [])]
                let updatedStatus = m.status
                let updatedSteps = [...(m.steps || [])]
                let updatedProgress = m.progress
                let taskReceipt = m.taskReceipt
                let templateCandidate = m.templateCandidate

                if (evType === 'workflow_progress') {
                  updatedProgress = payload.progress
                } else if (evType === 'agent_start') {
                  updatedStatus = 'executing'
                  updatedSteps = updatedSteps.map(s =>
                    s.id === event.agentId || s.role === payload.role
                      ? { ...s, status: 'running' }
                      : s
                  )
                  updatedLogs.push(`▶ Starting step: ${payload.name || event.agentId}`)

                } else if (evType === 'agent_progress') {
                  if (payload.message) updatedLogs.push(`   ${payload.message}`)

                } else if (evType === 'agent_waiting') {
                  updatedStatus = 'waiting'
                  updatedSteps = updatedSteps.map(s =>
                    s.id === event.agentId ? { ...s, status: 'waiting' } : s
                  )
                  updatedLogs.push(`⏳ Execution paused — awaiting client permission`)

                } else if (evType === 'agent_done') {
                  updatedSteps = updatedSteps.map(s =>
                    s.id === event.agentId || s.role === payload.role
                      ? { ...s, status: 'completed' }
                      : s
                  )
                  updatedLogs.push(`✔ Completed step: ${payload.name || event.agentId}`)

                } else if (evType === 'agent_error') {
                  updatedSteps = updatedSteps.map(s =>
                    s.id === event.agentId || s.role === payload.role
                      ? { ...s, status: 'failed' }
                      : s
                  )
                  updatedLogs.push(`✗ Error: ${payload.message || 'unknown failure'}`)

                } else if (evType === 'workflow_done') {
                  updatedStatus = 'completed'
                  updatedProgress = 100
                  updatedLogs.push(`🎉 Goal outcome completed successfully.`)
                  taskReceipt = payload.task_receipt
                  templateCandidate = payload.template_candidate
                  onSuccessCallback?.(runId)
                  
                  if (typeof window !== 'undefined') {
                    const bc = new BroadcastChannel('chatbolt-tasks')
                    bc.postMessage({ type: 'task:completed', runId })
                    bc.close()
                  }

                  addToast({
                    title: 'Task Completed',
                    description: 'Process completed successfully.',
                    runId,
                    type: 'success'
                  })

                } else if (evType === 'workflow_error') {
                  updatedStatus = 'failed'
                  updatedLogs.push(`✗ Pipeline failed to complete.`)
                  
                  if (typeof window !== 'undefined') {
                    const bc = new BroadcastChannel('chatbolt-tasks')
                    bc.postMessage({ type: 'task:failed', runId })
                    bc.close()
                  }

                  addToast({
                    title: 'Task Failed',
                    description: payload.error || 'Process failed to complete.',
                    runId,
                    type: 'error'
                  })
                }

                return { 
                  ...m, 
                  status: updatedStatus, 
                  steps: updatedSteps, 
                  logs: updatedLogs, 
                  progress: updatedProgress,
                  taskReceipt,
                  templateCandidate
                }
              }))
              break
            }
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  }, [])


  // Unified execution sender
  const handleExecute = async (promptText: string, extraInputs: Record<string, any> = {}) => {
    if (loading || !promptText.trim()) return

    // Prepend attachment context if present
    let finalPrompt = promptText
    if (attachment) {
      const prefix = attachment.type === 'url'
        ? `[Context from ${attachment.label}]:\n${attachment.content}\n\n---\n\n`
        : attachment.type === 'image'
        ? `[Image description — ${attachment.label}]:\n${attachment.content}\n\n---\n\n`
        : attachment.type === 'transcript'
        ? `[Voice input]:\n${attachment.content}\n\n---\n\n`
        : `[File: ${attachment.label}]:\n${attachment.content}\n\n---\n\n`
      finalPrompt = prefix + promptText
      setAttachment(null)
    }

    setLoading(true)
    const userMsgId = crypto.randomUUID()
    const assistantMsgId = crypto.randomUUID()

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: promptText },
      { id: assistantMsgId, role: 'assistant', content: '', isTyping: true }
    ])

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const response = await fetch(`${baseUrl}/chat/api/v2/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token || ''}`
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          session_id: sessionIdFromHistory(),
          inputs: extraInputs
        }),
        signal: abortRef.current.signal
      })

      if (!response.ok) throw new Error('Network execution request failed.')
      await processSSEStream(response, assistantMsgId, (runId) => {
        loadArtifactsForRun(runId)
      })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: `Error executing task: ${err.message}`, isTyping: false }
            : m
        ))
      }
    } finally {
      setLoading(false)
    }
  }

  const sessionIdFromHistory = (): string => {
    return 'terminal-session-' + (session?.user?.id || 'default')
  }

  // Safety approval actions
  const callWorkflowAction = async (msgIndex: number, action: 'approve' | 'reject') => {
    const msg = messages[msgIndex]
    if (!msg.runId) return

    const newStatus = action === 'approve' ? 'executing' : 'cancelled'
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, status: newStatus } : m))

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      
      let res;
      if (action === 'approve') {
        const waitingStep = msg.steps?.find((s: any) => s.status === 'waiting')
        const actionId = waitingStep?.id || 'default'
        res = await fetch(`${baseUrl}/api/runs/${msg.runId}/actions/${actionId}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.token || ''}`
          }
        })
      } else {
        res = await fetch(`${baseUrl}/workflows/${msg.workflowId}/runs/${msg.runId}/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.token || ''}`
          }
        })
      }
      
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Action failed.')
      toastSuccess(
        action === 'approve' ? 'Authorized' : 'Cancelled',
        action === 'approve' ? 'Execution resumed.' : 'Task run terminated.'
      )
    } catch (err: any) {
      toastError('Authorization action failed', err.message)
    }
  }

  // Execution cancellation
  const handleCancelRun = async (runId: string) => {
    try {
      await api.workflows.cancelRun(runId)
      setMessages(prev => prev.map(m =>
        m.runId === runId ? { ...m, status: 'cancelled', logs: [...(m.logs || []), '✗ Swarm cancelled by user'] } : m
      ).filter(m => m.status !== 'cancel_confirmation'))
      toastSuccess('Cancelled', 'Execution has been terminated.')
    } catch (err: any) {
      toastError('Cancellation failed', err.message)
    }
  }

  // Calibration Form submit
  const handleCalibrationSubmit = async (msgIndex: number, values: Record<string, string>) => {
    const msg = messages[msgIndex]
    if (!msg.content || loading) return

    setLoading(true)
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, status: 'planning' } : m))

    try {
      await handleExecute(msg.content, values)
    } catch (err: any) {
      toastError('Failed to launch task', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDismissCancel = (msgIndex: number) => {
    setMessages(prev => prev.filter((_, i) => i !== msgIndex))
  }

  const handleSelectTemplate = (templateText: string) => {
    setInputText(templateText)
    setTimeout(() => {
      inputBarRef.current?.selectPlaceholder()
    }, 50)
  }

  const isDark = theme === 'obsidian'

  return (
    <div className={`h-screen flex text-[13px] overflow-hidden ${
      isDark ? 'bg-[#0C0C0E] text-zinc-100' : 'bg-white text-zinc-800'
    }`}>
      <style>{`
        @media (max-width: 768px) {
          .main-terminal-column {
            width: 100% !important;
          }
          .artifact-panel-wrapper {
            display: contents !important;
          }
        }
      `}</style>
      
      {/* Main Terminal Column (55% or 100% depending on artifact open status) */}
      <div className={`main-terminal-column flex flex-col h-full relative transition-all duration-300 ${
        activeArtifact ? 'w-[55%]' : 'w-full'
      }`}>
        
        {/* Header toolbar */}
        <header className={`px-6 py-4 flex items-center justify-between border-b ${
          isDark ? 'border-white/[0.05] bg-[#0C0C0E]' : 'border-zinc-200 bg-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#534AB7] to-[#7B72F0] flex items-center justify-center text-white font-black shadow-md shadow-[#534AB7]/10">
              <Bot size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[12px] font-black uppercase tracking-widest text-white">
                  {TERMINAL_STRINGS.headerTitle}
                </h2>
                <StreakBadge streak={session?.tenant?.current_streak} />
              </div>
              <p className="text-[9px] font-medium tracking-wider text-zinc-500">
                {TERMINAL_STRINGS.headerSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* History Toggle Button */}
            <button
              onClick={() => setIsHistoryOpen(prev => !prev)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-[#141418] border-white/[0.05] text-zinc-400 hover:text-white'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-black'
              }`}
              title="View task history"
            >
              <Clock size={14} />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(t => t === 'obsidian' ? 'arctic' : 'obsidian')}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-[#141418] border-white/[0.05] text-zinc-400 hover:text-white'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-black'
              }`}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        {/* Messages thread / Welcome view */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto text-center py-16 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Main headline */}
              <div className="space-y-4">
                <h1 className={`text-center tracking-tight leading-tight text-[32px] font-[600] ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}>
                  {(() => {
                    const greeting = getTimeBasedGreeting()
                    const name = getUserGreetingName()
                    return name
                      ? `${greeting}, ${name.split(' ')[0]}`
                      : `${greeting}`
                  })()}
                </h1>
                <p className={`text-sm transition-all duration-500 ${
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                }`}>
                  {activeMode
                    ? MODE_CHIPS.find(c => c.id === activeMode)?.placeholder
                    : PLACEHOLDER_ROTATION[subtitleIndex]
                  }
                </p>
              </div>



              {/* Suggestion cards */}
              <div className="flex flex-col gap-2.5">
                {getDynamicWelcomeSuggestions().map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExecute(suggestion)}
                    className={`group px-4 py-3.5 rounded-xl border text-left text-[13px] font-medium transition-all hover:scale-[1.01] cursor-pointer flex items-center justify-between ${
                      isDark
                        ? 'bg-zinc-900/60 hover:bg-zinc-900 border-white/[0.06] hover:border-white/[0.12] text-zinc-300 hover:text-white'
                        : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 hover:border-zinc-300 text-zinc-700'
                    }`}
                  >
                    <span>{suggestion}</span>
                    <svg className="w-3.5 h-3.5 text-zinc-600 group-hover:text-[#534AB7] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-[900px] w-full mx-auto">
              {(() => {
                const displayedMessages = messages.length > 200 ? messages.slice(-100) : messages
                return (
                  <ChatThread
                    messages={displayedMessages}
                    onApprovePermission={(idx) => {
                      const originalIndex = messages.length > 200 ? (messages.length - 100 + idx) : idx
                      callWorkflowAction(originalIndex, 'approve')
                    }}
                    onRejectPermission={(idx) => {
                      const originalIndex = messages.length > 200 ? (messages.length - 100 + idx) : idx
                      callWorkflowAction(originalIndex, 'reject')
                    }}
                    onCancelRun={handleCancelRun}
                    onSubmitCalibration={(idx, values) => {
                      const originalIndex = messages.length > 200 ? (messages.length - 100 + idx) : idx
                      handleCalibrationSubmit(originalIndex, values)
                    }}
                    onDismissCancel={(idx) => {
                      const originalIndex = messages.length > 200 ? (messages.length - 100 + idx) : idx
                      handleDismissCancel(originalIndex)
                    }}
                  />
                )
              })()}
              {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].status === 'completed' && (
                <SuggestionChips
                  taskName={messages[messages.length - 1].content || ''}
                  taskOutput={(messages[messages.length - 1].logs || []).join('\n')}
                  onSuggestionClick={(prompt) => { setInputText(prompt); handleExecute(prompt); }}
                  className="mb-4"
                />
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <footer className={`p-6 border-t ${
          isDark ? 'border-white/[0.05] bg-[#0C0C0E]/50' : 'border-zinc-200 bg-white/50'
        }`}>
          <div className="max-w-3xl mx-auto">
            <InputBar 
              ref={inputBarRef}
              value={inputText} 
              onChange={setInputText} 
              onSend={(txt) => handleExecute(txt)} 
              disabled={loading}
              placeholder={activeMode
                ? MODE_CHIPS.find(c => c.id === activeMode)?.placeholder
                : PLACEHOLDER_ROTATION[subtitleIndex]
              }
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => {
                // Short delay to allow click event on templates to execute
                setTimeout(() => setIsInputFocused(false), 200)
              }}
            />
            {/* Mode chips below input */}
            <div className="flex items-center justify-start gap-1.5 flex-wrap mt-2.5">
              {MODE_CHIPS.map(chip => (
                <button
                  key={chip.id}
                  onClick={() => {
                    setActiveMode(prev => prev === chip.id ? null : chip.id)
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeMode === chip.id
                      ? 'bg-[#534AB7] text-white shadow-[0_0_10px_rgba(83,74,183,0.3)]'
                      : isDark
                        ? 'bg-white/[0.03] border border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/10'
                        : 'bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            {/* Multimodal toolbar — file, URL, voice */}
            <div className="mt-3.5">
              <MultimodalInput
                attachment={attachment}
                onAttach={setAttachment}
                onRemove={() => setAttachment(null)}
                disabled={loading}
              />
            </div>
            <TemplateLibrary
              visible={isInputFocused && messages.filter(m => m.role === 'user').length === 0 && !inputText}
              onSelectTemplate={handleSelectTemplate}
            />
          </div>
        </footer>

      </div>

      {/* Sliding Artifact Panel (45%) */}
      {activeArtifact && (
        <div className="artifact-panel-wrapper w-[45%] h-full">
          <ArtifactPanel
            artifact={activeArtifact}
            onClose={() => setActiveArtifact(null)}
          />
        </div>
      )}

      {/* Task Toast Notifications Overlay */}
      <TaskToast
        tasks={toasts}
        onDismiss={dismissToast}
        onViewTask={(runId) => loadArtifactsForRun(runId)}
      />

      {/* History Slide-Out Panel */}
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRerun={(prompt) => {
          setInputText(prompt)
          setIsHistoryOpen(false)
          setTimeout(() => {
            inputBarRef.current?.focus()
          }, 50)
        }}
        onViewArtifact={(runId) => {
          loadArtifactsForRun(runId)
          setIsHistoryOpen(false)
        }}
      />

      {/* Command Palette Overlay */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectShortcut={(prompt, autoSubmit) => {
          setInputText(prompt)
          if (autoSubmit && prompt) {
            handleExecute(prompt)
          } else {
            setTimeout(() => {
              inputBarRef.current?.focus()
            }, 50)
          }
        }}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

    </div>
  )
}
