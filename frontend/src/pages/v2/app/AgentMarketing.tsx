import { useEffect, useState } from 'react';
import { Megaphone, RefreshCw, Send } from '../../../components/icons';
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
  Field,
  Select,
  Input,
  EmptyState,
} from '../../../components/v2/app/Blocks';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';

interface Activity {
  id: string;
  type: string;
  channel: string | null;
  status: string;
  content: Record<string, unknown> & { title?: string; body?: string; callToAction?: string };
  createdAt: string;
}

interface Dashboard {
  last24h: number;
  last30d: number;
  byStatus: Array<{ status: string; _count: { _all: number } }>;
}

export default function AgentMarketing() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [topic, setTopic] = useState('');
  const [channel, setChannel] = useState('facebook');
  const [contentType, setContentType] = useState<'social_post' | 'campaign_email' | 'ad_copy'>('social_post');
  const [generating, setGenerating] = useState(false);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const reload = async () => {
    try {
      const [d, a] = await Promise.all([
        api.get('/agent/marketing/dashboard'),
        api.get('/agent/marketing/activity'),
      ]);
      setDashboard(d.data);
      setActivity(a.data ?? []);
    } catch (e: any) {
      addToast(`Erreur chargement: ${e?.response?.data?.error ?? e.message}`, 'error');
    }
  };

  useEffect(() => { void reload(); }, []);

  const generate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      await api.post('/agent/marketing/generate', { contentType, topic: topic.trim(), channel });
      addToast('Contenu généré', 'success');
      setTopic('');
      await reload();
    } catch (e: any) {
      addToast(`Échec: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Posts sociaux, emails campagne, ad copy adaptés à votre niche">
        <GhostBtn onClick={() => void reload()}>
          <RefreshCw size={13} aria-hidden="true" />
          Actualiser
        </GhostBtn>
      </PageActions>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat icon={Megaphone} label="Activités 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={Megaphone} label="Activités 30j" value={dashboard?.last30d ?? 0} />
        <Stat
          icon={Send}
          label="Total publié"
          value={dashboard?.byStatus?.find(s => s.status === 'approved')?._count?._all ?? 0}
        />
      </div>

      <Card>
        <SectionHead title="Générer un contenu" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={contentType} onChange={e => setContentType(e.target.value as typeof contentType)}>
              <option value="social_post">Post réseaux sociaux</option>
              <option value="campaign_email">Email campagne</option>
              <option value="ad_copy">Texte publicitaire</option>
            </Select>
          </Field>
          <Field label="Canal">
            <Select value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="email">Email</option>
              <option value="google_ads">Google Ads</option>
            </Select>
          </Field>
          <Field label="Sujet" className="md:col-span-2">
            <Input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="ex: promo été, lancement nouveau service…"
            />
          </Field>
        </div>
        <div className="flex justify-end mt-4">
          <PrimaryBtn onClick={generate} disabled={generating || !topic.trim()}>
            {generating
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <Send size={13} aria-hidden="true" />}
            {generating ? 'Génération…' : 'Générer'}
          </PrimaryBtn>
        </div>
      </Card>

      <Card pad={false}>
        <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
          <SectionHead
            className="mb-0"
            title="Contenus récents"
            action={<span className="text-[11px] text-q2-fog tabular-nums">{activity.length}</span>}
          />
        </div>
        {activity.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Aucun contenu généré pour le moment."
            description="Lancez une génération pour alimenter vos canaux."
          />
        ) : (
          <ul>
            {activity.slice(0, 20).map((a, i) => (
              <li key={a.id}>
                <Row
                  first={i === 0}
                  label={a.content?.title || a.type}
                  hint={a.content?.body ? String(a.content.body).slice(0, 240) : undefined}
                  right={
                    <>
                      {a.channel && <span className="text-[11px] text-q2-fog">{a.channel}</span>}
                      <Pill tone={a.status === 'approved' ? 'ok' : 'info'}>{a.status}</Pill>
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
