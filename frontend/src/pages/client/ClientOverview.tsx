// === FILE: ClientOverview.tsx ===
import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Phone, Users, Bot, Settings, ChevronRight, AlertCircle,
  Headphones, Sparkles, TrendingUp, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { formatShortDate, daysUntil } from '../../utils/format';
import OnboardingChecklist from '../../components/client/OnboardingChecklist';

type TrendDir = 'up' | 'down' | 'flat';

interface KpiItem {
  label: string;
  value: string | number;
  hint?: string;
  trend?: { dir: TrendDir; pct: number };
}

function greeting(name: string): string {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] || name;
  if (h < 12) return `Bonjour, ${first}`;
  if (h < 18) return `Bon après-midi, ${first}`;
  return `Bonsoir, ${first}`;
}

function outcomeLabel(outcome: string): string {
  if (outcome === 'lead_captured') return 'Lead';
  if (outcome === 'transferred') return 'Transféré';
  return outcome;
}

function outcomePill(outcome: string): string {
  if (outcome === 'lead_captured') return 'bg-emerald-400/10 text-emerald-400';
  if (outcome === 'transferred') return 'bg-indigo-400/10 text-indigo-400';
  return 'bg-white/[0.05] text-white/40';
}

// Skeleton block
function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className ?? ''}`} />;
}

export default function ClientOverview() {
  const { user, checkAuth } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [calls, setCalls] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const retryCount = useRef(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ov, cl] = await Promise.all([
        api.get('/my-dashboard/overview'),
        api.get('/my-dashboard/calls?page=1&limit=5').catch(() => ({ data: { data: [] } })),
      ]);
      setData(ov.data);
      setCalls((cl.data?.data as Record<string, unknown>[]) || []);
      setPaymentPending(false);
      retryCount.current = 0;
      checkAuth();
      if (searchParams.has('payment')) {
        searchParams.delete('payment');
        setSearchParams(searchParams, { replace: true });
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response?.status;
      if ((status === 401 || status === 403 || status === 404) && retryCount.current < 6) {
        retryCount.current++;
        setPaymentPending(true);
        setTimeout(load, 2500);
        return;
      }
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [checkAuth, searchParams, setSearchParams]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('ai-status-change', handler);
    return () => window.removeEventListener('ai-status-change', handler);
  }, [load]);

  // Derived values
  const c = (data as Record<string, unknown> & { client?: Record<string, unknown> })?.client ?? {};
  const isActive = c.subscriptionStatus === 'active' || c.subscriptionStatus === 'trialing';
  const isPaused = c.subscriptionStatus === 'paused';

  const calls_ = (data as Record<string, unknown> & { calls?: Record<string, number> })?.calls ?? {};
  const sentiment_ = (data as Record<string, unknown> & { sentiment?: Record<string, number> })?.sentiment ?? {};
  const leads_ = (data as Record<string, unknown> & { leads?: Record<string, number> })?.leads ?? {};

  const callsToday = (calls_ as Record<string, number>).today ?? 0;
  const callsYesterday = (calls_ as Record<string, number>).yesterday ?? 0;
  const callsMonth = (calls_ as Record<string, number>).thisMonth ?? 0;
  const leadsMonth = (leads_ as Record<string, number>).thisMonth ?? 0;
  const sentTotal = ((sentiment_ as Record<string, number>).positive ?? 0)
    + ((sentiment_ as Record<string, number>).neutral ?? 0)
    + ((sentiment_ as Record<string, number>).negative ?? 0);
  const convRate = callsMonth > 0 ? Math.round((leadsMonth / callsMonth) * 100) : 0;
  const positiveRate = sentTotal > 0 ? Math.round(((sentiment_ as Record<string, number>).positive / sentTotal) * 100) : 0;
  const callsTodayPct = callsYesterday > 0
    ? Math.abs(Math.round(((callsToday - callsYesterday) / callsYesterday) * 100))
    : 0;
  const callsTodayDir: TrendDir = callsToday > callsYesterday ? 'up' : callsToday < callsYesterday ? 'down' : 'flat';

  const quotaUsed = (calls_ as Record<string, number>).quotaUsed ?? 0;
  const quotaTotal = (c.monthlyCallsQuota as number) ?? (calls_ as Record<string, number>).quota ?? 0;
  const quotaPct = quotaTotal > 0 ? Math.round((quotaUsed / quotaTotal) * 100) : 0;

  const kpis: KpiItem[] = [
    {
      label: "Appels totaux",
      value: callsMonth,
      hint: quotaTotal ? `${quotaPct}% quota (${quotaUsed}/${quotaTotal})` : undefined,
    },
    {
      label: "Leads qualifiés",
      value: leadsMonth,
      hint: callsMonth > 0 ? `${convRate}% de conversion` : undefined,
    },
    {
      label: "Taux conversion",
      value: `${convRate}%`,
      hint: `${leadsMonth} leads ce mois`,
    },
    {
      label: "Score moyen",
      value: `${positiveRate}%`,
      hint: sentTotal > 0 ? `${sentTotal} appels analysés` : 'Pas encore de données',
      trend: callsTodayPct > 0 ? { dir: callsTodayDir, pct: callsTodayPct } : undefined,
    },
  ];

  const onboardingClient = {
    hasPhone: !!(c.transferNumber || c.vapiPhoneNumber),
    hasTestCall: !!c.hasTestCall,
    hasCustomConfig: !!c.hasCustomConfig,
    hasCallForwarding: c.forwardingStatus === 'verified' || !!c.forwardingVerifiedAt,
    forwardingStatus: c.forwardingStatus as string | undefined,
    forwardingVerifiedAt: c.forwardingVerifiedAt as string | undefined,
    isActive,
    transferNumber: c.transferNumber as string | undefined,
    vapiPhoneNumber: c.vapiPhoneNumber as string | undefined,
    subscriptionStatus: c.subscriptionStatus as string | undefined,
    businessName: c.businessName as string | undefined,
  };
  const onboardingDone = onboardingClient.hasPhone && onboardingClient.hasTestCall
    && onboardingClient.hasCustomConfig && onboardingClient.isActive;

  // --- Loading skeleton ---
  if (loading) {
    return (
      <main className="space-y-8 max-w-[1200px]" aria-busy="true">
        {paymentPending && (
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] px-5 py-3">
            <p className="text-sm text-white/70">Activation de votre compte en cours…</p>
          </div>
        )}
        <div className="flex items-end justify-between">
          <div className="space-y-2"><Bone className="h-7 w-44" /><Bone className="h-4 w-32" /></div>
        </div>
        {/* KPI strip skeleton */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.06]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 space-y-2 first:pl-0 last:pr-0">
                <Bone className="h-3 w-20" />
                <Bone className="h-8 w-14" />
                <Bone className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
        {/* Calls skeleton */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04] last:border-b-0">
              <Bone className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5"><Bone className="h-3.5 w-36" /><Bone className="h-3 w-24" /></div>
              <Bone className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <main className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-5 h-5 text-red-400" />
        </div>
        <p className="text-sm text-white/60 mb-4">{error}</p>
        <button
          onClick={load}
          className="px-5 py-2 rounded-xl text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Réessayer
        </button>
      </main>
    );
  }

  return (
    <main className="space-y-8 max-w-[1200px]">
      {/* Header */}
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white/90">
            {greeting(user?.name || 'Utilisateur')}
          </h1>
          <p className="text-[12.5px] mt-1 text-white/50">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="mx-1.5 text-white/20">·</span>
            <span className={isActive ? 'text-emerald-400' : isPaused ? 'text-amber-400' : 'text-red-400'}>
              {isActive ? 'Service actif' : isPaused ? 'En pause' : 'Inactif'}
            </span>
          </p>
        </div>
      </section>

      {/* Onboarding */}
      {!onboardingDone && <OnboardingChecklist client={onboardingClient} />}

      {/* Banners */}
      {!!c.isTrial && (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] px-5 py-3 flex items-center gap-3">
          <Sparkles size={15} className="text-indigo-400 flex-shrink-0" />
          <p className="text-[13px] text-white/80 flex-1">
            Période d'essai — <strong className="text-white/90">{daysUntil(c.trialEndDate as string)} jours restants</strong>
          </p>
          <Link
            to="/dashboard/billing"
            className="text-[12px] font-medium text-indigo-400 hover:text-indigo-300 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
          >
            Mettre à jour
          </Link>
        </div>
      )}
      {!c.transferNumber && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] px-5 py-3 flex items-center gap-3">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-[13px] text-white/80 flex-1">Numéro de transfert non configuré</p>
          <Link
            to="/dashboard/receptionist#transfer"
            className="text-[12px] font-medium text-indigo-400 hover:text-indigo-300 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
          >
            Configurer
          </Link>
        </div>
      )}

      {/* KPI strip */}
      <section aria-label="Indicateurs clés">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04]">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/[0.06]">
            {kpis.map((kpi, i) => (
              <div key={i} className="px-6 py-5">
                <p className="text-[11px] font-medium uppercase tracking-widest text-white/30 mb-2">{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-[28px] font-semibold tabular-nums leading-none text-white/90">{kpi.value}</p>
                  {kpi.trend && kpi.trend.pct > 0 && (
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${kpi.trend.dir === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {kpi.trend.dir === 'up' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                      {kpi.trend.pct}%
                    </span>
                  )}
                </div>
                {kpi.hint && <p className="text-[11px] mt-1 text-white/30">{kpi.hint}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent calls */}
      <section aria-label="Appels récents">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">Activité récente</h2>
          <Link
            to="/dashboard/calls"
            className="text-[11.5px] font-medium text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
          >
            Tout voir <ChevronRight size={12} />
          </Link>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] overflow-hidden">
          {(calls as unknown[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30">
              <Phone size={28} className="opacity-40 mb-3" />
              <p className="text-[13px]">Aucun appel pour le moment</p>
            </div>
          ) : (
            <ul>
              {(calls as Record<string, unknown>[]).map((call, i) => (
                <li key={(call.id as string) || i}>
                  <Link
                    to={`/dashboard/calls?id=${call.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors border-b border-white/[0.04] last:border-b-0 group focus:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-indigo-400"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                      <Phone size={13} className="text-white/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white/90 truncate">
                        {(call.callerName as string) || (call.phoneNumber as string) || 'Appel inconnu'}
                      </p>
                      <p className="text-[11px] text-white/30">
                        {call.startedAt
                          ? new Date(call.startedAt as string).toLocaleString('fr-FR', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            })
                          : '—'}
                        {call.duration ? ` · ${Math.round(call.duration as number)}s` : ''}
                      </p>
                    </div>
                    {!!call.outcome && (
                      <span className={`text-[10.5px] font-medium px-2.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${outcomePill(call.outcome as string)}`}>
                        {outcomeLabel(call.outcome as string)}
                      </span>
                    )}
                    <ChevronRight size={13} className="text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Quick links */}
      <section aria-label="Actions rapides">
        <div className="flex items-center mb-3 px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">Actions rapides</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Phone, label: 'Configurer le renvoi', desc: 'iPhone et Android – guide pas à pas', to: '/dashboard/setup/call-forwarding' },
            { icon: Bot, label: "Personnaliser l'IA", desc: 'Voix, scripts, transferts', to: '/dashboard/receptionist' },
            { icon: Settings, label: 'Paramètres du compte', desc: 'Profil, sécurité, notifications', to: '/dashboard/account' },
          ].map(({ icon: Icon, label, desc, to }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4 hover:border-white/[0.12] hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Icon size={14} className="text-white/70" />
                </div>
                <ChevronRight size={13} className="ml-auto text-white/20 group-hover:text-indigo-400 transition-colors" />
              </div>
              <p className="text-[13px] font-semibold text-white/90">{label}</p>
              <p className="text-[11.5px] mt-0.5 text-white/30">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Support */}
      <section>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] px-5 py-4 flex items-center gap-3">
          <Headphones size={15} className="text-white/40 flex-shrink-0" />
          <p className="text-[12.5px] text-white/70 flex-1">
            Besoin d'aide ? Notre équipe répond en moins d'une heure.
          </p>
          <Link
            to="/dashboard/support"
            className="text-[12px] font-medium text-indigo-400 hover:text-indigo-300 whitespace-nowrap transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
          >
            Contacter le support <TrendingUp size={11} />
          </Link>
        </div>
      </section>

      <p className="text-center text-[10px] text-white/20 pb-2">
        Qwillio · {c.planType ? `Plan ${(c.planType as string).charAt(0).toUpperCase() + (c.planType as string).slice(1)}` : 'Plan'}
        {' · '}Mis à jour {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </main>
  );
}
