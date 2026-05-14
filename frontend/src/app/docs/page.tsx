'use client'

export default function WhatIsChatbolt() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-12">
        <div className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.2em] mb-4">Getting Started</div>
        <h1 className="display-title text-4xl md:text-6xl text-[#1A1A1A] mb-6 tracking-tighter">What is Chatbolt?</h1>
        <p className="text-xl text-[#555555] leading-relaxed font-medium">
          Chatbolt is an AI customer support platform that lets you build, train, and deploy AI agents that know your business inside out. 
        </p>
      </div>

      <div className="space-y-16">
        <section>
          <p className="text-[#555555] leading-relaxed">
            Instead of hiring more support staff to answer the same questions over and over, you train a Chatbolt agent once on your business data — and it handles customer queries automatically, 24/7, across every channel.
          </p>
        </section>

        <section className="p-10 card border-black/5 bg-black/[0.01]">
          <h2 className="text-[#1A1A1A] text-2xl font-bold mb-8 tracking-tight">How it works</h2>
          <p className="text-[#555555] mb-8 leading-relaxed">Chatbolt uses a technique called Retrieval-Augmented Generation (RAG). Here's what that means in plain English:</p>
          <ol className="space-y-6 list-decimal pl-6 text-[#555555]">
            <li className="pl-4">You upload your business documents (PDFs, URLs, FAQs)</li>
            <li className="pl-4">Chatbolt breaks them into small chunks and creates a searchable knowledge base</li>
            <li className="pl-4">When a customer asks a question, Chatbolt finds the most relevant chunks from your knowledge base</li>
            <li className="pl-4">It passes those chunks to an AI model (NVIDIA Llama 3.1) along with the question</li>
            <li className="pl-4">The AI generates an accurate answer grounded in <strong>YOUR data</strong> — not hallucinated from the internet</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[#1A1A1A] text-2xl font-bold mb-6 tracking-tight">What Chatbolt is not</h2>
          <p className="text-[#555555] leading-relaxed">
            Chatbolt is not a general-purpose chatbot. It doesn't answer questions from general knowledge. It only answers based on what you've trained it on. This is intentional — it means your agent stays on-topic, accurate, and trustworthy.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            { t: 'Agent', d: 'An AI model configured for a specific purpose with its own knowledge base, persona, and settings.' },
            { t: 'Knowledge Base', d: 'The collection of documents, URLs, and text your agent learns from.' },
            { t: 'Chunk', d: 'A small piece of text (around 500 words) that your documents are split into for efficient retrieval.' },
            { t: 'Embedding', d: 'A mathematical representation of text that allows semantic similarity search.' },
            { t: 'Credit', d: 'One message credit = one AI response. Credits reset monthly with your plan.' },
            { t: 'Escalation', d: 'When the agent détermine it cannot confidently answer and hands off to a human.' }
          ].map(term => (
            <div key={term.t} className="p-6 border border-black/5 rounded-none">
              <h4 className="text-[#00DFB8] font-bold text-xs uppercase tracking-widest mb-2">{term.t}</h4>
              <p className="text-sm text-[#555555] leading-relaxed">{term.d}</p>
            </div>
          ))}
        </section>
      </div>
    </article>
  )
}

