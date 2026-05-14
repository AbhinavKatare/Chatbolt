'use client'

export default function TrustedBy() {
  const companies = [
    'Razorpay', 'CRED', 'Zomato', 'Swiggy', 'Meesho', 'Zepto', 
    'Groww', 'Nykaa', 'boAt', 'Mamaearth', 'Lenskart', 
    'BrowserStack', 'Freshworks', 'Chargebee', 'Postman'
  ]

  return (
    <section className="py-24 bg-[#FDFDFB] border-y border-black/5 overflow-hidden">
      <div className="container mx-auto px-6 mb-16 text-center">
        <h3 className="text-[10px] font-bold text-[#444] uppercase tracking-[0.4em]">
          Powering the next generation of Indian startups
        </h3>
      </div>
      
      <div className="relative flex overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap gap-24 py-4 items-center">
          {[...companies, ...companies].map((name, i) => (
            <span key={i} className="text-3xl md:text-5xl font-bold text-[#555555]/10 hover:text-[#00DFB8] transition-all duration-500 cursor-default select-none display-title">
              {name}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 50s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  )
}

