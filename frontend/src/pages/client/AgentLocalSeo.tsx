import { useEffect, useState } from 'react';
import { MapPin, RefreshCw, Send } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, PageHeader, SectionHead, PrimaryBtn, Pill, Stat } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

interface Activity {
  id: string;
  type: string;
  platform: string | null;
  keyword: string | null;
  status: string;
  content: { result?: Record<string, unknown>; recommendations?: string[]; topic?: string };
  createdAt: string;
}

interface Dashboard { last24h: number; last30d: number }

export default function AgentLocalSeo() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const reload = async () => {
    try {
      const [d, a] = await Promise.all([
        api.get('/agent/local-seo/dashboard'),
        api.get('/agent/local-seo/activity'),
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
      await fn();
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
      <PageHeader title="Local SEO AI" subtitle="Posts GMB, audit fiche, mots-clés locaux" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat icon={MapPin} label="Actions 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={MapPin} label="Actions 30j" value={dashboard?.last30d ?? 0} />
        <Stat icon={MapPin} label="GMB posts" value={activity.filter(a => a.type === 'gmb_post_drafted').length} />
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <SectionHead title="Générer un post Google Business" />
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Sujet du post (ex: promo été, nouveau service)"
            className="w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
            style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <PrimaryBtn
              onClick={() => run('gmb', () => api.post('/agent/local-seo/gmb-post', { topic: topic.trim() || 'actualité' }).then(r => r.data))}
              disabled={busy === 'gmb' || !topic.trim()}
            >
              {busy === 'gmb' ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
              <span className="ml-1.5">Générer post</span>
            </PrimaryBtn>
            <PrimaryBtn
              onClick={() => run('keywords', () => api.post('/agent/local-seo/keywords', { count: 20 }).then(r => r.data))}
              disabled={busy === 'keywords'}
            >
              {busy === 'keywords' ? <RefreshCw size={12} className="animate-spin" /> : <MapPin size={12} />}
              <span className="ml-1.5">Suggérer mots-clés</span>
            </PrimaryBtn>
            <PrimaryBtn
              onClick={() => run('audit', () => api.post('/agent/local-seo/audit', { listing: { businessName: 'Mon entreprise', address: '', phone: '', website: '', categories: [] } }).then(r => r.data))}
              disabled={busy === 'audit'}
            >
              {busy === 'audit' ? <RefreshCw size={12} className="animate-spin" /> : <MapPin size={12} />}
              <span className="ml-1.5">Auditer ma fiche</span>
            </PrimaryBtn>
          </div>
        </div>
      </Card>

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
                    {a.platform && <Pill color="info">{a.platform}</Pill>}
                    <Pill color={a.status === 'completed' ? 'ok' : 'info'}>{a.status}</Pill>
                  </div>
                  {a.content.recommendations && a.content.recommendations.length > 0 && (
                    <ul className="text-[11px] mt-1 space-y-0.5" style={{ color: pro.textSec }}>
                      {a.content.recommendations.slice(0, 3).map((rec, idx) => <li key={idx}>• {rec}</li>)}
                    </ul>
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
