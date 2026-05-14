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
  X
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

const subNav = [
  { name: 'Chats', icon: MessageSquare, active: true },
  { name: 'Customers', icon: Users },
  { name: 'Topics', icon: Target },
  { name: 'Sentiment', icon: Smile },
]

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

const COLORS = ['#D1E9FF', '#FCE7F3', '#FEF3C7']

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-y-auto relative">
      <div className="max-w-6xl w-full mx-auto p-10 space-y-10 pb-32">
        <div className="flex items-center justify-between">
           <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00DFB8]/10 text-[#00DFB8] rounded-full text-[10px] font-bold uppercase tracking-widest mb-2">
                <BarChart3 size={12} /> Live Reporting
              </div>
              <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Analytics Overview</h1>
              <p className="text-[#888] text-sm">Key performance indicators and conversation data for your AI workforce.</p>
           </div>
           <div className="flex flex-col items-end gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date Range</span>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-black/5 rounded-xl shadow-sm text-xs font-bold text-[#1A1A1A] cursor-pointer hover:border-[#00DFB8]/50 transition-colors">
                 <Calendar size={14} className="text-[#00DFB8]" /> Oct 1 - Oct 31, 2023 <ChevronDown size={14} className="text-gray-300 ml-2" />
              </div>
           </div>
        </div>

        {/* TOP STAT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {overviewStats.map((stat, i) => (
             <div key={i} className="bg-white border border-black/5 p-6 rounded-2xl space-y-4 shadow-xl shadow-black/5 hover:border-[#00DFB8]/30 transition-all group">
                <div className="flex items-center gap-2 text-gray-400 group-hover:text-[#00DFB8] transition-colors">
                   <stat.icon size={14} />
                   <span className="text-[10px] font-bold uppercase tracking-widest">{stat.label}</span>
                </div>
                <div className="flex items-end justify-between">
                   <div className="text-3xl font-black text-[#1A1A1A]">{stat.value}</div>
                   <div className={`text-[10px] font-black uppercase flex items-center gap-1 px-2 py-1 rounded-full ${stat.inverseTrend ? (stat.trend.startsWith('-') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600') : (stat.trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}`}>
                      {stat.trend} {stat.trend.startsWith('+') ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                   </div>
                </div>
                <div className="h-10 opacity-50 group-hover:opacity-100 transition-opacity">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={lineData.slice(0, 6)}>
                         <Area type="monotone" dataKey="rate" stroke="#00DFB8" fill="#00DFB820" strokeWidth={2} />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>
           ))}
        </div>

        {/* MAIN CHART */}
        <div className="bg-white border border-black/5 rounded-2xl p-8 space-y-6 shadow-xl shadow-black/5">
           <div className="space-y-1 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-[#1A1A1A]">Resolution Rate Over Time</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform Average vs Target</p>
              </div>
              <button className="px-4 py-2 bg-black/5 text-[#1A1A1A] text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-black/10 transition-colors">
                Export CSV
              </button>
           </div>
           <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={lineData}>
                    <defs>
                       <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00DFB8" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#00DFB8" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} 
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #00000010', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px', color: '#1A1A1A' }}
                    />
                    <Area type="monotone" dataKey="rate" stroke="#00DFB8" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* BOTTOM GRIDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white border border-black/5 rounded-2xl p-8 space-y-6 shadow-xl shadow-black/5 hover:border-[#00DFB8]/30 transition-all">
              <div className="space-y-1">
                 <h3 className="text-sm font-black text-[#1A1A1A]">Message Volume by Channel</h3>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">(Stacked Bar Graph)</p>
              </div>
              <div className="h-[250px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
                       <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} 
                          dy={10}
                       />
                       <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} 
                       />
                       <Tooltip cursor={{ fill: '#FAFAFA' }} />
                       <Bar dataKey="web" stackId="a" fill="#1A1A1A" radius={[0, 0, 0, 0]} />
                       <Bar dataKey="whatsapp" stackId="a" fill="#00DFB8" radius={[0, 0, 0, 0]} />
                       <Bar dataKey="messenger" stackId="a" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6">
                 {[
                    { label: 'Web Widget', color: 'bg-[#1A1A1A]' },
                    { label: 'WhatsApp', color: 'bg-[#00DFB8]' },
                    { label: 'Messenger', color: 'bg-[#E5E7EB]' },
                 ].map((c) => (
                    <div key={c.label} className="flex items-center gap-2">
                       <div className={`w-3 h-3 rounded-sm ${c.color}`} />
                       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{c.label}</span>
                    </div>
                 ))}
              </div>
           </div>

           <div className="bg-white border border-black/5 rounded-2xl p-8 space-y-6 shadow-xl shadow-black/5 hover:border-[#00DFB8]/30 transition-all">
              <div className="space-y-1">
                 <h3 className="text-sm font-black text-[#1A1A1A]">Conversation Status Breakdown</h3>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resolution vs Escalation</p>
              </div>
              <div className="h-[250px] relative flex items-center justify-center">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={90}
                          paddingAngle={5}
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
                    <div className="text-4xl font-black text-[#1A1A1A]">88.4%</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resolved</div>
                 </div>
              </div>
              <div className="flex justify-center gap-6">
                 {pieData.map((d, i) => {
                    const colors = ['bg-[#00DFB8]', 'bg-[#1A1A1A]', 'bg-[#E5E7EB]'];
                    return (
                      <div key={d.name} className="flex items-center gap-2">
                         <div className={`w-3 h-3 rounded-full ${colors[i]}`} />
                         <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{d.name}</span>
                      </div>
                    )
                 })}
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}

