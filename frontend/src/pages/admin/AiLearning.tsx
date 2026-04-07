import { useEffect, useState } from 'react';
import api from '../../services/api';
import { RefreshCw, Brain, TrendingUp, Clock, BarChart3, Cpu } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import { StatCardSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';

export default function AiLearning() {
  const [stats, setStats] = useState<any>(null);
  const [mutations, setMutations] = useState<any[]>([]);
  const [abTests, setAbTests] = useState<any[]>([]);
  const [bestTimes, setBestTimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mutations' | 'abtests' | 'besttimes'>('mutations');
  const { toasts, add: toast, remove } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [s, m, a, b] = await Promise.all([
        api.get('/ai/stats'),
        api.get('/ai/mutations?limit=50'),
        api.get('/ai/ab-tests'),
        api.get('/ai/best-times'),
      ]);
      setStats(s.data);
      setMutations(Array.isArray(m.data.data) ? m.data.data : (Array.isArray(m.data) ? m.data : []));
      setAbTests(Array.isArray(a.data.data) ? a.data.data : (Array.isArray(a.data) ? a.data : []));
      setBestTimes(Array.isArray(b.data.data) ? b.data.data : (Array.isArray(b.data) ? b.data : []));
    } catch { toast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const TABS = [
    { id: 'mutations', label: 'Mutations de script', count: mutations.length },
    { id: 'abtests', label: 'Tests A/B', count: abTests.length },
    { id: 'besttimes', label: 'Meilleurs horaires', count: bestTimes.length },
  ] as const;

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">IA — Apprentissage</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Optimisation automatique des scripts et horaires</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Mutations totales" value={stats?.totalMutations ?? 0} icon={<Brain className="w-4 h-4" />} color="#7B5CF0" />
          <StatCard label="Tests A/B actifs" value={stats?.activeAbTests ?? 0} icon={<BarChart3 className="w-4 h-4" />} />
          <StatCard label="Taux de succès moyen" value={stats?.avgSuccessRate ?? 0} suffix="%" format="percent" icon={<TrendingUp className="w-4 h-4" />} color="#22C55E" />
          <StatCard label="Révocations" value={stats?.totalReverts ?? 0} icon={<Cpu className="w-4 h-4" />} color="#EF4444" />
        </>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === t.id ? 'text-[#7B5CF0] border-[#7B5CF0]' : 'text-[#8B8BA7] border-transparent hover:text-white'
            }`}>
            {t.label}
            {t.count > 0 && <span className="ml-2 text-[10px] bg-white/[0.08] px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Mutations */}
      {tab === 'mutations' && (
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Niche','Type','Taux succès','Statut','Bloqué','Créée'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                  : mutations.length === 0
                    ? <tr><td colSpan={6}><EmptyState icon={<Brain className="w-7 h-7" />} title="Aucune mutation" /></td></tr>
                    : mutations.map((m: any) => (
                      <tr key={m.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5"><span className="text-xs text-[#F8F8FF] font-medium">{m.niche ?? '—'}</span></td>
                        <td className="px-4 py-3.5"><Badge label={m.type ?? 'script'} variant="info" size="xs" /></td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-bold ${(m.successRate ?? 0) >= 50 ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`}>
                            {(m.successRate ?? 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5"><Badge label={m.status ?? 'active'} dot size="xs" /></td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs ${m.blocked ? 'text-[#EF4444]' : 'text-[#8B8BA7]'}`}>{m.blocked ? 'Oui' : 'Non'}</span>
                        </td>
                        <td className="px-4 py-3.5"><span className="text-xs text-[#8B8BA7]">{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* A/B Tests */}
      {tab === 'abtests' && (
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Niche','Variante A','Variante B','Gagnant','Appels','Statut'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                  : abTests.length === 0
                    ? <tr><td colSpan={6}><EmptyState icon={<BarChart3 className="w-7 h-7" />} title="Aucun test A/B" /></td></tr>
                    : abTests.map((t: any) => (
                      <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5"><span className="text-xs text-[#F8F8FF]">{t.niche ?? '—'}</span></td>
                        <td className="px-4 py-3.5"><span className="text-xs text-[#8B8BA7] truncate max-w-[100px] block">{t.variantAId ?? '—'}</span></td>
                        <td className="px-4 py-3.5"><span className="text-xs text-[#8B8BA7] truncate max-w-[100px] block">{t.variantBId ?? '—'}</span></td>
                        <td className="px-4 py-3.5">
                          {t.winnerId ? <Badge label="Déterminé" variant="success" size="xs" /> : <span className="text-xs text-[#8B8BA7]">En cours</span>}
                        </td>
                        <td className="px-4 py-3.5"><span className="text-xs text-[#F8F8FF]">{(t.callsA ?? 0) + (t.callsB ?? 0)}</span></td>
                        <td className="px-4 py-3.5"><Badge label={t.status ?? 'active'} dot size="xs" /></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Best Times */}
      {tab === 'besttimes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
            : bestTimes.length === 0
              ? <div className="col-span-full"><EmptyState icon={<Clock className="w-7 h-7" />} title="Aucune donnée horaire" /></div>
              : bestTimes.map((bt: any) => (
                <div key={bt.id} className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-[#F8F8FF]">{bt.niche}</span>
                    <Clock className="w-4 h-4 text-[#8B8BA7]" />
                  </div>
                  <div className="space-y-2">
                    {bt.bestHours?.slice(0, 3).map((h: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[#7B5CF0] w-12">{String(h.hour).padStart(2,'0')}h00</span>
                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full">
                          <div className="h-full bg-[#7B5CF0] rounded-full" style={{ width: `${Math.min(h.rate * 100, 100)}%` }} />
                        </div>
                        <span className="text-xs text-[#8B8BA7] w-12 text-right">{(h.rate * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}
