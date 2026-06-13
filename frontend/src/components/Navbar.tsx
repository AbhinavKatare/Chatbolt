'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Globe, Smartphone, Wand2, FileText, Chrome, Radar, Mail, Puzzle,
  PieChart, User, LayoutGrid, Landmark, LineChart,
  Newspaper, BookOpen, List, Compass, Shield, ChevronDown, Zap
} from 'lucide-react'
import { getSession } from '@/lib/api'

export default function Navbar() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    getSession().then(setSession).catch(() => {})
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const featuresDropdown = [
    { icon: Globe, title: 'Web app', desc: 'Build full-stack, AI-powered sites', href: '/features/webapp' },
    { icon: Smartphone, title: 'Mobile app', desc: 'Build native iOS & Android apps', href: '/features/mobileapp' },
    { icon: Wand2, title: 'AI design', desc: 'Automates the entire design journey', href: '/features/design' },
    { icon: FileText, title: 'AI slides', desc: 'Use Nano Banana Pro to create slides', href: '/features/slides' },
    { icon: Chrome, title: 'Chatbolt browser operator', desc: 'Lend a tab to Chatbolt', href: '/features/browser' },
    { icon: Radar, title: 'Wide Research', desc: 'Parallel research at scale', href: '/features/research' },
    { icon: Mail, title: 'Mail Chatbolt', desc: 'Turn any email into action', href: '/features/mail' },
    { icon: Puzzle, title: 'Agent Skills', desc: 'Automate your expertise', href: '/features/skills' }
  ]

  const solutionsDropdown = [
    { icon: PieChart, title: 'Marketing', desc: 'From creatives to conversions', href: '/solutions/marketing' },
    { icon: User, title: 'Sales', desc: 'From leads to deals', href: '/solutions/sales' },
    { icon: LayoutGrid, title: 'Product', desc: 'From ideas to launch', href: '/solutions/product' },
    { icon: Landmark, title: 'Finance', desc: 'From numbers to strategy', href: '/solutions/finance' },
    { icon: LineChart, title: 'Analysts', desc: 'From data to decisions', href: '/solutions/analytics' }
  ]

  const resourcesDropdown = [
    { icon: BookOpen, title: 'Product Docs', desc: 'Learn about Chatbolt and get started', href: '/docs' },
    { icon: Newspaper, title: 'Resources & updates', desc: 'Discover use cases and updates', href: '/resources' },
    { icon: Shield, title: 'Trust Center', desc: 'Security, AES-256 and compliance', href: '/legal' }
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#F9F9F9]/90 backdrop-blur-md py-4 border-b border-[#EAEAEA]/40' : 'py-6 bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 no-underline shrink-0 select-none">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#333333]">
            <path d="M10.82 2.652a2.001 2.001 0 0 1 2.36 0l5.875 4.316a2 2 0 0 1 .74 2.278l-2.245 6.908a2 2 0 0 1-1.902 1.382H8.352a2 2 0 0 1-1.902-1.382l-2.245-6.908a2 2 0 0 1 .74-2.278l5.875-4.316Z" fill="currentColor"/>
          </svg>
          <span className="text-[22px] font-serif font-bold tracking-tight text-[#222222]">
            chatbolt
          </span>
        </Link>

        {/* Desktop Navigation Link Toggles */}
        <div className="hidden md:flex items-center gap-1">
          {/* Features Dropdown */}
          <div className="relative group">
            <button className="px-4 py-2 rounded-full text-[14px] font-semibold text-[#444444] group-hover:bg-[#F2F2F2] group-hover:text-[#111111] transition-all">
              Features
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-white border border-[#EAEAEA] rounded-3xl p-2 w-[340px] shadow-[0_12px_40px_rgba(0,0,0,0.08)] flex flex-col gap-0.5">
                {featuresDropdown.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    className="flex items-start text-left gap-3 p-3 hover:bg-[#F7F7F7] rounded-xl cursor-pointer transition-colors group/item no-underline w-full"
                  >
                    <div className="w-8 h-8 rounded-md border border-[#EAEAEA] bg-[#FDFDFD] flex items-center justify-center shrink-0 shadow-sm group-hover/item:border-[#D5D5D5] transition-colors">
                      <item.icon size={16} className="text-[#333333]" strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-[#111111]">{item.title}</span>
                      <span className="text-[12px] text-[#888888] leading-tight mt-[1px]">{item.desc}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Solutions Dropdown */}
          <div className="relative group">
            <button className="px-4 py-2 rounded-full text-[14px] font-semibold text-[#444444] group-hover:bg-[#F2F2F2] group-hover:text-[#111111] transition-all">
              Solutions
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-white border border-[#EAEAEA] rounded-3xl p-2 w-[340px] shadow-[0_12px_40px_rgba(0,0,0,0.08)] flex flex-col gap-0.5">
                {solutionsDropdown.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    className="flex items-start text-left gap-3 p-3 hover:bg-[#F7F7F7] rounded-xl cursor-pointer transition-colors group/item no-underline w-full"
                  >
                    <div className="w-8 h-8 rounded-md border border-[#EAEAEA] bg-[#FDFDFD] flex items-center justify-center shrink-0 shadow-sm group-hover/item:border-[#D5D5D5] transition-colors">
                      <item.icon size={16} className="text-[#333333]" strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-[#111111]">{item.title}</span>
                      <span className="text-[12px] text-[#888888] leading-tight mt-[1px]">{item.desc}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Resources Dropdown */}
          <div className="relative group">
            <button className="px-4 py-2 rounded-full text-[14px] font-semibold text-[#444444] group-hover:bg-[#F2F2F2] group-hover:text-[#111111] transition-all">
              Resources
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-white border border-[#EAEAEA] rounded-3xl p-2 w-[340px] shadow-[0_12px_40px_rgba(0,0,0,0.08)] flex flex-col gap-0.5">
                {resourcesDropdown.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    className="flex items-start text-left gap-3 p-3 hover:bg-[#F7F7F7] rounded-xl cursor-pointer transition-colors group/item no-underline w-full"
                  >
                    <div className="w-8 h-8 rounded-md border border-[#EAEAEA] bg-[#FDFDFD] flex items-center justify-center shrink-0 shadow-sm group-hover/item:border-[#D5D5D5] transition-colors">
                      <item.icon size={16} className="text-[#333333]" strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-[#111111]">{item.title}</span>
                      <span className="text-[12px] text-[#888888] leading-tight mt-[1px]">{item.desc}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link href="/events" className="px-4 py-2 rounded-full text-[14px] font-semibold text-[#444444] hover:bg-[#F2F2F2] hover:text-[#111111] transition-all no-underline">
            Events
          </Link>
          <Link href="/business" className="px-4 py-2 rounded-full text-[14px] font-semibold text-[#444444] hover:bg-[#F2F2F2] hover:text-[#111111] transition-all no-underline">
            Business
          </Link>
          <Link href="/pricing" className="px-4 py-2 rounded-full text-[14px] font-semibold text-[#444444] hover:bg-[#F2F2F2] hover:text-[#111111] transition-all no-underline">
            Pricing
          </Link>
        </div>

        {/* Right side CTA actions */}
        <div className="flex items-center gap-3 shrink-0">
          {session ? (
            <Link 
              href="/dashboard"
              className="px-6 py-2.5 bg-[#1A1A1A] text-white text-[13px] font-bold uppercase tracking-wider rounded-xl hover:bg-black transition-all no-underline shadow-md"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link 
                href="/login"
                className="px-5 py-2 bg-[#1A1A1A] text-white text-[14px] font-semibold rounded-xl hover:bg-black transition-colors no-underline shadow-sm"
              >
                Sign in
              </Link>
              <Link 
                href="/signup"
                className="px-5 py-2 bg-white border border-[#EAEAEA] text-[#1A1A1A] text-[14px] font-semibold rounded-xl hover:bg-[#F5F5F5] transition-colors no-underline shadow-sm"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
