import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com'

function getHeaders(): Record<string, string> {
  const t = localStorage.getItem('token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

interface BillingData {
  mrr: number
  arr: number
  totalClients: number
  byPlan: Record<string, { count: number; revenue: number }>
  setupFeesThisMonth: number
  totalRevenueThisMonth: number
  growth: number
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
}

function SkeletonStat() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
      <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
      <div className="h-7 w-32 rounded bg-white/5 animate-pulse" />
      <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
    </div>
  )
}

function PlanBar({ plan, info, mrr }: { plan: string; info: { count: number; revenue: number }; mrr: number }) {
  const pct = mrr > 0 ? Math.round((info.revenue / mrr) * 100) : 0
  return (
    <li className="py-4 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white capitalize">{plan}</p>
          <p className="text-xs text-white/35 mt-0.5">
            {info.count} client{info.count !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-white tabular-nums">{fmt(info.revenue)} €/mois</p>
          <p className="text-xs text-white/35 mt-0.5">{pct}% du MRR</p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${plan} : ${pct}% du MRR`}
        className="h-1 rounded-full bg-white/[0.06] overflow-hidden"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: 'oklch(56% 0.22 299)',
          }}
        />
      </div>
    </li>
  )
}

export default function Billing() {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/admin/billing`, { headers: getHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<BillingData>
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const plans = Object.entries(data?.byPlan ?? {})
  const growth = data?.growth ?? 0
  const growthPositive = growth > 0

  return (
    <main aria-label="Tableau de bord facturation" className="px-4 sm:px-6 py-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <header>
        <p className="text-xs font-semibold tracking-widest uppercase text-white/25 mb-1">Facturation</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">Revenus</h1>
      </header>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
        >
          Impossible de charger les données de facturation.
        </div>
      )}

      {/* MRR hero card */}
      {loading ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-3">
          <div className="h-3 w-40 rounded bg-white/5 animate-pulse" />
          <div className="h-10 w-48 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-28 rounded bg-white/5 animate-pulse" />
        </div>
      ) : data ? (
        <div
          className="rounded-2xl border p-6"
          style={{
            borderColor: 'oklch(56% 0.22 299 / 0.2)',
            background: 'oklch(56% 0.22 299 / 0.06)',
          }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase mb-1"
            style={{ color: 'oklch(56% 0.22 299 / 0.6)' }}>
            Monthly Recurring Revenue
          </p>
          <p
            className="text-4xl font-bold tabular-nums"
            style={{ color: 'oklch(74% 0.18 299)' }}
          >
            {fmt(data.mrr)} €
          </p>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <p className="text-sm text-white/35">
              ARR {fmt(data.arr || data.mrr * 12)} €/an
            </p>
            {growth !== 0 && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: growthPositive ? 'oklch(74% 0.18 155 / 0.12)' : 'oklch(60% 0.22 25 / 0.12)',
                  color: growthPositive ? 'oklch(74% 0.18 155)' : 'oklch(68% 0.22 25)',
                }}
              >
                {growthPositive ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}% ce mois
              </span>
            )}
          </div>
        </div>
      ) : null}

      {/* Stats row */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <SkeletonStat />
          <SkeletonStat />
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-xs text-white/35 mb-1.5">Clients actifs</p>
            <p className="text-2xl font-bold text-white tabular-nums">{data.totalClients}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-xs text-white/35 mb-1.5">Ce mois</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'oklch(74% 0.18 299)' }}>
              {fmt(data.totalRevenueThisMonth)} €
            </p>
          </div>
          {data.setupFeesThisMonth > 0 && (
            <div className="col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-xs text-white/35 mb-1.5">Frais de mise en place ce mois</p>
              <p className="text-xl font-bold text-white tabular-nums">
                {fmt(data.setupFeesThisMonth)} €
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Plan breakdown */}
      {!loading && plans.length > 0 && (
        <section aria-labelledby="plans-heading">
          <h2
            id="plans-heading"
            className="text-xs font-semibold tracking-widest uppercase text-white/25 mb-3"
          >
            Répartition par plan
          </h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5">
            <ul role="list" aria-label="Plans de facturation">
              {plans.map(([plan, info]) => (
                <PlanBar key={plan} plan={plan} info={info} mrr={data?.mrr ?? 0} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && !error && plans.length === 0 && (
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
              d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
            />
          </svg>
          <p className="text-sm font-medium">Aucune donnée de facturation</p>
        </div>
      )}
    </main>
  )
}
