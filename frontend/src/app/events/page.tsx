'use client'
import React, { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Ticket, Calendar, MapPin, Users, CheckCircle } from 'lucide-react'

export default function EventsPage() {
  const [registered, setRegistered] = useState(false)
  const [email, setEmail] = useState('')

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setRegistered(true)
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111111] font-sans antialiased flex flex-col justify-between selection:bg-black/10 relative overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pt-32 pb-24 space-y-16 z-10">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[#444]">
            <Ticket size={12} className="text-[#00E599]" /> Chatbolt Global Summit 2026
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#111111] tracking-tight font-medium">
            The Autonomous Workforce Keynote
          </h1>
          <p className="text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
            Join 10,000+ AI engineers, enterprise founders, and automation operators to explore the future of multi-agent orchestration.
          </p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 space-y-3 shadow-sm">
            <Calendar size={20} className="text-[#00E599]" />
            <h4 className="text-xs font-bold text-white uppercase tracking-tight">Date & Time</h4>
            <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
              October 12, 2026<br />9:00 AM — 5:00 PM PST
            </p>
          </div>

          <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 space-y-3 shadow-sm">
            <MapPin size={20} className="text-[#00E599]" />
            <h4 className="text-xs font-bold text-white uppercase tracking-tight">Location</h4>
            <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
              Moscone Center, SF<br />& Streaming Virtual Keynote
            </p>
          </div>

          <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 space-y-3 shadow-sm">
            <Users size={20} className="text-[#00E599]" />
            <h4 className="text-xs font-bold text-white uppercase tracking-tight">Ecosystem</h4>
            <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
              10,000+ Attendees<br />50+ AI Partner Exhibitors
            </p>
          </div>
        </div>

        {/* Showcase Speakers */}
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Keynote Speakers</h3>
            <p className="text-[10px] text-zinc-500 mt-1 font-semibold uppercase tracking-wider">Presenting cutting-edge AI orchestration paradigms</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-[#EAEAEA] p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-[#111111] shrink-0 font-serif">AK</div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-tight">Andrej Karpathy</h4>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed font-semibold">Ex-Tesla Autopilot / OpenAI Architect</p>
              </div>
            </div>

            <div className="bg-white border border-[#EAEAEA] p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-[#111111] shrink-0 font-serif">SD</div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-tight">Support Core Fleet</h4>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed font-semibold">Chatbolt OS Autonomous Personnel Evals</p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Registration Card */}
        <div className="bg-white border-2 border-black rounded-3xl p-8 max-w-xl mx-auto shadow-xl relative overflow-hidden">
          {registered ? (
            <div className="text-center space-y-4 animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-[#00E599]/10 border border-[#00E599]/20 rounded-full flex items-center justify-center text-3xl mx-auto text-[#00E599]">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-serif font-bold text-[#111111]">Reservation Secured!</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed font-semibold">
                We've reserved a global summit pass for <b>{email}</b>. A calendar invite with Moscone entry codes has been sent to your email.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-serif font-bold text-[#111111]">Register for Summit Pass</h3>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto mt-1 font-semibold">
                   Moscone Center passes are extremely limited. Secure yours for free.
                </p>
              </div>

              <form onSubmit={handleRegister} className="flex gap-2">
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="flex-1 bg-[#F9F9F9] border border-black/10 rounded-xl px-4 py-3.5 text-xs text-[#1A1A1A] outline-none focus:border-[#00E599]/40 font-semibold"
                  required
                />
                <button 
                  type="submit" 
                  className="px-6 py-3.5 bg-black text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-zinc-800 transition-colors shadow-md shrink-0 cursor-pointer"
                >
                  Get Ticket
                </button>
              </form>
            </div>
          )}
        </div>

      </main>

      <Footer />
    </div>
  )
}
