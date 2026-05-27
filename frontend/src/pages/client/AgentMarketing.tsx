import { useEffect, useState } from 'react';
import { Megaphone, RefreshCw, Send } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, PageHeader, SectionHead, PrimaryBtn, Pill, Stat } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

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
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />
      <PageHeader title="Marketing AI" subtitle="Posts sociaux, emails campagne, ad copy adaptés à votre niche" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat icon={Megaphone} label="Activités 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={Megaphone} label="Activités 30j" value={dashboard?.last30d ?? 0} />
        <Stat icon={Megaphone} label="Total publié"
          value={dashboard?.byStatus?.find(s => s.status === 'approved')?._count?._all ?? 0} />
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <SectionHead title="Générer un contenu" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Type</span>
              <select
                value={contentType}
                onChange={e => setContentType(e.target.value as typeof contentType)}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              >
                <option value="social_post">Post réseaux sociaux</option>
                <option value="campaign_email">Email campagne</option>
                <option value="ad_copy">Texte publicitaire</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Canal</span>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="email">Email</option>
                <option value="google_ads">Google Ads</option>
              </select>
            </label>
            <label className="block md:col-span-3">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Sujet</span>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="ex: promo été, lancement nouveau service…"
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <PrimaryBtn onClick={generate} disabled={generating || !topic.trim()}>
              {generating ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
              <span className="ml-1.5">{generating ? 'Génération…' : 'Générer'}</span>
            </PrimaryBtn>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <SectionHead title="Contenus récents" />
          {activity.length === 0 ? (
            <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>
              Aucun contenu généré pour le moment.
            </p>
          ) : (
            <ul className="space-y-3 mt-2">
              {activity.slice(0, 20).map(a => (
                <li key={a.id} className="py-2.5" style={{ borderTop: `1px solid ${pro.border}` }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <span className="text-[12px] font-semibold" style={{ color: pro.text }}>
                      {a.content?.title || a.type}
                    </span>
                    <div className="flex items-center gap-2">
                      <Pill color={a.status === 'approved' ? 'ok' : 'info'}>{a.status}</Pill>
                      <span className="text-[10.5px]" style={{ color: pro.textTer }}>{a.channel}</span>
                    </div>
                  </div>
                  {a.content?.body && (
                    <p className="text-[11.5px] leading-snug" style={{ color: pro.textSec }}>
                      {String(a.content.body).slice(0, 240)}
                    </p>
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
