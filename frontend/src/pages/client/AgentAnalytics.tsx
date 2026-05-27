import { useEffect, useState } from 'react';
import { LineChart, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, PageHeader, SectionHead, PrimaryBtn, Pill, Stat } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

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
      addToast(`Échec: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const latest = history[0];

  return (
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />
      <PageHeader title="Analytics AI" subtitle="Digest hebdomadaire, anomalies, forecast et recommandations" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat icon={LineChart} label="Actions 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={LineChart} label="Actions 30j" value={dashboard?.last30d ?? 0} />
        <Stat icon={LineChart} label="Digests" value={history.length} />
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <SectionHead title="Actions analytics" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <PrimaryBtn onClick={() => run('digest', () => api.post('/agent/analytics/digest').then(r => r.data))} disabled={busy === 'digest'}>
              {busy === 'digest' ? <RefreshCw size={12} className="animate-spin" /> : <LineChart size={12} />}
              <span className="ml-1.5">Digest hebdo</span>
            </PrimaryBtn>
            <PrimaryBtn onClick={() => run('anomalies', () => api.post('/agent/analytics/anomalies').then(r => r.data))} disabled={busy === 'anomalies'}>
              {busy === 'anomalies' ? <RefreshCw size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
              <span className="ml-1.5">Détecter anomalies</span>
            </PrimaryBtn>
            <PrimaryBtn onClick={() => run('forecast', () => api.post('/agent/analytics/forecast', { metric: 'calls' }).then(r => r.data))} disabled={busy === 'forecast'}>
              {busy === 'forecast' ? <RefreshCw size={12} className="animate-spin" /> : <LineChart size={12} />}
              <span className="ml-1.5">Forecast appels</span>
            </PrimaryBtn>
            <PrimaryBtn onClick={() => run('recommend', () => api.post('/agent/analytics/recommend').then(r => r.data))} disabled={busy === 'recommend'}>
              {busy === 'recommend' ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span className="ml-1.5">Recommandations</span>
            </PrimaryBtn>
          </div>
        </div>
      </Card>

      {latest && (
        <Card>
          <div className="p-4">
            <SectionHead title={`Dernier digest · ${new Date(latest.createdAt).toLocaleDateString('fr-FR')}`} />
            {latest.content.insights && latest.content.insights.length > 0 && (
              <div className="mb-3">
                <p className="text-[11.5px] font-semibold mb-1" style={{ color: pro.textSec }}>Insights</p>
                <ul className="space-y-1">
                  {latest.content.insights.map((s, i) => (
                    <li key={i} className="text-[12px]" style={{ color: pro.text }}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {latest.content.recommendations && latest.content.recommendations.length > 0 && (
              <div>
                <p className="text-[11.5px] font-semibold mb-1" style={{ color: pro.textSec }}>Recommandations</p>
                <ul className="space-y-1">
                  {latest.content.recommendations.map((s, i) => (
                    <li key={i} className="text-[12px]" style={{ color: pro.text }}>↳ {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <div className="p-4">
          <SectionHead title="Historique des digests" />
          {history.length === 0 ? (
            <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>Aucun digest généré.</p>
          ) : (
            <ul className="space-y-0">
              {history.slice(0, 12).map((h, i) => (
                <li key={h.id} className="py-2.5" style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: pro.text }}>
                      {new Date(h.createdAt).toLocaleString('fr-FR')}
                    </span>
                    <Pill color={h.status === 'completed' ? 'ok' : 'info'}>{h.status}</Pill>
                    {h.content.anomalies && h.content.anomalies.length > 0 && (
                      <Pill color="warn">{h.content.anomalies.length} anomalies</Pill>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
