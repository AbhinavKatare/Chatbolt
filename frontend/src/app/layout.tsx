import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chatbolt — AI Customer Support Platform',
  description: 'Build and deploy AI support agents trained on your business data. Handle customer queries automatically, 24/7. Trusted by 10,000+ businesses.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.03]" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }} />
        <main>{children}</main>
      </body>
    </html>
  )
}
