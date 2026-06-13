'use client'

import { useEffect, useState } from 'react'
import { api, getSession, saveSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  Bell, 
  Mail, 
  Clock, 
  Save, 
  Settings, 
  ShieldCheck, 
  Sparkles,
  Inbox,
  AlertCircle
} from 'lucide-react'

type PreferenceType = 'in_app' | 'email_immediate' | 'email_digest'

export default function PreferencesPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [tenant, setTenant] = useState<any>(null)
  const [pref, setPref] = useState<PreferenceType>('in_app')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSession().then(s => {
      if (s?.tenant) {
        setTenant(s.tenant)
        setPref((s.tenant.notification_preferences as PreferenceType) || 'in_app')
      }
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) return

    setSaving(true)
    try {
      const updatedProfile = await api.auth.updateProfile({
        name: tenant.name,
        user_details: tenant.user_details,
        user_purpose: tenant.user_purpose,
        notification_preferences: pref
      })

      setTenant(updatedProfile.tenant)
      saveSession('', updatedProfile.tenant)
      toastSuccess('Preferences updated successfully')
      window.dispatchEvent(new Event('storage'))
    } catch (err: any) {
      toastError('Failed to save preferences', err.message || 'An error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const options = [
    {
      id: 'in_app' as PreferenceType,
      title: 'In-app only',
      desc: 'Show in-app notification toasts in the terminal when your processes complete.',
      icon: Bell,
      badge: 'Default'
    },
    {
      id: 'email_immediate' as PreferenceType,
      title: 'Email me when long tasks finish',
      desc: 'Get an immediate email alert for background processes running longer than 2 minutes.',
      icon: Mail,
      badge: 'Real-time'
    },
    {
      id: 'email_digest' as PreferenceType,
      title: 'Daily digest email at 6pm',
      desc: 'Receive a single email every day summarizing all successfully completed tasks.',
      icon: Clock,
      badge: 'Daily'
    }
  ]

  return (
    <div className="flex flex-col h-full bg-[#050507] font-sans selection:bg-[#00E599]/30">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-white/[0.04] bg-[#09090B] flex items-center justify-between px-4 md:px-8 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
            <Settings size={14} className="text-[#00E599]" /> Personal Preferences
          </div>
          <div className="hidden sm:block h-4 w-px bg-white/[0.06]" />
          <div className="hidden sm:flex items-center gap-4">
            <span className="text-[10px] font-bold text-white uppercase tracking-widest border-b border-[#00E599] pb-1 cursor-pointer">Notifications</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 space-y-8">
          
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#00E599]/10 text-[#00E599] rounded-full text-[9px] font-black uppercase tracking-widest border border-[#00E599]/20 shadow-[0_0_8px_rgba(0,229,153,0.1)]">
              <ShieldCheck size={10} /> Smart Notification Matrix
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Notification Settings</h1>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
              Configure how and when Chatbolt notifies you about task events and process completions.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-[#0D0D11] border border-white/[0.06] p-8 rounded-2xl shadow-xl space-y-8">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-6">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Notification Channels</h3>
                  <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest mt-1">Select your preferred delivery frequency</p>
                </div>
                <Inbox size={18} className="text-[#00E599]" />
              </div>

              <div className="grid grid-cols-1 gap-4">
                {options.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = pref === opt.id
                  return (
                    <label
                      key={opt.id}
                      onClick={() => setPref(opt.id)}
                      className={`relative flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 cursor-pointer group ${
                        isSelected 
                          ? 'bg-[#00E599]/5 border-[#00E599]/40 shadow-[0_0_15px_rgba(0,229,153,0.03)]' 
                          : 'bg-white/[0.01] border-white/[0.05] hover:border-white/10 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center h-5 mt-0.5">
                        <input
                          type="radio"
                          name="notification_pref"
                          checked={isSelected}
                          onChange={() => setPref(opt.id)}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? 'border-[#00E599]' : 'border-zinc-700 group-hover:border-zinc-500'
                        }`}>
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-[#00E599]" />
                          )}
                        </div>
                      </div>

                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        isSelected 
                          ? 'bg-[#00E599]/10 border-[#00E599]/20 text-[#00E599]' 
                          : 'bg-white/[0.02] border-white/[0.04] text-zinc-500'
                      }`}>
                        <Icon size={16} />
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white tracking-wide">{opt.title}</span>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                            isSelected 
                              ? 'bg-[#00E599]/10 text-[#00E599]' 
                              : 'bg-white/[0.03] text-zinc-500'
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-medium leading-relaxed uppercase tracking-wider mt-1.5">
                          {opt.desc}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>

              {pref === 'email_digest' && (
                <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl animate-in fade-in duration-300">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[9px] font-semibold text-amber-500 uppercase tracking-widest leading-loose">
                    Daily digest email requires SMTP Gateway configured. Ensure SMTP is operational under System Settings to avoid delivery dropouts.
                  </p>
                </div>
              )}

              <div className="p-5 bg-white/[0.02] border border-white/[0.04] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 text-[#00E599] flex items-center justify-center shadow-inner">
                    <Sparkles size={16} className="shadow-[0_0_8px_rgba(0,229,153,0.3)]" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white">Target Address</div>
                    <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                      {tenant?.email || 'Loading workspace email...'}
                    </div>
                  </div>
                </div>
              </div>

              <button 
                className="flex items-center gap-2 px-8 py-3.5 bg-white text-black hover:bg-zinc-200 rounded-xl shadow-lg transition-all text-[10px] font-black uppercase tracking-widest active:scale-[0.98] disabled:opacity-50" 
                type="submit" 
                disabled={saving || !tenant}
              >
                {saving ? 'Saving...' : <><Save size={14} /> Save Preferences</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
