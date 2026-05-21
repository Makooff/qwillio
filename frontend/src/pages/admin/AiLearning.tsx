import { useEffect, useState } from 'react';
import { Brain, Clock, BarChart3, ChevronDown, ChevronUp, Zap, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, GhostBtn, Pill,
} from '../../components/pro/ProBlocks';

// ─── Types ───────────────────────────────────────────────────────────────────

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

interface Mutation {
  id: string;
  niche: string;
  variantKey: string;
  status: string;
  content?: string;
  successRate?: number;
  createdAt: string;
}

interface AbTest {
  id: string;
  niche: string;
  variantA: string;
  variantB: string;
  successRateA?: number;
  successRateB?: number;
  active: boolean;
  winner?: string;
  createdAt: string;
}

interface BestTime {
  niche: string;
  hour: number;
  successRate: number;
  callCount: number;
  dayOfWeek?: number;
}

interface AiStats {
  totalMutations?: number;
  avgWinRate?: number;
  totalSamples?: number;
  avgSuccessRate?: number;
}

interface NicheInsight {
  niche: string;
  insightType: string;
  confidence: number;
  content: string;
}

type TabId = 'mutations' | 'abtests' | 'besttimes' | 'insights';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso?: string) {
  if (!iso) return '—';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr }); } catch { return '—'; }
}

function mutationStatusColor(s: string): PillColor {
  switch (s.toLowerCase()) {
    case 'testing': return 'warn';
    case 'winner':  return 'ok';
    case 'loser':   return 'bad';
    case 'active':  return 'ok';
    case 'reverted': return 'neutral';
    default: return 'neutral';
  }
}

function rateColor(r: number): PillColor {
  if (r >= 70) return 'ok';
  if (r >= 40) return 'warn';
  return 'bad';
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

interface HeatCell {
  callCount: number;
  successRate: number;
}

function buildHeatmap(data: BestTime[]): HeatCell[][] {
  // 7 rows (0=Mon … 6=Sun) × 24 cols (0h-23h)
  const grid: HeatCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ callCount: 0, successRate: 0 }))
  );
  for (const bt of data) {
    const day = bt.dayOfWeek !== undefined ? bt.dayOfWeek % 7 : 0;
    const hour = Math.max(0, Math.min(23, bt.hour));
    const cell = grid[day][hour];
    // Accumulate weighted average
    const newCount = cell.callCount + bt.callCount;
    if (newCount > 0) {
      cell.successRate = (cell.successRate * cell.callCount + bt.successRate * bt.callCount) / newCount;
    }
    cell.callCount = newCount;
  }
  return grid;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function heatColor(rate: number): string {
  if (rate <= 0) return 'transparent';
  if (rate < 30) return 'rgba(123,92,240,0.1)';
  if (rate < 60) return 'rgba(123,92,240,0.4)';
  return 'rgba(123,92,240,0.9)';
}

