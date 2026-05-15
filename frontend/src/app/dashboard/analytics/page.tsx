'use client'
import { 
  BarChart3, 
  ChevronDown, 
  Calendar, 
  MessageSquare, 
  UserCheck, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Layers,
  Users,
  Target,
  Smile,
  LayoutGrid,
  History,
  HelpCircle,
  X,
  Activity,
  Zap,
  ShieldCheck,
  Download,
  Filter,
  Cpu
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts'

const overviewStats = [
  { label: 'Total Conversations', value: '45,892', trend: '+12.5%', icon: MessageSquare },
  { label: 'Resolution Rate', value: '88.4%', trend: '+3.1%', icon: UserCheck },
  { label: 'Avg. Response Time', value: '1m 45s', trend: '-8.2%', icon: Clock, inverseTrend: true },
  { label: 'Message Volume', value: '198,300', trend: '+15.7%', icon: Layers },
]

const lineData = [
  { name: 'Oct 01', rate: 73.9 },
  { name: 'Oct 04', rate: 87.7 },
  { name: 'Oct 08', rate: 76.6 },
  { name: 'Oct 12', rate: 88.4 },
  { name: 'Oct 15', rate: 80.2 },
  { name: 'Oct 19', rate: 87.3 },
  { name: 'Oct 22', rate: 80.2 },
  { name: 'Oct 26', rate: 86.4 },
  { name: 'Oct 29', rate: 83.7 },
  { name: 'Oct 31', rate: 88.4 },
]

const barData = [
  { name: 'Week 1', web: 4000, whatsapp: 2400, messenger: 2400 },
  { name: 'Week 2', web: 3000, whatsapp: 1398, messenger: 2210 },
  { name: 'Week 3', web: 2000, whatsapp: 9800, messenger: 2290 },
  { name: 'Week 4', web: 2780, whatsapp: 3908, messenger: 2000 },
]

const pieData = [
  { name: 'Resolved', value: 88.4 },
  { name: 'Escalated', value: 7.2 },
  { name: 'Abandoned', value: 4.4 },
]

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] font-sans selection:bg-[#00DFB8]/30">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-black/[0.03] bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              <Activity size={14} className="text-[#00DFB8]" /> Performance Intelligence
           </div>
           <div className="h-4 w-px bg-black/[0.05]" />
           <div className="flex items-center gap-4">
              <button className="text-[10px] font-bold text-black uppercase tracking-widest border-b border-black">Overview</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Inference Latency</button>
              <button className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Token Economics</button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-black/[0.05] rounded-lg text-[9px] font-black uppercase tracking-widest text-black cursor-pointer hover:border-black transition-all">
              <Calendar size={12} className="text-[#00DFB8]" /> Oct 1 - Oct 31 <ChevronDown size={12} className="text-gray-300" />
           </div>
           <button className="p-1.5 bg-white border border-black/[0.05] rounded-lg text-gray-400 hover:text-black transition-all shadow-sm">
              <Download size={14} />
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
          
          <div className="flex justify-between items-end">
             <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[9px] font-black uppercase tracking-widest">
                   <Zap size={10} fill="currentColor" /> Real-time Metrics
                </div>
                <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">Intelligence Dashboard</h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] max-w-xl leading-relaxed">
                   High-fidelity tracking of autonomous agent workforce performance and global conversation heuristics.
                </p>
             </div>
          </div>

          {/* TOP STAT CARDS */}
          <div className="grid grid-cols-4 gap-4">
             {overviewStats.map((stat, i) => (
               <div key={i} className="bg-white border border-black/[0.03] p-5 rounded-2xl shadow-sm space-y-4 group">
                  <div className="flex items-center gap-2 text-gray-300 group-hover:text-[#00DFB8] transition-colors">
                     <stat.icon size={14} />
                     <span className="text-[9px] font-black uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <div className="flex items-end justify-between">
                     <div className="text-xl font-bold text-[#1A1A1A]">{stat.value}</div>
                     <div className={`text-[8px] font-black uppercase flex items-center gap-1 px-1.5 py-0.5 rounded ${stat.inverseTrend ? (stat.trend.startsWith('-') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600') : (stat.trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}`}>
                        {stat.trend}
                     </div>
                  </div>
                  <div className="h-8 opacity-30 group-hover:opacity-100 transition-opacity">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={lineData.slice(0, 6)}>
                           <Area type="monotone" dataKey="rate" stroke="#00DFB8" fill="#00DFB820" strokeWidth={1.5} />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               </div>
             ))}
          </div>

          {/* MAIN CHART */}
          <div className="bg-white border border-black/[0.03] rounded-2xl p-6 space-y-6 shadow-sm">
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-[#1A1A1A] uppercase tracking-widest">Resolution Trajectory</h3>
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1">Global Workforce Accuracy Manifest</p>
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1 text-[8px] font-black text-[#00DFB8] uppercase tracking-widest bg-[#00DFB8]/5 px-2 py-0.5 rounded">
                      Target: 95%
                   </div>
                </div>
             </div>
             <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={lineData}>
                      <defs>
                         <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00DFB8" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#00DFB8" stopOpacity={0}/>
                         </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000005" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fill: '#D1D5DB', fontWeight: 700 }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fill: '#D1D5DB', fontWeight: 700 }} 
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #00000005', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                      />
                      <Area type="monotone" dataKey="rate" stroke="#00DFB8" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* BOTTOM GRIDS */}
          <div className="grid grid-cols-2 gap-8">
             <div className="bg-white border border-black/[0.03] rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="space-y-1">
                   <h3 className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest">Channel Distribution</h3>
                   <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">Aggregated Message Volume</p>
                </div>
                <div className="h-[200px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000005" />
                         <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 8, fill: '#D1D5DB', fontWeight: 700 }} 
                            dy={5}
                         />
                         <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 8, fill: '#D1D5DB', fontWeight: 700 }} 
                         />
                         <Tooltip cursor={{ fill: '#F9F9F9' }} />
                         <Bar dataKey="web" stackId="a" fill="#1A1A1A" radius={[0, 0, 0, 0]} />
                         <Bar dataKey="whatsapp" stackId="a" fill="#00DFB8" radius={[0, 0, 0, 0]} />
                         <Bar dataKey="messenger" stackId="a" fill="#E5E7EB" radius={[2, 2, 0, 0]} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4">
                   {[
                      { label: 'Web', color: 'bg-[#1A1A1A]' },
                      { label: 'WhatsApp', color: 'bg-[#00DFB8]' },
                      { label: 'Messenger', color: 'bg-[#E5E7EB]' },
                   ].map((c) => (
                      <div key={c.label} className="flex items-center gap-1.5">
                         <div className={`w-2 h-2 rounded-sm ${c.color}`} />
                         <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">{c.label}</span>
                      </div>
                   ))}
                </div>
             </div>

             <div className="bg-white border border-black/[0.03] rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="space-y-1">
                   <h3 className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-widest">Inference State Breakdown</h3>
                   <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">Resolution vs Escalation Logic</p>
                </div>
                <div className="h-[200px] relative flex items-center justify-center">
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                         <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={75}
                            paddingAngle={8}
                            dataKey="value"
                         >
                            {[
                              <Cell key="cell-0" fill="#00DFB8" />,
                              <Cell key="cell-1" fill="#1A1A1A" />,
                              <Cell key="cell-2" fill="#E5E7EB" />
                            ]}
                         </Pie>
                         <Tooltip />
                      </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-xl font-bold text-[#1A1A1A]">88.4%</div>
                      <div className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Success</div>
                   </div>
                </div>
                <div className="flex justify-center gap-4">
                   {pieData.map((d, i) => {
                      const colors = ['bg-[#00DFB8]', 'bg-[#1A1A1A]', 'bg-[#E5E7EB]'];
                      return (
                        <div key={d.name} className="flex items-center gap-1.5">
                           <div className={`w-2 h-2 rounded-full ${colors[i]}`} />
                           <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">{d.name}</span>
                        </div>
                      )
                   })}
                </div>
             </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 pt-4">
             <div className="bg-[#1A1A1A] p-5 rounded-2xl shadow-xl border border-black space-y-3">
                <div className="flex items-center gap-2 text-[#00DFB8]">
                   <ShieldCheck size={14} />
                   <h3 className="text-[9px] font-black uppercase tracking-widest">Guardrail Health</h3>
                </div>
                <div className="text-[9px] text-gray-400 leading-relaxed uppercase font-medium">
                   0.00% PII leakage detected. All toxicity filters operational across 48k sessions.
                </div>
             </div>
             <div className="bg-white border border-black/[0.03] p-5 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-blue-500">
                   <Cpu size={14} />
                   <h3 className="text-[9px] font-black uppercase tracking-widest">Compute Efficiency</h3>
                </div>
                <div className="text-[9px] text-gray-400 leading-relaxed uppercase font-medium">
                   Token optimization reduced inference cost by 14.2% this billing cycle.
                </div>
             </div>
             <div className="bg-white border border-black/[0.03] p-5 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-purple-500">
                   <Target size={14} />
                   <h3 className="text-[9px] font-black uppercase tracking-widest">Goal Alignment</h3>
                </div>
                <div className="text-[9px] text-gray-400 leading-relaxed uppercase font-medium">
                   Agent compliance with system prompts verified at 99.1% across test cohorts.
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
