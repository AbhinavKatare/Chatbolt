'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menuItems = [
  { name: 'Overview', href: '/dashboard', icon: '📊' },
  { name: 'Agents', href: '/dashboard/agents', icon: '🤖' },
  { name: 'Autopilot', href: '/dashboard/autopilot', icon: '🚀' },
  { name: 'Knowledge', href: '/dashboard/knowledge', icon: '📚' },
  { name: 'Analytics', href: '/dashboard/analytics', icon: '📈' },
  { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-[#FFFFFF] border-r border-black/5 flex flex-col sticky top-0 h-screen">
      <div className="p-8 border-b border-black/5 mb-8">
        <Link href="/" className="flex items-center gap-3 group no-underline">
          <div className="w-8 h-8 bg-[#00DFB8] rounded-none flex items-center justify-center">
             <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M4 10C4 6.686 6.686 4 10 4s6 2.686 6 6-2.686 6-6 6H4V10z" fill="#FDFDFB"/>
            </svg>
          </div>
          <span className="display-title text-xl text-[#1A1A1A] tracking-tighter uppercase">Chatbolt</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-4 px-4 py-3 rounded-none text-xs font-bold uppercase tracking-widest transition-all ${pathname === item.href ? 'bg-[#00DFB8] text-[#FDFDFB]' : 'text-[#555555] hover:bg-black/5 hover:text-[#1A1A1A]'}`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="p-6 border-t border-black/5">
        <div className="flex items-center gap-4 p-4 bg-black/[0.02] border border-black/5 rounded-none">
          <div className="w-10 h-10 rounded-none bg-gradient-to-br from-[#00DFB8]/20 to-transparent flex items-center justify-center text-[#1A1A1A] font-bold">
            JD
          </div>
          <div className="overflow-hidden">
            <div className="text-[10px] font-bold text-[#1A1A1A] uppercase tracking-widest truncate">John Doe</div>
            <div className="text-[9px] text-[#444] font-bold uppercase tracking-widest truncate">Hobby Plan</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

