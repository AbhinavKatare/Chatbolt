import type { Metadata } from 'next'
import './globals.css'
import Footer from '@/components/Footer'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Chatbolt — Customer Support Platform',
  description: 'Build and deploy support assistants trained on your business data. Handle customer queries automatically, 24/7. Trusted by 10,000+ businesses.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const analyticsId = process.env.NEXT_PUBLIC_ANALYTICS_ID

  return (
    <html lang="en">
      <head>
        {analyticsId && (
          <Script
            id="analytics-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){
                  // Initializing tracking placeholder with ID
                  w[l] = w[l] || [];
                  w[l].push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
                })(window,document,'script','dataLayer','${analyticsId}');
              `,
            }}
          />
        )}
      </head>
      <body className="antialiased bg-[#F9F9F9] text-[#1A1A1A] min-h-screen flex flex-col">
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
