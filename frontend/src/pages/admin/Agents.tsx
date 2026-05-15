import { useEffect, useState, useCallback } from 'react';
import {
  Zap, TrendingUp, Brain, GitMerge, RefreshCw, AlertTriangle,
  Bot, Activity, Play, CheckCircle, XCircle,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, Pill, PrimaryBtn, GhostBtn,
} from '../../components/pro/ProBlocks';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentDashboard {
  closerAgent:   { sequencesActive: number; converted7d: number; total7d: number; conversionRate: number };
  workPlanner:   { plansGenerated7d: number; avgPlannedPerDay: number };
  businessPlan:  { pitchesGenerated7d: number };
  brandingAgent: { analysesRun7d: number };
  evolution:     { activeStrategies: number; activeInsights: number; lastEvolved: string | null; lastEvolvedAgent: string | null };
  anomalies:     Array<{
    id: string; metric: string; current: number; avg: number;
    deviation: number; severity: string; diagnosis: string | null; createdAt: string;
  }>;
}

interface WorkPlan { id: string; date: string; tasks: string[]; status: string }
interface Pitch    { id: string; prospectName: string; content: string; createdAt: string }
interface BrandRec { id: string; prospectName: string; recommendations: string; createdAt: string }
interface Mutation { id: string; type: string; field: string; confidence: number; status: string; createdAt: string }
interface AbTest   { id: string; variant: string; calls: number; conversionRate: number; isWinner: boolean }
interface Strategy { id: string; name: string; description: string; active: boolean; createdAt: string }
interface AiDecision { id: string; type: string; field: string; confidence: number; status: string; createdAt: string }
interface BotActivity { id: string; type: string; message?: string; description?: string; timestamp?: string; createdAt?: string }

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral';

type TabKey = 'Aperçu' | 'Work Planner' | 'Business Plan' | 'Branding' | 'IA Learning' | 'Évolution' | 'Moniteur' | 'Décisions';

const TABS: TabKey[] = ['Aperçu', 'Work Planner', 'Business Plan', 'Branding', 'IA Learning', 'Évolution', 'Moniteur', 'Décisions'];

const severityColor = (s: string): PillColor => {
  const v = s.toLowerCase();
  if (v === 'critical' || v === 'high') return 'bad';
  if (v === 'medium') return 'warn';
  return 'info';
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl h-24" style={{ background: pro.panel, border: `1px solid ${pro.border}` }} />
      ))}
    </div>
  );
}

// ── Tab: Aperçu ───────────────────────────────────────────────────────────────

