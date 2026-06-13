'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Key, Code, Zap, Plus, Trash2, Copy, Check, Eye, EyeOff,
  Globe, Shield, ArrowRight, ExternalLink, Loader2,
  Bot, Terminal, Webhook, RefreshCw, X
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

type Tab = 'API Access' | 'Embed Widget' | 'Zapier/Make'
type ApiKey = { id: string; name: string; key_prefix: string; last_used_at: string | null; created_at: string }
type Agent = { id: string; name: string; description?: string }

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-mono">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-[#00E599] transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap">{code}</pre>
    </div>
  )
}

// ── API Access Tab ─────────────────────────────────────────────────────────────

function ApiAccessTab({ agents }: { agents: Agent[] }) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyAgentId, setNewKeyAgentId] = useState('')
  const [showNewKey, setShowNewKey] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    api.apiKeys.list().then(res => setKeys(res.keys || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await api.apiKeys.create(newKeyName.trim(), newKeyAgentId || undefined)
      if (res.full_key) setShowNewKey(res.full_key)
      setKeys(prev => [res.key || res, ...prev])
      setNewKeyName('')
      setNewKeyAgentId('')
      toast({ title: 'API key created', type: 'success' })
    } catch (err: any) {
      toast({ title: 'Failed to create key', message: err.message, type: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const deleteKey = async (id: string) => {
    if (!confirm('Delete this API key? Any apps using it will stop working.')) return
    try {
      await api.apiKeys.delete(id)
      setKeys(prev => prev.filter(k => k.id !== id))
      toast({ title: 'Key deleted', type: 'success' })
    } catch (err: any) {
      toast({ title: 'Failed to delete key', message: err.message, type: 'error' })
    }
  }

  const exampleCode = `# Submit a task
curl -X POST https://your-chatbolt-domain.com/api/v1/tasks \\
  -H "X-API-Key: YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Summarize my inbox and draft replies"}'

# Check task status
curl https://your-chatbolt-domain.com/api/v1/tasks/TASK_ID \\
  -H "X-API-Key: YOUR_KEY_HERE"`

  return (
    <div className="space-y-6">
      {/* New key revealed */}
      {showNewKey && (
        <div className="bg-[#00E599]/10 border border-[#00E599]/30 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#00E599] mb-1">🔑 Your new API key — copy it now</p>
              <p className="text-xs text-zinc-500 mb-3">This key won&apos;t be shown again.</p>
              <code className="text-sm text-white font-mono bg-zinc-900 px-3 py-2 rounded-lg block break-all">{showNewKey}</code>
            </div>
            <button onClick={() => setShowNewKey(null)} className="text-zinc-500 hover:text-white transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create new key */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-[#00E599]" />
          Create API Key
        </h3>
        <form onSubmit={createKey} className="flex flex-wrap gap-2">
          <input
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. Production App)"
            className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E599]/50"
            required
          />
          <select
            value={newKeyAgentId}
            onChange={e => setNewKeyAgentId(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-[#00E599]/50"
          >
            <option value="">All agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button
            type="submit"
            disabled={creating || !newKeyName.trim()}
            className="px-4 py-2 bg-[#00E599] text-black text-sm font-semibold rounded-lg hover:bg-[#00E599]/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Generate
          </button>
        </form>
      </div>

      {/* Keys list */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-zinc-400" />
            Active Keys ({keys.length})
          </h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-zinc-800 rounded-lg animate-pulse" />)}
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-2">
            <Key className="w-8 h-8" />
            <p className="text-sm">No API keys yet</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {keys.map(k => (
              <div key={k.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-800/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{k.name}</p>
                  <p className="text-xs text-zinc-500 font-mono">{k.key_prefix}••••••••</p>
                </div>
                <p className="text-xs text-zinc-600">
                  {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}
                </p>
                <button
                  onClick={() => deleteKey(k.id)}
                  className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Code example */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#00E599]" />
          How to use
        </h3>
        <CodeBlock code={exampleCode} language="bash" />
      </div>
    </div>
  )
}

// ── Embed Widget Tab ───────────────────────────────────────────────────────────

function EmbedWidgetTab({ agents }: { agents: Agent[] }) {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || '')
  const [copied, setCopied] = useState(false)

  const embedCode = `<script 
  src="https://your-chatbolt-domain.com/widget.js"
  data-agent="${selectedAgent || 'YOUR_AGENT_ID'}"
  data-theme="dark"
  data-position="bottom-right"
  data-welcome="Hi! How can I help you today?"
></script>`

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      {/* Agent selector */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Bot className="w-4 h-4 text-[#00E599]" />
          Select an Agent to Embed
        </h3>
        <select
          value={selectedAgent}
          onChange={e => setSelectedAgent(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00E599]/50"
        >
          <option value="">Choose an agent...</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Preview */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-zinc-400" />
          Widget Preview
        </h3>
        <div className="relative h-56 bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
          {/* Simulated page content */}
          <div className="absolute inset-0 p-4 opacity-30">
            <div className="h-3 bg-zinc-700 rounded w-3/4 mb-2" />
            <div className="h-3 bg-zinc-700 rounded w-1/2 mb-2" />
            <div className="h-3 bg-zinc-700 rounded w-2/3" />
          </div>
          {/* Chat widget bubble */}
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-300 shadow-lg max-w-[180px]">
              Hi! How can I help you today? 👋
            </div>
            <div className="w-12 h-12 rounded-full bg-[#00E599] flex items-center justify-center shadow-lg cursor-pointer">
              <Bot className="w-6 h-6 text-black" />
            </div>
          </div>
        </div>
        <p className="text-xs text-zinc-600 mt-2 text-center">Live preview — widget appears in the bottom-right corner</p>
      </div>

      {/* Embed code */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Code className="w-4 h-4 text-[#00E599]" />
            Embed Code
          </h3>
          <button
            onClick={copyEmbed}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-[#00E599] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#00E599]/10"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
        <CodeBlock code={embedCode} language="html" />
        <p className="text-xs text-zinc-600 mt-3">
          Paste this snippet before the <code className="text-zinc-500">&lt;/body&gt;</code> tag on any page.
          To customize colors or behavior, go to the agent settings.
        </p>
      </div>
    </div>
  )
}

// ── Zapier/Make Tab ────────────────────────────────────────────────────────────

function ZapierTab() {
  const [webhookToken, setWebhookToken] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const webhookUrl = webhookToken
    ? `https://your-chatbolt-domain.com/webhooks-receiver/receive/${webhookToken}`
    : ''

  const generateToken = async () => {
    setGenerating(true)
    try {
      // Generate a random webhook token
      const token = Array.from(crypto.getRandomValues(new Uint8Array(20)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      setWebhookToken(token)
      toast({ title: 'Webhook URL generated', type: 'success' })
    } catch {
      toast({ title: 'Failed to generate token', type: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const steps = [
    { step: '1', title: 'Get your API key', desc: 'Copy your API key from the API Access tab above', icon: Key },
    { step: '2', title: 'Open Zapier or Make.com', desc: 'Search for "Webhooks by Zapier" or "HTTP" in Make', icon: ExternalLink },
    { step: '3', title: 'Paste your webhook URL', desc: 'Copy the webhook URL below and paste it as the trigger', icon: Webhook },
    { step: '4', title: 'Set up your action', desc: 'Choose: Task Completed, New Memory Saved, or Agent Response', icon: Zap },
  ]

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#00E599]/10 to-transparent border border-[#00E599]/20 rounded-2xl p-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E599]/5 rounded-full -mr-10 -mt-10" />
        <Zap className="w-8 h-8 text-[#00E599] mb-3" />
        <h3 className="text-base font-bold text-white mb-1">Connect to 5,000+ apps</h3>
        <p className="text-sm text-zinc-400">
          Use Zapier, Make.com, or any webhook-compatible tool to trigger Chatbolt tasks, 
          receive task results, and automate cross-app workflows.
        </p>
      </div>

      {/* Steps */}
      <div className="grid md:grid-cols-2 gap-3">
        {steps.map(({ step, title, desc, icon: Icon }) => (
          <div key={step} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#00E599]/15 text-[#00E599] flex items-center justify-center text-xs font-bold shrink-0">
              {step}
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-0.5">{title}</p>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Webhook generator */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Webhook className="w-4 h-4 text-[#00E599]" />
          Your Webhook URL
        </h3>
        {webhookToken ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-zinc-300 font-mono bg-zinc-950 border border-zinc-700 px-3 py-2 rounded-lg break-all">
                {webhookUrl}
              </code>
              <button
                onClick={copyWebhook}
                className="p-2 text-zinc-400 hover:text-[#00E599] hover:bg-[#00E599]/10 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={generateToken}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Generate new URL
            </button>
          </div>
        ) : (
          <button
            onClick={generateToken}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Webhook className="w-4 h-4" />}
            Generate Webhook URL
          </button>
        )}
      </div>

      {/* API example for Zapier */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Example Zapier Action (HTTP POST)</h3>
        <CodeBlock
          code={`URL: https://your-chatbolt-domain.com/api/v1/tasks
Method: POST
Headers:
  X-API-Key: YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "prompt": "Summarize the lead data from {{zapier_field}}"
}`}
          language="http"
        />
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DeployPage() {
  const [tab, setTab] = useState<Tab>('API Access')
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    api.agents.list().then(res => setAgents(res.agents || [])).catch(() => {})
  }, [])

  const tabs: Tab[] = ['API Access', 'Embed Widget', 'Zapier/Make']
  const tabIcons = { 'API Access': Key, 'Embed Widget': Globe, 'Zapier/Make': Zap }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#00E599]" />
            Deploy & Integrate
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Connect Chatbolt to external apps, embed it on your site, or access via API
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-xl p-1 w-fit">
          {tabs.map(t => {
            const Icon = tabIcons[t]
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  tab === t ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {tab === 'API Access' && <ApiAccessTab agents={agents} />}
        {tab === 'Embed Widget' && <EmbedWidgetTab agents={agents} />}
        {tab === 'Zapier/Make' && <ZapierTab />}
      </div>
    </div>
  )
}
