'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { api, saveSession } from '@/lib/api'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password
      })
      if (authError) throw new Error(authError.message)
      if (!data.session) throw new Error('Failed to create session')
      
      // Fetch tenant context from our backend using the new session token
      const { tenant } = await api.auth.me()
      saveSession(data.session.access_token, tenant)
      
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#FDFDFB] relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#00DFB8]/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-8 group">
            <div className="w-10 h-10 bg-[#00DFB8] flex items-center justify-center shadow-[0_0_20px_rgba(0,223,184,0.3)] group-hover:shadow-[0_0_30px_rgba(0,223,184,0.5)] transition-shadow">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10C4 6.686 6.686 4 10 4s6 2.686 6 6-2.686 6-6 6H4V10z" fill="#FDFDFB"/>
                <circle cx="10" cy="10" r="2.5" fill="#00DFB8"/>
              </svg>
            </div>
            <span className="display-title text-2xl text-[#1A1A1A] tracking-tight">Chatbolt</span>
          </Link>
          <h1 className="display-title text-4xl text-[#1A1A1A] mb-3 tracking-tighter">Welcome back</h1>
          <p className="text-[#555555] text-sm">Sign in to your Chatbolt dashboard</p>
        </div>

        <div className="card p-8 bg-[#FFFFFF]/80 backdrop-blur-xl border border-black/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00DFB8]/30 to-transparent" />
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-sm p-4 mb-6 text-sm text-red-400 text-center">
              {error}
            </div>
          )}
          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#555555] mb-2 block">Email Address</label>
              <input 
                className="w-full bg-[#FDFDFB] border border-black/10 px-4 py-3 text-[#1A1A1A] placeholder:text-[#555555]/50 focus:border-[#00DFB8]/50 focus:outline-none transition-colors" 
                type="email" 
                placeholder="you@company.com" 
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                required 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#555555] mb-2 flex justify-between">
                <span>Password</span>
                <Link href="/reset-password" className="text-[#00DFB8] hover:text-[#1A1A1A] transition-colors">Forgot?</Link>
              </label>
              <input 
                className="w-full bg-[#FDFDFB] border border-black/10 px-4 py-3 text-[#1A1A1A] placeholder:text-[#555555]/50 focus:border-[#00DFB8]/50 focus:outline-none transition-colors" 
                type="password" 
                placeholder="••••••••" 
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
                required 
              />
            </div>
            <button 
              className="w-full bg-[#00DFB8] text-[#FDFDFB] font-bold uppercase tracking-[0.2em] text-[10px] py-4 hover:bg-white transition-all duration-300" 
              type="submit" 
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-sm text-[#555555]">
          Don't have an account?{' '}
          <Link href="/signup" className="text-[#00DFB8] font-medium hover:text-[#1A1A1A] transition-colors">Request access</Link>
        </p>
      </div>
    </div>
  )
}
