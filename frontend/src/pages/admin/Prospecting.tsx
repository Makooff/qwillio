import { useEffect, useState } from 'react';
import api from '../../services/api';
import { RefreshCw, Zap, Activity, Play, TrendingUp, Search, Phone, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import { StatCardSkeleton } from '../../components/ui/Skeleton';
import StatCard from '../../components/ui/StatCard';
import { t, glass } from '../../styles/admin-theme';

interface TriggerAction {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  icon: React.ReactNode;
}

const TRIGGERS: TriggerAction[] = [
  { id: 'scrape', label: 'Scraping Apify', description: 'Lancer scraping Google Maps', endpoint: '/prospecting/trigger/scrape', icon: <Search className="w-4 h-4" /> },
  { id: 'call', label: 'Tenter un appel', description: 'Déclencher 1 appel sortant', endpoint: '/prospecting/trigger/call', icon: <Phone className="w-4 h-4" /> },
  { id: 'ab-analysis', label: 'Analyse A/B', description: 'Analyser résultats tests A/B', endpoint: '/prospecting/trigger/ab-analysis', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'best-time', label: 'Meilleurs horaires', description: 'Calculer horaires optimaux', endpoint: '/prospecting/trigger/best-time', icon: <Clock className="w-4 h-4" /> },
  { id: 'script-learning', label: 'Script learning', description: 'Lancer optimisation script', endpoint: '/prospecting/trigger/script-learning', icon: <Activity className="w-4 h-4" /> },
  { id: 'follow-ups', label: 'Follow-ups', description: 'Traiter suivis dus', endpoint: '/prospecting/trigger/follow-ups', icon: <CheckCircle className="w-4 h-4" /> },
  { id: 'rescore', label: 'Re-scoring', description: 'Rescorer prospects non scorés', endpoint: '/prospecting/trigger/rescore', icon: <Zap className="w-4 h-4" /> },
  { id: 'seed-local-presence', label: 'Local presence', description: 'Alimenter numéros locaux', endpoint: '/prospecting/trigger/seed-local-presence', icon: <Phone className="w-4 h-4" /> },
];

export default function AdminProspecting() {
  const [status, setStatus] = useState<any>(null);
  const [abTests, setAbTests] = useState<any[]>([]);
  const [mutations, setMutations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = async () => {
    setLoading(true);
    const [s, a, m] = await Promise.all([
      api.get('/prospecting/status').catch(() => null),
      api.get('/prospecting/ab-tests').catch(() => null),
      api.get('/prospecting/mutations').catch(() => null),
    ]);
    if (s?.data) setStatus(s.data);
    if (a?.data) setAbTests(Array.isArray(a.data.data) ? a.data.data : (Array.isArray(a.data) ? a.data : []));
    if (m?.data) setMutations(Array.isArray(m.data.data) ? m.data.data : (Array.isArray(m.data) ? m.data : []));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const trigger = async (action: TriggerAction) => {
    setTriggering(action.id);
    try {
      await api.post(action.endpoint);
      toast(`${action.label} déclenché`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message ?? `Erreur ${action.label}`, 'error');
    } finally { setTriggering(null); }
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Moteur de prospection</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Contrôle et déclenchement manuel</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Engine Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Prospects trouvés" value={status?.prospectsFound ?? 0} icon={<Search className="w-4 h-4" />} />
          <StatCard label="Appels aujourd'hui" value={status?.callsToday ?? 0} icon={<Phone className="w-4 h-4" />} />
          <StatCard label="Tests A/B actifs" value={abTests.length} icon={<TrendingUp className="w-4 h-4" />} />
          <StatCard label="Mutations actives" value={mutations.length} icon={<Activity className="w-4 h-4" />} />
        </>}
      </div>

      {/* Triggers */}
      <div className="p-5" style={glass}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Déclenchement manuel</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {TRIGGERS.map(action => (
            <button key={action.id} onClick={() => trigger(action)} disabled={triggering === action.id}
              className="flex items-start gap-3 p-4 rounded-xl text-left transition-all disabled:opacity-50 group hover:border-white/[0.15]"
              style={{ background: t.elevated, border: `1px solid ${t.border}`, borderRadius: t.rSm }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors bg-white/[0.06]"
                style={{ color: t.textSec }}>
                {triggering === action.id ? (
                  <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: t.text }}>{action.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: t.textSec }}>{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* A/B Tests */}
      {abTests.length > 0 && (
        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Tests A/B actifs</h3>
          <div className="space-y-3">
            {abTests.slice(0, 5).map((ab: any) => (
              <div key={ab.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: t.elevated, borderRadius: t.rSm }}>
                <div>
                  <p className="text-sm" style={{ color: t.text }}>{ab.niche ?? 'Global'}</p>
                  <p className="text-xs" style={{ color: t.textSec }}>Appels: A={ab.callsA ?? 0} / B={ab.callsB ?? 0}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={ab.winnerId ? 'Terminé' : 'En cours'} dot={!ab.winnerId} size="xs" variant={ab.winnerId ? 'success' : 'warning'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mutations */}
      {mutations.length > 0 && (
        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Mutations de script récentes</h3>
          <div className="space-y-2">
            {mutations.slice(0, 6).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: t.elevated, borderRadius: t.rSm }}>
                <div>
                  <p className="text-xs font-medium" style={{ color: t.text }}>{m.niche ?? 'Global'} — {m.type}</p>
                  <p className="text-[10px]" style={{ color: t.textSec }}>Score succès: {(m.successRate ?? 0).toFixed(1)}%</p>
                </div>
                <Badge label={m.blocked ? 'Bloqué' : m.status ?? 'active'} dot size="xs"
                  variant={m.blocked ? 'danger' : m.status === 'winner' ? 'success' : 'neutral'} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
