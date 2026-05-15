import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, TrendingUp, Brain, GitMerge, RefreshCw,
  ChevronRight, AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, Pill, PrimaryBtn, GhostBtn,
} from '../../components/pro/ProBlocks';

interface AgentDashboard {
  closerAgent: {
    sequencesActive: number;
    converted7d: number;
    total7d: number;
    conversionRate: number;
  };
  workPlanner: {
    plansGenerated7d: number;
    avgPlannedPerDay: number;
  };
  businessPlan: {
    pitchesGenerated7d: number;
  };
  brandingAgent: {
    analysesRun7d: number;
  };
  evolution: {
    activeStrategies: number;
    activeInsights: number;
    lastEvolved: string | null;
    lastEvolvedAgent: string | null;
  };
  anomalies: Array<{
    id: string;
    metric: string;
    current: number;
    avg: number;
    deviation: number;
    severity: string;
    diagnosis: string | null;
    createdAt: string;
  }>;
}

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral';

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const severityColor = (s: string): PillColor => {
  const v = s.toLowerCase();
  if (v === 'critical' || v === 'high') return 'bad';
  if (v === 'medium') return 'warn';
  return 'info';
};

const AGENT_CARDS = (data: AgentDashboard) => [
  {
    name: 'Closer Agent',
    description: 'Pipeline SMS+Email 7 touches',
    metric: `${data.closerAgent.total7d} actions 7j`,
    path: '/admin/agents/work-planner',
    color: pro.ok,
  },
  {
    name: 'Work Planner',
    description: "Plan d'appels IA quotidien",
    metric: `${data.workPlanner.plansGenerated7d} plans 7j`,
    path: '/admin/agents/work-planner',
    color: pro.info,
  },
  {
    name: 'Business Plan',
    description: 'ROI pitches personnalisés',
    metric: `${data.businessPlan.pitchesGenerated7d} pitches 7j`,
    path: '/admin/agents/business-plan',
    color: pro.accent,
  },
  {
    name: 'Branding Agent',
    description: 'Analyse identité marque',
    metric: `${data.brandingAgent.analysesRun7d} analyses 7j`,
    path: '/admin/agents/branding',
    color: pro.warn,
  },
];

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl h-24" style={{ background: pro.panel, border: `1px solid ${pro.border}` }} />
      ))}
    </div>
  );
}

export default function Agents() {
  const [data, setData] = useState<AgentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [evolving, setEvolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/ai-agents/dashboard');
      setData(res.data);
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

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Agents IA"
        subtitle="Système multi-agents auto-apprenant"
        right={
          <div className="flex items-center gap-2">
            <GhostBtn onClick={load} size="sm">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </GhostBtn>
            <PrimaryBtn onClick={triggerEvolution} disabled={evolving} size="sm">
              {evolving ? 'Évolution…' : 'Déclencher évolution'}
            </PrimaryBtn>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: 'rgba(239,68,68,0.10)', color: pro.bad, border: `1px solid rgba(239,68,68,0.20)` }}>
          {error}
        </div>
      )}

      {/* KPI Grid */}
      <section>
        <SectionHead title="Aperçu" />
        {loading && !data ? (
          <SkeletonGrid />
        ) : data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat
              label="Séquences actives"
              value={data.closerAgent.sequencesActive}
              icon={Zap}
            />
            <Stat
              label="Conversion 7j"
              value={`${(data.closerAgent.conversionRate * 100).toFixed(1)}%`}
              hint={`${data.closerAgent.converted7d} / ${data.closerAgent.total7d}`}
              icon={TrendingUp}
            />
            <Stat
              label="Stratégies actives"
              value={data.evolution.activeStrategies}
              icon={Brain}
            />
            <Stat
              label="Insights cross-agents"
              value={data.evolution.activeInsights}
              icon={GitMerge}
            />
          </div>
        ) : null}
      </section>

      {/* Agent Cards Grid */}
      {data && (
        <section>
          <SectionHead title="Agents" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {AGENT_CARDS(data).map((agent) => (
              <Link key={agent.name} to={agent.path} className="block group">
                <Card className="hover:border-white/[0.14] transition-colors">
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${agent.color}1A` }}
                      >
                        <Brain size={14} style={{ color: agent.color }} />
                      </div>
                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: pro.textSec }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: pro.text }}>{agent.name}</p>
                      <p className="text-[11.5px] mt-0.5" style={{ color: pro.textSec }}>{agent.description}</p>
                    </div>
                    <p className="text-[11px] font-medium tabular-nums" style={{ color: agent.color }}>{agent.metric}</p>
                    <p className="text-[11px]" style={{ color: pro.accent }}>Ouvrir →</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Anomalies */}
      {data && data.anomalies.length > 0 && (
        <section>
          <SectionHead title="⚠️ Anomalies actives" />
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${pro.border}` }}>
                    {['Métrique', 'Actuel', 'Moy 7j', 'Déviation', 'Sévérité', 'Diagnostic'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10.5px]" style={{ color: pro.textSec }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.anomalies.map((anomaly, i) => (
                    <tr
                      key={anomaly.id}
                      className="hover:bg-white/[0.02] transition-colors"
                      style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: pro.text }}>{anomaly.metric}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: pro.text }}>{anomaly.current.toFixed(2)}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: pro.textSec }}>{anomaly.avg.toFixed(2)}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: pro.warn }}>{anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation.toFixed(1)}σ</td>
                      <td className="px-4 py-3">
                        <Pill color={severityColor(anomaly.severity)}>{anomaly.severity}</Pill>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: pro.textSec }}>
                        {anomaly.diagnosis ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* Last Evolution */}
      {data && (
        <section>
          <SectionHead title="Dernière évolution" />
          <Card>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(123,92,240,0.12)' }}>
                  <AlertTriangle size={14} style={{ color: pro.accent }} />
                </div>
                <div>
                  <p className="text-[13px] font-medium" style={{ color: pro.text }}>
                    {data.evolution.lastEvolvedAgent ?? 'Aucune évolution récente'}
                  </p>
                  <p className="text-[11.5px]" style={{ color: pro.textSec }}>
                    {fmtDate(data.evolution.lastEvolved)}
                  </p>
                </div>
              </div>
              <PrimaryBtn onClick={triggerEvolution} disabled={evolving} size="sm">
                {evolving ? 'Évolution…' : 'Déclencher évolution'}
              </PrimaryBtn>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