function Heatmap({ data }: { data: BestTime[] }) {
  const grid = buildHeatmap(data);
  const [tooltip, setTooltip] = useState<{ day: number; hour: number } | null>(null);

  const hasSufficientData = data.some(d => d.dayOfWeek !== undefined);

  if (!hasSufficientData) {
    // Fallback: per-niche best hour list
    const byNiche = data.reduce<Record<string, BestTime[]>>((acc, bt) => {
      const list = acc[bt.niche] ?? [];
      list.push(bt);
      acc[bt.niche] = list;
      return acc;
    }, {});

    return (
      <div className="space-y-1">
        {Object.entries(byNiche).map(([niche, times]) => {
          const best = [...times].sort((a, b) => b.successRate - a.successRate)[0];
          return (
            <div
              key={niche}
              className="flex items-center gap-4 px-4 py-3"
              style={{ borderBottom: `1px solid ${pro.border}` }}
            >
              <Pill color="accent">{niche}</Pill>
              <span className="text-[13px] font-mono" style={{ color: pro.text }}>
                {String(best.hour).padStart(2, '0')}h00
              </span>
              <span className="text-[12px]" style={{ color: pro.textSec }}>
                {best.successRate.toFixed(1)}% succès · {best.callCount} appels
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px] p-4">
        {/* Hour labels */}
        <div className="flex ml-8 mb-1">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[9px]" style={{ color: pro.textTer }}>
              {h % 3 === 0 ? `${h}h` : ''}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {grid.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center mb-0.5">
            <span
              className="w-8 text-[10px] text-right pr-2 flex-shrink-0"
              style={{ color: pro.textSec }}
            >
              {DAY_LABELS[dayIdx]}
            </span>
            {row.map((cell, hour) => (
              <div
                key={hour}
                className="flex-1 h-5 mx-px rounded-sm cursor-pointer relative"
                style={{ background: heatColor(cell.successRate) }}
                onMouseEnter={() => setTooltip({ day: dayIdx, hour })}
                onMouseLeave={() => setTooltip(null)}
              >
                {tooltip?.day === dayIdx && tooltip?.hour === hour && cell.callCount > 0 && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-[10px] whitespace-nowrap z-10 pointer-events-none"
                    style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}
                  >
                    {cell.callCount} appels, {cell.successRate.toFixed(1)}% succès
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 ml-8">
          <span className="text-[10px]" style={{ color: pro.textTer }}>Moins</span>
          {[0.05, 0.25, 0.55, 0.85].map((v, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-sm"
              style={{ background: `rgba(123,92,240,${v})` }}
            />
          ))}
          <span className="text-[10px]" style={{ color: pro.textTer }}>Plus</span>
        </div>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AiLearning() {
  const [stats, setStats] = useState<AiStats | null>(null);
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [abTests, setAbTests] = useState<AbTest[]>([]);
  const [bestTimes, setBestTimes] = useState<BestTime[]>([]);
  const [insights, setInsights] = useState<NicheInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('mutations');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  function normalizeArray<T>(d: unknown): T[] {
    if (!d) return [];
    if (Array.isArray(d)) return d as T[];
    if (typeof d === 'object' && d !== null && 'data' in d && Array.isArray((d as Record<string, unknown>).data)) {
      return (d as Record<string, unknown[]>).data as T[];
    }
    return [];
  }

  const load = async () => {
    setLoading(true);
    const [s, m, a, b, ni] = await Promise.all([
      api.get('/ai/stats').catch(() => null),
      api.get('/ai/mutations?limit=50').catch(() => null),
      api.get('/ai/ab-tests').catch(() => null),
      api.get('/ai/best-times').catch(() => null),
      api.get('/ai/niche-insights').catch(() => null),
    ]);
    if (s?.data) setStats(s.data as AiStats);
    setMutations(normalizeArray<Mutation>(m?.data));
    setAbTests(normalizeArray<AbTest>(a?.data));
    setBestTimes(normalizeArray<BestTime>(b?.data));
    setInsights(normalizeArray<NicheInsight>(ni?.data));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const trigger = async (path: string, label: string) => {
    setTriggerLoading(path);
    try {
      await api.post(`/prospecting/trigger/${path}`);
      toast(`${label} déclenché`, 'success');
    } catch {
      toast(`Erreur: ${label}`, 'error');
    } finally {
      setTriggerLoading(null);
    }
  };

  // Stats row values
  const activeMutations = mutations.filter(m => m.status === 'testing' || m.status === 'active').length;
  const avgWinRate = abTests.length > 0
    ? abTests.reduce((sum, t) => {
        const best = Math.max(t.successRateA ?? 0, t.successRateB ?? 0);
        return sum + best;
      }, 0) / abTests.length
    : (stats?.avgWinRate ?? 0);

  const bestHourEntry = bestTimes.length > 0
    ? [...bestTimes].sort((a, b) => b.successRate - a.successRate)[0]
    : null;
  const bestHourLabel = bestHourEntry ? `${String(bestHourEntry.hour).padStart(2, '0')}h00` : '—';

  const TABS: { id: TabId; label: string; count: number }[] = [
    { id: 'mutations', label: 'Mutations', count: mutations.length },
    { id: 'abtests',   label: 'A/B Tests', count: abTests.length },
    { id: 'besttimes', label: 'Meilleures heures', count: bestTimes.length },
    { id: 'insights',  label: 'Insights niche', count: insights.length },
  ];

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="IA Self-Learning"
        subtitle="Mutations de scripts, A/B tests et optimisation temporelle"
        right={
          <div className="flex items-center gap-2">
            <GhostBtn
              size="sm"
              onClick={() => trigger('script-learning', 'Analyser scripts')}
              disabled={triggerLoading !== null}
            >
              {triggerLoading === 'script-learning' ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
              Analyser scripts
            </GhostBtn>
            <GhostBtn
              size="sm"
              onClick={() => trigger('ab-analysis', 'A/B Analysis')}
              disabled={triggerLoading !== null}
            >
              A/B Analysis
            </GhostBtn>
            <GhostBtn
              size="sm"
              onClick={() => trigger('best-time', 'Best-time')}
              disabled={triggerLoading !== null}
            >
              Best-time
            </GhostBtn>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Mutations actives" value={activeMutations} hint="testing ou active" />
        <Stat
          label="Win rate moy."
          value={avgWinRate > 0 ? `${avgWinRate.toFixed(1)}%` : '—'}
          hint="Moyenne A/B tests"
        />
        <Stat label="Meilleure heure" value={bestHourLabel} hint="Heure optimale globale" />
        <Stat label="Scripts mutés" value={mutations.length} hint="Total mutations" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: `1px solid ${pro.border}` }}>
        {TABS.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className="px-4 py-2.5 text-[12.5px] font-medium transition-colors border-b-2 -mb-px"
            style={{
              color: tab === tb.id ? pro.text : pro.textSec,
              borderBottomColor: tab === tb.id ? pro.borderHi : 'transparent',
            }}
          >
            {tb.label}
            {tb.count > 0 && (
              <span
                className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                style={{ background: 'rgba(255,255,255,0.05)', color: pro.textSec }}
              >
                {tb.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Mutations ── */}
      {tab === 'mutations' && (
        <section>
          <SectionHead
            title="Mutations de scripts"
            action={
              <GhostBtn
                size="sm"
                onClick={() => trigger('script-learning', 'Nouveau cycle')}
                disabled={triggerLoading !== null}
              >
                <Zap className="w-3 h-3" /> Nouveau cycle
              </GhostBtn>
            }
          />
          <Card>
            {loading ? (
              <div className="p-12 text-center" style={{ color: pro.textTer }}>
                <RefreshCw className="w-5 h-5 mx-auto animate-spin" />
              </div>
            ) : mutations.length === 0 ? (
              <div className="p-12 text-center" style={{ color: pro.textTer }}>
                <Brain className="w-7 h-7 mx-auto mb-3" />
                <p className="text-[13px]">Aucune mutation</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${pro.border}` }}>
                    {['Niche', 'Variante', 'Statut', 'Créé le', 'Score', 'Actions'].map(col => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-wider"
                        style={{ color: pro.textTer }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mutations.map((m, i) => {
                    const isExpanded = expandedId === m.id;
                    const rate = Number(m.successRate ?? 0);
                    return (
                      <>
                        <tr
                          key={m.id}
                          style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                          className="transition-colors hover:bg-white/[0.015]"
                        >
                          <td className="px-4 py-3 text-[13px]" style={{ color: pro.text }}>
                            {m.niche || '—'}
                          </td>
                          <td className="px-4 py-3 text-[12px] font-mono" style={{ color: pro.textSec }}>
                            {m.variantKey || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Pill color={mutationStatusColor(m.status)}>{m.status}</Pill>
                          </td>
                          <td className="px-4 py-3 text-[12px]" style={{ color: pro.textSec }}>
                            {timeAgo(m.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Pill color={rateColor(rate)}>{rate.toFixed(1)}%</Pill>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : m.id)}
                              className="flex items-center gap-1 text-[11.5px] transition-colors hover:opacity-80"
                              style={{ color: pro.textSec }}
                            >
                              Détail
                              {isExpanded
                                ? <ChevronUp className="w-3 h-3" />
                                : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${m.id}-expand`} style={{ background: 'rgba(255,255,255,0.015)' }}>
                            <td colSpan={6} className="px-4 py-3">
                              <div
                                className="rounded-lg p-3 text-[12px] font-mono whitespace-pre-wrap"
                                style={{ background: 'rgba(0,0,0,0.2)', color: pro.textSec, maxHeight: 200, overflowY: 'auto' }}
                              >
                                {m.content || '(aucun contenu disponible)'}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </section>
      )}

      {/* ── TAB: A/B Tests ── */}
      {tab === 'abtests' && (
        <section>
          <SectionHead title="A/B Tests" />
          {loading ? (
            <div className="p-12 text-center" style={{ color: pro.textTer }}>
              <RefreshCw className="w-5 h-5 mx-auto animate-spin" />
            </div>
          ) : abTests.length === 0 ? (
            <Card>
              <div className="p-12 text-center" style={{ color: pro.textTer }}>
                <BarChart3 className="w-7 h-7 mx-auto mb-3" />
                <p className="text-[13px]">Aucun test A/B</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {abTests.map(ab => {
                const rA = ab.successRateA ?? 0;
                const rB = ab.successRateB ?? 0;
                const maxR = Math.max(rA, rB, 1);
                const isWinnerA = ab.winner === ab.variantA || (!ab.winner && rA > rB);
                const isWinnerB = ab.winner === ab.variantB || (!ab.winner && rB > rA);
                const statusLabel = ab.active ? 'En test' : ab.winner ? 'Gagnant déclaré' : 'Terminé';
                const statusColor: PillColor = ab.active ? 'warn' : ab.winner ? 'ok' : 'neutral';

                return (
                  <Card key={ab.id}>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: pro.text }}>
                            {ab.niche || 'Test A/B'}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: pro.textTer }}>
                            {timeAgo(ab.createdAt)}
                          </p>
                        </div>
                        <Pill color={statusColor}>{statusLabel}</Pill>
                      </div>

                      {/* Variant A */}
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11.5px] flex items-center gap-1.5" style={{ color: pro.textSec }}>
                              Variante A
                              {isWinnerA && !ab.active && (
                                <Pill color="ok">Gagnant</Pill>
                              )}
                            </span>
                            <span className="text-[12px] font-semibold tabular-nums" style={{ color: pro.text }}>
                              {rA.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-6 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div
                              className="h-full rounded-lg transition-colors duration-500 flex items-center px-2"
                              style={{
                                width: `${(rA / maxR) * 100}%`,
                                minWidth: rA > 0 ? 24 : 0,
                                background: isWinnerA && !ab.active
                                  ? 'rgba(34,197,94,0.3)'
                                  : 'rgba(123,92,240,0.3)',
                              }}
                            >
                              <span className="text-[10px]" style={{ color: pro.textSec }}>
                                {ab.variantA?.slice(0, 20) || 'A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Variant B */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11.5px] flex items-center gap-1.5" style={{ color: pro.textSec }}>
                              Variante B
                              {isWinnerB && !ab.active && (
                                <Pill color="ok">Gagnant</Pill>
                              )}
                            </span>
                            <span className="text-[12px] font-semibold tabular-nums" style={{ color: pro.text }}>
                              {rB.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-6 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div
                              className="h-full rounded-lg transition-colors duration-500 flex items-center px-2"
                              style={{
                                width: `${(rB / maxR) * 100}%`,
                                minWidth: rB > 0 ? 24 : 0,
                                background: isWinnerB && !ab.active
                                  ? 'rgba(34,197,94,0.3)'
                                  : 'rgba(255,255,255,0.1)',
                              }}
                            >
                              <span className="text-[10px]" style={{ color: pro.textSec }}>
                                {ab.variantB?.slice(0, 20) || 'B'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div
                        className="flex items-center gap-4 mt-4 pt-3"
                        style={{ borderTop: `1px solid ${pro.border}` }}
                      >
                        <div>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: pro.textTer }}>Écart</p>
                          <p className="text-[12.5px] font-semibold tabular-nums"
                             style={{ color: Math.abs(rA - rB) > 10 ? pro.ok : pro.textSec }}>
                            {Math.abs(rA - rB).toFixed(1)}%
                          </p>
                        </div>
                        {ab.winner && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: pro.textTer }}>Gagnant</p>
                            <p className="text-[12.5px] font-semibold" style={{ color: pro.ok }}>
                              {ab.winner === ab.variantA ? 'Variante A' : 'Variante B'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── TAB: Meilleures heures ── */}
      {tab === 'besttimes' && (
        <section>
          <SectionHead title="Heatmap des meilleurs créneaux" />
          <Card>
            {loading ? (
              <div className="p-12 text-center" style={{ color: pro.textTer }}>
                <RefreshCw className="w-5 h-5 mx-auto animate-spin" />
              </div>
            ) : bestTimes.length === 0 ? (
              <div className="p-12 text-center" style={{ color: pro.textTer }}>
                <Clock className="w-7 h-7 mx-auto mb-3" />
                <p className="text-[13px]">Aucune donnée horaire disponible</p>
              </div>
            ) : (
              <Heatmap data={bestTimes} />
            )}
          </Card>
        </section>
      )}

      {/* ── TAB: Insights niche ── */}
      {tab === 'insights' && (
        <section>
          <SectionHead title="Insights par niche" />
          {loading ? (
            <div className="p-12 text-center" style={{ color: pro.textTer }}>
              <RefreshCw className="w-5 h-5 mx-auto animate-spin" />
            </div>
          ) : insights.length === 0 ? (
            <Card>
              <div className="p-12 text-center" style={{ color: pro.textTer }}>
                <Brain className="w-7 h-7 mx-auto mb-3" />
                <p className="text-[13px]">Aucun insight disponible</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <Card key={i}>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Pill color="accent">{ins.niche}</Pill>
                      <Pill color="info">{ins.insightType}</Pill>
                      <span className="ml-auto text-[11px]" style={{ color: pro.textSec }}>
                        Confiance
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div
                          className="h-full rounded-full transition-[width] duration-500 ease-out"
                          style={{
                            width: `${Math.min(ins.confidence, 100)}%`,
                            background: ins.confidence >= 70 ? pro.ok : ins.confidence >= 40 ? pro.warn : pro.bad,
                          }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums w-10 text-right" style={{ color: pro.textSec }}>
                        {ins.confidence.toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-[12.5px]" style={{ color: pro.textSec }}>
                      {ins.content}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
