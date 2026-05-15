import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import {
  RefreshCw, DollarSign, Users, Clock, AlertCircle, CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, GhostBtn, Pill,
} from '../../components/pro/ProBlocks';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Client {
  id: string;
  businessName: string;
  contactEmail: string;
  planType: string;
  monthlyFee: number;
  subscriptionStatus: string;
  createdAt: string;
  activationDate?: string;
}

interface RevenuePoint {
  date: string;
  mrr: number;
  newClients?: number;
}

interface DashStats {
  revenue?: { mrr: number };
  clients?: { total: number };
}

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'accent';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const statusPill = (status?: string): { color: PillColor; label: string } => {
  switch ((status ?? '').toLowerCase()) {
    case 'active':    return { color: 'ok',      label: 'Actif' };
    case 'trial':     return { color: 'info',    label: 'Essai' };
    case 'past_due':  return { color: 'warn',    label: 'Retard' };
    case 'unpaid':    return { color: 'bad',     label: 'Impayé' };
    case 'canceled':
    case 'cancelled': return { color: 'neutral', label: 'Annulé' };
    default:          return { color: 'neutral', label: status ?? '—' };
  }
};

const fmtDate = (iso?: string): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const initials = (name?: string): string =>
  (name ?? '?').trim().charAt(0).toUpperCase();

/* ─── Skeleton row ───────────────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3 animate-pulse">
      <div className="w-9 h-9 rounded-full flex-shrink-0"
           style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 rounded-full w-2/5" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-2.5 rounded-full w-1/3" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
      <div className="h-3 w-14 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="h-5 w-14 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
    </div>
  );
}

/* ─── Custom chart tooltip ───────────────────────────────────────────────── */

