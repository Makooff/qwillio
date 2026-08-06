import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, Bot, Calendar, ChevronDown, ChevronRight, Headphones, Pause,
  Phone, PhoneForwarded, Settings, SlidersHorizontal, Sparkles,
} from '../../../components/icons';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../services/api';
import { daysUntil } from '../../../utils/format';
import OnboardingChecklist from '../../../components/client/OnboardingChecklist';
import {
  AttentionList, DetailCard, HeroTrendPanel, InsightCard, KpiSplit, RadialGauge,
  SegmentBar, TallyMeter,
  type AttnItem, type Dir, type KpiCell,
} from '../../../components/dashboard/OverviewBlocks';

/* Vue d'ensemble client, mise en page « frameless » reprise du dashboard V1
   (blocs partagés de components/dashboard/OverviewBlocks, filets à la place des
   cartes). Les appels API, états et guards sont ceux de la V2.
   Le h1 est rendu par AppShell: la salutation est un en-tête de contenu. */

const NB = ' ';

interface OverviewClient {
  planType?: string;
  subscriptionStatus?: string;
  vapiPhoneNumber?: string | null;
  transferNumber?: string | null;
  isTrial?: boolean;
  trialEndDate?: string | null;
  monthlyMinutesQuota?: number | null;
  hasCustomConfig?: boolean;
  hasTestCall?: boolean;
  forwardingStatus?: string | null;
  forwardingVerifiedAt?: string | null;
  planFeatures?: string[];
  businessName?: string;
}

interface OverviewData {
  client?: OverviewClient;
  calls?: Record<string, number>;
  minutes?: Record<string, number>;
  bookings?: Record<string, number>;
  leads?: Record<string, number>;
  spam?: Record<string, number>;
  sentiment?: Record<string, number>;
}

interface CallRow {
  id?: string;
  callerName?: string | null;
  callerNumber?: string | null;
  phoneNumber?: string | null;
  startedAt?: string | null;
  createdAt?: string | null;
  durationSeconds?: number | null;
  duration?: number | null;
  outcome?: string | null;
}

type OutcomeTone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info';

const OUTCOMES: Record<string, { label: string; tone: OutcomeTone }> = {
  lead_captured: { label: 'Lead', tone: 'ok' },
  booking_made: { label: 'Rendez-vous', tone: 'ok' },
  transferred: { label: 'Transféré', tone: 'info' },
  info_provided: { label: 'Information', tone: 'neutral' },
  message_taken: { label: 'Message', tone: 'neutral' },
  complaint: { label: 'Réclamation', tone: 'warn' },
  missed: { label: 'Manqué', tone: 'bad' },
  technical_issue: { label: 'Incident', tone: 'bad' },
  spam: { label: 'Spam', tone: 'neutral' },
};

/* Pastilles d'issue d'appel, mêmes teintes que la liste d'activité V1 */
const OUTCOME_PILL: Record<OutcomeTone, string> = {
  ok: 'bg-emerald-400/10 text-emerald-400',
  warn: 'bg-amber-400/10 text-amber-400',
  bad: 'bg-red-400/10 text-red-400',
  info: 'bg-white/[0.08] text-white/60',
  neutral: 'bg-white/[0.05] text-white/40',
};

function greeting(name: string): string {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] || name;
  if (h < 12) return `Bonjour, ${first}`;
  if (h < 18) return `Bon après-midi, ${first}`;
  return `Bonsoir, ${first}`;
}

function fr(n: number): string {
  return n.toLocaleString('fr-FR');
}

function callMoment(call: CallRow): string {
  const raw = call.startedAt || call.createdAt;
  if (!raw) return 'Date inconnue';
  const when = new Date(raw).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const secs = call.durationSeconds ?? call.duration ?? 0;
  if (!secs) return when;
  const dur = secs < 60 ? `${Math.round(secs)}${NB}s` : `${Math.round(secs / 60)}${NB}min`;
  return `${when} · ${dur}`;
}

