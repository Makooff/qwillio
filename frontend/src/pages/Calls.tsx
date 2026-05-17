import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com'

interface Call {
  id: string
  prospectName: string
  status: string
  duration: number
  outcome: string
  createdAt: string
}

type OutcomeFilter = 'all' | 'interested' | 'converted' | 'no_answer'

const FILTERS: { key: OutcomeFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'interested', label: 'Intéressé' },
  { key: 'converted', label: 'Converti' },
  { key: 'no_answer', label: 'Sans réponse' },
]

const OUTCOME_STYLES: Record<string, { badge: string; avatar: string; label: string }> = {
  interested: {
    badge: 'bg-indigo-500/10 text-indigo-400',
    avatar: 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/30',
    label: 'Intéressé',
  },
  converted: {
    badge: 'bg-emerald-500/10 text-emerald-400',
    avatar: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
    label: 'Converti',
  },
  not_interested: {
    badge: 'bg-red-500/10 text-red-400',
    avatar: 'bg-red-500/10 text-red-400 ring-red-500/30',
    label: 'Pas intéressé',
  },
  no_answer: {
    badge: 'bg-white/5 text-white/30',
    avatar: 'bg-white/5 text-white/20 ring-white/10',
    label: 'Sans réponse',
  },
  callback: {
    badge: 'bg-violet-500/10 text-violet-400',
    avatar: 'bg-violet-500/10 text-violet-400 ring-violet-500/30',
    label: 'Rappel',
  },
}

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}min ${s}s` : `${s}s`
}

function formatRelative(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return `À l'instant`
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function outcomeStyle(outcome: string) {
  return OUTCOME_STYLES[outcome] ?? OUTCOME_STYLES.no_answer
}

function SkeletonRow() {
  return (
    <li role="listitem" className="flex items-center gap-4 px-5 py-4 border-b border-white/5">
      <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-36 rounded bg-white/5 animate-pulse" />
        <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="h-5 w-20 rounded-full bg-white/5 animate-pulse" />
        <div className="h-3 w-14 rounded bg-white/5 animate-pulse" />
      </div>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/30">
      <svg
        aria-hidden="true"
        className="w-10 h-10 opacity-40"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
        />
      </svg>
      <p className="text-sm font-medium">Aucun appel</p>
    </div>
  )
}

interface StatBarProps {
  calls: Call[]
}

function StatBar({ calls }: StatBarProps) {
  const total = calls.length
  const interested = calls.filter(
    (c) => c.outcome === 'interested' || c.outcome === 'converted',
  ).length
  const converted = calls.filter((c) => c.outcome === 'converted').length
  const avgDuration =
    total > 0 ? Math.round(calls.reduce((sum, c) => sum + (c.duration || 0), 0) / total) : 0

  const interestedPct = total > 0 ? Math.round((interested / total) * 100) : 0

  const stats = [
    { label: 'Total appels', value: String(total) },
    { label: 'Taux intérêt', value: `${interestedPct}%` },
    { label: 'Convertis', value: String(converted) },
    { label: 'Durée moy.', value: formatDuration(avgDuration) },
  ]

  return (
    <div className="flex divide-x divide-white/5 bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden mb-5">
      {stats.map(({ label, value }) => (
        <div key={label} className="flex-1 px-4 py-3 text-center min-w-0">
          <p className="text-xs text-white/30 mb-1 truncate">{label}</p>
          <p className="text-base font-semibold text-white tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  )
}

export default function Calls() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<OutcomeFilter>('all')

  async function fetchCalls() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/calls`, { headers: getHeaders() })
      const data: unknown = await res.json()
      if (Array.isArray(data)) setCalls(data)
      else if (data && typeof data === 'object' && 'calls' in data && Array.isArray((data as { calls: unknown[] }).calls))
        setCalls((data as { calls: Call[] }).calls)
    } catch {
      // silent — list stays empty
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCalls() }, [])

  const filtered =
    activeFilter === 'all' ? calls : calls.filter((c) => c.outcome === activeFilter)

  return (
    <main aria-label="Liste des appels" className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Appels</h1>
          <p className="text-sm text-white/30 mt-0.5">
            {loading ? '…' : `${calls.length} appel${calls.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchCalls}
          disabled={loading}
          aria-label="Rafraîchir les appels"
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg
            aria-hidden="true"
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
        </button>
      </div>

      {/* Stats */}
      {!loading && calls.length > 0 && <StatBar calls={calls} />}

      {/* Filter tabs */}
      <div
        role="tablist"
        aria-label="Filtrer par résultat"
        className="flex gap-1.5 mb-4 flex-wrap"
      >
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={activeFilter === key}
            onClick={() => setActiveFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeFilter === key
                ? 'bg-indigo-500 text-white'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
        <ul role="list" className="divide-y divide-white/5">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
          ) : filtered.length === 0 ? (
            <li role="listitem">
              <EmptyState />
            </li>
          ) : (
            filtered.map((call) => {
              const style = outcomeStyle(call.outcome)
              const initials = getInitials(call.prospectName)
              return (
                <li
                  key={call.id}
                  role="listitem"
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.025] transition-colors"
                >
                  {/* Avatar */}
                  <div
                    aria-hidden="true"
                    className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold ring-1 ${style.avatar}`}
                  >
                    {initials}
                  </div>

                  {/* Name + badge */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {call.prospectName || 'Inconnu'}
                    </p>
                    <div className="mt-1">
                      <span
                        aria-label={`Statut: ${style.label}`}
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}
                      >
                        {style.label}
                      </span>
                    </div>
                  </div>

                  {/* Duration + time */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm text-white/60 tabular-nums">
                      {formatDuration(call.duration)}
                    </p>
                    <p className="text-xs text-white/25">{formatRelative(call.createdAt)}</p>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </main>
  )
}
