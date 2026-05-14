'use client'
import { useEffect, useRef } from 'react'

export default function Stats() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const items = ref.current?.querySelectorAll('.aos')
    if (!items) return
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.1 }
    )
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const stats = [
    { number: '10K+', label: 'Businesses worldwide' },
    { number: '98%', label: 'Resolution rate' },
    { number: '4.8', label: 'Average rating' },
    { number: '80+', label: 'Languages supported' },
  ]

  return (
    <section ref={ref} className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {stats.map((s, i) => (
            <div
              key={i}
              className={`aos aos-delay-${i + 1} text-center rounded-2xl p-6`}
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="font-display text-4xl md:text-5xl font-800 gradient-text mb-2"
                style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800 }}
              >
                {s.number}
              </div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Customer story */}
        <div
          className="aos rounded-3xl p-8 md:p-12 relative overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
          style={{ background: 'linear-gradient(135deg, rgba(184,255,0,0.08) 0%, rgba(184,255,0,0.02) 100%)', border: '1px solid rgba(184,255,0,0.15)' }}
        >
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(184,255,0,0.1) 0%, transparent 70%)' }} />

          <div className="relative z-10">
            <div className="flex justify-center mb-4">
              <span className="badge">Customer story</span>
            </div>
            <blockquote
              className="text-xl md:text-2xl text-[#1A1A1A] font-500 leading-snug mb-6"
              style={{ fontFamily: 'Syne, sans-serif', fontWeight: 500 }}
            >
              "Our growth no longer requires hiring more support staff. ChatAI handles 94% of queries automatically."
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-700 text-sm"
                style={{ background: '#B8FF00', color: '#0A0A0A' }}>JS</div>
              <div>
                <div className="text-sm text-[#1A1A1A] font-600">Johnny Sandoval</div>
                <div className="text-xs text-gray-500">CTO, Velo Commerce</div>
              </div>
            </div>
          </div>

          {/* Video/image placeholder */}
          <div className="relative rounded-2xl overflow-hidden aspect-video flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
              style={{ background: 'rgba(184,255,0,0.9)' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M6 4l10 6-10 6V4z" fill="#0A0A0A"/>
              </svg>
            </div>
            <div className="absolute bottom-4 left-4">
              <div className="text-sm text-[#1A1A1A] font-600" style={{ fontFamily: 'Syne, sans-serif' }}>Watch the story</div>
              <div className="text-xs text-gray-500">3 min</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
