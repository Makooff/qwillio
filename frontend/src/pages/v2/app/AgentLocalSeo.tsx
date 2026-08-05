import { useEffect, useState } from 'react';
import { MapPin, RefreshCw, Send, KeyRound, ClipboardCheck } from '../../../components/icons';
import api from '../../../services/api';
import {
  Card,
  PageActions,
  SectionHead,
  Stat,
  PrimaryBtn,
  GhostBtn,
  Pill,
  Field,
  Input,
  EmptyState,
} from '../../../components/v2/app/Blocks';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';

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
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Posts GMB, audit fiche, mots-clés locaux">
        <GhostBtn onClick={() => void reload()}>
          <RefreshCw size={13} aria-hidden="true" />
          Actualiser
        </GhostBtn>
      </PageActions>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat icon={MapPin} label="Actions 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={MapPin} label="Actions 30j" value={dashboard?.last30d ?? 0} />
        <Stat icon={Send} label="GMB posts" value={activity.filter(a => a.type === 'gmb_post_drafted').length} />
      </div>

      <Card>
        <SectionHead title="Générer un post Google Business" />
        <Field label="Sujet du post">
          <Input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Sujet du post (ex: promo été, nouveau service)"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <PrimaryBtn
            onClick={() => run('gmb', () => api.post('/agent/local-seo/gmb-post', { topic: topic.trim() || 'actualité' }).then(r => r.data))}
            disabled={busy === 'gmb' || !topic.trim()}
          >
            {busy === 'gmb'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <Send size={13} aria-hidden="true" />}
            Générer post
          </PrimaryBtn>
          <GhostBtn
            onClick={() => run('keywords', () => api.post('/agent/local-seo/keywords', { count: 20 }).then(r => r.data))}
            disabled={busy === 'keywords'}
          >
            {busy === 'keywords'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <KeyRound size={13} aria-hidden="true" />}
            Suggérer mots-clés
          </GhostBtn>
          <GhostBtn
            onClick={() => run('audit', () => api.post('/agent/local-seo/audit', { listing: { businessName: 'Mon entreprise', address: '', phone: '', website: '', categories: [] } }).then(r => r.data))}
            disabled={busy === 'audit'}
          >
            {busy === 'audit'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <ClipboardCheck size={13} aria-hidden="true" />}
            Auditer ma fiche
          </GhostBtn>
        </div>
      </Card>

      <Card pad={false}>
        <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
          <SectionHead
            className="mb-0"
            title="Activité récente"
            action={<span className="text-[11px] text-q2-fog tabular-nums">{activity.length}</span>}
          />
        </div>
        {activity.length === 0 ? (
          <EmptyState icon={MapPin} title="Aucune activité." description="Lancez un audit ou un post pour démarrer." />
        ) : (
          <ul>
            {activity.slice(0, 20).map((a, i) => (
              <li key={a.id} className={`px-4 py-3 ${i === 0 ? '' : 'border-t border-q2-graphite-d'}`}>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[13.5px] font-medium text-white">{a.type}</span>
                  {a.platform && <Pill tone="info">{a.platform}</Pill>}
                  <Pill tone={a.status === 'completed' ? 'ok' : 'info'}>{a.status}</Pill>
                </div>
                {a.content.recommendations && a.content.recommendations.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5 marker:text-q2-fog">
                    {a.content.recommendations.slice(0, 3).map((rec, idx) => (
                      <li key={idx} className="text-[12.5px] text-q2-mist q2-body-text">{rec}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
