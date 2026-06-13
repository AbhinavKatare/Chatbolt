'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  FileText, Plus, Lock, Unlock, Clock, History, CheckCircle2,
  AlertCircle, ChevronRight, Layers, Bot, Calendar, Eye, Loader2,
  Trash2, X, RefreshCw, Sparkles, Database, FileSpreadsheet,
  Tv, Clipboard, HelpCircle, HardDrive
} from 'lucide-react'

type Workspace = { id: string; name: string }
type Project = { id: string; name: string; description?: string }
type Artifact = {
  id: string
  name: string
  artifact_type: 'pdf' | 'spreadsheet' | 'presentation' | 'dataset' | 'brief' | 'website'
  locked_by_user_id: string | null
  locked_at: string | null
  metadata: {
    linked_agents: string[]
    linked_memory: string[]
    source_tasks: string[]
  }
  latest_version?: number
  latest_summary?: string
  created_at: string
}

type ArtifactVersion = {
  id: string
  version_number: number
  summary: string
  change_description?: string
  created_by: string
  created_at: string
}

export default function ArtifactsPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  
  // Scopes
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  
  // Artifact lists
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingScopes, setLoadingScopes] = useState(true)

  // Selected Artifact for explorer
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null)
  const [versions, setVersions] = useState<ArtifactVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  // Creation modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newArtifactName, setNewArtifactName] = useState('')
  const [newArtifactType, setNewArtifactType] = useState<Artifact['artifact_type']>('brief')

  // Version Commit modals
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [versionContents, setVersionContents] = useState('')
  const [versionDescription, setVersionDescription] = useState('')

  // Load scopes
  useEffect(() => {
    async function loadScopes() {
      try {
        setLoadingScopes(true)
        const res = await api.workspaces.list()
        const wsList = res.workspaces || []
        setWorkspaces(wsList)
        if (wsList.length > 0) {
          setSelectedWorkspaceId(wsList[0].id)
        }
      } catch (err: any) {
        toastError('Failed to load workspaces', err.message)
      } finally {
        setLoadingScopes(false)
      }
    }
    loadScopes()
  }, [])

  // Load projects when workspace changes
  useEffect(() => {
    if (!selectedWorkspaceId) return
    async function loadProjects() {
      try {
        const res = await api.workspaces.listProjects(selectedWorkspaceId)
        const projList = res.projects || []
        setProjects(projList)
        if (projList.length > 0) {
          setSelectedProjectId(projList[0].id)
        } else {
          setSelectedProjectId('')
          setArtifacts([])
        }
      } catch (err: any) {
        toastError('Failed to load projects', err.message)
      }
    }
    loadProjects()
  }, [selectedWorkspaceId])

  // Load artifacts
  const loadArtifacts = useCallback(async () => {
    if (!selectedProjectId) return
    try {
      setLoading(true)
      const res = await api.artifacts.list(selectedProjectId)
      setArtifacts(res.artifacts || [])
    } catch (err: any) {
      toastError('Failed to load artifacts', err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => {
    loadArtifacts()
    setSelectedArtifact(null)
  }, [selectedProjectId, loadArtifacts])

  // Load version timeline for selected artifact
  const loadVersions = async (artifact: Artifact) => {
    try {
      setLoadingVersions(true)
      const res = await api.artifacts.versions(artifact.id)
      setVersions(res.versions || [])
    } catch (err: any) {
      toastError('Failed to load versions timeline', err.message)
    } finally {
      setLoadingVersions(false)
    }
  }

  const handleSelectArtifact = (art: Artifact) => {
    setSelectedArtifact(art)
    loadVersions(art)
  }

  // Create new first-class artifact
  const handleCreateArtifact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) return
    try {
      await api.artifacts.create(selectedProjectId, {
        name: newArtifactName,
        artifact_type: newArtifactType,
        metadata: { linked_agents: [], linked_memory: [], source_tasks: [] }
      })
      toastSuccess('Artifact created successfully')
      setShowCreateModal(false)
      setNewArtifactName('')
      loadArtifacts()
    } catch (err: any) {
      toastError('Failed to create artifact', err.message)
    }
  }

  // Lock acquisition
  const handleLock = async (art: Artifact) => {
    try {
      const res = await api.artifacts.lock(art.id)
      toastSuccess(`Edit Lock acquired by: ${res.locked_by}`)
      
      const updatedArt = { ...art, locked_by_user_id: res.locked_by, locked_at: new Date().toISOString() }
      setSelectedArtifact(updatedArt)
      setArtifacts(prev => prev.map(a => a.id === art.id ? updatedArt : a))
    } catch (err: any) {
      toastError('Lock acquisition rejected', err.message)
    }
  }

  // Lock release
  const handleUnlock = async (art: Artifact) => {
    try {
      await api.artifacts.unlock(art.id)
      toastSuccess('Edit Lock released')

      const updatedArt = { ...art, locked_by_user_id: null, locked_at: null }
      setSelectedArtifact(updatedArt)
      setArtifacts(prev => prev.map(a => a.id === art.id ? updatedArt : a))
    } catch (err: any) {
      toastError('Lock release rejected', err.message)
    }
  }

  // Save new version
  const handleCommitVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedArtifact) return
    try {
      const nextVer = (selectedArtifact.latest_version || 0) + 1
      const res = await api.artifacts.saveVersion(selectedArtifact.id, {
        version_number: nextVer,
        raw_contents: versionContents,
        change_description: versionDescription
      })

      toastSuccess(`Version ${nextVer} committed! Cached semantic summary successfully.`)
      setShowVersionModal(false)
      setVersionContents('')
      setVersionDescription('')

      // Reload artifact info
      const updatedArt = { 
        ...selectedArtifact, 
        latest_version: nextVer, 
        latest_summary: res.summary,
        locked_by_user_id: null,
        locked_at: null
      }
      setSelectedArtifact(updatedArt)
      setArtifacts(prev => prev.map(a => a.id === selectedArtifact.id ? updatedArt : a))
      loadVersions(updatedArt)
    } catch (err: any) {
      toastError('Failed to commit version', err.message)
    }
  }

  const getTypeIcon = (type: Artifact['artifact_type']) => {
    switch (type) {
      case 'pdf': return <FileText className="text-red-400" size={16} />
      case 'spreadsheet': return <FileSpreadsheet className="text-[#00E599]" size={16} />
      case 'presentation': return <Tv className="text-blue-400" size={16} />
      case 'brief': return <Clipboard className="text-amber-400" size={16} />
      case 'dataset': return <Database className="text-purple-400" size={16} />
      default: return <HardDrive className="text-zinc-400" size={16} />
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#050507] text-[#EDEDED] overflow-y-auto custom-scrollbar">

      {/* Header Panel */}
      <div className="h-14 border-b border-white/[0.04] bg-[#070709]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Layers size={16} className="text-[#00E599]" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Versioned Artifacts Explorer</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedProjectId && (
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-[#00E599] text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#00E599]/90 transition-all">
              <Plus size={12} /> Create Artifact
            </button>
          )}
        </div>
      </div>

      {/* Scope Selectors */}
      <div className="bg-[#09090B] border-b border-white/[0.04] px-6 py-3 flex items-center gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Workspace</span>
          <select 
            value={selectedWorkspaceId} 
            onChange={e => setSelectedWorkspaceId(e.target.value)}
            className="bg-[#0D0D11] border border-white/[0.06] text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#00E599]/40"
          >
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Project</span>
          <select 
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)}
            className="bg-[#0D0D11] border border-white/[0.06] text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#00E599]/40 min-w-[140px]"
            disabled={projects.length === 0}
          >
            {projects.length === 0 ? (
              <option value="">No Projects</option>
            ) : (
              projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
            )}
          </select>
        </div>
      </div>

      {/* Dual Column Workspace layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Left Column: Artifacts list */}
        <div className="w-1/2 border-r border-white/[0.04] flex flex-col min-h-0 bg-[#070709]/30">
          <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Project Assets ({artifacts.length})</span>
            <button onClick={loadArtifacts} className="p-1 bg-white/[0.03] border border-white/[0.06] rounded text-zinc-500 hover:text-white transition-all">
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-[#00E599]" size={20} />
              </div>
            ) : artifacts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto text-zinc-700 mb-3" size={28} />
                <div className="text-zinc-500 text-xs font-semibold">No versioned artifacts in this project.</div>
              </div>
            ) : (
              artifacts.map(art => {
                const isSelected = selectedArtifact?.id === art.id
                const isLocked = !!art.locked_by_user_id
                return (
                  <div
                    key={art.id}
                    onClick={() => handleSelectArtifact(art)}
                    className={`bg-[#0D0D11] border rounded-xl p-4 cursor-pointer hover:border-white/10 transition-all relative group ${
                      isSelected ? 'border-[#00E599]/30 bg-[#00E599]/[0.02]' : 'border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                        {getTypeIcon(art.artifact_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                          {art.name}
                          {isLocked && (
                            <span className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-black uppercase tracking-widest">
                              <Lock size={8} /> locked
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate mt-1">
                          Type: <span className="text-zinc-400 uppercase font-mono">{art.artifact_type}</span> · Version: <span className="text-[#00E599] font-bold">v{art.latest_version || 0}</span>
                        </div>
                      </div>
                    </div>
                    {art.latest_summary && (
                      <div className="mt-3 text-[10px] text-zinc-400 bg-black/20 p-2.5 rounded-lg border border-white/[0.03] italic line-clamp-2">
                        {art.latest_summary}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Versions timeline & metadata panel */}
        <div className="w-1/2 flex flex-col min-h-0 bg-[#050507]">
          {selectedArtifact ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Header Details */}
              <div className="bg-[#0D0D11] border border-white/[0.05] rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/[0.03] border border-white/[0.05] rounded-xl shrink-0">
                      {getTypeIcon(selectedArtifact.artifact_type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{selectedArtifact.name}</h4>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono mt-0.5">{selectedArtifact.artifact_type}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {selectedArtifact.locked_by_user_id ? (
                      <button 
                        onClick={() => handleUnlock(selectedArtifact)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-amber-500/20"
                      >
                        <Unlock size={10} /> Release Lock
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleLock(selectedArtifact)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white/[0.03] border border-white/[0.06] text-zinc-300 rounded-lg text-[9px] font-black uppercase tracking-wider hover:text-white hover:border-white/10"
                      >
                        <Lock size={10} /> Edit Lock
                      </button>
                    )}
                    
                    {(!selectedArtifact.locked_by_user_id || selectedArtifact.locked_by_user_id === 'agent') && (
                      <button
                        onClick={() => setShowVersionModal(true)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/20 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-[#00E599]/20"
                      >
                        <Plus size={10} /> Commit Version
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata tags */}
                <div className="border-t border-white/[0.04] pt-4 grid grid-cols-3 gap-3 text-[10px]">
                  <div className="space-y-1">
                    <div className="text-zinc-600 font-bold uppercase tracking-wider">Linked Agents</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedArtifact.metadata?.linked_agents?.length > 0 ? (
                        selectedArtifact.metadata.linked_agents.map((a, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-white/[0.03] text-zinc-400 rounded border border-white/[0.05]">{a}</span>
                        ))
                      ) : (
                        <span className="text-zinc-600 font-mono italic">None linked</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-zinc-600 font-bold uppercase tracking-wider">Linked Memory</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedArtifact.metadata?.linked_memory?.length > 0 ? (
                        selectedArtifact.metadata.linked_memory.map((m, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-white/[0.03] text-zinc-400 rounded border border-white/[0.05]">{m}</span>
                        ))
                      ) : (
                        <span className="text-zinc-600 font-mono italic">None linked</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-zinc-600 font-bold uppercase tracking-wider">Source Tasks</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedArtifact.metadata?.source_tasks?.length > 0 ? (
                        selectedArtifact.metadata.source_tasks.map((t, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-white/[0.03] text-zinc-400 rounded border border-white/[0.05]">{t}</span>
                        ))
                      ) : (
                        <span className="text-zinc-600 font-mono italic">None linked</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Version History Log */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <History size={14} className="text-zinc-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Immutable Rollback Timeline</span>
                </div>

                {loadingVersions ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="animate-spin text-zinc-600" size={16} />
                  </div>
                ) : versions.length === 0 ? (
                  <div className="bg-[#0D0D11] border border-white/[0.05] rounded-xl p-6 text-center text-zinc-500 text-xs">
                    No committed versions. Lock and save a draft to create version v1.
                  </div>
                ) : (
                  <div className="relative border-l border-white/[0.06] ml-2 pl-6 space-y-6">
                    {versions.map(ver => (
                      <div key={ver.id} className="relative group">
                        {/* Timeline dot */}
                        <div className="absolute -left-[30px] top-1 w-2.5 h-2.5 rounded-full bg-[#00E599] border-2 border-[#050507] group-hover:scale-125 transition-transform shadow-[0_0_6px_#00E599]" />
                        
                        <div className="bg-[#0D0D11] border border-white/[0.05] rounded-xl p-4 space-y-2 hover:border-white/10 transition-colors">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-black text-white">Version v{ver.version_number}</span>
                            <span className="text-[9px] text-zinc-500 font-mono">{new Date(ver.created_at).toLocaleString()}</span>
                          </div>
                          
                          {ver.change_description && (
                            <div className="text-[10px] text-[#00E599] font-bold bg-[#00E599]/[0.03] px-2 py-1 rounded inline-block border border-[#00E599]/10">
                              ⚡ {ver.change_description}
                            </div>
                          )}

                          <div className="text-xs text-zinc-400 bg-black/20 p-3 rounded-lg border border-white/[0.03] space-y-1 font-mono leading-relaxed whitespace-pre-wrap">
                            <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Cached Semantic Summary</div>
                            {ver.summary}
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-zinc-600 font-bold pt-1">
                            <span className="flex items-center gap-1"><Bot size={10} /> Author: {ver.created_by}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <FileText className="text-zinc-800 mb-4 animate-pulse" size={48} />
              <h4 className="text-white font-bold mb-1">Select an Artifact</h4>
              <p className="text-zinc-500 text-xs max-w-xs">Click on any artifact in the left column to view its immutable rollback timelines, edit locks, and semantic caches.</p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL: CREATE ARTIFACT */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <form onSubmit={handleCreateArtifact} className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl max-w-md w-full p-6 relative z-10 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-[#00E599]" size={16} />
                <span className="text-xs font-black uppercase tracking-wider text-white">Create First-Class Asset</span>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Asset Title</label>
                <input 
                  type="text" 
                  value={newArtifactName}
                  onChange={e => setNewArtifactName(e.target.value)}
                  placeholder="Competitor pricing model brief..."
                  className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#00E599]/40 placeholder-zinc-700"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Asset Format Type</label>
                <select
                  value={newArtifactType}
                  onChange={e => setNewArtifactType(e.target.value as any)}
                  className="w-full bg-[#0D0D11] border border-white/[0.06] text-xs text-white rounded-xl px-3.5 py-2.5 outline-none focus:border-[#00E599]/40"
                >
                  <option value="pdf">PDF Document</option>
                  <option value="spreadsheet">Spreadsheet Ledger</option>
                  <option value="presentation">Presentation Deck</option>
                  <option value="brief">Knowledge Brief / Memo</option>
                  <option value="dataset">Enriched Data Set</option>
                  <option value="website">Static Landing Page</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-zinc-400 hover:text-white">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-[#00E599] text-black rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#00E599]/90">
                Generate Asset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: COMMIT NEW VERSION */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowVersionModal(false)} />
          <form onSubmit={handleCommitVersion} className="bg-[#0D0D11] border border-white/[0.08] rounded-2xl max-w-lg w-full p-6 relative z-10 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="text-[#00E599]" size={16} />
                <span className="text-xs font-black uppercase tracking-wider text-white">Commit Asset Snapshot (v{(selectedArtifact?.latest_version || 0) + 1})</span>
              </div>
              <button type="button" onClick={() => setShowVersionModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Change Description / Commit Message</label>
                <input 
                  type="text" 
                  value={versionDescription}
                  onChange={e => setVersionDescription(e.target.value)}
                  placeholder="Updated financial projections or edited market research outline..."
                  className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#00E599]/40 placeholder-zinc-700"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Raw Text Contents</label>
                <textarea 
                  value={versionContents}
                  onChange={e => setVersionContents(e.target.value)}
                  placeholder="Paste the full, raw text content of the artifact to version, summarize, and semantically index..."
                  className="w-full h-44 bg-black/40 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#00E599]/40 placeholder-zinc-700 font-mono resize-none custom-scrollbar"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowVersionModal(false)} className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-zinc-400 hover:text-white">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-[#00E599] text-black rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#00E599]/90">
                Commit & Unlock
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}
