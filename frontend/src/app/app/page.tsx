'use client'
import React, { useState } from 'react'
import AppHeader from '@/components/AppHeader'
import { 
  Plus, Link as LinkIcon, Monitor, Mic, ArrowUp, 
  FileText, Globe, Palette, MoreHorizontal,
  Video, Code, Clock, Search, Table, BarChart, Music, MessageSquare, BookOpen,
  ChevronDown, Import, ArrowUpRight, Zap, X
} from 'lucide-react'

type Mode = 'none' | 'slides' | 'website' | 'design' | 'video' | 'apps' | 'spreadsheet'

export default function AppDashboard() {
  const [activeMode, setActiveMode] = useState<Mode>('none')
  const [prompt, setPrompt] = useState('hey how you can help me')
  const [showMore, setShowMore] = useState(false)
  const [activeWebsiteType, setActiveWebsiteType] = useState('Dashboard')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Handlers for switching modes
  const handleModeSelect = (mode: Mode) => {
    setActiveMode(mode)
    setShowMore(false)
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <AppHeader />

      <main className="flex-1 flex flex-col items-center pt-[10vh] px-6 max-w-4xl mx-auto w-full relative">
        <input type="file" ref={fileInputRef} className="hidden" />
        {/* Main Title */}
        <h1 className="text-4xl md:text-[52px] font-serif font-medium text-white/90 mb-10 tracking-tight">
          What can I do for you?
        </h1>

        {/* Input Area */}
        <div className="w-full bg-[#1C1C1C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-4 shadow-lg mb-6 transition-all focus-within:border-white/20">
          
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={activeMode === 'spreadsheet' ? 'Upload a spreadsheet to analyze or start one from scratch' : 'Describe your task...'}
            className="w-full h-16 bg-transparent text-[15px] text-white/90 placeholder-white/40 resize-none outline-none p-2"
          />

          <div className="flex items-center justify-between px-2 pt-2">
            
            {/* Left Controls & Active Mode Pills */}
            <div className="flex items-center gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white">
                <Plus size={18} />
              </button>
              <button onClick={() => { const url = window.prompt('Enter link URL:'); if(url) setPrompt(prev => prev + ' ' + url); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white">
                <LinkIcon size={16} />
              </button>
              
              {/* Dynamic Pills based on selected mode */}
              {activeMode === 'slides' && (
                <>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1D4ED8]/20 border border-[#1D4ED8]/30 text-[#60A5FA] text-[12px] font-medium">
                    <button onClick={() => handleModeSelect('none')} className="hover:text-white transition-colors"><X size={14} /></button>
                    <span>Slides</span>
                  </div>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-[12px] font-medium">
                    <Zap size={14} />
                    <span>Professional</span>
                  </button>
                </>
              )}
              {activeMode === 'website' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1D4ED8]/20 border border-[#1D4ED8]/30 text-[#60A5FA] text-[12px] font-medium">
                  <button onClick={() => handleModeSelect('none')} className="hover:text-white transition-colors"><X size={14} /></button>
                  <span>Website</span>
                </div>
              )}
              {activeMode === 'design' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1D4ED8]/20 border border-[#1D4ED8]/30 text-[#60A5FA] text-[12px] font-medium">
                  <button onClick={() => handleModeSelect('none')} className="hover:text-white transition-colors"><X size={14} /></button>
                  <Palette size={14} />
                  <span>Design</span>
                </div>
              )}
              {activeMode === 'video' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1D4ED8]/20 border border-[#1D4ED8]/30 text-[#60A5FA] text-[12px] font-medium">
                  <button onClick={() => handleModeSelect('none')} className="hover:text-white transition-colors"><X size={14} /></button>
                  <Video size={14} />
                  <span>Video</span>
                </div>
              )}
              {activeMode === 'apps' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1D4ED8]/20 border border-[#1D4ED8]/30 text-[#60A5FA] text-[12px] font-medium">
                  <button onClick={() => handleModeSelect('none')} className="hover:text-white transition-colors"><X size={14} /></button>
                  <Code size={14} />
                  <span>Develop apps</span>
                </div>
              )}
              {activeMode === 'spreadsheet' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1D4ED8]/20 border border-[#1D4ED8]/30 text-[#60A5FA] text-[12px] font-medium">
                  <button onClick={() => handleModeSelect('none')} className="hover:text-white transition-colors"><X size={14} /></button>
                  <Table size={14} />
                  <span>Spreadsheet</span>
                </div>
              )}
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-3">
              <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white">
                <Mic size={18} />
              </button>
              <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 transition-all">
                <ArrowUp size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Content Below Input */}
        <div className="w-full relative">
          
          {/* MODE: NONE (Default) */}
          {activeMode === 'none' && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <div className="flex flex-wrap justify-center gap-3 mb-16 relative">
                <button onClick={() => handleModeSelect('slides')} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 text-[13px] font-medium text-white/70 transition-all">
                  <FileText size={15} /> Create slides
                </button>
                <button onClick={() => handleModeSelect('website')} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 text-[13px] font-medium text-white/70 transition-all">
                  <Globe size={15} /> Build website
                </button>
                <button onClick={() => handleModeSelect('design')} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 text-[13px] font-medium text-white/70 transition-all">
                  <Palette size={15} /> Design
                </button>
                <div className="relative">
                  <button onClick={() => setShowMore(!showMore)} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 text-[13px] font-medium text-white/70 transition-all">
                    More
                  </button>
                  
                  {/* More Dropdown */}
                  {showMore && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-[#1F1F1F] border border-white/10 rounded-2xl p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => handleModeSelect('video')} className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/5 hover:text-white rounded-xl transition-colors"><Video size={16}/> Video</button>
                        <button onClick={() => handleModeSelect('apps')} className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/5 hover:text-white rounded-xl transition-colors"><Code size={16}/> Develop apps</button>
                        <button className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/5 hover:text-white rounded-xl transition-colors"><Clock size={16}/> Schedule tasks</button>
                        <button className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/5 hover:text-white rounded-xl transition-colors"><Search size={16}/> Wide Research</button>
                        <button onClick={() => handleModeSelect('spreadsheet')} className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/5 hover:text-white rounded-xl transition-colors"><Table size={16}/> Spreadsheet</button>
                        <button className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/5 hover:text-white rounded-xl transition-colors"><BarChart size={16}/> Visualization</button>
                        <button className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/5 hover:text-white rounded-xl transition-colors"><Music size={16}/> Audio</button>
                        <button className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/5 hover:text-white rounded-xl transition-colors"><MessageSquare size={16}/> Chat mode</button>
                        <button className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/5 hover:text-white rounded-xl transition-colors"><BookOpen size={16}/> Playbook</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Banner */}
              <div className="w-[600px] h-28 bg-[#1F1F1F] border border-white/5 rounded-[20px] flex items-center justify-between px-8 relative overflow-hidden">
                <div className="flex flex-col gap-1 z-10">
                  <h3 className="font-semibold text-white/90 text-[15px]">Customize your AI agent for your business</h3>
                  <p className="text-[13px] text-white/50">A distinct identity that grows with your business.</p>
                </div>
                <div className="z-10 bg-[#2A2A2A] p-3 rounded-xl border border-white/10 shadow-lg relative">
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#1F1F1F]"><MessageSquare size={12} className="text-white"/></div>
                  <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-[#1F1F1F]"><Music size={12} className="text-white"/></div>
                  <div className="w-10 h-1 bg-white/20 rounded-full mb-1.5" />
                  <div className="w-6 h-1 bg-white/10 rounded-full" />
                </div>
                {/* Decorative background gradient */}
                <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-white/5 to-transparent z-0 pointer-events-none" />
              </div>
            </div>
          )}

          {/* MODE: SLIDES */}
          {activeMode === 'slides' && (
            <div className="w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4">
              
              {/* Sample Prompts */}
              <div>
                <h3 className="text-[13px] font-semibold text-white/90 mb-3">Sample prompts</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    "Automate weekly team status reporting",
                    "Research market opportunity for product launch",
                    "Build quarterly sales performance dashboard",
                    "Create strategic business review presentation"
                  ].map((text, i) => (
                    <button key={i} className="bg-[#1C1C1C] hover:bg-[#242424] border border-white/5 hover:border-white/10 transition-all rounded-2xl p-4 text-left flex flex-col justify-between h-28 group">
                      <p className="text-[13px] text-white/70 leading-relaxed">{text}</p>
                      <div className="self-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowUpRight size={16} className="text-white/40" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Templates */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-white/90">Choose a template</h3>
                  <button className="flex items-center gap-2 text-[12px] bg-[#1C1C1C] border border-white/10 px-3 py-1.5 rounded-lg text-white/70 hover:text-white transition-colors">
                    <Monitor size={14} /> 8 - 12 <ChevronDown size={14} />
                  </button>
                </div>
                
                <div className="grid grid-cols-4 gap-3">
                  {/* Import Card */}
                  <button onClick={() => fileInputRef.current?.click()} className="bg-[#1C1C1C] hover:bg-[#242424] border border-white/5 hover:border-white/10 border-dashed transition-all rounded-2xl aspect-[4/3] flex flex-col items-center justify-center gap-3">
                    <Import size={24} className="text-white/40" />
                    <span className="text-[13px] text-white/60 font-medium">Import template</span>
                  </button>
                  {/* Mock Template Cards */}
                  <div className="bg-[#EAEAEA] rounded-2xl aspect-[4/3] overflow-hidden border border-white/5 p-4 flex items-center justify-center">
                     <div className="text-black text-center font-serif text-[12px] font-bold">HOW TO BE ALONE IN A CROWDED CITY</div>
                  </div>
                  <div className="bg-[#2A2522] rounded-2xl aspect-[4/3] overflow-hidden border border-white/5 p-4 flex items-center justify-center">
                     <div className="text-[#D4C3A3] text-center font-serif text-[16px] font-bold">The Business of Independent Magazines</div>
                  </div>
                  <div className="bg-[#114065] rounded-2xl aspect-[4/3] overflow-hidden border border-white/5 p-4 flex items-center justify-center">
                     <div className="text-white text-center font-sans text-[12px] font-bold tracking-tight">Industrial Design Lessons from the Original iMac</div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* MODE: WEBSITE */}
          {activeMode === 'website' && (
            <div className="w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4">
              
              {/* What would you like to build */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-white/90">What would you like to build?</h3>
                  <div className="flex items-center gap-4 text-[12px] text-white/60">
                    <button onClick={() => window.prompt('Enter website URL for reference:')} className="flex items-center gap-1.5 hover:text-white transition-colors"><LinkIcon size={12}/> Add website reference</button>
                    <button onClick={() => window.prompt('Enter Figma file URL:')} className="flex items-center gap-1.5 hover:text-white transition-colors"><Palette size={12} className="text-[#F24E1E]"/> Import from Figma</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  <button onClick={() => setActiveWebsiteType('Landing Page')} className={`shrink-0 px-4 py-2 border rounded-xl text-[13px] transition-colors flex items-center gap-2 ${activeWebsiteType === 'Landing Page' ? 'bg-[#1D4ED8]/20 border-[#1D4ED8]/50 text-[#60A5FA] font-medium' : 'bg-[#1C1C1C] hover:bg-[#242424] border-white/5 text-white/80'}`}>
                    <Globe size={14} className={activeWebsiteType === 'Landing Page' ? '' : 'text-white/40'}/> Landing Page
                  </button>
                  <button onClick={() => setActiveWebsiteType('Dashboard')} className={`shrink-0 px-4 py-2 border rounded-xl text-[13px] transition-colors flex items-center gap-2 ${activeWebsiteType === 'Dashboard' ? 'bg-[#1D4ED8]/20 border-[#1D4ED8]/50 text-[#60A5FA] font-medium' : 'bg-[#1C1C1C] hover:bg-[#242424] border-white/5 text-white/80'}`}>
                    <BarChart size={14} className={activeWebsiteType === 'Dashboard' ? '' : 'text-white/40'} /> Dashboard
                  </button>
                  <button onClick={() => setActiveWebsiteType('Portfolio')} className={`shrink-0 px-4 py-2 border rounded-xl text-[13px] transition-colors flex items-center gap-2 ${activeWebsiteType === 'Portfolio' ? 'bg-[#1D4ED8]/20 border-[#1D4ED8]/50 text-[#60A5FA] font-medium' : 'bg-[#1C1C1C] hover:bg-[#242424] border-white/5 text-white/80'}`}>
                    <Table size={14} className={activeWebsiteType === 'Portfolio' ? '' : 'text-white/40'}/> Portfolio
                  </button>
                  <button onClick={() => setActiveWebsiteType('Corporate')} className={`shrink-0 px-4 py-2 border rounded-xl text-[13px] transition-colors flex items-center gap-2 ${activeWebsiteType === 'Corporate' ? 'bg-[#1D4ED8]/20 border-[#1D4ED8]/50 text-[#60A5FA] font-medium' : 'bg-[#1C1C1C] hover:bg-[#242424] border-white/5 text-white/80'}`}>
                    <Monitor size={14} className={activeWebsiteType === 'Corporate' ? '' : 'text-white/40'}/> Corporate
                  </button>
                  <button onClick={() => setActiveWebsiteType('SaaS')} className={`shrink-0 px-4 py-2 border rounded-xl text-[13px] transition-colors flex items-center gap-2 ${activeWebsiteType === 'SaaS' ? 'bg-[#1D4ED8]/20 border-[#1D4ED8]/50 text-[#60A5FA] font-medium' : 'bg-[#1C1C1C] hover:bg-[#242424] border-white/5 text-white/80'}`}>
                    <Zap size={14} className={activeWebsiteType === 'SaaS' ? '' : 'text-white/40'}/> SaaS
                  </button>
                  <button onClick={() => setActiveWebsiteType('Link-in-bio')} className={`shrink-0 px-4 py-2 border rounded-xl text-[13px] transition-colors flex items-center gap-2 ${activeWebsiteType === 'Link-in-bio' ? 'bg-[#1D4ED8]/20 border-[#1D4ED8]/50 text-[#60A5FA] font-medium' : 'bg-[#1C1C1C] hover:bg-[#242424] border-white/5 text-white/80'}`}>
                    <LinkIcon size={14} className={activeWebsiteType === 'Link-in-bio' ? '' : 'text-white/40'}/> Link-in-bio <ChevronDown size={14}/>
                  </button>
                </div>
              </div>

              {/* Explore ideas */}
              <div>
                <h3 className="text-[13px] font-semibold text-white/90 mb-3">Explore ideas</h3>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2.5 bg-[#1C1C1C] hover:bg-[#242424] border border-white/5 rounded-xl text-[13px] text-white/70 transition-colors flex items-center gap-2 group">
                    Analytics dashboard <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button className="px-4 py-2.5 bg-[#1C1C1C] hover:bg-[#242424] border border-white/5 rounded-xl text-[13px] text-white/70 transition-colors flex items-center gap-2 group">
                    Sales tracking dashboard <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button className="px-4 py-2.5 bg-[#1C1C1C] hover:bg-[#242424] border border-white/5 rounded-xl text-[13px] text-white/70 transition-colors flex items-center gap-2 group">
                    Inventory management dashboard <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>

              {/* Built-in integrations banner */}
              <div className="w-[600px] bg-[#1C1C1C] border border-white/5 rounded-[24px] p-6 relative overflow-hidden flex items-center justify-between">
                <div className="flex flex-col gap-4 z-10 w-1/2">
                  <h3 className="text-[14px] font-semibold text-white/90 flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                    Powerful built-in Integrations <ChevronDown size={14} className="-rotate-90"/>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {["LLM", "Stripe integration", "Database", "Image generation", "Maps", "Notification", "File storage", "Data API", "Voice to Text"].map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-md bg-[#2A2A2A] border border-white/5 text-[11px] font-medium text-white/50">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Visual Graphic on the right */}
                <div className="w-[200px] h-32 bg-[#242424] border border-white/10 rounded-xl relative z-10 shadow-xl p-3 flex flex-col gap-2">
                  <div className="text-[10px] font-semibold text-white/70">AI website builder</div>
                  <div className="flex-1 bg-[#1A1A1A] rounded-md border border-white/5 flex items-center justify-center p-2">
                     <BarChart size={32} className="text-[#3B82F6]" strokeWidth={1}/>
                  </div>
                </div>
                {/* Glow */}
                <div className="absolute right-10 top-1/2 -translate-y-1/2 w-48 h-48 bg-[#3B82F6]/10 blur-3xl z-0 rounded-full pointer-events-none" />
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  )
}
