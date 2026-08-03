import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, Bot, CalendarCheck, Check, ChevronRight, Gauge, Headphones,
  Pause, Phone, PhoneForwarded, Settings, Sparkles, Users,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../services/api';
import { daysUntil } from '../../../utils/format';
import OnboardingChecklist from '../../../components/client/OnboardingChecklist';
import {
  Card, EmptyState, GhostBtn, Meter, PageActions, Pill, Row, SectionHead, Stat,
} from '../../../components/v2/app/Blocks';

/* Vue d'ensemble client, registre produit V2 « instrument ».
   Le h1 est rendu par AppShell: cette page n'en dessine aucun. */

const NB = ' ';

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

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info';

const OUTCOMES: Record<string, { label: string; tone: Tone }> = {
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

/* Barre hairline (pas de recharts dans le registre produit pour une simple tendance) */
function TrendBar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[92px] shrink-0 text-[11.5px] text-q2-fog">{label}</span>
      <span className="flex-1 h-[3px] rounded-full bg-q2-obsidian overflow-hidden">
        <span
          className="block h-full rounded-full"
          style={{ width: `${ratio * 100}%`, background: color ?? 'var(--q2-indigo)' }}
        />
      </span>
      <span className="w-12 shrink-0 text-right text-[12.5px] text-q2-mist tabular-nums">{fr(value)}</span>
    </div>
  );
}

