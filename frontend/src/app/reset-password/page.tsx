'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <div className="min-h-screen bg-[#FDFDFB] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <Link href="/" className="w-10 h-10 bg-[#B8FF00] rounded-sm flex items-center justify-center no-underline">
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
              <path d="M3 9C3 5.686 5.686 3 9 3s6 2.686 6 6-2.686 6-6 6H3V9z" fill="#0A0A0A"/>
              <circle cx="9" cy="9" r="2" fill="#B8FF00"/>
            </svg>
          </Link>
        </div>

        <div className="card p-10 bg-[#FFFFFF]">
          {sent ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-[#B8FF00]/10 rounded-full flex items-center justify-center text-2xl mx-auto border border-[#B8FF00]/20">
                📧
              </div>
              <div>
                <h2 className="display-title text-2xl text-[#1A1A1A] mb-2">Check your inbox</h2>
                <p className="text-sm-muted">We've sent a recovery link to <b>{email}</b>. Please check your spam folder if you don't see it.</p>
              </div>
              <Link href="/login" className="btn btn-primary w-full py-4 no-underline hover:no-underline mt-4">Return to Login</Link>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="display-title text-2xl text-[#1A1A1A] mb-2">Reset Password</h2>
                <p className="text-sm-muted">Enter your email and we'll send you a link to reset your password.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-label block mb-2">Email Address</label>
                  <input 
                    type="email"
                    className="w-full bg-[#FDFDFB] border border-black/5 rounded-lg p-3 text-[#1A1A1A] focus:border-[#B8FF00]/40 outline-none" 
                    placeholder="name@company.com" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button onClick={() => setSent(true)} className="btn btn-primary w-full py-4">Send Reset Link →</button>
              <div className="text-center">
                <Link href="/login" className="text-xs text-[#444] hover:text-[#B8FF00] font-bold uppercase tracking-widest no-underline transition-colors">
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