interface TooltipPayloadItem {
  value: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-[12px]"
         style={{ background: '#111', border: 'none', color: '#fff' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
      <p className="font-semibold tabular-nums mt-0.5">{payload[0].value}€</p>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function AdminBilling() {
  const [clients, setClients]   = useState<Client[]>([]);
  const [stats, setStats]       = useState<DashStats | null>(null);
  const [revenue, setRevenue]   = useState<RevenuePoint[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [sRes, cRes, rRes] = await Promise.all([
        api.get<DashStats>('/dashboard/stats'),
        api.get<{ data: Client[] } | Client[]>('/clients/'),
        api.get<RevenuePoint[]>('/dashboard/revenue-history'),
      ]);

      setStats(sRes.data);

      const raw = cRes.data;
      if (Array.isArray(raw)) {
        setClients(raw);
      } else if (raw && Array.isArray((raw as { data: Client[] }).data)) {
        setClients((raw as { data: Client[] }).data);
      } else {
        setClients([]);
      }

      setRevenue(Array.isArray(rRes.data) ? rRes.data : []);
    } catch {
      setError(true);
      toast('Erreur lors du chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const retryPayment = async (clientId: string) => {
    setRetrying(clientId);
    try {
      await api.post(`/clients/${clientId}/retry-payment`);
      toast('Relance envoyée', 'success');
    } catch {
      toast('Erreur relance paiement', 'error');
    } finally {
      setRetrying(null);
    }
  };

  /* ── Derived data ── */
  const mrr           = stats?.revenue?.mrr ?? 0;
  const activeClients = clients.filter(c => c.subscriptionStatus === 'active');
  const trialClients  = clients.filter(c => c.subscriptionStatus === 'trial');
  const failedPayments = clients.filter(
    c => c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid',
  );

  const subscriptions = [...clients]
    .filter(c =>
      c.subscriptionStatus === 'active' ||
      c.subscriptionStatus === 'trial'  ||
      c.subscriptionStatus === 'past_due' ||
      c.subscriptionStatus === 'unpaid',
    )
    .sort((a, b) => {
      const order: Record<string, number> = { past_due: 0, unpaid: 1, trial: 2, active: 3 };
      const oa = order[a.subscriptionStatus] ?? 99;
      const ob = order[b.subscriptionStatus] ?? 99;
      if (oa !== ob) return oa - ob;
      return a.businessName.localeCompare(b.businessName, 'fr');
    });

  const chartData = revenue.map(p => ({
    ...p,
    label: (() => {
      try { return format(new Date(p.date), 'dd/MM', { locale: fr }); }
      catch { return p.date; }
    })(),
  }));

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-5 max-w-[1200px]">
        <div className="flex items-center justify-between animate-pulse">
          <div className="space-y-2">
            <div className="h-6 w-36 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="h-3 w-52 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border p-4 animate-pulse"
                 style={{ borderColor: pro.border, background: pro.panel }}>
              <div className="h-2.5 w-16 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="h-7 w-24 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border p-5 animate-pulse"
             style={{ borderColor: pro.border, background: pro.panel }}>
          <div className="h-[200px] rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
        <Card>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
              <SkeletonRow />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="space-y-5 max-w-[1200px]">
        <PageHeader
          title="Facturation"
          subtitle="Revenus récurrents et abonnements"
          right={
            <IconBtn onClick={load} title="Rafraîchir">
              <RefreshCw className="w-4 h-4" />
            </IconBtn>
          }
        />
        <Card>
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: pro.bad }} />
            <p className="text-[13px] font-medium" style={{ color: pro.text }}>
              Impossible de charger les données
            </p>
            <p className="text-[12px] mt-1" style={{ color: pro.textTer }}>
              Vérifiez votre connexion et réessayez.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  /* ── Main render ── */
  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Facturation"
        subtitle="Revenus récurrents et abonnements"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className="w-4 h-4" />
          </IconBtn>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={DollarSign}
          label="MRR"
          value={`${Math.round(mrr)}€`}
          hint="Récurrent mensuel"
        />
        <Stat
          icon={Users}
          label="Clients actifs"
          value={activeClients.length}
          hint="Abonnements actifs"
        />
        <Stat
          icon={Clock}
          label="En essai"
          value={trialClients.length}
          hint="Période d'essai"
        />
        <Stat
          icon={AlertCircle}
          label="Impayés"
          value={failedPayments.length}
          hint="past_due + unpaid"
        />
      </div>

      {/* MRR Trend Chart */}
      <section>
        <SectionHead title="Tendance MRR" />
        <Card>
          <div className="p-5">
            {chartData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <p className="text-[13px]" style={{ color: pro.textTer }}>
                  Données insuffisantes
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={pro.accent} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={pro.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(255,255,255,0.04)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: pro.textTer }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: pro.textTer }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}€`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke={pro.accent}
                    strokeWidth={2}
                    fill="url(#mrrGrad)"
                    dot={false}
                    activeDot={{ r: 3, fill: pro.accent }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>

      {/* Failed payments */}
      {failedPayments.length > 0 && (
        <section>
          <SectionHead title="Paiements à relancer" />
          <Card>
            {failedPayments.map((c, i) => {
              const s = statusPill(c.subscriptionStatus);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3.5 px-4 py-3"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
                    style={{ background: 'rgba(239,68,68,0.10)', color: pro.bad }}
                  >
                    {initials(c.businessName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                      {c.businessName}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                      {c.contactEmail} · {Number(c.monthlyFee ?? 0).toFixed(0)}€/mois
                    </p>
                  </div>

                  <Pill color={s.color}>{s.label}</Pill>

                  <GhostBtn
                    size="sm"
                    onClick={() => retryPayment(c.id)}
                    disabled={retrying === c.id}
                  >
                    {retrying === c.id ? '…' : 'Relancer'}
                  </GhostBtn>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {/* Subscriptions table */}
      <section>
        <SectionHead
          title="Abonnements"
          action={
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: pro.textSec }}
            >
              {subscriptions.length}
            </span>
          }
        />
        <Card>
          {subscriptions.length === 0 ? (
            <div className="p-12 text-center" style={{ color: pro.textTer }}>
              <Users className="w-7 h-7 mx-auto mb-3 opacity-40" />
              <p className="text-[13px]">Aucun abonnement</p>
            </div>
          ) : (
            subscriptions.map((c, i) => {
              const s = statusPill(c.subscriptionStatus);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
                    style={{ background: 'rgba(255,255,255,0.05)', color: pro.text }}
                  >
                    {initials(c.businessName)}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                      {c.businessName}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                      {c.contactEmail || '—'} · Depuis {fmtDate(c.activationDate ?? c.createdAt)}
                    </p>
                  </div>

                  {/* Plan type */}
                  <div
                    className="hidden md:flex items-center gap-1.5 flex-shrink-0 text-[11.5px]"
                    style={{ color: pro.textSec }}
                  >
                    <CreditCard size={11} />
                    <span>{c.planType || '—'}</span>
                  </div>

                  {/* Fee */}
                  <div className="text-right flex-shrink-0 w-[72px]">
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: pro.text }}>
                      {Number(c.monthlyFee ?? 0).toFixed(0)}€
                    </p>
                    <p className="text-[10.5px]" style={{ color: pro.textTer }}>/mois</p>
                  </div>

                  <Pill color={s.color}>{s.label}</Pill>
                </div>
              );
            })
          )}
        </Card>
      </section>
    </div>
  );
}
