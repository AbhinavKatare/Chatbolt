'use client'

export default function CoreConcepts() {
  const concepts = [
    {
      title: 'Agent',
      body: 'An AI model configured for a specific purpose with its own knowledge base, persona, and settings.'
    },
    {
      title: 'Knowledge Base',
      body: 'The collection of documents, URLs, and text your agent learns from.'
    },
    {
      title: 'Chunk',
      body: 'A small piece of text (around 500 words) that your documents are split into for efficient retrieval.'
    },
    {
      title: 'Embedding',
      body: 'A mathematical representation of text that allows semantic similarity search — finding chunks that mean the same thing as the customer\'s question, even if the exact words differ.'
    },
    {
      title: 'Credit',
      body: 'One message credit = one AI response. Credits reset monthly with your plan.'
    },
    {
      title: 'Escalation',
      body: 'When the agent détermine it cannot confidently answer and hands off to a human agent.'
    }
  ]

  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-12">
        <div className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.2em] mb-4">Getting Started</div>
        <h1 className="display-title text-4xl md:text-6xl text-[#1A1A1A] mb-6 tracking-tighter">Core Concepts</h1>
        <p className="text-xl text-[#555555] leading-relaxed font-medium">
          Understand the building blocks of the Chatbolt platform.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {concepts.map((c, i) => (
          <div key={i} className="flex gap-8 group">
            <div className="flex-shrink-0 w-1 bg-black/5 group-hover:bg-[#00DFB8]/40 transition-colors" />
            <div>
              <h3 className="text-[#1A1A1A] text-2xl font-bold mb-4 tracking-tight">{c.title}</h3>
              <p className="text-[#555555] leading-relaxed max-w-2xl">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

