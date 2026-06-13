import { useEffect, useState } from 'react';
import QwillioLoader from '../components/QwillioLoader';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';
import { AlertCircle, Calendar, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { pro } from '../styles/pro-theme';
import { PrimaryBtn } from '../components/pro/ProBlocks';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardHero } from '../components/dashboard/DashboardHero';
import { DashboardKPIs } from '../components/dashboard/DashboardKPIs';
import { DashboardCallsChart } from '../components/dashboard/DashboardCallsChart';
import { DashboardActivityFeed } from '../components/dashboard/DashboardActivityFeed';
import { DashboardAnomalies } from '../components/dashboard/DashboardAnomalies';
import { DashboardQuickActions } from '../components/dashboard/DashboardQuickActions';
import { ChannelDonut } from '../components/pro/ChannelDonut';

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

      <DashboardKPIs stats={stats} />

      {/* Main row — large chart + channel donut rail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <DashboardCallsChart data={callsChart} className="lg:col-span-3" />
        <div className="lg:col-span-2">
          {/* Real channel-source split isn't tracked yet — honest empty state
              instead of placeholder percentages. Wire call source to populate. */}
          <ChannelDonut data={[]} />
        </div>
      </div>

      {/* Secondary row — recent activity + "à traiter" (anomalies) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <DashboardActivityFeed activity={activity} className="lg:col-span-3" />
        <div className="lg:col-span-2">
          <DashboardAnomalies anomalies={anomalies} />
        </div>
      </div>

      <DashboardQuickActions busy={actionBusy} onAction={quickAction} />
    </div>
  );
}
