import { useEffect, useState } from 'react';
import api from '../../services/api';
import { RefreshCw, Brain, TrendingUp, Clock, BarChart3, Cpu } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import { StatCardSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import { t, glass } from '../../styles/admin-theme';

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
    const [s, m, a, b] = await Promise.all([
      api.get('/ai/stats').catch(() => null),
      api.get('/ai/mutations?limit=50').catch(() => null),
      api.get('/ai/ab-tests').catch(() => null),
      api.get('/ai/best-times').catch(() => null),
    ]);
    if (s?.data) setStats(s.data);
    if (m?.data) setMutations(Array.isArray(m.data.data) ? m.data.data : (Array.isArray(m.data) ? m.data : []));
    if (a?.data) setAbTests(Array.isArray(a.data.data) ? a.data.data : (Array.isArray(a.data) ? a.data : []));
    if (b?.data) setBestTimes(Array.isArray(b.data.data) ? b.data.data : (Array.isArray(b.data) ? b.data : []));
    setLoading(false);
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
          <h1 className="text-xl font-bold" style={{ color: t.text }}>IA — Apprentissage</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Optimisation automatique des scripts et horaires</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Mutations totales" value={stats?.totalMutations ?? 0} icon={<Brain className="w-4 h-4" />} />
          <StatCard label="Tests A/B actifs" value={stats?.activeAbTests ?? 0} icon={<BarChart3 className="w-4 h-4" />} />
          <StatCard label="Taux de succès moyen" value={stats?.avgSuccessRate ?? 0} suffix="%" format="percent" icon={<TrendingUp className="w-4 h-4" />} color={t.success} />
          <StatCard label="Révocations" value={stats?.totalReverts ?? 0} icon={<Cpu className="w-4 h-4" />} color={t.danger} />
        </>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: `1px solid ${t.border}` }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className="px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px"
            style={{
              color: tab === tb.id ? t.text : t.textSec,
              borderBottomColor: tab === tb.id ? 'rgba(255,255,255,0.30)' : 'transparent',
            }}>
            {tb.label}
            {tb.count > 0 && <span className="ml-2 text-[10px] bg-white/[0.08] px-1.5 py-0.5 rounded-full">{tb.count}</span>}
          </button>
        ))}
      </div>

      {/* Mutations */}
      {tab === 'mutations' && (
        <div className="overflow-hidden" style={glass}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Niche</th>
                <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Type</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Succès</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Statut</th>
                <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Bloqué</th>
                <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Créée</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                : mutations.length === 0
                  ? <tr><td colSpan={6}><EmptyState icon={<Brain className="w-7 h-7" />} title="Aucune mutation" /></td></tr>
                  : mutations.map((m: any) => (
                    <tr key={m.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-3 py-3">
                        <span className="text-xs font-medium" style={{ color: t.text }}>{m.niche ?? '—'}</span>
                        <span className="md:hidden ml-2"><Badge label={m.type ?? 'script'} variant="info" size="xs" /></span>
                      </td>
                      <td className="hidden md:table-cell px-3 py-3"><Badge label={m.type ?? 'script'} variant="info" size="xs" /></td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-bold" style={{ color: (m.successRate ?? 0) >= 50 ? t.success : t.warning }}>
                          {(m.successRate ?? 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-3"><Badge label={m.status ?? 'active'} dot size="xs" /></td>
                      <td className="hidden md:table-cell px-3 py-3">
                        <span className="text-xs" style={{ color: m.blocked ? t.danger : t.textSec }}>{m.blocked ? 'Oui' : 'Non'}</span>
                      </td>
                      <td className="hidden md:table-cell px-3 py-3"><span className="text-xs" style={{ color: t.textSec }}>{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {/* A/B Tests */}
      {tab === 'abtests' && (
        <div className="overflow-hidden" style={glass}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Niche</th>
                <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Var. A</th>
                <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Var. B</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Gagnant</th>
                <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Appels</th>
                <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                : abTests.length === 0
                  ? <tr><td colSpan={6}><EmptyState icon={<BarChart3 className="w-7 h-7" />} title="Aucun test A/B" /></td></tr>
                  : abTests.map((ab: any) => (
                    <tr key={ab.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-3 py-3">
                        <span className="text-xs" style={{ color: t.text }}>{ab.niche ?? '—'}</span>
                        <p className="text-[10px] md:hidden" style={{ color: t.textSec }}>{(ab.callsA ?? 0) + (ab.callsB ?? 0)} appels</p>
                      </td>
                      <td className="hidden md:table-cell px-3 py-3"><span className="text-xs truncate max-w-[100px] block" style={{ color: t.textSec }}>{ab.variantAId ?? '—'}</span></td>
                      <td className="hidden md:table-cell px-3 py-3"><span className="text-xs truncate max-w-[100px] block" style={{ color: t.textSec }}>{ab.variantBId ?? '—'}</span></td>
                      <td className="px-3 py-3">
                        {ab.winnerId ? <Badge label="Déterminé" variant="success" size="xs" /> : <span className="text-xs" style={{ color: t.textSec }}>En cours</span>}
                      </td>
                      <td className="hidden md:table-cell px-3 py-3"><span className="text-xs" style={{ color: t.text }}>{(ab.callsA ?? 0) + (ab.callsB ?? 0)}</span></td>
                      <td className="px-3 py-3"><Badge label={ab.status ?? 'active'} dot size="xs" /></td>
                    </tr>
                  ))}
            </tbody>
          </table>
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
                <div key={bt.id} className="p-5" style={glass}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold" style={{ color: t.text }}>{bt.niche}</span>
                    <Clock className="w-4 h-4" style={{ color: t.textSec }} />
                  </div>
                  <div className="space-y-2">
                    {bt.bestHours?.slice(0, 3).map((h: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-mono w-12" style={{ color: t.textSec }}>{String(h.hour).padStart(2,'0')}h00</span>
                        <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(h.rate * 100, 100)}%`, background: t.textTer }} />
                        </div>
                        <span className="text-xs w-12 text-right" style={{ color: t.textSec }}>{(h.rate * 100).toFixed(1)}%</span>
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