function TabApercu({ data, evolving, onEvolve }: {
  data: AgentDashboard | null;
  loading: boolean;
  evolving: boolean;
  onEvolve: () => void;
}) {
  return (
    <div className="space-y-5">
      <section>
        <SectionHead title="Aperçu" />
        {!data ? (
          <SkeletonGrid />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Séquences actives"   value={data.closerAgent.sequencesActive} icon={Zap} />
            <Stat
              label="Conversion 7j"
              value={`${(data.closerAgent.conversionRate * 100).toFixed(1)}%`}
              hint={`${data.closerAgent.converted7d} / ${data.closerAgent.total7d}`}
              icon={TrendingUp}
            />
            <Stat label="Stratégies actives"  value={data.evolution.activeStrategies}  icon={Brain} />
            <Stat label="Insights cross-agents" value={data.evolution.activeInsights}  icon={GitMerge} />
          </div>
        )}
      </section>

      {data && data.anomalies.length > 0 && (
        <section>
          <SectionHead title="Anomalies actives" />
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${pro.border}` }}>
                    {['Métrique', 'Actuel', 'Moy 7j', 'Déviation', 'Sévérité', 'Diagnostic'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10.5px]" style={{ color: pro.textSec }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.anomalies.map((a, i) => (
                    <tr key={a.id} className="hover:bg-white/[0.02] transition-colors"
                        style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                      <td className="px-4 py-3 font-medium" style={{ color: pro.text }}>{a.metric}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: pro.text }}>{a.current.toFixed(2)}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: pro.textSec }}>{a.avg.toFixed(2)}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: pro.warn }}>{a.deviation > 0 ? '+' : ''}{a.deviation.toFixed(1)}σ</td>
                      <td className="px-4 py-3"><Pill color={severityColor(a.severity)}>{a.severity}</Pill></td>
                      <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: pro.textSec }}>{a.diagnosis ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

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
                  <p className="text-[11.5px]" style={{ color: pro.textSec }}>{fmtDate(data.evolution.lastEvolved)}</p>
                </div>
              </div>
              <PrimaryBtn onClick={onEvolve} disabled={evolving} size="sm">
                {evolving ? 'Évolution…' : 'Déclencher évolution'}
              </PrimaryBtn>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

// ── Tab: Work Planner ─────────────────────────────────────────────────────────

function TabWorkPlanner() {
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post('/ai-agents/work-planner', { date });
      const data: unknown = res.data;
      if (Array.isArray(data)) setPlans(data as WorkPlan[]);
      else if (data && typeof data === 'object' && 'plans' in data) setPlans((data as { plans: WorkPlan[] }).plans);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [date]);

  return (
    <div className="space-y-4">
      <SectionHead title="Work Planner" />
      <Card>
        <div className="p-4 flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm focus:outline-none"
            style={{ background: pro.bg, color: pro.text, border: `1px solid ${pro.border}` }}
          />
          <PrimaryBtn onClick={generate} disabled={loading} size="sm">
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
            {loading ? 'Génération…' : 'Générer plan'}
          </PrimaryBtn>
        </div>
      </Card>
      {plans.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${pro.border}` }}>
                  {['Date', 'Tâches', 'Statut'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10.5px]" style={{ color: pro.textSec }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((p, i) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors"
                      style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                    <td className="px-4 py-3 tabular-nums" style={{ color: pro.text }}>{p.date}</td>
                    <td className="px-4 py-3" style={{ color: pro.textSec }}>{p.tasks?.join(', ')}</td>
                    <td className="px-4 py-3">
                      <Pill color={p.status === 'done' ? 'ok' : p.status === 'pending' ? 'warn' : 'neutral'}>
                        {p.status}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Business Plan ────────────────────────────────────────────────────────

function TabBusinessPlan() {
  const [prospectId, setProspectId] = useState('');
  const [pitch, setPitch]           = useState<Pitch | null>(null);
  const [loading, setLoading]       = useState(false);

  const generate = useCallback(async () => {
    if (!prospectId.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/ai-agents/business-plan', { prospectId });
      setPitch(res.data as Pitch);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [prospectId]);

  return (
    <div className="space-y-4">
      <SectionHead title="Business Plan Agent" />
      <Card>
        <div className="p-4 flex items-center gap-3">
          <input
            type="text"
            value={prospectId}
            onChange={e => setProspectId(e.target.value)}
            placeholder="ID prospect…"
            className="px-3 py-2 rounded-xl text-sm flex-1 focus:outline-none"
            style={{ background: pro.bg, color: pro.text, border: `1px solid ${pro.border}` }}
          />
          <PrimaryBtn onClick={generate} disabled={loading || !prospectId.trim()} size="sm">
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Brain size={13} />}
            {loading ? 'Génération…' : 'Générer pitch'}
          </PrimaryBtn>
        </div>
      </Card>
      {pitch && (
        <Card>
          <div className="p-4 space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>
              {pitch.prospectName} · {fmtDate(pitch.createdAt)}
            </p>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: pro.text }}>
              {pitch.content}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Branding ─────────────────────────────────────────────────────────────

function TabBranding() {
  const [prospectId, setProspectId] = useState('');
  const [rec, setRec]               = useState<BrandRec | null>(null);
  const [loading, setLoading]       = useState(false);

  const generate = useCallback(async () => {
    if (!prospectId.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/ai-agents/branding', { prospectId });
      setRec(res.data as BrandRec);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [prospectId]);

  return (
    <div className="space-y-4">
      <SectionHead title="Branding Agent" />
      <Card>
        <div className="p-4 flex items-center gap-3">
          <input
            type="text"
            value={prospectId}
            onChange={e => setProspectId(e.target.value)}
            placeholder="ID prospect…"
            className="px-3 py-2 rounded-xl text-sm flex-1 focus:outline-none"
            style={{ background: pro.bg, color: pro.text, border: `1px solid ${pro.border}` }}
          />
          <PrimaryBtn onClick={generate} disabled={loading || !prospectId.trim()} size="sm">
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
            {loading ? 'Génération…' : 'Analyser marque'}
          </PrimaryBtn>
        </div>
      </Card>
      {rec && (
        <Card>
          <div className="p-4 space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>
              {rec.prospectName} · {fmtDate(rec.createdAt)}
            </p>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: pro.text }}>
              {rec.recommendations}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: IA Learning ──────────────────────────────────────────────────────────

function TabIaLearning() {
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [abTests, setAbTests]     = useState<AbTest[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/ai/mutations').catch(() => ({ data: [] })),
      api.get('/ai/ab-tests').catch(() => ({ data: [] })),
    ]).then(([m, ab]) => {
      if (!active) return;
      const mData: unknown = m.data;
      const abData: unknown = ab.data;
      setMutations(Array.isArray(mData) ? mData as Mutation[] : (mData as { items: Mutation[] }).items ?? []);
      setAbTests(Array.isArray(abData) ? abData as AbTest[] : (abData as { items: AbTest[] }).items ?? []);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <SkeletonGrid />;

  return (
    <div className="space-y-4">
      <SectionHead title="IA Learning" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat label="Mutations totales"  value={mutations.length} icon={Brain} />
        <Stat label="Tests A/B actifs"   value={abTests.length}   icon={TrendingUp} />
        <Stat
          label="Gagnants A/B"
          value={abTests.filter(t => t.isWinner).length}
          icon={CheckCircle}
        />
      </div>
      {mutations.length > 0 && (
        <Card>
          <div className="p-3 text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: pro.textSec }}>
            Dernières mutations
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${pro.border}` }}>
                  {['Type', 'Champ', 'Confiance', 'Statut', 'Date'].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[10.5px]" style={{ color: pro.textSec }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mutations.slice(0, 10).map((m, i) => (
                  <tr key={m.id} style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                    <td className="px-4 py-2" style={{ color: pro.text }}>{m.type}</td>
                    <td className="px-4 py-2" style={{ color: pro.textSec }}>{m.field}</td>
                    <td className="px-4 py-2 tabular-nums" style={{ color: pro.text }}>{m.confidence}%</td>
                    <td className="px-4 py-2">
                      <Pill color={m.status === 'applied' ? 'ok' : m.status === 'pending' ? 'warn' : 'neutral'}>{m.status}</Pill>
                    </td>
                    <td className="px-4 py-2 tabular-nums" style={{ color: pro.textTer }}>{fmtDate(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Évolution ────────────────────────────────────────────────────────────

function TabEvolution() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/ai-agents/strategies').catch(() => ({ data: [] })).then(res => {
      if (!active) return;
      const d: unknown = res.data;
      setStrategies(Array.isArray(d) ? d as Strategy[] : (d as { items: Strategy[] }).items ?? []);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <SkeletonGrid />;

  return (
    <div className="space-y-4">
      <SectionHead title="Évolution des stratégies" />
      {strategies.length === 0 ? (
        <Card><div className="p-8 text-center text-[13px]" style={{ color: pro.textSec }}>Aucune stratégie disponible</div></Card>
      ) : (
        <div className="space-y-2">
          {strategies.map((s, i) => (
            <Card key={s.id}>
              <div className="p-4 flex items-start gap-3">
                <div
                  className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                  style={{ background: s.active ? pro.ok : pro.textTer }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold" style={{ color: pro.text }}>{s.name}</p>
                    <Pill color={s.active ? 'ok' : 'neutral'}>{s.active ? 'Actif' : 'Inactif'}</Pill>
                    <span className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>{fmtDate(s.createdAt)}</span>
                  </div>
                  <p className="text-[12px] mt-1" style={{ color: pro.textSec }}>{s.description}</p>
                </div>
                <span className="text-[11px] font-mono" style={{ color: pro.textTer }}>#{i + 1}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Moniteur ─────────────────────────────────────────────────────────────

function TabMoniteur() {
  const [botActive, setBotActive] = useState(false);
  const [activity, setActivity]   = useState<BotActivity[]>([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    const [bot, act] = await Promise.allSettled([
      api.get('/bot/status').catch(() => ({ data: { isActive: false } })),
      api.get('/bot/activity?limit=10').catch(() => ({ data: [] })),
    ]);
    if (bot.status === 'fulfilled') setBotActive((bot.value.data as { isActive: boolean }).isActive ?? false);
    if (act.status === 'fulfilled') {
      const d: unknown = act.value.data;
      setActivity(Array.isArray(d) ? d as BotActivity[] : (d as { items: BotActivity[] }).items ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-4">
      <SectionHead title="Moniteur live" action={<GhostBtn onClick={load} size="sm"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></GhostBtn>} />
      <Card>
        <div className="p-4 flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{
              background: botActive ? pro.ok : pro.textTer,
              boxShadow: botActive ? `0 0 6px ${pro.ok}` : undefined,
            }}
          />
          <p className="text-[14px] font-semibold" style={{ color: pro.text }}>
            {botActive ? 'Bot actif' : 'Bot inactif'}
          </p>
        </div>
      </Card>
      {activity.length > 0 && (
        <Card>
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {activity.map((a, i) => (
              <div key={a.id ?? i} className="flex items-start gap-3 px-4 py-3">
                <Activity size={12} className="mt-1 flex-shrink-0" style={{ color: pro.textSec }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px]" style={{ color: pro.text }}>{a.message ?? a.description ?? a.type}</p>
                  {(a.createdAt ?? a.timestamp) && (
                    <p className="text-[10.5px]" style={{ color: pro.textTer }}>
                      {new Date(a.createdAt ?? a.timestamp ?? '').toLocaleTimeString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Décisions ────────────────────────────────────────────────────────────

function TabDecisions() {
  const [decisions, setDecisions] = useState<AiDecision[]>([]);
  const [loading, setLoading]     = useState(true);
  const [busy, setBusy]           = useState<string | null>(null);
  const { add: toast }            = useToast();

  const load = useCallback(async () => {
    try {
      const res = await api.get('/ai/mutations?status=pending');
      const d: unknown = res.data;
      setDecisions(Array.isArray(d) ? d as AiDecision[] : (d as { items: AiDecision[] }).items ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id);
    try {
      await api.post(`/ai/mutations/${id}/${action}`);
      toast(action === 'approve' ? 'Approuvé' : 'Rejeté', 'success');
      await load();
    } catch {
      toast('Erreur', 'error');
    } finally { setBusy(null); }
  };

  if (loading) return <SkeletonGrid />;

  return (
    <div className="space-y-4">
      <SectionHead title="Décisions IA en attente" />
      {decisions.length === 0 ? (
        <Card>
          <div className="p-8 flex flex-col items-center gap-2">
            <CheckCircle size={28} style={{ color: pro.ok }} />
            <p className="text-[13px]" style={{ color: pro.textSec }}>Aucune décision en attente</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {decisions.map(d => (
            <Card key={d.id}>
              <div className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-[13px] font-semibold" style={{ color: pro.text }}>{d.type}</p>
                    <p className="text-[12px]" style={{ color: pro.textSec }}>{d.field}</p>
                    <Pill color="info">{d.confidence}% confiance</Pill>
                  </div>
                  <p className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>{fmtDate(d.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => act(d.id, 'approve')}
                    disabled={busy === d.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-40"
                    style={{ background: 'rgba(34,197,94,0.12)', color: pro.ok, border: `1px solid rgba(34,197,94,0.24)` }}
                  >
                    <CheckCircle size={12} />
                    Approuver
                  </button>
                  <button
                    onClick={() => act(d.id, 'reject')}
                    disabled={busy === d.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-40"
                    style={{ background: 'rgba(239,68,68,0.10)', color: pro.bad, border: `1px solid rgba(239,68,68,0.24)` }}
                  >
                    <XCircle size={12} />
                    Rejeter
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Agents() {
  const [tab, setTab]         = useState<TabKey>('Aperçu');
  const [data, setData]       = useState<AgentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [evolving, setEvolving] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/ai-agents/dashboard');
      setData(res.data as AgentDashboard);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
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
      toast(err instanceof Error ? err.message : 'Erreur', 'error');
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

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all whitespace-nowrap"
            style={tab === t
              ? { background: 'rgba(255,255,255,0.08)', color: pro.text }
              : { color: pro.textSec }}
          >
            {t === 'Aperçu'       && <Bot size={12} />}
            {t === 'Work Planner' && <Activity size={12} />}
            {t === 'Business Plan' && <Brain size={12} />}
            {t === 'Branding'     && <Zap size={12} />}
            {t === 'IA Learning'  && <TrendingUp size={12} />}
            {t === 'Évolution'    && <GitMerge size={12} />}
            {t === 'Moniteur'     && <Activity size={12} />}
            {t === 'Décisions'    && <AlertTriangle size={12} />}
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Aperçu'        && <TabApercu data={data} loading={loading} evolving={evolving} onEvolve={triggerEvolution} />}
      {tab === 'Work Planner'  && <TabWorkPlanner />}
      {tab === 'Business Plan' && <TabBusinessPlan />}
      {tab === 'Branding'      && <TabBranding />}
      {tab === 'IA Learning'   && <TabIaLearning />}
      {tab === 'Évolution'     && <TabEvolution />}
      {tab === 'Moniteur'      && <TabMoniteur />}
      {tab === 'Décisions'     && <TabDecisions />}
    </div>
  );
}
