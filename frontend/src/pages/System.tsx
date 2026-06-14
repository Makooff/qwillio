import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com'

function getHeaders(): Record<string, string> {
  const t = localStorage.getItem('token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

interface SystemData {
  prospects: number
  clients: number
  botStatus: { isActive: boolean; callsToday: number; quota: number; uptime?: number }
  database: { status: string }
  recentErrors?: number
}

function StatusDot({ healthy }: { healthy: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ background: healthy ? 'oklch(74% 0.18 155)' : 'oklch(60% 0.22 25)' }}
    />
  )
}

export default function System() {
  const [data, setData] = useState<SystemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ping, setPing] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const t0 = Date.now()
    fetch(`${API}/api/admin/system`, { headers: getHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<SystemData>
      })
      .then((d) => {
        setData(d)
        setPing(Date.now() - t0)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Chargement"
        className="flex items-center justify-center min-h-[60vh]"
      >
        <div
          className="w-9 h-9 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: 'oklch(56% 0.02 265)', borderRightColor: 'oklch(56% 0.02 265)' }}
        />
      </div>
    )
  }

  const healthy = data?.database?.status === 'connected' || data?.database?.status === 'ok'
  const botActive = data?.botStatus?.isActive ?? false

  return (
    <main aria-label="État du système" className="px-4 sm:px-6 py-6 max-w-3xl mx-auto space-y-5">
      <header>
        <p className="text-xs font-semibold tracking-widest uppercase text-white/25 mb-1">Admin</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">Système</h1>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
        >
          Impossible de charger l'état du système.
        </div>
      )}

      {/* Top status card */}
      <section
        aria-labelledby="status-heading"
        className="rounded-2xl border p-5"
        style={{
          background: healthy ? 'oklch(74% 0.18 155 / 0.05)' : 'oklch(60% 0.22 25 / 0.05)',
          borderColor: healthy ? 'oklch(74% 0.18 155 / 0.2)' : 'oklch(60% 0.22 25 / 0.2)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusDot healthy={healthy} />
            <div>
              <h2 id="status-heading" className="text-base font-semibold text-white">
                {healthy ? 'Tous les systèmes opérationnels' : 'Dégradation détectée'}
              </h2>
              <p className="text-xs text-white/35 mt-0.5">
                DB {data?.database?.status ?? '—'} · ping {ping ?? '—'} ms
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Counts */}
      <section aria-labelledby="counts-heading" className="grid grid-cols-2 gap-3">
        <h2 id="counts-heading" className="sr-only">Compteurs</h2>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-xs text-white/35 mb-1.5">Prospects</p>
          <p className="text-2xl font-bold text-white tabular-nums">{data?.prospects ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-xs text-white/35 mb-1.5">Clients</p>
          <p className="text-2xl font-bold text-white tabular-nums">{data?.clients ?? 0}</p>
        </div>
      </section>

      {/* Bot status */}
      <section
        aria-labelledby="bot-heading"
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <StatusDot healthy={botActive} />
            <h2 id="bot-heading" className="text-sm font-semibold text-white">
              Bot {botActive ? 'actif' : 'inactif'}
            </h2>
          </div>
          {data?.botStatus?.uptime != null && (
            <p className="text-xs text-white/35">
              Uptime {Math.floor(data.botStatus.uptime / 3600)}h
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-white/30 mb-1">Appels aujourd'hui</dt>
            <dd className="text-lg font-semibold text-white tabular-nums">
              {data?.botStatus?.callsToday ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-white/30 mb-1">Quota</dt>
            <dd className="text-lg font-semibold text-white tabular-nums">
              {data?.botStatus?.quota ?? 0}
            </dd>
          </div>
        </dl>

        {(data?.botStatus?.quota ?? 0) > 0 && (
          <div
            role="progressbar"
            aria-valuenow={data!.botStatus.callsToday}
            aria-valuemin={0}
            aria-valuemax={data!.botStatus.quota}
            aria-label="Quota quotidien"
            className="mt-4 h-1 rounded-full bg-white/[0.06] overflow-hidden"
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.min(100, (data!.botStatus.callsToday / data!.botStatus.quota) * 100)}%`,
                background: 'oklch(56% 0.02 265)',
              }}
            />
          </div>
        )}
      </section>

      {/* Errors */}
      {data?.recentErrors != null && data.recentErrors > 0 && (
        <section
          aria-labelledby="errors-heading"
          className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5"
        >
          <h2 id="errors-heading" className="text-sm font-semibold text-red-400 mb-1">
            {data.recentErrors} erreur{data.recentErrors > 1 ? 's' : ''} récente{data.recentErrors > 1 ? 's' : ''}
          </h2>
          <p className="text-xs text-red-400/60">Consultez les logs admin pour les détails.</p>
        </section>
      )}
    </main>
  )
}
