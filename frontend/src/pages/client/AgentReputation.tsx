import { useEffect, useState } from 'react';
import { Star, RefreshCw, Send } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, PageHeader, SectionHead, PrimaryBtn, Pill, Stat } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

interface ReviewActivity {
  id: string;
  type: string;
  platform: string | null;
  rating: number | null;
  status: string;
  content: { reply?: string; reviewText?: string; shouldEscalate?: boolean };
  createdAt: string;
}

interface Dashboard {
  last24h: number;
  last30d: number;
  avgRating: number | null;
  reviewCount: number;
}

export default function AgentReputation() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [reviews, setReviews] = useState<ReviewActivity[]>([]);
  const [platform, setPlatform] = useState('google');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [drafting, setDrafting] = useState(false);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const reload = async () => {
    try {
      const [d, r] = await Promise.all([
        api.get('/agent/reputation/dashboard'),
        api.get('/agent/reputation/reviews'),
      ]);
      setDashboard(d.data);
      setReviews(r.data ?? []);
    } catch (e: any) {
      addToast(`Erreur: ${e?.response?.data?.error ?? e.message}`, 'error');
    }
  };

  useEffect(() => { void reload(); }, []);

  const draft = async () => {
    if (!reviewText.trim()) return;
    setDrafting(true);
    try {
      await api.post('/agent/reputation/draft', { platform, rating, reviewText: reviewText.trim() });
      addToast('Réponse générée', 'success');
      setReviewText('');
      await reload();
    } catch (e: any) {
      addToast(`Échec: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />
      <PageHeader title="Reputation AI" subtitle="Monitoring avis Google et Facebook + génération de réponses" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat icon={Star} label="Avis traités 30j" value={dashboard?.reviewCount ?? 0} />
        <Stat icon={Star} label="Note moyenne" value={dashboard?.avgRating ? dashboard.avgRating.toFixed(1) : 0} />
        <Stat icon={Star} label="Activités 24h" value={dashboard?.last24h ?? 0} />
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <SectionHead title="Générer une réponse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Plateforme</span>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              >
                <option value="google">Google</option>
                <option value="facebook">Facebook</option>
                <option value="yelp">Yelp</option>
                <option value="tripadvisor">TripAdvisor</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Note (étoiles)</span>
              <select
                value={rating}
                onChange={e => setRating(parseInt(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} étoile{n > 1 ? 's' : ''}</option>)}
              </select>
            </label>
            <label className="block md:col-span-3">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Texte de l'avis</span>
              <textarea
                rows={3}
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder="Collez ici le texte de l'avis client…"
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <PrimaryBtn onClick={draft} disabled={drafting || !reviewText.trim()}>
              {drafting ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
              <span className="ml-1.5">{drafting ? 'Génération…' : 'Générer la réponse'}</span>
            </PrimaryBtn>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <SectionHead title="Avis récents" />
          {reviews.length === 0 ? (
            <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>Aucun avis encore.</p>
          ) : (
            <ul className="space-y-0">
              {reviews.slice(0, 20).map((r, i) => (
                <li key={r.id} className="py-2.5" style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[12px] font-semibold" style={{ color: pro.text }}>{r.platform}</span>
                    {r.rating != null && <Pill color={r.rating <= 2 ? 'bad' : r.rating <= 3 ? 'warn' : 'ok'}>{r.rating}/5</Pill>}
                    <Pill color={r.content.shouldEscalate ? 'warn' : 'info'}>{r.status}</Pill>
                  </div>
                  {r.content.reviewText && (
                    <p className="text-[11px]" style={{ color: pro.textSec }}>« {String(r.content.reviewText).slice(0, 180)} »</p>
                  )}
                  {r.content.reply && (
                    <p className="text-[11.5px] mt-1" style={{ color: pro.text }}>↳ {String(r.content.reply).slice(0, 240)}</p>
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
