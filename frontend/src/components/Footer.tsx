'use client'
import React from 'react'
import Link from 'next/link'
import { Linkedin, Twitter, Youtube, Instagram, Globe, ChevronDown } from 'lucide-react'

// Custom TikTok Icon since it might not be in older lucide-react versions
const TikTokIcon = ({ size = 20, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
)

export default function Footer() {
  return (
    <footer className="w-full bg-[#161616] text-white pt-24 pb-8 px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Headline */}
        <div className="mb-16">
          <h2 className="text-4xl md:text-[42px] font-serif italic text-white/90 leading-tight">
            Less structure,<br />
            more intelligence.
          </h2>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-8 lg:gap-4 mb-20 text-[14px]">
          {/* Product */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-white">Product</h3>
            <div className="flex flex-col gap-3 text-white/70">
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/features/webapp" className="hover:text-white transition-colors">Web app</Link>
              <Link href="/features/design" className="hover:text-white transition-colors">AI design</Link>
              <Link href="/features/slides" className="hover:text-white transition-colors">AI slides</Link>
              <Link href="/features" className="hover:text-white transition-colors">AI image generator</Link>
              <Link href="/features" className="hover:text-white transition-colors">AI music generator</Link>
              <Link href="/features/browser" className="hover:text-white transition-colors">Chatbolt browser operator</Link>
              <Link href="/features/research" className="hover:text-white transition-colors">Wide Research</Link>
              <Link href="/features/mail" className="hover:text-white transition-colors">Mail Chatbolt</Link>
              <Link href="/features" className="hover:text-white transition-colors">Slack integration</Link>
            </div>
          </div>

          {/* Resources */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-white">Resources</h3>
            <div className="flex flex-col gap-3 text-white/70">
              <Link href="/resources" className="hover:text-white transition-colors">Blog</Link>
              <Link href="/resources" className="hover:text-white transition-colors">Docs</Link>
              <Link href="/resources" className="hover:text-white transition-colors">Updates</Link>
              <Link href="/resources" className="hover:text-white transition-colors">Help center</Link>
              <Link href="/resources" className="hover:text-white transition-colors">Trust center</Link>
              <Link href="/resources" className="hover:text-white transition-colors">API</Link>
              <Link href="/pricing" className="hover:text-white transition-colors">Team plan</Link>
              <Link href="/business" className="hover:text-white transition-colors">Startups</Link>
              <Link href="/resources" className="hover:text-white transition-colors underline underline-offset-4">Playbook</Link>
              <Link href="/resources" className="hover:text-white transition-colors">Brand assets</Link>
            </div>
          </div>

          {/* Community */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-white">Community</h3>
            <div className="flex flex-col gap-3 text-white/70">
              <Link href="/events" className="hover:text-white transition-colors">Events</Link>
              <Link href="/community" className="hover:text-white transition-colors">Fellows</Link>
            </div>
          </div>

          {/* Compare */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-white">Compare</h3>
            <div className="flex flex-col gap-3 text-white/70">
              <Link href="/compare/chatgpt" className="hover:text-white transition-colors">VS ChatGPT</Link>
              <Link href="/compare/lovable" className="hover:text-white transition-colors">VS Lovable</Link>
              <Link href="/compare/replit" className="hover:text-white transition-colors">VS Replit</Link>
            </div>
          </div>

          {/* Download */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-white">Download</h3>
            <div className="flex flex-col gap-3 text-white/70">
              <Link href="/download" className="hover:text-white transition-colors">Mobile app</Link>
              <Link href="/download" className="hover:text-white transition-colors">Desktop app</Link>
              <Link href="/download" className="hover:text-white transition-colors">My Browser</Link>
            </div>
          </div>

          {/* Business */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-white">Business</h3>
            <div className="flex flex-col gap-3 text-white/70">
              <Link href="/pricing" className="hover:text-white transition-colors">Team plan</Link>
              <Link href="/features" className="hover:text-white transition-colors">SSO</Link>
              <Link href="/features" className="hover:text-white transition-colors">API</Link>
            </div>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-white">Company</h3>
            <div className="flex flex-col gap-3 text-white/70">
              <Link href="/about" className="hover:text-white transition-colors">About us</Link>
              <Link href="/careers" className="hover:text-white transition-colors">Careers</Link>
              <Link href="/business" className="hover:text-white transition-colors">For business</Link>
              <Link href="/media" className="hover:text-white transition-colors">For media</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of service</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy policy</Link>
            </div>
          </div>
        </div>

        {/* Footer Bottom Row 1: Socials & Language */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/10 pt-8 pb-4">
          {/* Social Icons */}
          <div className="flex items-center gap-5 text-white/80">
            <a href="#" className="hover:text-white transition-colors"><Linkedin size={20} /></a>
            <a href="#" className="hover:text-white transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="#" className="hover:text-white transition-colors"><Youtube size={22} /></a>
            <a href="#" className="hover:text-white transition-colors"><Instagram size={20} /></a>
            <a href="#" className="hover:text-white transition-colors"><TikTokIcon size={19} /></a>
          </div>

          {/* Language Selector */}
          <div className="mt-4 sm:mt-0 flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 text-white/90 text-sm hover:bg-white/5 cursor-pointer transition-colors">
            <Globe size={16} />
            <span>English</span>
            <ChevronDown size={16} />
          </div>
        </div>

        {/* Footer Bottom Row 2: Brand & Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 text-sm text-white/70">
          <div className="flex items-center gap-1.5 font-medium">
            <span>from</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
              <path d="M10.82 2.652a2.001 2.001 0 0 1 2.36 0l5.875 4.316a2 2 0 0 1 .74 2.278l-2.245 6.908a2 2 0 0 1-1.902 1.382H8.352a2 2 0 0 1-1.902-1.382l-2.245-6.908a2 2 0 0 1 .74-2.278l5.875-4.316Z" fill="currentColor"/>
            </svg>
            <span className="font-serif font-bold text-white tracking-tight">chatbolt</span>
          </div>
          <div className="mt-4 sm:mt-0">
            © {new Date().getFullYear()} Chatbolt
          </div>
        </div>
      </div>
    </footer>
  )
}
