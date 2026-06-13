'use client'
import { useState, useEffect } from 'react'
import {
  Users, Users2, Plus, UserPlus, Mail, Crown, X,
  ChevronLeft, Copy, Check, Loader2, Activity,
  Shield, Trash2, CheckCircle2, Clock, AlertCircle, ArrowRight
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

type TeamMember = {
  id: string
  tenant_id: string
  team_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
  name: string
  email: string
}

type Team = {
  id: string
  owner_tenant_id: string
  name: string
  description: string
  member_count: number
  my_role: string
  owner_name: string
  owner_email: string
  created_at: string
}

type ActivityRun = {
  id: string
  status: string
  workflow_name: string
  member_name: string
  member_email: string
  created_at: string
  duration_ms: number | null
}

type PendingInvite = {
  id: string
  invited_email: string
  role: string
  expires_at: string
  invite_url: string
}

function roleBadge(role: string) {
  if (role === 'owner') return 'bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/20'
  if (role === 'admin') return 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
  if (role === 'viewer') return 'bg-zinc-800 text-zinc-400 border border-zinc-700'
  return 'bg-zinc-800 text-zinc-300 border border-zinc-700'
}

function statusIcon(status: string) {
  if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-[#00E599]" />
  if (status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-red-400" />
  return <Clock className="w-3.5 h-3.5 text-zinc-400" />
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Create Team Modal ─────────────────────────────────────────────────────────

function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Team) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await (api as any).teams.create({ name: name.trim(), description: description.trim() })
      onCreated(res.team)
      toast({ title: 'Team created', message: `"${name}" is ready.`, type: 'success' })
      onClose()
    } catch (err: any) {
      toast({ title: 'Failed to create team', message: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Users2 className="w-4 h-4 text-[#00E599]" />
            Create Team
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Team Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Growth Team"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E599]/50"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Description <span className="text-zinc-600">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this team work on?"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E599]/50 resize-none h-20"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2.5 rounded-lg bg-[#00E599] text-black text-sm font-semibold hover:bg-[#00E599]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users2 className="w-4 h-4" />}
              Create Team
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Invite Teammate Modal ───────────────────────────────────────────────────────

function InviteTeammateModal({ onClose, onInvite, teamId }: { onClose: () => void; onInvite: (invite: PendingInvite, url: string) => void; teamId: string }) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const { toast } = useToast()

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await (api as any).teams.invite(teamId, inviteEmail.trim(), inviteRole)
      toast({ title: 'Invite sent', message: `Invite sent to ${inviteEmail}`, type: 'success' })
      onInvite(res.invite, res.invite_url)
      onClose()
    } catch (err: any) {
      toast({ title: 'Could not send invite', message: err.message, type: 'error' })
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#00E599]" />
            Invite a teammate
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={sendInvite} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Email Address</label>
            <input
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              type="email"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E599]/50"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Role</label>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00E599]/50"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex-1 py-2.5 rounded-lg bg-[#00E599] text-black text-sm font-semibold hover:bg-[#00E599]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Team Detail View ──────────────────────────────────────────────────────────

function TeamDetailView({ team, onBack, currentTenantId }: { team: Team; onBack: () => void; currentTenantId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [activity, setActivity] = useState<ActivityRun[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [myRole, setMyRole] = useState(team.my_role)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    Promise.all([
      (api as any).teams.get(team.id),
      (api as any).teams.activity(team.id)
    ]).then(([detail, actRes]) => {
      setMembers(detail.members || [])
      setPendingInvites(detail.pending_invites || [])
      setMyRole(detail.my_role || team.my_role)
      setActivity(actRes.runs || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [team.id])

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await (api as any).teams.invite(team.id, inviteEmail.trim(), inviteRole)
      toast({ title: 'Invite sent', message: `Invite sent to ${inviteEmail}`, type: 'success' })
      setPendingInvites(prev => [...prev, { ...res.invite, invite_url: res.invite_url }])
      setInviteEmail('')
    } catch (err: any) {
      toast({ title: 'Could not send invite', message: err.message, type: 'error' })
    } finally {
      setInviting(false)
    }
  }

  const removeMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the team?`)) return
    try {
      await (api as any).teams.removeMember(team.id, memberId)
      setMembers(prev => prev.filter(m => m.tenant_id !== memberId))
      toast({ title: 'Member removed', type: 'success' })
    } catch (err: any) {
      toast({ title: 'Could not remove member', message: err.message, type: 'error' })
    }
  }

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(url)
      setTimeout(() => setCopiedLink(null), 2000)
    })
  }

  const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .custom-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .skeleton-bar {
          background: var(--color-background-secondary, rgba(255, 255, 255, 0.08)) !important;
          border-radius: var(--border-radius-md, 0.75rem) !important;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">{team.name}</h2>
          {team.description && <p className="text-sm text-zinc-500 mt-0.5">{team.description}</p>}
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadge(myRole)}`}>
          {myRole}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Members column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Members list */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00E599]" />
                Members ({members.length})
              </h3>
            </div>
            {loading ? (
              <div className="p-5 space-y-3 custom-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 skeleton-bar w-full" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-500 text-center px-4">
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <Users className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">Your team is empty</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Invite a teammate to collaborate on this workspace.
                  </p>
                </div>
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#00E599] text-black text-xs font-semibold rounded-lg hover:bg-[#00E599]/90 transition-colors mt-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Invite a teammate
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-800/30 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                      {(m.name || m.email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.name || m.email}</p>
                      <p className="text-xs text-zinc-500 truncate">{m.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(m.role)}`}>{m.role}</span>
                    {isOwnerOrAdmin && m.tenant_id !== currentTenantId && m.role !== 'owner' && (
                      <button
                        onClick={() => removeMember(m.tenant_id, m.name || m.email)}
                        className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-zinc-400" />
                  Pending Invites ({pendingInvites.length})
                </h3>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                    <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate">{inv.invited_email}</p>
                      <p className="text-xs text-zinc-600">Role: {inv.role} · Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                    </div>
                    {inv.invite_url && (
                      <button
                        onClick={() => copyLink(inv.invite_url)}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-[#00E599] transition-colors px-2 py-1 rounded hover:bg-[#00E599]/10"
                      >
                        {copiedLink === inv.invite_url ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedLink === inv.invite_url ? 'Copied!' : 'Copy link'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite form */}
          {isOwnerOrAdmin && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4 text-[#00E599]" />
                Invite a Member
              </h3>
              <form onSubmit={sendInvite} className="flex gap-2">
                <input
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  type="email"
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E599]/50"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-[#00E599]/50"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 bg-[#00E599] text-black text-sm font-semibold rounded-lg hover:bg-[#00E599]/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  Invite
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00E599]" />
              Recent Activity
            </h3>
          </div>
          {loading ? (
            <div className="p-5 space-y-3 custom-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 skeleton-bar w-full" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-600 gap-2">
              <Activity className="w-8 h-8" />
              <p className="text-sm">No team activity yet</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/30 max-h-[500px] overflow-y-auto">
              {activity.map(run => (
                <div key={run.id} className="px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                  <div className="flex items-start gap-2">
                    {statusIcon(run.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{run.workflow_name || 'Task'}</p>
                      <p className="text-xs text-zinc-500 truncate">{run.member_name || run.member_email}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{relativeTime(run.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showInviteModal && (
        <InviteTeammateModal
          onClose={() => setShowInviteModal(false)}
          onInvite={(invite, url) => {
            setPendingInvites(prev => [...prev, { ...invite, invite_url: url }])
          }}
          teamId={team.id}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [currentTenantId, setCurrentTenantId] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    try {
      const tenantStr = localStorage.getItem('chatai_tenant')
      if (tenantStr) {
        const t = JSON.parse(tenantStr)
        setCurrentTenantId(t.id || '')
      }
    } catch {}

    loadTeams()
  }, [])

  async function loadTeams() {
    setLoading(true)
    try {
      const res = await (api as any).teams.list()
      setTeams(res.teams || [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const handleTeamCreated = (team: Team) => {
    setTeams(prev => [team, ...prev])
  }

  const deleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Delete "${teamName}"? This cannot be undone.`)) return
    try {
      await (api as any).teams.delete(teamId)
      setTeams(prev => prev.filter(t => t.id !== teamId))
      if (selectedTeam?.id === teamId) setSelectedTeam(null)
      toast({ title: 'Team deleted', type: 'success' })
    } catch (err: any) {
      toast({ title: 'Could not delete team', message: err.message, type: 'error' })
    }
  }

  if (selectedTeam) {
    return (
      <div className="min-h-screen bg-[#050507] text-white">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <TeamDetailView
            team={selectedTeam}
            onBack={() => setSelectedTeam(null)}
            currentTenantId={currentTenantId}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .custom-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .skeleton-bar {
          background: var(--color-background-secondary, rgba(255, 255, 255, 0.08)) !important;
          border-radius: var(--border-radius-md, 0.75rem) !important;
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00E599]" />
              Team Workspaces
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Collaborate with your team, share tasks, and delegate work
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00E599] text-black text-sm font-semibold rounded-xl hover:bg-[#00E599]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Team
          </button>
        </div>

        {/* Stats */}
        {teams.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex gap-3 items-center">
              <div className="w-8 h-8 bg-[#00E599]/15 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-[#00E599]" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{teams.length}</p>
                <p className="text-xs text-zinc-500">Teams</p>
              </div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex gap-3 items-center">
              <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                <Users2 className="w-4 h-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{teams.reduce((s, t) => s + Number(t.member_count || 0), 0)}</p>
                <p className="text-xs text-zinc-500">Total Members</p>
              </div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex gap-3 items-center">
              <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{teams.filter(t => t.my_role === 'owner').length}</p>
                <p className="text-xs text-zinc-500">Teams You Own</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4 custom-pulse">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="skeleton-bar h-40 w-full" />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center">
              <Users2 className="w-8 h-8 text-zinc-650" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-white mb-1">No team yet</h3>
              <p className="text-sm text-zinc-500 max-w-xs">
                Create a team to share tasks, collaborate in real-time, and delegate work to teammates.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00E599] text-black text-sm font-semibold rounded-xl hover:bg-[#00E599]/90 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              Create your first team
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {teams.map(team => (
              <div
                key={team.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 border border-[#00E599]/20 flex items-center justify-center">
                      <span className="text-[#00E599] font-bold text-base">{team.name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{team.name}</h3>
                      <p className="text-xs text-zinc-500">{team.member_count} member{Number(team.member_count) !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {team.my_role === 'owner' && (
                      <span className="text-xs text-[#00E599] flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Owner
                      </span>
                    )}
                  </div>
                </div>

                {team.description && (
                  <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{team.description}</p>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => setSelectedTeam(team)}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    View Team
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  {team.my_role === 'owner' && (
                    <button
                      onClick={() => deleteTeam(team.id, team.name)}
                      className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete team"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleTeamCreated}
        />
      )}
    </div>
  )
}