function Bone({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-q2-obsidian ${className}`} />;
}

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
  const callsWeek = data?.calls?.thisWeek ?? 0;
  const callsToday = data?.calls?.today ?? 0;
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

  const quotaUsed = data?.minutes?.used ?? 0;
  const quotaTotal = c.monthlyMinutesQuota ?? data?.minutes?.quota ?? 0;
  const quotaPct = data?.minutes?.percent
    ?? (quotaTotal > 0 ? Math.min(100, Math.round((quotaUsed / quotaTotal) * 100)) : 0);

  const planLabel = c.planType
    ? `${c.planType.charAt(0).toUpperCase()}${c.planType.slice(1)}`
    : 'Non défini';

  const attn: { icon: typeof AlertCircle; label: string; hint?: string; to: string; tone: Tone }[] = [];
  if (!c.transferNumber) {
    attn.push({
      icon: AlertCircle,
      label: 'Numéro de transfert manquant',
      hint: 'Les urgences ne peuvent pas être transférées',
      to: '/dashboard/receptionist#transfer',
      tone: 'bad',
    });
  }
  if (c.forwardingStatus !== 'verified' && !c.forwardingVerifiedAt) {
    attn.push({
      icon: PhoneForwarded,
      label: "Renvoi d'appel à configurer",
      hint: 'iPhone et Android, guide pas à pas',
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
    });
  }
  if (isPaused) {
    attn.push({ icon: Pause, label: 'Abonnement en pause', to: '/dashboard/billing', tone: 'bad' });
  }

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
      <div className="space-y-6" aria-busy="true">
        {paymentPending && (
          <p className="text-[13px] text-q2-fog">Activation de votre compte en cours</p>
        )}
        <Bone className="h-4 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Bone key={i} className="h-[104px] rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <Bone className="h-[320px] rounded-xl" />
          <Bone className="h-[320px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <EmptyState
          icon={AlertCircle}
          title="Chargement impossible"
          description={error}
          action={<GhostBtn onClick={load}>Réessayer</GhostBtn>}
        />
      </Card>
    );
  }

  const today = new Date();

  return (
    <div className="space-y-6">
      {paymentPending && (
        <Card pad={false}>
          <p className="px-4 py-3 text-[13px] text-q2-mist">Activation de votre compte en cours</p>
        </Card>
      )}

      <PageActions
        subtitle={
          <>
            {greeting(user?.name || 'Utilisateur')}
            <span className="text-q2-fog"> · </span>
            {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </>
        }
      >
        <Pill tone={isActive ? 'ok' : isPaused ? 'warn' : 'bad'}>
          {isActive ? 'Service actif' : isPaused ? 'En pause' : 'Inactif'}
        </Pill>
      </PageActions>

      {!onboardingDone && <OnboardingChecklist client={onboardingClient} />}

      <section aria-label="Indicateurs du mois" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Appels ce mois"
          value={fr(callsMonth)}
          hint={spamBlockedMonth > 0 ? `${fr(spamBlockedMonth)} spam bloqué` : `${fr(callsToday)} aujourd'hui`}
          icon={Phone}
          to="/dashboard/calls"
        />
        <Stat
          label="Rendez-vous"
          value={fr(bookingsMonth)}
          hint={bookingsUpcoming > 0 ? `${fr(bookingsUpcoming)} à venir` : 'Aucun à venir'}
          icon={CalendarCheck}
        />
        <Stat
          label="Leads qualifiés"
          value={fr(leadsMonth)}
          hint={`${convRate}${NB}% des appels`}
          icon={Users}
          to="/dashboard/leads"
        />
        <Card pad={false} className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gauge size={13} className="text-q2-fog" aria-hidden="true" />
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog">Minutes consommées</p>
          </div>
          <p className="text-[26px] font-light tracking-tight text-white tabular-nums leading-none">{fr(quotaUsed)}</p>
          <div className="mt-3">
            <Meter value={quotaUsed} max={quotaTotal} label="Minutes consommées ce mois" />
          </div>
          <p className="text-[11.5px] text-q2-fog mt-2 tabular-nums">
            {quotaTotal > 0
              ? `sur ${fr(quotaTotal)} minutes incluses (${quotaPct}${NB}%)`
              : 'Aucun quota plafonné'}
          </p>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="min-w-0 space-y-6">
          <section aria-label="Appels récents">
            <SectionHead
              title="Activité récente"
              action={
                <Link
                  to="/dashboard/calls"
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-q2-fog hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
                >
                  Tout voir <ChevronRight size={12} aria-hidden="true" />
                </Link>
              }
            />
            <Card pad={false}>
              {calls.length === 0 ? (
                <EmptyState
                  icon={Phone}
                  title="Aucun appel pour le moment"
                  description="Les appels traités par votre réceptionniste apparaîtront ici."
                />
              ) : (
                calls.map((call, i) => {
                  const meta = call.outcome ? OUTCOMES[call.outcome] : undefined;
                  return (
                    <Row
                      key={call.id || i}
                      first={i === 0}
                      icon={Phone}
                      label={call.callerName || call.callerNumber || call.phoneNumber || 'Appel inconnu'}
                      hint={callMoment(call)}
                      right={
                        call.outcome ? (
                          <Pill tone={meta?.tone ?? 'neutral'}>{meta?.label ?? call.outcome}</Pill>
                        ) : undefined
                      }
                      to={`/dashboard/calls?id=${call.id ?? ''}`}
                    />
                  );
                })
              )}
            </Card>
          </section>

          <section aria-label="Volume et sentiment">
            <SectionHead
              title="Volume des appels"
              action={
                <Link
                  to="/dashboard/analytics"
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-q2-fog hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
                >
                  Analytique <ChevronRight size={12} aria-hidden="true" />
                </Link>
              }
            />
            <Card>
              <div className="space-y-2.5">
                <TrendBar label="Aujourd'hui" value={callsToday} max={callsMonth} />
                <TrendBar label="Cette semaine" value={callsWeek} max={callsMonth} />
                <TrendBar label="Ce mois" value={callsMonth} max={callsMonth} />
              </div>
              {sentTotal > 0 ? (
                <div className="mt-5 pt-4 border-t border-q2-graphite-d">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-3">
                    Sentiment des appels analysés
                  </p>
                  <div className="space-y-2.5">
                    <TrendBar label="Positif" value={positive} max={sentTotal} color="var(--q2p-ok)" />
                    <TrendBar label="Neutre" value={neutral} max={sentTotal} color="var(--q2-lift)" />
                    <TrendBar label="Négatif" value={negative} max={sentTotal} color="var(--q2p-bad)" />
                  </div>
                  <p className="text-[11.5px] text-q2-fog mt-3 q2-body-text">
                    {`Sentiment positif sur ${positiveRate}${NB}% des appels analysés, avec un taux de conversion de ${convRate}${NB}% ce mois.`}
                  </p>
                </div>
              ) : (
                <p className="text-[11.5px] text-q2-fog mt-4 pt-4 border-t border-q2-graphite-d q2-body-text">
                  Connectez votre ligne pour générer des analyses automatiques de vos appels et de leur sentiment.
                </p>
              )}
            </Card>
          </section>
        </div>

        <aside className="space-y-6">
          <section aria-label="À traiter">
            <SectionHead title="À traiter" />
            <Card pad={false}>
              {attn.length === 0 ? (
                <p className="px-4 py-4 text-[12.5px] text-q2-fog">Tout est en ordre.</p>
              ) : (
                attn.map((item, i) => (
                  <Row
                    key={item.to + item.label}
                    first={i === 0}
                    icon={item.icon}
                    label={item.label}
                    hint={item.hint}
                    to={item.to}
                    danger={item.tone === 'bad'}
                  />
                ))
              )}
            </Card>
          </section>

          <section aria-label="Actions rapides">
            <SectionHead title="Actions rapides" />
            <Card pad={false}>
              <Row
                first
                icon={PhoneForwarded}
                label="Configurer le renvoi"
                hint="iPhone et Android, guide pas à pas"
                to="/dashboard/setup/call-forwarding"
              />
              <Row
                icon={Bot}
                label="Personnaliser l'IA"
                hint="Voix, scripts, transferts"
                to="/dashboard/receptionist"
              />
              <Row
                icon={Settings}
                label="Paramètres du compte"
                hint="Profil, sécurité, notifications"
                to="/dashboard/account"
              />
            </Card>
          </section>

          <section aria-label="Abonnement">
            <SectionHead title="Abonnement" />
            <Card pad={false}>
              <dl className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[12px] text-q2-fog">Plan</dt>
                  <dd className="text-[12.5px] text-q2-mist">{planLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[12px] text-q2-fog">Statut</dt>
                  <dd>
                    <Pill tone={isActive ? 'ok' : isPaused ? 'warn' : 'bad'}>
                      {isActive ? (c.isTrial ? 'Essai' : 'Actif') : isPaused ? 'En pause' : 'Inactif'}
                    </Pill>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[12px] text-q2-fog">Numéro IA</dt>
                  <dd className="text-[12.5px] text-q2-mist tabular-nums">{c.vapiPhoneNumber || 'Non attribué'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[12px] text-q2-fog">{c.isTrial ? "Fin d'essai" : 'Renouvellement'}</dt>
                  <dd className="text-[12.5px] text-q2-mist tabular-nums">
                    {c.trialEndDate
                      ? new Date(c.trialEndDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Non planifié'}
                  </dd>
                </div>
                {Array.isArray(c.planFeatures) && c.planFeatures.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-q2-graphite-d">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-2">
                      Ce que votre plan inclut
                    </p>
                    <ul className="space-y-1.5">
                      {c.planFeatures.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[12.5px] text-q2-mist">
                          <Check size={13} className="mt-[2px] shrink-0 text-q2-lift" aria-hidden="true" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </dl>
              <Row label="Gérer la facturation" to="/dashboard/billing" />
            </Card>
          </section>

          <Card pad={false}>
            <Row
              first
              icon={Headphones}
              label="Contacter le support"
              hint="Notre équipe répond en moins d'une heure."
              to="/dashboard/support"
            />
          </Card>
        </aside>
      </div>

      <p className="text-[10.5px] text-q2-fog text-center tabular-nums">
        {`Qwillio · Plan ${planLabel} · Mis à jour ${today.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
      </p>
    </div>
  );
}
