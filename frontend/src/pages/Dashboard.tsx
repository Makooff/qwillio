import { useEffect, useState } from 'react';
import QwillioLoader from '../components/QwillioLoader';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';
import {
  AlertCircle, Calendar, ChevronDown, SlidersHorizontal,
  Phone, Sparkles,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { pro } from '../styles/pro-theme';
import { PrimaryBtn } from '../components/pro/ProBlocks';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardHero } from '../components/dashboard/DashboardHero';
import { DashboardActivityFeed } from '../components/dashboard/DashboardActivityFeed';
import { DashboardQuickActions } from '../components/dashboard/DashboardQuickActions';
import {
  KpiSplit, HeroTrendPanel, RadialGauge, TallyMeter, DetailCard, AttentionList,
  SegmentBar, InsightCard,
  type KpiCell, type AttnItem, type Tone, type Dir,
} from '../components/dashboard/OverviewBlocks';

const API = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com';

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function SkeletonCard({ h = 'h-24' }: { h?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl ${h}`}
      style={{ background: pro.panel, border: `1px solid ${pro.border}` }}
    />
  );
}

export default function Dashboard() {
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('qw-intro-played'));
  const [introFading, setIntroFading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const { botStatus, stats, activity, callsChart, anomalies, loading, error, refetch } = useDashboardData(10_000);

  useEffect(() => {
    if (!showIntro) return;
    const fadeTimer = window.setTimeout(() => setIntroFading(true), 2300);
    const hideTimer = window.setTimeout(() => {
      setShowIntro(false);
      sessionStorage.setItem('qw-intro-played', '1');
    }, 2750);
    return () => { window.clearTimeout(fadeTimer); window.clearTimeout(hideTimer); };
  }, [showIntro]);

  const toggleBot = async () => {
    if (!botStatus) return;
    setBusy(true);
    const action = botStatus.isActive ? 'stop' : 'start';
    try {
      const r = await fetch(`${API}/api/bot/${action}`, { method: 'POST', headers: getHeaders() });
      if (!r.ok) {
        const err: unknown = await r.json().catch(() => ({}));
        const msg = (err as Record<string, string>).error ?? 'Échec';
        addToast(`Erreur ${r.status}: ${msg}`, 'error');
      }
    } catch (e: unknown) {
      addToast(`Erreur réseau : ${e instanceof Error ? e.message : 'inconnu'}`, 'error');
    }
    await refetch();
    setBusy(false);
  };

  const quickAction = async (label: string, endpoint: string) => {
    setActionBusy(label);
    try {
      const r = await fetch(`${API}/api/${endpoint}`, { method: 'POST', headers: getHeaders() });
      if (!r.ok) addToast(`Erreur ${r.status}`, 'error');
    } catch { /* intentional */ }
    setActionBusy(null);
    await refetch();
  };

  if (loading) {
    return (
      <div className="space-y-4 admin-page">
        <SkeletonCard h="h-36" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3"><SkeletonCard h="h-56" /></div>
          <div className="lg:col-span-2"><SkeletonCard h="h-56" /></div>
        </div>
      </div>
    );
  }

  if (error && !botStatus && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <AlertCircle className="w-9 h-9 mb-3" style={{ color: pro.bad }} />
        <p className="text-sm mb-4" style={{ color: pro.textSec }}>{error}</p>
        <PrimaryBtn onClick={refetch}>Réessayer</PrimaryBtn>
      </div>
    );
  }

  const latestTs = activity[0]?.createdAt ?? activity[0]?.timestamp;
  const subtitle = latestTs
    ? `Mis à jour ${formatDistanceToNow(new Date(latestTs), { addSuffix: true, locale: fr })}`
    : undefined;

  // ── Derived figures for the Efferd-style layout ──────────────────────────────
  const mrr = stats?.revenue.mrr ?? 0;
  const activeClients = stats?.clients.totalActive ?? 0;
  const prospectsTotal = stats?.prospects.total ?? 0;
  const newProspects = stats?.prospects.newThisMonth ?? 0;
  const hotLeads = stats?.hotLeads ?? 0;
  const callsToday = botStatus?.callsToday ?? 0;
  const callsQuota = botStatus?.callsQuota ?? 0;
  const eligible = botStatus?.eligibleProspects ?? 0;
  const quotaPct = callsQuota > 0 ? Math.min(100, Math.round((callsToday / callsQuota) * 100)) : 0;
  const hotPct = prospectsTotal > 0 ? Math.round((hotLeads / prospectsTotal) * 100) : 0;

  const callsTotal = callsChart.reduce((s, d) => s + d.calls, 0);
  const heroSeries = callsChart.map((d) => ({
    label: new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    value: d.calls,
  }));
  const hMid = Math.floor(callsChart.length / 2);
  const h1 = callsChart.slice(0, hMid).reduce((s, d) => s + d.calls, 0);
  const h2 = callsChart.slice(hMid).reduce((s, d) => s + d.calls, 0);
  const heroPct = h1 > 0 ? Math.abs(Math.round(((h2 - h1) / h1) * 100)) : 0;
  const heroDir: Dir = h2 > h1 ? 'up' : h2 < h1 ? 'down' : 'flat';

  const kpis: KpiCell[] = [
    { label: 'Clients actifs', value: activeClients.toLocaleString('fr-FR') },
    { label: 'MRR', value: `${mrr.toLocaleString('fr-FR')} €` },
    { label: 'Prospects', value: prospectsTotal.toLocaleString('fr-FR'), hint: newProspects > 0 ? `+${newProspects} ce mois` : 'Aucun nouveau ce mois' },
  ];

  const severityTone = (s: string): Tone => {
    const v = s.toLowerCase();
    if (v === 'high' || v === 'critical') return 'bad';
    if (v === 'medium' || v === 'warning') return 'warn';
    return 'neutral';
  };
  const attn: AttnItem[] = anomalies.slice(0, 5).map((a) => ({
    icon: AlertCircle,
    label: a.diagnosis || a.metric,
    to: '/admin/agents',
    tone: severityTone(a.severity),
  }));

  const insightText = stats
    ? <><strong className="font-semibold">{activeClients}</strong> clients actifs génèrent <strong className="font-semibold">{mrr.toLocaleString('fr-FR')} €</strong> de revenu récurrent, avec <strong className="font-semibold">{hotLeads}</strong> leads chauds à convertir.</>
    : <>Les indicateurs de la plateforme se chargent.</>;

  return (
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />

      {showIntro && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: pro.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: introFading ? 0 : 1,
            transition: 'opacity 450ms var(--ease-out)',
            pointerEvents: introFading ? 'none' : 'auto',
          }}
        >
          <QwillioLoader fullscreen={false} size={160} />
        </div>
      )}

      {/* Header — greeting + period controls */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight" style={{ color: pro.text }}>Bon retour</h1>
          {subtitle && <p className="text-[12.5px] mt-0.5" style={{ color: pro.textSec }}>{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-medium transition-colors"
            style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
          >
            30 derniers jours <ChevronDown size={14} style={{ color: pro.textSec }} />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-medium transition-colors"
            style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.textSec }}
          >
            <Calendar size={14} />
            {new Date(Date.now() - 29 * 864e5).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            {' – '}
            {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-medium transition-colors"
            style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.textSec }}
          >
            <SlidersHorizontal size={14} /> Personnaliser
          </button>
        </div>
      </header>

      <DashboardHero status={botStatus} busy={busy} onToggle={toggleBot} />

      {/* KPI split row — borderless figures with a hairline under */}
      <section aria-label="Indicateurs clés" className="pb-6 border-b border-white/[0.06]">
        <KpiSplit items={kpis} />
      </section>

      {/* Main grid — content + right rail, separated by a vertical hairline */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] xl:divide-x divide-white/[0.06]">
        {/* Left column */}
        <div className="min-w-0 divide-y divide-white/[0.06] xl:pr-6">
          <HeroTrendPanel
            value={callsTotal.toLocaleString('fr-FR')}
            label="Appels sur la période"
            delta={heroPct > 0 ? { pct: heroPct, dir: heroDir } : undefined}
            deltaSuffix="sur la période"
            series={heroSeries}
            unit="appels"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-white/[0.06]">
            <div className="md:pr-6">
              <InsightCard
                kicker="Analyse IA"
                icon={Sparkles}
                action={{ label: 'Voir les leads', to: '/admin/leads' }}
              >
                {insightText}
              </InsightCard>
            </div>
            <div className="md:pl-6">
              <SegmentBar
                title="Quota d’appels du jour"
                value={callsToday.toLocaleString('fr-FR')}
                hint={callsQuota > 0 ? `sur ${callsQuota.toLocaleString('fr-FR')} appels autorisés` : 'Quota non défini'}
                segments={callsQuota > 0
                  ? [
                      { label: 'Passés', pct: quotaPct, bright: true },
                      { label: 'Restant', pct: 100 - quotaPct },
                    ]
                  : [{ label: 'Appels du jour', pct: 100, bright: true }]}
                action={{ label: 'Détails', to: '/admin/calls' }}
              />
            </div>
          </div>
        </div>

        {/* Right rail — flat, divided by hairlines */}
        <div className="divide-y divide-white/[0.06] border-t border-white/[0.06] xl:border-t-0 xl:pl-6">
          <RadialGauge
            caption="Quota du jour"
            value={callsToday.toLocaleString('fr-FR')}
            fraction={callsQuota > 0 ? quotaPct / 100 : 0}
            icon={Phone}
            legend={callsQuota > 0
              ? [
                  { label: 'Passés', value: callsToday.toLocaleString('fr-FR'), bright: true },
                  { label: 'Quota', value: callsQuota.toLocaleString('fr-FR') },
                ]
              : [{ label: 'Aujourd’hui', value: callsToday.toLocaleString('fr-FR'), bright: true }]}
            action={{ label: 'Voir les appels', to: '/admin/calls' }}
          />

          <TallyMeter
            caption="Leads chauds (≥ 8)"
            value={hotLeads.toLocaleString('fr-FR')}
            pct={hotPct}
            legend={[
              { label: 'Chauds', value: '', bright: true },
              { label: 'Prospects', value: '' },
            ]}
          />

          <DetailCard
            title="Plateforme"
            rows={[
              { k: 'MRR', v: `${mrr.toLocaleString('fr-FR')} €` },
              { k: 'Clients actifs', v: activeClients.toLocaleString('fr-FR') },
              { k: 'Prospects éligibles', v: eligible.toLocaleString('fr-FR') },
              { k: 'Bot', v: botStatus?.isActive ? 'En marche' : 'Arrêté', status: botStatus?.isActive ? 'ok' : 'warn' },
            ]}
            action={{ label: 'Facturation', to: '/admin/billing' }}
          />

          <AttentionList title="À traiter" items={attn} empty="Aucune anomalie détectée." />
        </div>
      </div>

      <DashboardActivityFeed activity={activity} />

      <DashboardQuickActions busy={actionBusy} onAction={quickAction} />
    </div>
  );
}
