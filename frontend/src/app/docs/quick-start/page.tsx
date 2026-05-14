'use client'

export default function QuickStart() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-12">
        <div className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.2em] mb-4">Getting Started</div>
        <h1 className="display-title text-4xl md:text-6xl text-[#1A1A1A] mb-6 tracking-tighter">Quick Start</h1>
        <p className="text-xl text-[#555555] leading-relaxed font-medium">
          Get your first Chatbolt agent live in under 5 minutes.
        </p>
      </div>

      <div className="space-y-12">
        <div className="space-y-16">
          {[
            {
              step: 'Step 1',
              title: 'Create your account',
              body: 'Go to chatbolt.io/signup. Enter your business name, email, and password. You get 500 free credits immediately — no credit card needed.'
            },
            {
              step: 'Step 2',
              title: 'Create your first agent',
              body: 'Click "New Agent" in the dashboard. Give it a name (e.g. "Support Bot"), choose a tone (professional, friendly, or casual), and write a short description of your business. Click Create.'
            },
            {
              step: 'Step 3',
              title: 'Upload your knowledge base',
              body: 'In the Docs tab, upload a PDF of your product manual, FAQ doc, or paste your website URL. Chatbolt processes it automatically — you\'ll see it go from "Processing" to "Ready" in about 30–60 seconds.'
            },
            {
              step: 'Step 4',
              title: 'Test your agent',
              body: 'In the Config tab, use the live preview chat to test your agent. Ask it questions your customers typically ask. If the answers are off, add more documents or refine your system prompt.'
            },
            {
              step: 'Step 5',
              title: 'Deploy',
              body: 'Go to the Embed tab. Copy the one-line script tag. Paste it just before the closing </body> tag on your website. Your agent is live.'
            }
          ].map((s, i) => (
            <div key={i} className="flex gap-8 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-none bg-black/5 border border-black/10 flex items-center justify-center text-sm font-black text-[#00DFB8] group-hover:border-[#00DFB8]/40 transition-colors">
                0{i + 1}
              </div>
              <div>
                <h3 className="text-[#1A1A1A] text-2xl font-bold mb-4 tracking-tight">{s.title}</h3>
                <p className="text-[#555555] leading-relaxed mb-6">{s.body}</p>
                {i === 4 && (
                  <div className="bg-[#FFFFFF] border border-black/5 rounded-none p-6 font-mono text-xs text-[#00DFB8]">
                    &lt;script <br />
                    &nbsp;&nbsp;src="https://chatbolt.io/widget.js" <br />
                    &nbsp;&nbsp;data-agent-id="YOUR_AGENT_ID" <br />
                    &nbsp;&nbsp;defer <br />
                    &gt;&lt;/script&gt;
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

