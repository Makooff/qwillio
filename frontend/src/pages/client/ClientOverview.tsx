// === FILE: ClientOverview.tsx ===
import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Phone, Bot, Settings, ChevronRight, AlertCircle,
  Headphones, Sparkles, PhoneForwarded, Pause,
  ChevronDown, Calendar, SlidersHorizontal,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { daysUntil } from '../../utils/format';
import OnboardingChecklist from '../../components/client/OnboardingChecklist';
import {
  KpiSplit, HeroTrendPanel, RadialGauge, TallyMeter, DetailCard,
  AttentionList, SegmentBar, InsightCard,
  type KpiCell, type AttnItem, type Dir,
} from '../../components/dashboard/OverviewBlocks';

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
  if (outcome === 'transferred') return 'bg-white/[0.08] text-white/60';
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
        api.get('/my-dashboard/calls?page=1&limit=6').catch(() => ({ data: { data: [] } })),
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
  const positive = (sentiment_ as Record<string, number>).positive ?? 0;
  const convRate = callsMonth > 0 ? Math.round((leadsMonth / callsMonth) * 100) : 0;
  const positiveRate = sentTotal > 0 ? Math.round((positive / sentTotal) * 100) : 0;
  const callsTodayPct = callsYesterday > 0
    ? Math.abs(Math.round(((callsToday - callsYesterday) / callsYesterday) * 100))
    : 0;
  const callsTodayDir: Dir = callsToday > callsYesterday ? 'up' : callsToday < callsYesterday ? 'down' : 'flat';

  const quotaUsed = (calls_ as Record<string, number>).quotaUsed ?? callsMonth;
  const quotaTotal = (c.monthlyCallsQuota as number) ?? (calls_ as Record<string, number>).quota ?? 0;
  const quotaPct = quotaTotal > 0 ? Math.min(100, Math.round((quotaUsed / quotaTotal) * 100)) : 0;

  const planLabel = c.planType
    ? `${(c.planType as string).charAt(0).toUpperCase()}${(c.planType as string).slice(1)}`
    : '—';

  // KPI row — three borderless figures
  const kpis: KpiCell[] = [
    {
      label: 'Taux de conversion',
      value: `${convRate}%`,
    },
    {
      label: 'Appels traités',
      value: callsMonth.toLocaleString('fr-FR'),
      delta: callsTodayPct > 0 ? { pct: callsTodayPct, dir: callsTodayDir } : undefined,
      deltaSuffix: 'vs hier',
    },
    {
      label: 'Score sentiment',
      value: sentTotal > 0 ? `${positiveRate}%` : '—',
    },
  ];

  // Needs-attention items, derived from real state
  const attn: AttnItem[] = [];
  if (!c.transferNumber) {
    attn.push({ icon: AlertCircle, label: 'Numéro de transfert manquant', to: '/dashboard/receptionist#transfer', tone: 'bad' });
  }
  if (c.forwardingStatus !== 'verified' && !c.forwardingVerifiedAt) {
    attn.push({ icon: PhoneForwarded, label: "Renvoi d'appel à configurer", to: '/dashboard/setup/call-forwarding', tone: 'warn' });
  }
  if (c.isTrial) {
    attn.push({ icon: Sparkles, label: `Essai: ${daysUntil(c.trialEndDate as string)} jours restants`, to: '/dashboard/billing', tone: 'warn', count: daysUntil(c.trialEndDate as string) });
  }
  if (isPaused) {
    attn.push({ icon: Pause, label: 'Abonnement en pause', to: '/dashboard/billing', tone: 'bad' });
  }

  const insightText = sentTotal > 0
    ? <>Sentiment positif sur <strong className="font-semibold">{positiveRate}%</strong> des appels analysés, avec un taux de conversion de <strong className="font-semibold">{convRate}%</strong> ce mois.</>
    : <>Connectez votre ligne pour générer des analyses automatiques de vos appels et de leur sentiment.</>;

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
      <main className="space-y-6 max-w-[1320px]" aria-busy="true">
        {paymentPending && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3">
            <p className="text-sm text-white/70">Activation de votre compte en cours…</p>
          </div>
        )}
        <div className="space-y-2"><Bone className="h-7 w-44" /><Bone className="h-4 w-40" /></div>
        <div className="grid grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2"><Bone className="h-3 w-24" /><Bone className="h-8 w-16" /></div>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
          <Bone className="h-[320px] rounded-2xl" />
          <Bone className="h-[320px] rounded-2xl" />
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
          className="px-5 py-2 rounded-xl text-sm font-medium bg-white/[0.06] text-white hover:bg-white/[0.1] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
        >
          Réessayer
        </button>
      </main>
    );
  }

  return (
    <main className="space-y-6 max-w-[1320px]">
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
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-medium text-white/90 transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            style={{ background: '#161616', border: '1px solid oklch(24% 0 0 / 0.55)' }}
          >
            30 derniers jours <ChevronDown size={14} className="text-white/45" />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-medium text-white/60 transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            style={{ background: '#161616', border: '1px solid oklch(24% 0 0 / 0.55)' }}
          >
            <Calendar size={14} />
            {new Date(Date.now() - 29 * 864e5).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            {' – '}
            {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-medium text-white/60 transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            style={{ background: '#161616', border: '1px solid oklch(24% 0 0 / 0.55)' }}
          >
            <SlidersHorizontal size={14} /> Personnaliser
          </button>
        </div>
      </section>

      {/* Onboarding */}
      {!onboardingDone && <OnboardingChecklist client={onboardingClient} />}

      {/* KPI split row — borderless figures with a hairline under */}
      <section aria-label="Indicateurs clés" className="pb-6 border-b border-white/[0.06]">
        <KpiSplit items={kpis} />
      </section>

      {/* Main grid — content + right rail, separated by a vertical hairline */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] xl:divide-x divide-white/[0.06]">
        {/* Left column */}
        <div className="min-w-0 divide-y divide-white/[0.06] xl:pr-6">
          <HeroTrendPanel
            value={callsMonth.toLocaleString('fr-FR')}
            label="Appels traités ce mois"
            delta={callsTodayPct > 0 ? { pct: callsTodayPct, dir: callsTodayDir } : undefined}
            deltaSuffix="sur 24 h"
            series={[]}
            unit="appels"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-white/[0.06]">
            <div className="md:pr-6">
              <InsightCard
                kicker="Analyse IA"
                icon={Sparkles}
                action={{ label: 'Voir l’analyse', to: '/dashboard/analytics' }}
              >
                {insightText}
              </InsightCard>
            </div>
            <div className="md:pl-6">
              <SegmentBar
                title="Utilisation du quota"
                value={quotaTotal > 0 ? `${quotaUsed.toLocaleString('fr-FR')}` : callsMonth.toLocaleString('fr-FR')}
                hint={quotaTotal > 0 ? `sur ${quotaTotal.toLocaleString('fr-FR')} appels inclus` : 'Aucun quota plafonné'}
                segments={quotaTotal > 0
                  ? [
                      { label: 'Utilisé', pct: quotaPct, bright: true },
                      { label: 'Restant', pct: 100 - quotaPct },
                    ]
                  : [{ label: 'Appels traités', pct: 100, bright: true }]}
                action={{ label: 'Gérer', to: '/dashboard/billing' }}
              />
            </div>
          </div>

          {/* Recent activity — frameless, rows split by lines */}
          <section aria-label="Appels récents" className="py-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/40">Activité récente</h2>
              <Link
                to="/dashboard/calls"
                className="text-[11.5px] font-medium text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded"
              >
                Tout voir <ChevronRight size={12} />
              </Link>
            </div>
            <div className="-mx-2">
              {(calls as unknown[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/30">
                  <Phone size={28} className="opacity-40 mb-3" />
                  <p className="text-[13px]">Aucun appel pour le moment</p>
                </div>
              ) : (
                <ul>
                  {(calls as Record<string, unknown>[]).map((call, i) => (
                    <li key={(call.id as string) || i}>
                      <Link
                        to={`/dashboard/calls?id=${call.id}`}
                        className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-white/[0.02] transition-colors border-b border-white/[0.04] last:border-b-0 group focus:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-white/30"
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
        </div>

        {/* Right rail — flat, divided by hairlines */}
        <div className="divide-y divide-white/[0.06] border-t border-white/[0.06] xl:border-t-0 xl:pl-6">
          <RadialGauge
            caption={quotaTotal > 0 ? 'Quota d’appels' : 'Appels ce mois'}
            value={quotaTotal > 0 ? quotaUsed.toLocaleString('fr-FR') : callsMonth.toLocaleString('fr-FR')}
            fraction={quotaTotal > 0 ? quotaPct / 100 : Math.min(1, callsMonth / 200)}
            legend={quotaTotal > 0
              ? [
                  { label: 'Utilisé', value: quotaUsed.toLocaleString('fr-FR'), bright: true },
                  { label: 'Inclus', value: quotaTotal.toLocaleString('fr-FR') },
                ]
              : [{ label: 'Ce mois', value: callsMonth.toLocaleString('fr-FR'), bright: true }]}
            action={{ label: 'Voir les appels', to: '/dashboard/calls' }}
          />

          <TallyMeter
            caption="Leads qualifiés ce mois"
            value={leadsMonth.toLocaleString('fr-FR')}
            pct={convRate}
            legend={[
              { label: 'Qualifiés', value: '', bright: true },
              { label: 'Total appels', value: '' },
            ]}
          />

          <DetailCard
            title="Abonnement"
            rows={[
              { k: 'Plan', v: planLabel },
              { k: 'Statut', v: isActive ? (c.isTrial ? 'Essai' : 'Actif') : isPaused ? 'En pause' : 'Inactif', status: isActive ? 'ok' : isPaused ? 'warn' : 'bad' },
              { k: 'Numéro IA', v: (c.vapiPhoneNumber as string) || '—' },
              { k: c.isTrial ? 'Fin d’essai' : 'Renouvellement', v: c.trialEndDate ? new Date(c.trialEndDate as string).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
            ]}
            action={{ label: 'Gérer la facturation', to: '/dashboard/billing' }}
          />

          <AttentionList title="À traiter" items={attn} empty="Tout est en ordre." />
        </div>
      </div>

      {/* Quick links — frameless tiles split by vertical lines */}
      <section aria-label="Actions rapides" className="pt-6 border-t border-white/[0.06]">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/40 mb-3">Actions rapides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
          {[
            { icon: PhoneForwarded, label: 'Configurer le renvoi', desc: 'iPhone et Android, guide pas à pas', to: '/dashboard/setup/call-forwarding' },
            { icon: Bot, label: "Personnaliser l'IA", desc: 'Voix, scripts, transferts', to: '/dashboard/receptionist' },
            { icon: Settings, label: 'Paramètres du compte', desc: 'Profil, sécurité, notifications', to: '/dashboard/account' },
          ].map(({ icon: Icon, label, desc, to }) => (
            <Link
              key={to}
              to={to}
              className="group py-4 sm:px-6 first:sm:pl-0 last:sm:pr-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 rounded-lg"
            >
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Icon size={14} className="text-white/70" />
                </div>
                <ChevronRight size={13} className="ml-auto text-white/20 group-hover:text-white/60 transition-colors" />
              </div>
              <p className="text-[13px] font-semibold text-white/90">{label}</p>
              <p className="text-[11.5px] mt-0.5 text-white/30">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Support — frameless strip */}
      <section className="pt-5 border-t border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Headphones size={15} className="text-white/40 flex-shrink-0" />
          <p className="text-[12.5px] text-white/70 flex-1">
            Besoin d'aide ? Notre équipe répond en moins d'une heure.
          </p>
          <Link
            to="/dashboard/support"
            className="text-[12px] font-medium text-white/70 hover:text-white whitespace-nowrap transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded"
          >
            Contacter le support <ChevronRight size={12} />
          </Link>
        </div>
      </section>

      <p className="text-center text-[10px] text-white/20 pb-2">
        Qwillio · Plan {planLabel}
        {' · '}Mis à jour {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </main>
  );
}
