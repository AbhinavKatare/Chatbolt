'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getSession } from '@/lib/api'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [session, setSession] = useState<any>(null)
  const pathname = usePathname()

  useEffect(() => {
    getSession().then(setSession)
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'Features', href: '/features' },
    { name: 'How it works', href: '/how-it-works' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Solutions', href: '/solutions' },
    { name: 'Docs', href: '/docs' },
    { name: 'Blog', href: '/blog' },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${scrolled ? 'bg-[#FDFDFB]/90 backdrop-blur-md py-4 border-b border-black/5' : 'py-8'}`}>
      <div className="container mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group no-underline">
          <div className="w-9 h-9 bg-[#00DFB8] rounded-none flex items-center justify-center transition-transform group-hover:scale-105">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10C4 6.686 6.686 4 10 4s6 2.686 6 6-2.686 6-6 6H4V10z" fill="#FDFDFB"/>
              <rect x="9" y="9" width="2" height="2" fill="#00DFB8"/>
            </svg>
          </div>
          <span className="display-title text-2xl text-[#1A1A1A] tracking-tighter uppercase">Chatbolt</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-10">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href} 
              className={`text-[11px] font-bold uppercase tracking-[0.2em] no-underline hover:text-[#1A1A1A] transition-colors ${pathname === link.href ? 'text-[#00DFB8]' : 'text-[#555555]'}`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Auth CTAs */}
        <div className="flex items-center gap-6">
          {session ? (
            <Link href="/dashboard" className="btn btn-primary px-8 no-underline hover:no-underline">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block text-[11px] font-bold uppercase tracking-[0.3em] text-[#555555] no-underline hover:text-[#1A1A1A] transition-colors">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary px-8 no-underline hover:no-underline shadow-xl shadow-black/20">
                Start building
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

