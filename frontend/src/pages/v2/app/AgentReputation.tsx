import { useEffect, useState } from 'react';
import { Star, RefreshCw, Send } from 'lucide-react';
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
  Select,
  Textarea,
  EmptyState,
} from '../../../components/v2/app/Blocks';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';

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
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Monitoring avis Google et Facebook + génération de réponses">
        <GhostBtn onClick={() => void reload()}>
          <RefreshCw size={13} aria-hidden="true" />
          Actualiser
        </GhostBtn>
      </PageActions>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat icon={Star} label="Avis traités 30j" value={dashboard?.reviewCount ?? 0} />
        <Stat icon={Star} label="Note moyenne" value={dashboard?.avgRating ? dashboard.avgRating.toFixed(1) : 0} />
        <Stat icon={Star} label="Activités 24h" value={dashboard?.last24h ?? 0} />
      </div>

      <Card>
        <SectionHead title="Générer une réponse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Plateforme">
            <Select value={platform} onChange={e => setPlatform(e.target.value)}>
              <option value="google">Google</option>
              <option value="facebook">Facebook</option>
              <option value="yelp">Yelp</option>
              <option value="tripadvisor">TripAdvisor</option>
            </Select>
          </Field>
          <Field label="Note (étoiles)">
            <Select value={rating} onChange={e => setRating(parseInt(e.target.value))}>
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n} étoile{n > 1 ? 's' : ''}</option>
              ))}
            </Select>
          </Field>
          <Field label="Texte de l'avis" className="md:col-span-2">
            <Textarea
              rows={3}
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="Collez ici le texte de l'avis client…"
            />
          </Field>
        </div>
        <div className="flex justify-end mt-4">
          <PrimaryBtn onClick={draft} disabled={drafting || !reviewText.trim()}>
            {drafting
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <Send size={13} aria-hidden="true" />}
            {drafting ? 'Génération…' : 'Générer la réponse'}
          </PrimaryBtn>
        </div>
      </Card>

      <Card pad={false}>
        <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
          <SectionHead
            className="mb-0"
            title="Avis récents"
            action={<span className="text-[11px] text-q2-fog tabular-nums">{reviews.length}</span>}
          />
        </div>
        {reviews.length === 0 ? (
          <EmptyState icon={Star} title="Aucun avis encore." description="Les avis traités par l'agent apparaîtront ici." />
        ) : (
          <ul>
            {reviews.slice(0, 20).map((r, i) => (
              <li key={r.id} className={`px-4 py-3 ${i === 0 ? '' : 'border-t border-q2-graphite-d'}`}>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[13.5px] font-medium text-white">{r.platform}</span>
                  {r.rating != null && (
                    <Pill tone={r.rating <= 2 ? 'bad' : r.rating <= 3 ? 'warn' : 'ok'}>{r.rating}/5</Pill>
                  )}
                  <Pill tone={r.content.shouldEscalate ? 'warn' : 'info'}>{r.status}</Pill>
                </div>
                {r.content.reviewText && (
                  <p className="text-[12.5px] text-q2-fog q2-body-text">
                    « {String(r.content.reviewText).slice(0, 180)} »
                  </p>
                )}
                {r.content.reply && (
                  <p className="text-[13px] text-q2-mist q2-body-text mt-1.5">
                    {String(r.content.reply).slice(0, 240)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