function Bone({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;
}

/* Bouton de filtre de période, purement visuel comme en V1 */
const filterBtn =
  'inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-medium bg-q2-obsidian border border-q2-graphite-d transition-colors duration-150 hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50';

export default function ClientOverview() {
  const { user, checkAuth } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<OverviewData | null>(null);
  const [calls, setCalls] = useState<CallRow[]>([]);
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
      setData(ov.data as OverviewData);
      setCalls((cl.data?.data as CallRow[]) || []);
      setPaymentPending(false);
      retryCount.current = 0;
      checkAuth();
      if (searchParams.has('payment')) {
        searchParams.delete('payment');
        setSearchParams(searchParams, { replace: true });
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
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

  const c: OverviewClient = data?.client ?? {};
  const isActive = c.subscriptionStatus === 'active' || c.subscriptionStatus === 'trialing';
  const isPaused = c.subscriptionStatus === 'paused';

  const callsMonth = data?.calls?.thisMonth ?? 0;
  const callsToday = data?.calls?.today ?? 0;
  const callsYesterday = data?.calls?.yesterday ?? 0;
  const leadsMonth = data?.leads?.thisMonth ?? 0;
  const bookingsMonth = data?.bookings?.thisMonth ?? 0;
  const bookingsUpcoming = data?.bookings?.upcoming ?? 0;
  const spamBlockedMonth = data?.spam?.blockedThisMonth ?? 0;

  const positive = data?.sentiment?.positive ?? 0;
  const neutral = data?.sentiment?.neutral ?? 0;
  const negative = data?.sentiment?.negative ?? 0;
  const sentTotal = positive + neutral + negative;
  const positiveRate = sentTotal > 0 ? Math.round((positive / sentTotal) * 100) : 0;
  const convRate = callsMonth > 0 ? Math.round((leadsMonth / callsMonth) * 100) : 0;

  const callsTodayPct = callsYesterday > 0
    ? Math.abs(Math.round(((callsToday - callsYesterday) / callsYesterday) * 100))
    : 0;
  const callsTodayDir: Dir = callsToday > callsYesterday
    ? 'up'
    : callsToday < callsYesterday ? 'down' : 'flat';

  /* Facturation à la minute: la jauge suit les minutes incluses, pas les appels */
  const quotaUsed = data?.minutes?.used ?? 0;
  const quotaTotal = c.monthlyMinutesQuota ?? data?.minutes?.quota ?? 0;
  const quotaPct = data?.minutes?.percent
    ?? (quotaTotal > 0 ? Math.min(100, Math.round((quotaUsed / quotaTotal) * 100)) : 0);

  const planLabel = c.planType
    ? `${c.planType.charAt(0).toUpperCase()}${c.planType.slice(1)}`
    : 'Non défini';

  const kpis: KpiCell[] = [
    { label: 'Taux de conversion', value: `${convRate}${NB}%` },
    {
      label: 'Appels traités',
      value: fr(callsMonth),
      delta: callsTodayPct > 0 ? { pct: callsTodayPct, dir: callsTodayDir } : undefined,
      deltaSuffix: 'vs hier',
    },
    { label: 'Score sentiment', value: sentTotal > 0 ? `${positiveRate}${NB}%` : 'Sans donnée' },
  ];

  const attn: AttnItem[] = [];
  if (!c.transferNumber) {
    attn.push({
      icon: AlertCircle,
      label: 'Numéro de transfert manquant',
      to: '/dashboard/receptionist#transfer',
      tone: 'bad',
    });
  }
  if (c.forwardingStatus !== 'verified' && !c.forwardingVerifiedAt) {
    attn.push({
      icon: PhoneForwarded,
      label: "Renvoi d'appel à configurer",
      to: '/dashboard/setup/call-forwarding',
      tone: 'warn',
    });
  }
  if (c.isTrial) {
    attn.push({
      icon: Sparkles,
      label: `Essai${NB}: ${daysUntil(c.trialEndDate)} jours restants`,
      to: '/dashboard/billing',
      tone: 'warn',
      count: daysUntil(c.trialEndDate),
    });
  }
  if (isPaused) {
    attn.push({ icon: Pause, label: 'Abonnement en pause', to: '/dashboard/billing', tone: 'bad' });
  }

  const insightText = sentTotal > 0
    ? (
      <>
        Sentiment positif sur <strong className="font-semibold">{positiveRate}{NB}%</strong> des appels
        analysés, avec un taux de conversion de <strong className="font-semibold">{convRate}{NB}%</strong> ce mois
        {bookingsMonth > 0 ? `, et ${fr(bookingsMonth)} rendez-vous pris` : ''}.
      </>
    )
    : (
      <>
        Connectez votre ligne pour générer des analyses automatiques de vos appels et de leur sentiment.
      </>
    );

  const onboardingClient = {
    hasPhone: !!(c.transferNumber || c.vapiPhoneNumber),
    hasTestCall: !!c.hasTestCall,
    hasCustomConfig: !!c.hasCustomConfig,
    hasCallForwarding: c.forwardingStatus === 'verified' || !!c.forwardingVerifiedAt,
    forwardingStatus: c.forwardingStatus ?? undefined,
    forwardingVerifiedAt: c.forwardingVerifiedAt ?? undefined,
    isActive,
    transferNumber: c.transferNumber ?? undefined,
    vapiPhoneNumber: c.vapiPhoneNumber ?? undefined,
    subscriptionStatus: c.subscriptionStatus,
    businessName: c.businessName,
  };
  const onboardingDone = onboardingClient.hasPhone && onboardingClient.hasTestCall
    && onboardingClient.hasCustomConfig && onboardingClient.isActive;

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6" aria-busy="true">
        {paymentPending && (
          <p className="text-[13px] text-q2-fog">Activation de votre compte en cours</p>
        )}
        <div className="space-y-2">
          <Bone className="h-7 w-44" />
          <Bone className="h-4 w-40" />
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Bone className="h-3 w-24" />
              <Bone className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 sm:gap-5">
          <Bone className="h-[220px] sm:h-[320px] rounded-2xl" />
          <Bone className="h-[220px] sm:h-[320px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <span className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-5 h-5 text-red-400" aria-hidden="true" />
        </span>
        <p className="text-[13px] text-q2-fog mb-4">{error}</p>
        <button
          type="button"
          onClick={load}
          className="px-5 min-h-[44px] py-2 rounded-xl text-[13px] font-medium bg-white/[0.06] text-white hover:bg-white/[0.1] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const today = new Date();

  return (
    <div className="space-y-4 sm:space-y-6">
      {paymentPending && (
        <div className="rounded-2xl border border-q2-graphite-d bg-white/[0.03] px-4 sm:px-5 py-3">
          <p className="text-[13px] text-q2-mist">Activation de votre compte en cours</p>
        </div>
      )}

      {/* En-tête de contenu: salutation, date, statut de service */}
      <section className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[19px] sm:text-[22px] font-semibold tracking-tight text-white/90">
            {greeting(user?.name || 'Utilisateur')}
          </p>
          <p className="text-[12px] sm:text-[12.5px] mt-0.5 sm:mt-1 text-q2-fog">
            {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="mx-1.5 text-white/20">·</span>
            <span
              style={{
                color: isActive
                  ? 'var(--q2p-ok)'
                  : isPaused ? 'var(--q2p-warn)' : 'var(--q2p-bad)',
              }}
            >
              {isActive ? 'Service actif' : isPaused ? 'En pause' : 'Inactif'}
            </span>
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          <button type="button" className={`${filterBtn} text-white/90`}>
            30 derniers jours <ChevronDown size={14} className="text-q2-fog" aria-hidden="true" />
          </button>
          <button type="button" className={`${filterBtn} text-q2-fog`}>
            <Calendar size={14} aria-hidden="true" />
            {new Date(Date.now() - 29 * 864e5).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            {' – '}
            {today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </button>
          <button type="button" className={`${filterBtn} text-q2-fog`}>
            <SlidersHorizontal size={14} aria-hidden="true" /> Personnaliser
          </button>
        </div>
      </section>

      {!onboardingDone && <OnboardingChecklist client={onboardingClient} />}

      {/* Chiffres clés, sans cartes, filet sous la rangée */}
      <section
        aria-label="Indicateurs clés"
        className="pb-4 sm:pb-6 border-b border-q2-graphite-d max-sm:[&>div]:gap-y-4 max-sm:[&>div>*]:px-2.5 max-sm:[&>div>*>p:nth-child(2)]:text-[22px]"
      >
        <KpiSplit items={kpis} />
      </section>

      {/* Colonne principale et rail droit, séparés par un filet vertical */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] xl:divide-x divide-q2-graphite-d">
        <div className="min-w-0 divide-y divide-q2-graphite-d xl:pr-6">
          <HeroTrendPanel
            value={fr(callsMonth)}
            label="Appels traités ce mois"
            delta={callsTodayPct > 0 ? { pct: callsTodayPct, dir: callsTodayDir } : undefined}
            deltaSuffix="sur 24 h"
            series={[]}
            unit="appels"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-q2-graphite-d">
            <div className="md:pr-6">
              <InsightCard
                kicker="Analyse IA"
                icon={Sparkles}
                action={{ label: "Voir l'analyse", to: '/dashboard/analytics' }}
              >
                {insightText}
              </InsightCard>
            </div>
            <div className="md:pl-6">
              <SegmentBar
                title="Minutes consommées"
                value={fr(quotaUsed)}
                hint={quotaTotal > 0
                  ? `sur ${fr(quotaTotal)} minutes incluses`
                  : 'Aucun quota plafonné'}
                segments={quotaTotal > 0
                  ? [
                      { label: 'Utilisé', pct: quotaPct, bright: true },
                      { label: 'Restant', pct: 100 - quotaPct },
                    ]
                  : [{ label: 'Minutes', pct: 100, bright: true }]}
                action={{ label: 'Gérer', to: '/dashboard/billing' }}
              />
            </div>
          </div>

          {/* Activité récente, sans cadre, lignes séparées par des filets */}
          <section aria-label="Appels récents" className="py-5 sm:py-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-q2-fog">
                Activité récente
              </h2>
              <Link
                to="/dashboard/calls"
                className="text-[11.5px] font-medium text-q2-fog hover:text-q2-mist transition-colors duration-150 flex items-center gap-1 min-h-[44px] sm:min-h-0 -my-3 sm:my-0 px-1 -mr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
              >
                Tout voir <ChevronRight size={12} aria-hidden="true" />
              </Link>
            </div>
            <div className="-mx-2">
              {calls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-q2-fog">
                  <Phone size={28} className="opacity-40 mb-3" aria-hidden="true" />
                  <p className="text-[13px]">Aucun appel pour le moment</p>
                </div>
              ) : (
                <ul>
                  {calls.map((call, i) => {
                    const meta = call.outcome ? OUTCOMES[call.outcome] : undefined;
                    return (
                      <li key={call.id || i}>
                        <Link
                          to={`/dashboard/calls?id=${call.id ?? ''}`}
                          className="flex items-center gap-3 px-2 py-2.5 min-h-[56px] rounded-lg hover:bg-white/[0.02] transition-colors duration-150 border-b border-q2-graphite-d last:border-b-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                        >
                          <span className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                            <Phone size={13} className="text-q2-fog" aria-hidden="true" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-white/90 truncate">
                              {call.callerName || call.callerNumber || call.phoneNumber || 'Appel inconnu'}
                            </p>
                            <p className="text-[11px] text-q2-fog tabular-nums">{callMoment(call)}</p>
                          </div>
                          {call.outcome && (
                            <span
                              className={`text-[10px] sm:text-[10.5px] font-medium px-2 sm:px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${OUTCOME_PILL[meta?.tone ?? 'neutral']}`}
                            >
                              {meta?.label ?? call.outcome}
                            </span>
                          )}
                          <ChevronRight
                            size={13}
                            aria-hidden="true"
                            className="text-white/20 group-hover:text-white/50 transition-colors duration-150 shrink-0"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Rail droit, plat, divisé par des filets */}
        <div className="divide-y divide-q2-graphite-d border-t border-q2-graphite-d xl:border-t-0 xl:pl-6">
          <RadialGauge
            caption={quotaTotal > 0 ? 'Minutes ce mois' : 'Appels ce mois'}
            value={quotaTotal > 0 ? fr(quotaUsed) : fr(callsMonth)}
            fraction={quotaTotal > 0 ? quotaPct / 100 : Math.min(1, callsMonth / 200)}
            legend={[
              ...(quotaTotal > 0
                ? [
                    { label: 'Utilisé (min)', value: fr(quotaUsed), bright: true },
                    { label: 'Inclus (min)', value: fr(quotaTotal) },
                  ]
                : [{ label: 'Ce mois', value: fr(callsMonth), bright: true }]),
              ...(spamBlockedMonth > 0
                ? [{ label: 'Spam bloqué', value: fr(spamBlockedMonth) }]
                : []),
            ]}
            action={{ label: 'Voir les appels', to: '/dashboard/calls' }}
          />

          <TallyMeter
            caption="Leads qualifiés ce mois"
            value={fr(leadsMonth)}
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
              {
                k: 'Statut',
                v: isActive ? (c.isTrial ? 'Essai' : 'Actif') : isPaused ? 'En pause' : 'Inactif',
                status: isActive ? 'ok' : isPaused ? 'warn' : 'bad',
              },
              { k: 'Numéro IA', v: c.vapiPhoneNumber || 'Non attribué' },
              { k: 'Rendez-vous', v: bookingsUpcoming > 0 ? `${fr(bookingsMonth)} (${fr(bookingsUpcoming)} à venir)` : fr(bookingsMonth) },
              {
                k: c.isTrial ? "Fin d'essai" : 'Renouvellement',
                v: c.trialEndDate
                  ? new Date(c.trialEndDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Non planifié',
              },
            ]}
            action={{ label: 'Gérer la facturation', to: '/dashboard/billing' }}
          />

          {Array.isArray(c.planFeatures) && c.planFeatures.length > 0 && (
            <div className="py-4 sm:py-5">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-q2-fog mb-3">
                Ce que votre plan inclut
              </h3>
              <ul className="space-y-2">
                {c.planFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-q2-mist">
                    <ChevronRight size={13} className="mt-[3px] shrink-0 text-q2-lift" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AttentionList title="À traiter" items={attn} empty="Tout est en ordre." />
        </div>
      </div>

      {/* Actions rapides, tuiles sans cadre séparées par des filets verticaux */}
      <section aria-label="Actions rapides" className="pt-5 sm:pt-6 border-t border-q2-graphite-d">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-q2-fog mb-3">
          Actions rapides
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-q2-graphite-d">
          {[
            { icon: PhoneForwarded, label: 'Configurer le renvoi', desc: 'iPhone et Android, guide pas à pas', to: '/dashboard/setup/call-forwarding' },
            { icon: Bot, label: "Personnaliser l'IA", desc: 'Voix, scripts, transferts', to: '/dashboard/receptionist' },
            { icon: Settings, label: 'Paramètres du compte', desc: 'Profil, sécurité, notifications', to: '/dashboard/account' },
          ].map(({ icon: Icon, label, desc, to }) => (
            <Link
              key={label}
              to={to}
              className="group py-3 sm:py-4 sm:px-6 first:sm:pl-0 last:sm:pr-0 rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
            >
              <div className="flex items-center gap-3 mb-2.5">
                <span className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Icon size={14} className="text-q2-mist" aria-hidden="true" />
                </span>
                <ChevronRight
                  size={13}
                  aria-hidden="true"
                  className="ml-auto text-white/20 group-hover:text-white/60 transition-colors duration-150"
                />
              </div>
              <p className="text-[13px] font-semibold text-white/90">{label}</p>
              <p className="text-[11.5px] mt-0.5 text-q2-fog">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Bande support */}
      <section className="pt-4 sm:pt-5 border-t border-q2-graphite-d">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Headphones size={15} className="text-q2-fog shrink-0" aria-hidden="true" />
          <p className="text-[12.5px] text-q2-mist flex-1 q2-body-text">
            Besoin d'aide ? Notre équipe répond en moins d'une heure.
          </p>
          <Link
            to="/dashboard/support"
            className="text-[12px] font-medium text-q2-mist hover:text-white whitespace-nowrap transition-colors duration-150 flex items-center gap-1 min-h-[44px] sm:min-h-0 -my-3 sm:my-0 px-1 -mr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
          >
            Contacter le support <ChevronRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <p className="text-center text-[10.5px] text-q2-fog pb-2 tabular-nums">
        {`Qwillio · Plan ${planLabel} · Mis à jour ${today.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
      </p>
    </div>
  );
}
