'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { api, saveSession } from '@/lib/api'

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      // 1. Sign up with Supabase
      const { data, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.name
          }
        }
      })
      
      if (authError) throw new Error(authError.message)
      if (!data.session) {
        setError('Signup successful! Please check your email to verify your account.')
        setLoading(false)
        return
      }
      
      // 2. Create the tenant record in our Postgres DB via our backend
      // We pass the token so the backend can verify the Supabase user
      const { tenant } = await api.auth.signup(form)
      saveSession(data.session.access_token, tenant)
      
      // Apply referral code if present
      if (typeof window !== 'undefined') {
        const refCode = localStorage.getItem('referral_code')
        if (refCode) {
          try {
            await api.referrals.apply(refCode)
            localStorage.removeItem('referral_code')
          } catch (refErr) {
            console.error('Failed to apply referral:', refErr)
          }
        }
      }

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

      <div className="w-full max-w-[420px] relative z-10 my-12">
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
          <h1 className="display-title text-4xl text-[#1A1A1A] mb-3 tracking-tighter">Scale your business</h1>
          <p className="text-[#555555] text-sm">Deploy your AI workforce in minutes</p>
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
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#555555] mb-2 block">Business Name</label>
              <input 
                className="w-full bg-[#FDFDFB] border border-black/10 px-4 py-3 text-[#1A1A1A] placeholder:text-[#555555]/50 focus:border-[#00DFB8]/50 focus:outline-none transition-colors" 
                placeholder="Acme Inc" 
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                required 
                minLength={2} 
              />
            </div>
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
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#555555] mb-2 block">Password</label>
              <input 
                className="w-full bg-[#FDFDFB] border border-black/10 px-4 py-3 text-[#1A1A1A] placeholder:text-[#555555]/50 focus:border-[#00DFB8]/50 focus:outline-none transition-colors" 
                type="password" 
                placeholder="Min. 8 characters" 
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
                required 
                minLength={8} 
              />
            </div>
            <button 
              className="w-full bg-[#00DFB8] text-[#FDFDFB] font-bold uppercase tracking-[0.2em] text-[10px] py-4 hover:bg-white transition-all duration-300 mt-2" 
              type="submit" 
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          
          <p className="text-center mt-6 text-xs text-[#555555]/60">
            Choose a plan in the next step.
          </p>
        </div>

        <p className="text-center mt-8 text-sm text-[#555555]">
          Already have an account?{' '}
          <Link href="/login" className="text-[#00DFB8] font-medium hover:text-[#1A1A1A] transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
