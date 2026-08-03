import { useEffect, useState } from 'react';
import { LineChart, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
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

interface DigestActivity {
  id: string;
  type: string;
  status: string;
  content: {
    insights?: string[];
    recommendations?: string[];
    anomalies?: Array<{ metric: string; severity: string; explanation: string }>;
  };
  createdAt: string;
}

interface Dashboard { last24h: number; last30d: number }

export default function AgentAnalytics() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [history, setHistory] = useState<DigestActivity[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const reload = async () => {
    try {
      const [d, h] = await Promise.all([
        api.get('/agent/analytics/dashboard'),
        api.get('/agent/analytics/history'),
      ]);
      setDashboard(d.data);
      setHistory(h.data ?? []);
    } catch (e: any) {
      addToast(`Erreur: ${e?.response?.data?.error ?? e.message}`, 'error');
    }
  };

  useEffect(() => { void reload(); }, []);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      addToast(`${label} OK`, 'success');
      await reload();
    } catch (e: any) {
      addToast(`Échec ${label}: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const latest = history[0];

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Digest hebdomadaire, anomalies, forecast et recommandations">
        <GhostBtn onClick={() => void reload()}>
          <RefreshCw size={13} aria-hidden="true" />
          Actualiser
        </GhostBtn>
      </PageActions>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat icon={LineChart} label="Actions 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={LineChart} label="Actions 30j" value={dashboard?.last30d ?? 0} />
        <Stat icon={LineChart} label="Digests" value={history.length} />
      </div>

      <Card>
        <SectionHead title="Actions analytics" />
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryBtn
            onClick={() => run('digest', () => api.post('/agent/analytics/digest').then(r => r.data))}
            disabled={busy === 'digest'}
          >
            {busy === 'digest'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <LineChart size={13} aria-hidden="true" />}
            Digest hebdo
          </PrimaryBtn>
          <GhostBtn
            onClick={() => run('anomalies', () => api.post('/agent/analytics/anomalies').then(r => r.data))}
            disabled={busy === 'anomalies'}
          >
            {busy === 'anomalies'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <AlertTriangle size={13} aria-hidden="true" />}
            Détecter anomalies
          </GhostBtn>
          <GhostBtn
            onClick={() => run('forecast', () => api.post('/agent/analytics/forecast', { metric: 'calls' }).then(r => r.data))}
            disabled={busy === 'forecast'}
          >
            {busy === 'forecast'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <LineChart size={13} aria-hidden="true" />}
            Forecast appels
          </GhostBtn>
          <GhostBtn
            onClick={() => run('recommend', () => api.post('/agent/analytics/recommend').then(r => r.data))}
            disabled={busy === 'recommend'}
          >
            {busy === 'recommend'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <Sparkles size={13} aria-hidden="true" />}
            Recommandations
          </GhostBtn>
        </div>
      </Card>

      {latest && (
        <Card>
          <SectionHead title={`Dernier digest · ${new Date(latest.createdAt).toLocaleDateString('fr-FR')}`} />
          {latest.content.insights && latest.content.insights.length > 0 && (
            <div className="mb-4">
              <p className="text-[12px] font-medium text-q2-mist mb-1.5">Insights</p>
              <ul className="list-disc pl-4 space-y-1 marker:text-q2-fog">
                {latest.content.insights.map((s, i) => (
                  <li key={i} className="text-[13px] text-white q2-body-text">{s}</li>
                ))}
              </ul>
            </div>
          )}
          {latest.content.recommendations && latest.content.recommendations.length > 0 && (
            <div>
              <p className="text-[12px] font-medium text-q2-mist mb-1.5">Recommandations</p>
              <ul className="list-disc pl-4 space-y-1 marker:text-q2-lift">
                {latest.content.recommendations.map((s, i) => (
                  <li key={i} className="text-[13px] text-white q2-body-text">{s}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card pad={false}>
        <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
          <SectionHead
            className="mb-0"
            title="Historique des digests"
            action={<span className="text-[11px] text-q2-fog tabular-nums">{history.length}</span>}
          />
        </div>
        {history.length === 0 ? (
          <EmptyState icon={LineChart} title="Aucun digest généré." description="Lancez un digest hebdomadaire." />
        ) : (
          <ul>
            {history.slice(0, 12).map((h, i) => (
              <li key={h.id}>
                <Row
                  first={i === 0}
                  label={<span className="tabular-nums">{new Date(h.createdAt).toLocaleString('fr-FR')}</span>}
                  right={
                    <>
                      {h.content.anomalies && h.content.anomalies.length > 0 && (
                        <Pill tone="warn">{h.content.anomalies.length} anomalies</Pill>
                      )}
                      <Pill tone={h.status === 'completed' ? 'ok' : 'info'}>{h.status}</Pill>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
