'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'

const navigation = [
  {
    title: 'Getting Started',
    links: [
      { name: 'What is Chatbolt?', href: '/docs' },
      { name: 'Quick Start (5 minutes)', href: '/docs/quick-start' },
      { name: 'Core Concepts', href: '/docs/concepts' },
      { name: 'Your first agent', href: '/docs/first-agent' },
    ],
  },
  {
    title: 'Building Agents',
    links: [
      { name: 'Create an agent', href: '/docs/create-agent' },
      { name: 'Writing a system prompt', href: '/docs/prompts' },
      { name: 'Training on documents', href: '/docs/training-docs' },
      { name: 'Training on URLs', href: '/docs/training-urls' },
    ],
  },
  {
    title: 'API Reference',
    links: [
      { name: 'Authentication', href: '/docs/api-auth' },
      { name: 'Chat API (Streaming)', href: '/docs/api-chat' },
    ],
  },
]

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="bg-[#FDFDFB] min-h-screen">
      <Navbar />
      <div className="container mx-auto px-6 pt-32 flex gap-12">
        {/* Sidebar */}
        <aside className="w-64 hidden lg:block sticky top-32 h-[calc(100vh-8rem)] overflow-y-auto pr-8 border-r border-black/5">
          <nav className="space-y-12 pb-12">
            {navigation.map((section) => (
              <div key={section.title}>
                <h5 className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] mb-6">{section.title}</h5>
                <ul className="space-y-4 list-none p-0">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link 
                        href={link.href}
                        className={`text-sm no-underline transition-colors block ${pathname === link.href ? 'text-[#00DFB8] font-bold' : 'text-[#555555] hover:text-[#1A1A1A]'}`}
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-3xl pb-32">
          {children}
        </main>
      </div>
    </div>
  )
}

