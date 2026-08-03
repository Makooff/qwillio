import { useEffect, useState } from 'react';
import { Users, RefreshCw, TrendingUp, Search } from 'lucide-react';
import api from '../../../services/api';
import {
  Card,
  PageActions,
  SectionHead,
  Stat,
  Row,
  PrimaryBtn,
  GhostBtn,
  Pill,
  EmptyState,
} from '../../../components/v2/app/Blocks';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';

interface Activity {
  id: string;
  type: string;
  dealId: string | null;
  status: string;
  content: Record<string, unknown> & { summary?: string };
  createdAt: string;
}

interface Dashboard {
  dealCount: number;
  byStage: Record<string, number>;
  last24h: number;
  last30d: number;
}

interface Forecast {
  forecast: { horizonMonths: number; weightedTotal: number; openDealCount: number };
}

export default function AgentCrm() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const reload = async () => {
    try {
      const [d, a] = await Promise.all([
        api.get('/agent/crm/dashboard'),
        api.get('/agent/crm/activity'),
      ]);
      setDashboard(d.data);
      setActivity(a.data ?? []);
    } catch (e: any) {
      addToast(`Erreur: ${e?.response?.data?.error ?? e.message}`, 'error');
    }
  };

  useEffect(() => { void reload(); }, []);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      const r = await fn();
      if (label === 'forecast') setForecast(r as Forecast);
      addToast(`${label} OK`, 'success');
      await reload();
    } catch (e: any) {
      addToast(`Échec ${label}: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Pipeline, forecast, relances et analyse de pertes">
        <GhostBtn onClick={() => void reload()}>
          <RefreshCw size={13} aria-hidden="true" />
          Actualiser
        </GhostBtn>
      </PageActions>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Users} label="Deals total" value={dashboard?.dealCount ?? 0} />
        <Stat icon={Users} label="Actions 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={Users} label="Actions 30j" value={dashboard?.last30d ?? 0} />
        <Stat
          icon={TrendingUp}
          label="Forecast (€)"
          tone="accent"
          value={forecast?.forecast?.weightedTotal ?? 0}
          hint={forecast ? `${forecast.forecast.horizonMonths} mois · ${forecast.forecast.openDealCount} deals ouverts` : undefined}
        />
      </div>

      <Card>
        <SectionHead title="Actions rapides" />
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryBtn
            onClick={() => run('sync', () => api.post('/agent/crm/sync').then(r => r.data))}
            disabled={busy === 'sync'}
          >
            {busy === 'sync'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <Users size={13} aria-hidden="true" />}
            Synchroniser HubSpot
          </PrimaryBtn>
          <GhostBtn
            onClick={() => run('forecast', () => api.post('/agent/crm/forecast', { periodMonths: 3 }).then(r => r.data))}
            disabled={busy === 'forecast'}
          >
            {busy === 'forecast'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <TrendingUp size={13} aria-hidden="true" />}
            Forecast 3 mois
          </GhostBtn>
          <GhostBtn
            onClick={() => run('analyze', () => api.post('/agent/crm/analyze-lost').then(r => r.data))}
            disabled={busy === 'analyze'}
          >
            {busy === 'analyze'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <Search size={13} aria-hidden="true" />}
            Analyser deals perdus
          </GhostBtn>
        </div>
      </Card>

      {dashboard?.byStage && Object.keys(dashboard.byStage).length > 0 && (
        <Card>
          <SectionHead title="Pipeline par étape" />
          <div className="flex flex-wrap gap-2">
            {Object.entries(dashboard.byStage).map(([stage, count]) => (
              <Pill key={stage} tone={stage.includes('won') ? 'ok' : stage.includes('lost') ? 'bad' : 'info'}>
                {stage}: {count}
              </Pill>
            ))}
          </div>
        </Card>
      )}

      <Card pad={false}>
        <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
          <SectionHead
            className="mb-0"
            title="Activité récente"
            action={<span className="text-[11px] text-q2-fog tabular-nums">{activity.length}</span>}
          />
        </div>
        {activity.length === 0 ? (
          <EmptyState icon={Users} title="Aucune activité." description="Synchronisez votre CRM pour démarrer." />
        ) : (
          <ul>
            {activity.slice(0, 20).map((a, i) => (
              <li key={a.id}>
                <Row
                  first={i === 0}
                  label={a.type}
                  hint={a.content.summary ? String(a.content.summary).slice(0, 240) : undefined}
                  right={<Pill tone={a.status === 'completed' ? 'ok' : 'info'}>{a.status}</Pill>}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
