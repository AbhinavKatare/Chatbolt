'use client'
import React, { useState } from 'react'
import { X, Bot, ChevronDown, Minus, Plus } from 'lucide-react'
import { api } from '@/lib/api'

const ROLES = ['researcher','writer','email_sender','scraper','data_processor','spreadsheet','code','analyzer']
const MODELS = [
  { id: 'qwen/qwen3-235b-a22b:free', label: '⚡ Qwen3 235B', sub: 'Free' },
  { id: 'gpt-4o', label: '🧠 GPT-4o', sub: 'Paid' },
  { id: 'claude-3-5-sonnet-20241022', label: '💎 Claude Sonnet', sub: 'Paid' },
  { id: 'mistralai/mistral-large-latest', label: '🔥 Mistral Large', sub: 'Paid' },
]

interface EditAgentModalProps {
  agent: any
  workflowId: string
  onClose: () => void
  onSaved: (updated: any) => void
}

export function EditAgentModal({ agent, workflowId, onClose, onSaved }: EditAgentModalProps) {
  const [form, setForm] = useState({
    name: agent.name || '',
    role: agent.role || 'researcher',
    description: agent.description || '',
    system_prompt: agent.system_prompt || '',
    model: agent.model || 'qwen/qwen3-235b-a22b:free',
    temperature: 0.3,
    max_tokens: 1024,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.workflows.updateAgent(workflowId, agent.id, form)
      setSaved(true)
      setTimeout(() => { onSaved({ ...agent, ...form }); onClose() }, 800)
    } catch (e: any) {
      alert('Save failed: ' + e.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-8 py-6 border-b border-black/5 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-3xl">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-gray-400">Edit Agent</div>
            <div className="text-base font-bold text-[#111] mt-0.5">{agent.name}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>

        <div className="px-8 py-6 space-y-7">
          {/* Identity */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-black/5 pb-2">Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-black/30" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Role</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:border-black/30">
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
              <input value={form.description} onChange={e => set('description', e.target.value)}
                className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-black/30" />
            </div>
          </section>

          {/* AI Config */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-black/5 pb-2">AI Configuration</h3>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">System Prompt</label>
              <textarea value={form.system_prompt} onChange={e => set('system_prompt', e.target.value)} rows={6}
                className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm font-medium resize-none focus:outline-none focus:border-black/30 font-mono"
                placeholder="You are a... Be specific about what this agent should do." />
              <div className="text-right text-[9px] text-gray-400">{form.system_prompt.length} / 4000</div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Model</label>
              <div className="grid grid-cols-2 gap-2">
                {MODELS.map(m => (
                  <button key={m.id} onClick={() => set('model', m.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${form.model === m.id ? 'border-[#111] bg-[#111]' : 'border-black/10 hover:border-black/30'}`}>
                    <div className={`text-[11px] font-bold ${form.model === m.id ? 'text-white' : 'text-[#111]'}`}>{m.label}</div>
                    <div className={`text-[9px] ${form.model === m.id ? 'text-gray-300' : 'text-gray-400'}`}>{m.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Temperature</label>
                <span className="text-[10px] font-black text-[#111]">{form.temperature.toFixed(1)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.1} value={form.temperature} onChange={e => set('temperature', parseFloat(e.target.value))}
                className="w-full accent-[#111]" />
              <div className="flex justify-between text-[9px] text-gray-300">
                <span>Precise</span><span>Balanced</span><span>Creative</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Max Tokens</label>
                <span className="text-[10px] font-black text-[#111]">{form.max_tokens}</span>
              </div>
              <input type="range" min={100} max={4000} step={100} value={form.max_tokens} onChange={e => set('max_tokens', parseInt(e.target.value))}
                className="w-full accent-[#111]" />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-black/5 flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-3xl">
          <button onClick={onClose} className="px-5 py-2.5 border border-black/10 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-[#111] text-white rounded-xl text-sm font-bold hover:bg-black transition-all disabled:opacity-60 min-w-[120px]">
            {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
