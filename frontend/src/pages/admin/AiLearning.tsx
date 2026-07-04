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

      {/* A/B Tests — Card layout with mini bar charts */}
      {tab === 'abtests' && (
        <div>
          {loading
            ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}</div>
            : abTests.length === 0
              ? <EmptyState icon={<BarChart3 className="w-7 h-7" />} title="Aucun test A/B" />
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {abTests.map((ab: any) => {
                    const callsA = ab.callsA ?? 0;
                    const callsB = ab.callsB ?? 0;
                    const totalCalls = callsA + callsB;
                    const rateA = ab.conversionRateA ?? (callsA > 0 ? ((ab.leadsA ?? 0) / callsA) * 100 : 0);
                    const rateB = ab.conversionRateB ?? (callsB > 0 ? ((ab.leadsB ?? 0) / callsB) * 100 : 0);
                    const maxRate = Math.max(rateA, rateB, 1);
                    const diff = maxRate > 0 ? Math.abs(rateA - rateB) / maxRate * 100 : 0;
                    const isSignificant = totalCalls > 100 && diff > 15;
                    const hasWinner = !!ab.winnerId;

                    return (
                      <div key={ab.id} className="p-5" style={glass}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <span className="text-sm font-semibold" style={{ color: t.text }}>{ab.niche ?? 'Test A/B'}</span>
                            <p className="text-[10px] mt-0.5" style={{ color: t.textSec }}>{ab.language ?? 'EN'} &middot; {totalCalls} appels</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasWinner && (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                                style={{ background: 'rgba(34,197,94,0.15)', color: t.success }}>
                                Gagnant
                              </span>
                            )}
                            {totalCalls > 100 ? (
                              <span className="text-[10px] font-medium px-2 py-1 rounded-full"
                                style={{
                                  background: isSignificant ? 'rgba(34,197,94,0.10)' : 'rgba(251,191,36,0.10)',
                                  color: isSignificant ? t.success : t.warning,
                                }}>
                                {isSignificant ? 'Significatif' : 'En cours'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-1 rounded-full"
                                style={{ background: 'rgba(255,255,255,0.06)', color: t.textSec }}>
                                Collecte
                              </span>
                            )}
                            <Badge label={ab.status ?? 'active'} dot size="xs" />
                          </div>
                        </div>

                        {/* Mini bar chart */}
                        <div className="space-y-3 mb-4">
                          {/* Variant A */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-medium" style={{ color: t.textSec }}>
                                Variante A {hasWinner && ab.winnerId === ab.variantAId && <span style={{ color: t.success }}>(gagnant)</span>}
                              </span>
                              <span className="text-[10px] font-bold tabular-nums" style={{ color: t.text }}>{rateA.toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                <div className="h-full rounded-lg transition-all duration-500 flex items-center px-2"
                                  style={{
                                    width: `${maxRate > 0 ? (rateA / maxRate) * 100 : 0}%`,
                                    minWidth: rateA > 0 ? '24px' : '0',
                                    background: hasWinner && ab.winnerId === ab.variantAId
                                      ? 'rgba(34,197,94,0.25)'
                                      : 'rgba(123,92,240,0.3)',
                                  }}>
                                  <span className="text-[9px] font-medium tabular-nums" style={{ color: t.textSec }}>{callsA}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Variant B */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-medium" style={{ color: t.textSec }}>
                                Variante B {hasWinner && ab.winnerId === ab.variantBId && <span style={{ color: t.success }}>(gagnant)</span>}
                              </span>
                              <span className="text-[10px] font-bold tabular-nums" style={{ color: t.text }}>{rateB.toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                <div className="h-full rounded-lg transition-all duration-500 flex items-center px-2"
                                  style={{
                                    width: `${maxRate > 0 ? (rateB / maxRate) * 100 : 0}%`,
                                    minWidth: rateB > 0 ? '24px' : '0',
                                    background: hasWinner && ab.winnerId === ab.variantBId
                                      ? 'rgba(34,197,94,0.25)'
                                      : 'rgba(96,165,250,0.3)',
                                  }}>
                                  <span className="text-[9px] font-medium tabular-nums" style={{ color: t.textSec }}>{callsB}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer stats */}
                        <div className="flex items-center gap-4 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
                          <div>
                            <p className="text-[9px] uppercase font-medium" style={{ color: t.textMuted }}>Difference</p>
                            <p className="text-xs font-bold tabular-nums" style={{ color: diff > 15 ? t.success : t.textSec }}>{diff.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase font-medium" style={{ color: t.textMuted }}>Total appels</p>
                            <p className="text-xs font-bold tabular-nums" style={{ color: t.text }}>{totalCalls}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase font-medium" style={{ color: t.textMuted }}>Seuil</p>
                            <p className="text-xs font-bold tabular-nums" style={{ color: totalCalls >= 200 ? t.success : t.textSec }}>{totalCalls} / 200</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
