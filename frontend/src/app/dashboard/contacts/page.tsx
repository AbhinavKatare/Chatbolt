'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  Users, Search, Filter, Download, Mail, Phone, MessageSquare,
  MoreHorizontal, UserPlus, Clock, ExternalLink, Activity, Database,
  X, Building2, Briefcase, Tag, ChevronLeft, ChevronRight, Edit3,
  Globe, RefreshCw, Check, ArrowUpDown
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  lead: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  qualified: 'bg-[#00E599]/10 text-[#00E599] border-[#00E599]/20',
  customer: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  churned: 'bg-red-500/10 text-red-400 border-red-500/20',
  archived: 'bg-zinc-700 text-zinc-400 border-zinc-600',
}

const SOURCE_ICONS: Record<string, any> = {
  website: Globe,
  whatsapp: MessageSquare,
  api: Database,
  manual: Users,
  import: Download,
  chat: MessageSquare,
  other: ExternalLink,
}

type Contact = {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  title?: string
  source: string
  status: string
  notes?: string
  interaction_count?: number
  created_at: string
}

type Stats = {
  total: string
  leads: string
  qualified: string
  customers: string
  new_this_week: string
}

export default function ContactsPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const limit = 20

  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', title: '',
    source: 'manual', status: 'lead', notes: ''
  })

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.contacts.list({ search: search || undefined, status: statusFilter || undefined, page, limit })
      setContacts(res.contacts || [])
      setTotal(res.total || 0)
      setStats(res.stats || null)
    } catch (err: any) {
      toastError('Failed to load contacts', err.message)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page])

  useEffect(() => { loadContacts() }, [loadContacts])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.contacts.create(form)
      toastSuccess('Contact created successfully')
      setShowAddModal(false)
      setForm({ name: '', email: '', phone: '', company: '', title: '', source: 'manual', status: 'lead', notes: '' })
      loadContacts()
    } catch (err: any) {
      toastError('Failed to create contact', err.message)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editContact) return
    try {
      await api.contacts.update(editContact.id, form)
      toastSuccess('Contact updated')
      setEditContact(null)
      loadContacts()
    } catch (err: any) {
      toastError('Failed to update contact', err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this contact?')) return
    try {
      await api.contacts.delete(id)
      toastSuccess('Contact archived')
      setActionMenuId(null)
      loadContacts()
    } catch (err: any) {
      toastError('Failed to archive contact', err.message)
    }
  }

  const openEdit = (c: Contact) => {
    setForm({
      name: c.name, email: c.email || '', phone: c.phone || '',
      company: c.company || '', title: c.title || '',
      source: c.source, status: c.status, notes: c.notes || ''
    })
    setEditContact(c)
    setActionMenuId(null)
  }

  const handleExport = async () => {
    try {
      const { contacts: all } = await api.contacts.exportAll()
      const header = 'Name,Email,Phone,Company,Title,Source,Status,Created\n'
      const rows = all.map(c =>
        `"${c.name}","${c.email || ''}","${c.phone || ''}","${c.company || ''}","${c.title || ''}",${c.source},${c.status},"${new Date(c.created_at).toLocaleDateString()}"`
      ).join('\n')
      const blob = new Blob([header + rows], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'contacts.csv'; a.click()
      URL.revokeObjectURL(url)
      toastSuccess('Contacts exported')
    } catch (err: any) {
      toastError('Export failed', err.message)
    }
  }

  const statCards = [
    { label: 'Total Contacts', value: stats?.total || '0', icon: Users, color: 'text-[#00E599]' },
    { label: 'Leads', value: stats?.leads || '0', icon: Activity, color: 'text-amber-400' },
    { label: 'Qualified', value: stats?.qualified || '0', icon: Check, color: 'text-blue-400' },
    { label: 'New This Week', value: stats?.new_this_week || '0', icon: UserPlus, color: 'text-purple-400' },
  ]

  const totalPages = Math.ceil(total / limit)

  const ModalContent = ({ onSubmit, title }: { onSubmit: (e: React.FormEvent) => void; title: string }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl p-8 max-w-lg w-full shadow-2xl relative">
        <button onClick={() => { setShowAddModal(false); setEditContact(null) }} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold text-white mb-6">{title}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Full Name *</label>
              <input required className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Email</label>
              <input type="email" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@acme.com" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Phone</label>
              <input className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 0123" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Company</label>
              <input className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Title</label>
              <input className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="CEO" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Source</label>
              <select className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                {['manual','website','whatsapp','api','import','chat','other'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Status</label>
              <select className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {['lead','qualified','customer','churned','archived'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Notes</label>
              <textarea rows={2} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00E599]/50 outline-none transition-all resize-none" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional context..." />
            </div>
          </div>
          <button type="submit" className="w-full py-3 bg-[#00E599] text-black font-bold rounded-xl text-sm hover:bg-[#00E599]/90 transition-all">
            {title.includes('Create') ? 'Create Contact' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-[#050507] font-sans text-[#EDEDED] overflow-y-auto custom-scrollbar" onClick={() => setActionMenuId(null)}>
      
      {/* Header bar */}
      <div className="h-14 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <Database size={14} className="text-[#00E599]" /> CRM Intelligence
          </div>
          <div className="h-4 w-px bg-white/[0.05]" />
          <div className="flex items-center gap-3">
            {(['', 'lead', 'qualified', 'customer'] as const).map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${statusFilter === s ? 'text-[#00E599] border-b border-[#00E599]' : 'text-zinc-500 hover:text-white'}`}>
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-all">
            <Download size={12} /> Export
          </button>
          <button onClick={() => { setShowAddModal(true); setEditContact(null); setForm({ name: '', email: '', phone: '', company: '', title: '', source: 'manual', status: 'lead', notes: '' }) }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#00E599] text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#00E599]/90 transition-all">
            <UserPlus size={12} /> Add Contact
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-6">
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <div key={i} className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <s.icon size={16} className={s.color} />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{s.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{loading ? '...' : s.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white outline-none focus:border-[#00E599]/50 transition-all"
                placeholder="Search contacts by name, email, or company..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <button onClick={loadContacts} className="p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-zinc-500 hover:text-white transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#0D0D11] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Contact', 'Company', 'Contact Info', 'Source', 'Status', 'Interactions', 'Added', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-[9px] font-black text-zinc-600 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-zinc-600">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-[#00E599] rounded-full animate-spin mx-auto" />
                  </td></tr>
                ) : contacts.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-zinc-500 text-sm">
                    No contacts found. <button onClick={() => setShowAddModal(true)} className="text-[#00E599] hover:underline ml-1">Add your first contact →</button>
                  </td></tr>
                ) : contacts.map((c) => {
                  const SrcIcon = SOURCE_ICONS[c.source] || Globe
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.015] transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#00E599]/10 border border-[#00E599]/20 rounded-lg flex items-center justify-center text-[10px] font-black text-[#00E599] shrink-0">
                            {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{c.name}</div>
                            {c.title && <div className="text-[10px] text-zinc-500">{c.title}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.company ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <Building2 size={11} className="text-zinc-600" /> {c.company}
                          </div>
                        ) : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          {c.email && <div className="flex items-center gap-1.5 text-[10px] text-zinc-400"><Mail size={10} className="text-zinc-600" />{c.email}</div>}
                          {c.phone && <div className="flex items-center gap-1.5 text-[10px] text-zinc-400"><Phone size={10} className="text-zinc-600" />{c.phone}</div>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                          <SrcIcon size={12} className="text-zinc-600" />
                          <span className="capitalize">{c.source}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${STATUS_COLORS[c.status] || STATUS_COLORS.lead}`}>
                          <div className="w-1 h-1 rounded-full bg-current" />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500 text-xs">{c.interaction_count || 0}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                          <Clock size={10} className="text-zinc-600" />
                          {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setActionMenuId(actionMenuId === c.id ? null : c.id)}
                          className="p-1.5 text-zinc-600 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]">
                          <MoreHorizontal size={14} />
                        </button>
                        {actionMenuId === c.id && (
                          <div className="absolute right-4 top-10 z-10 bg-[#0D0D11] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
                            <button onClick={() => openEdit(c)} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-all">
                              <Edit3 size={12} /> Edit Contact
                            </button>
                            <button onClick={() => handleDelete(c.id)} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition-all">
                              <X size={12} /> Archive
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-white/[0.04] px-5 py-3 flex items-center justify-between">
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                {total} total contacts · Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-500 disabled:opacity-30 hover:text-white transition-all">
                  <ChevronLeft size={14} />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-500 disabled:opacity-30 hover:text-white transition-all">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && <ModalContent onSubmit={handleCreate} title="Create New Contact" />}
      {editContact && <ModalContent onSubmit={handleUpdate} title="Edit Contact" />}
    </div>
  )
}
