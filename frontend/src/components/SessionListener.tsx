'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getSession, saveSession } from '@/lib/api'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function SessionListener() {
  const [showWarning, setShowWarning] = useState(false)
  const [minutesRemaining, setMinutesRemaining] = useState(5)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) {
        throw new Error(error?.message || 'No session')
      }
      const tenantStr = localStorage.getItem('chatai_tenant')
      const tenant = tenantStr ? JSON.parse(tenantStr) : { email: data.session.user.email, id: data.session.user.id }
      saveSession(data.session.access_token, tenant)
      setShowWarning(false)
    } catch (err) {
      console.error('Failed to manually refresh session:', err)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    // 1. Listen to Supabase token refresh events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        const tenantStr = localStorage.getItem('chatai_tenant')
        const tenant = tenantStr ? JSON.parse(tenantStr) : { email: session.user.email, id: session.user.id }
        saveSession(session.access_token, tenant)
      }
    })

    // 2. Set up interval to check token expiry every 30 seconds
    const checkExpiry = async () => {
      const s = await getSession()
      if (!s?.token) {
        setShowWarning(false)
        return
      }

      try {
        const parts = s.token.split('.')
        if (parts.length !== 3) return
        const payload = JSON.parse(atob(parts[1]))
        if (!payload.exp) return

        const expiryMs = payload.exp * 1000
        const timeRemainingMs = expiryMs - Date.now()

        // If less than 5 minutes remaining, warn user
        if (timeRemainingMs > 0 && timeRemainingMs <= 5 * 60 * 1000) {
          const mins = Math.ceil(timeRemainingMs / 60000)
          setMinutesRemaining(mins)
          setShowWarning(true)
        } else {
          setShowWarning(false)
        }
      } catch (err) {
        // Ignore decoding errors
      }
    }

    checkExpiry()
    const expiryInterval = setInterval(checkExpiry, 30000)

    // 3. Auto refresh every 50 minutes (3000000 ms)
    const autoRefresh = async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession()
        if (data?.session) {
          const tenantStr = localStorage.getItem('chatai_tenant')
          const tenant = tenantStr ? JSON.parse(tenantStr) : { email: data.session.user.email, id: data.session.user.id }
          saveSession(data.session.access_token, tenant)
        }
      } catch (err) {
        console.error('Auto refresh failed:', err)
      }
    }
    const refreshInterval = setInterval(autoRefresh, 50 * 60 * 1000)

    return () => {
      subscription.unsubscribe()
      clearInterval(expiryInterval)
      clearInterval(refreshInterval)
    }
  }, [])

  if (!showWarning) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-zinc-900/90 backdrop-blur-md border border-red-500/30 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-sm">
        <AlertCircle className="text-red-400 shrink-0 w-5 h-5 animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-zinc-100">Session Expiring</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            Your session will expire in {minutesRemaining} {minutesRemaining === 1 ? 'minute' : 'minutes'}.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#534AB7] hover:bg-[#534AB7]/90 disabled:opacity-50 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer border border-[#534AB7]/20 whitespace-nowrap"
        >
          {refreshing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            'Stay signed in'
          )}
        </button>
      </div>
    </div>
  )
}
