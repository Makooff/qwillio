import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Download, FileText, Shield } from 'lucide-react';
import api from '../../../services/api';
import { formatDate } from '../../../utils/format';
import {
  Card,
  DangerBtn,
  EmptyState,
  GhostBtn,
  Input,
  Meter,
  PageActions,
  Pill,
  PrimaryBtn,
  Row,
  SectionHead,
  tableCls,
} from '../../../components/v2/app/Blocks';

/* Facturation V2 « instrument ». Mêmes endpoints que la V1 client:
   GET /my-dashboard/billing, GET /my-dashboard/payments,
   POST /my-dashboard/upgrade, POST /my-dashboard/cancel.
   Le h1 est rendu par AppShell. */

interface BillingOverview {
  plan: string;
  status: string;
  renewalDate: string;
  minutesUsed: number;
  minutesLimit: number;
  trialEndsAt: string | null;
  isTrial: boolean;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  description: string;
}

const PLANS = [
  {
    id: 'solo',
    name: 'Solo',
    monthly: 99,
    minutes: 250,
    overage: 0.45,
    popular: false,
    features: [
      '250 minutes/mois incluses',
      'Réceptionniste IA 24/7',
      'Prise de RDV + agenda',
      'Analytiques',
      'Support email',
      'Transcription des appels',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    monthly: 249,
    minutes: 750,
    overage: 0.39,
    popular: false,
    features: [
      '750 minutes/mois incluses',
      'Tout Solo inclus',
      'Capture de leads',
      'Intégrations CRM natives',
      'Support prioritaire',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 599,
    minutes: 2000,
    overage: 0.35,
    popular: true,
    features: [
      '2 000 minutes/mois incluses',
      'Tout Starter inclus',
      'Analytiques avancées + sentiments',
      "Transfert d'appel intelligent",
      'Support prioritaire',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 1290,
    minutes: 5000,
    overage: 0.30,
    popular: false,
    features: [
      '5 000 minutes/mois incluses',
      'Tout Pro inclus',
      'Responsable dédié',
      'SLA 99.5% uptime',
      'Accès API complet',
      'IA auto-apprenante',
    ],
  },
] as const;

type PlanId = (typeof PLANS)[number]['id'];
type PlanTone = 'ok' | 'warn' | 'bad' | 'neutral';

const STATUS_LABELS: Record<string, { tone: PlanTone; label: string }> = {
  active: { tone: 'ok', label: 'Actif' },
  trial: { tone: 'warn', label: 'Essai' },
  cancelled: { tone: 'bad', label: 'Annulé' },
  past_due: { tone: 'warn', label: 'En retard' },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS['active'];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

function fr(n: number) {
  return n.toLocaleString('fr-FR');
}

function euros(n: number) {
  return n.toFixed(2).replace('.', ',');
}

export default function ClientBilling() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelInput, setCancelInput] = useState('');
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get('/my-dashboard/billing'), api.get('/my-dashboard/payments')])
      .then(([billingRes, paymentsRes]) => {
        setOverview(billingRes.data);
        setPayments(paymentsRes.data?.data || paymentsRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      await api.post('/my-dashboard/upgrade', { plan: planId });
      window.location.reload();
    } catch {
      /* état disabled suffit côté UX */
    } finally {
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    try {
      await api.post('/my-dashboard/cancel');
      setOverview((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
      setShowCancel(false);
      setCancelInput('');
    } catch {
      /* silencieux */
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-[132px] rounded-xl bg-q2-carbon border border-q2-graphite-d animate-pulse" />
        <div className="h-[180px] rounded-xl bg-q2-carbon border border-q2-graphite-d animate-pulse" />
        <div className="h-[180px] rounded-xl bg-q2-carbon border border-q2-graphite-d animate-pulse" />
      </div>
    );
  }

  const currentPlanId = (overview?.plan ?? 'starter') as PlanId;
  const currentIndex = PLANS.findIndex((p) => p.id === currentPlanId);
  const currentPlan = currentIndex >= 0 ? PLANS[currentIndex] : PLANS[0];
  const featured = PLANS.find((p) => p.popular) ?? PLANS[0];
  const otherPlans = PLANS.filter((p) => p.id !== featured.id);
  const minutesUsed = overview?.minutesUsed ?? 0;
  const minutesLimit = overview?.minutesLimit ?? currentPlan.minutes;
  const minutesPct = minutesLimit > 0 ? Math.min(Math.round((minutesUsed / minutesLimit) * 100), 100) : 0;
  const isCancelled = overview?.status === 'cancelled';
  const featuredIsCurrent = featured.id === currentPlanId;

  const actionLabel = (planId: string) => {
    const idx = PLANS.findIndex((p) => p.id === planId);
    return idx > (currentIndex >= 0 ? currentIndex : 0) ? 'Upgrader' : 'Réduire';
  };

  return (
    <div className="space-y-6">
      <PageActions subtitle="Gérez votre abonnement et vos factures" />

      {overview?.isTrial && (
        <Card className="flex items-start gap-3">
          <span className="w-8 h-8 shrink-0 rounded-lg bg-q2-obsidian flex items-center justify-center">
            <Shield size={15} className="text-q2-lift" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-white">Période d'essai en cours</p>
            {overview.trialEndsAt && (
              <p className="text-[12px] text-q2-fog mt-0.5 q2-body-text">
                Expire le {formatDate(overview.trialEndsAt)}, passez à un plan payant pour continuer.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Plan courant + consommation */}
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="q2-eyebrow text-q2-fog">Plan actuel</p>
            <p className="text-[26px] font-light tracking-tight text-white leading-none mt-2">{currentPlan.name}</p>
            {overview?.renewalDate && !isCancelled && (
              <p className="text-[11.5px] text-q2-fog mt-2 tabular-nums">
                Renouvellement le {formatDate(overview.renewalDate)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={overview?.status ?? 'active'} />
            <p className="text-[20px] font-light text-white tabular-nums">
              {fr(currentPlan.monthly)}&nbsp;€<span className="text-[12px] text-q2-fog">/mois</span>
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <span className="text-[11.5px] text-q2-fog">Minutes utilisées ce mois</span>
            <span className="text-[12.5px] text-white tabular-nums">
              {fr(minutesUsed)} / {fr(minutesLimit)} min
            </span>
          </div>
          <Meter value={minutesUsed} max={minutesLimit} label="Minutes utilisées ce mois" />
          {minutesPct > 80 && (
            <p
              className="text-[11.5px] mt-2 flex items-center gap-1.5 tabular-nums"
              style={{ color: 'var(--q2p-warn)' }}
            >
              <AlertTriangle size={12} aria-hidden="true" />
              {minutesPct} % du quota mensuel utilisé, envisagez un upgrade
            </p>
          )}
        </div>
      </Card>

      {/* Plans: une card mise en avant + rangées hairline */}
      <section>
        <SectionHead title="Plans disponibles" />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4 items-start">
          <Card className="[border-color:color-mix(in_oklch,var(--q2-indigo)_45%,transparent)]">
            <div className="flex items-center justify-between gap-3">
              <p className="q2-eyebrow" style={{ color: 'var(--q2-lift)' }}>
                {featuredIsCurrent ? 'Votre plan' : 'Recommandé'}
              </p>
              {featuredIsCurrent && <Pill tone="ok">Plan actuel</Pill>}
            </div>
            <p className="text-[19px] font-light text-white mt-3">{featured.name}</p>
            <p className="text-[30px] font-light tracking-tight text-white tabular-nums leading-none mt-1">
              {fr(featured.monthly)}&nbsp;€<span className="text-[12px] text-q2-fog">/mois</span>
            </p>
            <p className="text-[11.5px] text-q2-fog mt-2 tabular-nums">
              {fr(featured.minutes)} min incluses, {euros(featured.overage)}&nbsp;€/min supp.
            </p>

            <ul className="mt-5 space-y-2">
              {featured.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[12.5px] text-q2-mist q2-body-text">
                  <Check size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--q2p-ok)' }} aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>

            {!featuredIsCurrent && (
              <PrimaryBtn
                type="button"
                onClick={() => handleUpgrade(featured.id)}
                disabled={upgrading === featured.id}
                className="w-full mt-5"
              >
                {upgrading === featured.id ? 'Redirection…' : actionLabel(featured.id)}
              </PrimaryBtn>
            )}
          </Card>

          <Card pad={false}>
            {otherPlans.map((plan, i) => {
              const isCurrent = plan.id === currentPlanId;
              return (
                <Row
                  key={plan.id}
                  first={i === 0}
                  label={
                    <span className="flex items-center gap-2">
                      {plan.name}
                      {isCurrent && <Pill tone="ok">Plan actuel</Pill>}
                    </span>
                  }
                  hint={
                    <span className="tabular-nums">
                      {fr(plan.minutes)} min incluses, {euros(plan.overage)}&nbsp;€/min supp.
                    </span>
                  }
                  right={
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] text-white tabular-nums whitespace-nowrap">
                        {fr(plan.monthly)}&nbsp;€<span className="text-q2-fog">/mois</span>
                      </span>
                      {!isCurrent && (
                        <GhostBtn
                          type="button"
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={upgrading === plan.id}
                        >
                          {upgrading === plan.id ? 'Redirection…' : actionLabel(plan.id)}
                        </GhostBtn>
                      )}
                    </div>
                  }
                />
              );
            })}
          </Card>
        </div>
      </section>

      {/* Historique des paiements */}
      <section>
        <SectionHead title="Historique des paiements" />
        <Card pad={false}>
          {payments.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucun paiement"
              description="Aucun paiement enregistré pour l'instant."
            />
          ) : (
            <div className={tableCls.wrap}>
              <table className={tableCls.table}>
                <thead>
                  <tr>
                    <th className={tableCls.th}>Montant</th>
                    <th className={tableCls.th}>Description</th>
                    <th className={tableCls.th}>Statut</th>
                    <th className={tableCls.th}>Date</th>
                    <th className={tableCls.th} aria-label="Facture" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className={tableCls.tr}>
                      <td className={`${tableCls.td} text-white whitespace-nowrap`}>
                        {euros(Number(p.amount))}&nbsp;{p.currency === 'EUR' ? '€' : '$'}
                      </td>
                      <td className={`${tableCls.td} max-w-[220px] truncate`}>{p.description || '-'}</td>
                      <td className={tableCls.td}>
                        <StatusPill status={p.status} />
                      </td>
                      <td className={`${tableCls.td} whitespace-nowrap text-q2-fog`}>{formatDate(p.createdAt)}</td>
                      <td className={tableCls.td}>
                        <a
                          href={`/api/invoices/${p.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[12px] text-q2-mist hover:text-white transition-colors duration-150"
                        >
                          <Download size={12} aria-hidden="true" /> PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* Zone de danger: confirmation en deux temps, dans la page */}
      <section>
        <SectionHead title="Zone de danger" />
        <Card>
          <p className="text-[12.5px] text-q2-fog q2-body-text max-w-[560px]">
            Une fois annulé, votre réceptionniste IA cessera de répondre aux appels. Cette action est irréversible.
          </p>

          {!showCancel ? (
            <DangerBtn type="button" onClick={() => setShowCancel(true)} disabled={isCancelled} className="mt-4">
              <AlertTriangle size={13} aria-hidden="true" />
              {isCancelled ? 'Abonnement annulé' : "Annuler l'abonnement"}
            </DangerBtn>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-[12px] text-q2-mist">
                Tapez <span className="font-medium text-white">ANNULER</span> pour confirmer l'annulation.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 max-w-[420px]">
                <Input
                  type="text"
                  value={cancelInput}
                  onChange={(e) => setCancelInput(e.target.value)}
                  placeholder="Tapez ANNULER"
                  aria-label="Confirmation d'annulation"
                  className="flex-1"
                />
                <div className="flex gap-2 shrink-0">
                  <GhostBtn
                    type="button"
                    onClick={() => {
                      setShowCancel(false);
                      setCancelInput('');
                    }}
                  >
                    Retour
                  </GhostBtn>
                  <DangerBtn type="button" onClick={handleCancel} disabled={cancelInput !== 'ANNULER'}>
                    Confirmer
                  </DangerBtn>
                </div>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
