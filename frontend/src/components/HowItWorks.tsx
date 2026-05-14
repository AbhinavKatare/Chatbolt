'use client'

export default function HowItWorks() {
  const steps = [
    {
      id: '01',
      label: 'TRAIN',
      title: 'Feed the intelligence',
      body: 'Upload your business documents or paste your URL. Chatbolt reads everything and builds a deep understanding of your operations.'
    },
    {
      id: '02',
      label: 'CONFIG',
      title: 'Define the persona',
      body: 'Set your agents tone, instructions, and escalation rules. Test it live in our sandbox until its perfect.'
    },
    {
      id: '03',
      label: 'DEPLOY',
      title: 'Go live everywhere',
      body: 'Copy one line of code to your site or connect WhatsApp in two clicks. Your agent starts handling customers instantly.'
    }
  ]

  return (
    <section id="how-it-works" className="py-40 bg-[#FDFDFB] relative border-t border-black/5">
      <div className="container mx-auto px-6">
        <div className="mb-32">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 border border-[#00DFB8]/20 mb-8">
            <span className="text-[10px] font-bold text-[#00DFB8] uppercase tracking-[0.3em]">The Process</span>
          </div>
          <h2 className="display-title text-4xl md:text-7xl text-[#1A1A1A] mb-10 tracking-tighter leading-none">
            From zero to <span className="text-[#00DFB8]">fully automated</span> <br /> in 30 minutes.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-24">
          {steps.map((step, i) => (
            <div key={i} className="relative group">
              <div className="text-[120px] font-black text-[#1A1A1A]/[0.02] absolute -top-16 -left-8 group-hover:text-[#00DFB8]/5 transition-colors duration-700">{step.id}</div>
              <div className="relative">
                <div className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] mb-6">PHASE {step.id} — {step.label}</div>
                <h3 className="text-3xl font-bold text-[#1A1A1A] mb-6 tracking-tight">{step.title}</h3>
                <p className="text-[#555555] text-lg font-medium leading-relaxed">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

