import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, GitBranch } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Pill, PrimaryBtn, GhostBtn,
} from '../../components/pro/ProBlocks';

interface AgentStrategy {
  id: string;
  agent: string;
  niche: string;
  language: string;
  version: number;
  winRate: number;
  sampleCount: number;
  evolvedAt: string;
  playbook: Record<string, unknown>;
}

interface AgentInsight {
  id: string;
  sourceAgent: string;
  targetAgents: string[];
  insightType: string;
  confidence: number;
  sampleCount: number;
  updatedAt: string;
}

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const winRateColor = (rate: number): PillColor => {
  if (rate > 50) return 'ok';
  if (rate > 25) return 'warn';
  return 'bad';
};

const winRateBarColor = (rate: number): string => {
  if (rate > 50) return pro.ok;
  if (rate > 25) return pro.warn;
  return pro.bad;
};

function WinRateBar({ rate }: { rate: number }) {
  const pct = Math.min(rate, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%`, background: winRateBarColor(rate) }}
        />
      </div>
      <span className="text-[11px] tabular-nums font-semibold" style={{ color: winRateBarColor(rate) }}>
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.min(confidence * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: pro.info }}
        />
      </div>
      <span className="text-[11px] tabular-nums" style={{ color: pro.textSec }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

export default function AgentEvolution() {
  const [strategies, setStrategies] = useState<AgentStrategy[]>([]);
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [evolving, setEvolving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, iRes] = await Promise.all([
        api.get('/ai-agents/strategies'),
        api.get('/ai-agents/insights'),
      ]);
      const strats = Array.isArray(sRes.data?.data) ? sRes.data.data : Array.isArray(sRes.data) ? sRes.data : [];
      const ins = Array.isArray(iRes.data?.data) ? iRes.data.data : Array.isArray(iRes.data) ? iRes.data : [];
      setStrategies(strats);
      setInsights(ins);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerEvolution = useCallback(async () => {
    setEvolving(true);
    try {
      await api.post('/ai-agents/evolve');
      toast('Cycle d\'évolution déclenché', 'success');
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
    } finally {
      setEvolving(false);
    }
  }, [load, toast]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Évolution des agents"
        subtitle="Suivi des stratégies et insights cross-agents"
        right={
          <div className="flex items-center gap-2">
            <GhostBtn onClick={load} size="sm" disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </GhostBtn>
            <PrimaryBtn onClick={triggerEvolution} disabled={evolving} size="sm">
              <GitBranch size={13} />
              {evolving ? 'Évolution…' : 'Déclencher cycle'}
            </PrimaryBtn>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: 'rgba(239,68,68,0.10)', color: pro.bad, border: `1px solid rgba(239,68,68,0.20)` }}>
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl h-10" style={{ background: pro.panel }} />
          ))}
        </div>
      )}

      {/* Strategies */}
      {!loading && (
        <section>
          <SectionHead title={`Stratégies actives — ${strategies.length}`} />
          {strategies.length === 0 ? (
            <Card>
              <div className="p-12 text-center" style={{ color: pro.textSec }}>
                <GitBranch className="w-7 h-7 mx-auto mb-3" />
                <p className="text-[13px]">Aucune stratégie active</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${pro.border}` }}>
                      <th className="w-8" />
                      {['Agent', 'Niche', 'Langue', 'Version', 'Win Rate', 'Échantillons', 'Évolué le'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10.5px]" style={{ color: pro.textSec }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategies.map((s, i) => {
                      const isExpanded = expandedRows.has(s.id);
                      return (
                        <>
                          <tr
                            key={s.id}
                            className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                            style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                            onClick={() => toggleRow(s.id)}
                          >
                            <td className="pl-3">
                              {isExpanded
                                ? <ChevronDown size={13} style={{ color: pro.textSec }} />
                                : <ChevronRight size={13} style={{ color: pro.textSec }} />}
                            </td>
                            <td className="px-4 py-2.5 font-medium" style={{ color: pro.text }}>{s.agent}</td>
                            <td className="px-4 py-2.5" style={{ color: pro.textSec }}>{s.niche}</td>
                            <td className="px-4 py-2.5">
                              <Pill color="neutral">{s.language.toUpperCase()}</Pill>
                            </td>
                            <td className="px-4 py-2.5 tabular-nums" style={{ color: pro.textSec }}>v{s.version}</td>
                            <td className="px-4 py-2.5">
                              <WinRateBar rate={s.winRate} />
                            </td>
                            <td className="px-4 py-2.5 tabular-nums" style={{ color: pro.textSec }}>{s.sampleCount}</td>
                            <td className="px-4 py-2.5" style={{ color: pro.textSec }}>{fmtDate(s.evolvedAt)}</td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${s.id}-expanded`} style={{ borderTop: `1px solid ${pro.border}` }}>
                              <td colSpan={8} className="px-4 py-3">
                                <p className="text-[10.5px] uppercase tracking-wider font-semibold mb-2" style={{ color: pro.textSec }}>
                                  Playbook JSON
                                </p>
                                <pre
                                  className="text-[11px] overflow-auto max-h-48 rounded-lg p-3"
                                  style={{ background: 'rgba(255,255,255,0.03)', color: pro.textSec, border: `1px solid ${pro.border}` }}
                                >
                                  {JSON.stringify(s.playbook, null, 2)}
                                </pre>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      )}

      {/* Insights */}
      {!loading && (
        <section>
          <SectionHead title={`Insights cross-agents — ${insights.length}`} />
          {insights.length === 0 ? (
            <Card>
              <div className="p-12 text-center" style={{ color: pro.textSec }}>
                <GitBranch className="w-7 h-7 mx-auto mb-3" />
                <p className="text-[13px]">Aucun insight disponible</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${pro.border}` }}>
                      {['Source', 'Cibles', 'Type', 'Confiance', 'Échantillons', 'Mise à jour'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10.5px]" style={{ color: pro.textSec }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.map((insight, i) => (
                      <tr
                        key={insight.id}
                        className="hover:bg-white/[0.02] transition-colors"
                        style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                      >
                        <td className="px-4 py-2.5 font-medium" style={{ color: pro.text }}>{insight.sourceAgent}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {insight.targetAgents.map((t) => (
                              <Pill key={t} color="info">{t}</Pill>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Pill color="accent">{insight.insightType}</Pill>
                        </td>
                        <td className="px-4 py-2.5">
                          <ConfidenceBar confidence={insight.confidence} />
                        </td>
                        <td className="px-4 py-2.5 tabular-nums" style={{ color: pro.textSec }}>{insight.sampleCount}</td>
                        <td className="px-4 py-2.5" style={{ color: pro.textSec }}>{fmtDate(insight.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
