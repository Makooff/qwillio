import { useEffect, useState } from 'react';
import { Users, RefreshCw, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, PageHeader, SectionHead, PrimaryBtn, Pill, Stat } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

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
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />
      <PageHeader title="CRM AI" subtitle="Pipeline, forecast, relances et analyse de pertes" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Stat icon={Users} label="Deals total" value={dashboard?.dealCount ?? 0} />
        <Stat icon={Users} label="Actions 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={Users} label="Actions 30j" value={dashboard?.last30d ?? 0} />
        <Stat icon={TrendingUp} label="Forecast (€)" value={forecast?.forecast?.weightedTotal ?? 0} />
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <SectionHead title="Actions rapides" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <PrimaryBtn onClick={() => run('sync', () => api.post('/agent/crm/sync').then(r => r.data))} disabled={busy === 'sync'}>
              {busy === 'sync' ? <RefreshCw size={12} className="animate-spin" /> : <Users size={12} />}
              <span className="ml-1.5">Synchroniser HubSpot</span>
            </PrimaryBtn>
            <PrimaryBtn onClick={() => run('forecast', () => api.post('/agent/crm/forecast', { periodMonths: 3 }).then(r => r.data))} disabled={busy === 'forecast'}>
              {busy === 'forecast' ? <RefreshCw size={12} className="animate-spin" /> : <TrendingUp size={12} />}
              <span className="ml-1.5">Forecast 3 mois</span>
            </PrimaryBtn>
            <PrimaryBtn onClick={() => run('analyze', () => api.post('/agent/crm/analyze-lost').then(r => r.data))} disabled={busy === 'analyze'}>
              {busy === 'analyze' ? <RefreshCw size={12} className="animate-spin" /> : <Users size={12} />}
              <span className="ml-1.5">Analyser deals perdus</span>
            </PrimaryBtn>
          </div>
        </div>
      </Card>

      {dashboard?.byStage && Object.keys(dashboard.byStage).length > 0 && (
        <Card>
          <div className="p-4">
            <SectionHead title="Pipeline par étape" />
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(dashboard.byStage).map(([stage, count]) => (
                <Pill key={stage} color={stage.includes('won') ? 'ok' : stage.includes('lost') ? 'bad' : 'info'}>
                  {stage}: {count}
                </Pill>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-4">
          <SectionHead title="Activité récente" />
          {activity.length === 0 ? (
            <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>Aucune activité.</p>
          ) : (
            <ul className="space-y-0">
              {activity.slice(0, 20).map((a, i) => (
                <li key={a.id} className="py-2.5" style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[12px] font-semibold" style={{ color: pro.text }}>{a.type}</span>
                    <Pill color={a.status === 'completed' ? 'ok' : 'info'}>{a.status}</Pill>
                  </div>
                  {a.content.summary && (
                    <p className="text-[11px]" style={{ color: pro.textSec }}>{String(a.content.summary).slice(0, 240)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
