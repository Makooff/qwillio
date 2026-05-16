import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Phone, Search, X } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, PrimaryBtn, GhostBtn, Pill,
} from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import Pagination from '../../components/ui/Pagination';
import SlideSheet from '../../components/ui/SlideSheet';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CallRecord {
  id: string;
  prospectId?: string;
  phoneNumber: string;
  direction: string;
  status: string;
  durationSeconds?: number;
  interestScore?: number;
  detectionResult?: string;
  transcript?: string;
  summary?: string;
  sentiment?: string;
  niche?: string;
  createdAt: string;
  prospect?: { businessName: string; niche?: string };
}

interface CallsResponse {
  calls?: CallRecord[];
  data?: CallRecord[];
  total?: number;
  pagination?: { total?: number };
}

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
type StatusFilter = 'all' | 'completed' | 'voicemail' | 'failed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(s?: number): string {
  if (!s || s <= 0) return '—';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function statusColor(s: string): PillColor {
  switch (s.toLowerCase()) {
    case 'completed':  return 'ok';
    case 'voicemail':  return 'warn';
    case 'failed':     return 'bad';
    case 'in_progress':
    case 'ringing':    return 'info';
    default:           return 'neutral';
  }
}

function scoreColor(n: number): PillColor {
  return n >= 7 ? 'ok' : n >= 5 ? 'warn' : 'bad';
}

function isoToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Outcome pie data ─────────────────────────────────────────────────────────

interface PieSlice {
  name: string;
  value: number;
  color: string;
}

function buildPieData(calls: CallRecord[]): PieSlice[] {
  const counts: Record<string, number> = {
    completed: 0,
    voicemail: 0,
    failed: 0,
    in_progress: 0,
  };
  for (const c of calls) {
    const s = c.status.toLowerCase();
    if (s === 'completed') counts.completed++;
    else if (s === 'voicemail') counts.voicemail++;
    else if (s === 'failed') counts.failed++;
    else counts.in_progress++;
  }
  return [
    { name: 'Complété',  value: counts.completed,   color: pro.ok },
    { name: 'Voicemail', value: counts.voicemail,    color: pro.warn },
    { name: 'Échec',     value: counts.failed,       color: pro.bad },
    { name: 'En cours',  value: counts.in_progress,  color: pro.info },
  ].filter(s => s.value > 0);
}

// ─── Filter chip ─────────────────────────────────────────────────────────────

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="h-8 px-3.5 text-[12px] font-medium rounded-xl transition-colors"
      style={{
        background: active ? pro.text : pro.panel,
        color: active ? '#0B0B0D' : pro.textSec,
        border: `1px solid ${active ? pro.text : pro.border}`,
      }}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const LIMIT = 30;

export default function AdminCalls() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState(sevenDaysAgo());
  const [dateTo, setDateTo] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [selected, setSelected] = useState<CallRecord | null>(null);
  const [followingUp, setFollowingUp] = useState(false);
  const { toasts, add: toast, remove } = useToast();

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const { data: res } = await api.get<CallsResponse | CallRecord[]>(`/admin/calls?${params}`);
      const list = Array.isArray(res)
        ? res
        : (res as CallsResponse).calls ?? (res as CallsResponse).data ?? [];
      setCalls(list);
      const resTyped = res as CallsResponse;
      setTotal(resTyped.total ?? resTyped.pagination?.total ?? list.length);
    } catch {
      toast('Erreur chargement des appels', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, statusFilter, dateFrom, dateTo, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter, dateFrom, dateTo]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const todayCalls = calls.filter(c => isoToday(c.createdAt));
    const durations = calls.map(c => c.durationSeconds ?? 0).filter(n => n > 0);
    const avgDur = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    const completed = calls.filter(c => c.status.toLowerCase() === 'completed').length;
    const replyRate = calls.length ? Math.round((completed / calls.length) * 100) : 0;
    const scores = calls.map(c => c.interestScore ?? 0).filter(n => n > 0);
    const avgScore = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0;
    return { todayCount: todayCalls.length, avgDur, replyRate, avgScore };
  }, [calls]);

  const pieData = useMemo(() => buildPieData(calls), [calls]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const triggerCall = async () => {
    setTriggering(true);
    try {
      await api.post('/prospecting/trigger/call');
      toast('Appel déclenché', 'success');
      void load();
    } catch {
      toast('Erreur déclenchement appel', 'error');
    } finally {
      setTriggering(false);
    }
  };

  const triggerFollowUp = async (call: CallRecord) => {
    setFollowingUp(true);
    try {
      await api.post('/prospecting/trigger/follow-ups', { prospectId: call.prospectId ?? call.id });
      toast('Séquence de suivi déclenchée', 'success');
    } catch {
      toast('Erreur déclenchement suivi', 'error');
    } finally {
      setFollowingUp(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <PageHeader
        title="Appels"
        subtitle={`${total} appel${total !== 1 ? 's' : ''}`}
        right={
          <>
            <IconBtn onClick={load} title="Rafraîchir">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </IconBtn>
            <PrimaryBtn onClick={triggerCall} disabled={triggering}>
              <Phone className="w-3.5 h-3.5" />
              {triggering ? 'Déclenchement…' : 'Déclencher appel'}
            </PrimaryBtn>
          </>
        }
      />

      {/* Stats + Pie row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Appels aujourd'hui" value={stats.todayCount} hint="Total du jour" />
          <Stat label="Durée moy." value={fmtDuration(stats.avgDur)} hint="Secondes" />
          <Stat label="Taux réponse" value={`${stats.replyRate}%`} hint="% complétés" />
          <Stat label="Score intérêt moy." value={stats.avgScore > 0 ? `${stats.avgScore}/10` : '—'} hint="Sur 10" />
        </div>

        {/* Pie chart */}
        {pieData.length > 0 && (
          <Card className="flex flex-col items-center justify-center py-3 px-2">
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={52}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: pro.panel, border: `1px solid ${pro.border}`, borderRadius: 10, fontSize: 12, color: pro.text }}
                  itemStyle={{ color: pro.text }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
              {pieData.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-[10.5px]" style={{ color: pro.textTer }}>{s.name}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Filters */}
      <Card>
        {/* Search */}
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: pro.textTer }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par entreprise ou téléphone…"
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: pro.text }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: pro.textTer }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date + status chips */}
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3"
          style={{ borderTop: `1px solid ${pro.border}` }}
        >
          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-8 px-2.5 text-[12px] rounded-xl outline-none"
              style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}
            />
            <span className="text-[11px]" style={{ color: pro.textTer }}>→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-8 px-2.5 text-[12px] rounded-xl outline-none"
              style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}
            />
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-2">
            {(['all', 'completed', 'voicemail', 'failed'] as StatusFilter[]).map(s => (
              <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {s === 'all' ? 'Tous' : s === 'completed' ? 'Complété' : s === 'voicemail' ? 'Voicemail' : 'Échec'}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      {/* Calls table */}
      <Card>
        {loading ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-3 opacity-40" />
            <p className="text-[13px]">Chargement…</p>
          </div>
        ) : calls.length === 0 ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <Phone className="w-6 h-6 mx-auto mb-3 opacity-40" />
            <p className="text-[13px]">Aucun appel trouvé</p>
          </div>
        ) : (
          <>
            {calls.map((call, i) => {
              const name = call.prospect?.businessName ?? call.phoneNumber;
              const niche = call.prospect?.niche ?? call.niche;
              const sc = statusColor(call.status);
              const phoneIconBg =
                sc === 'ok' ? 'rgba(34,197,94,0.10)' :
                sc === 'warn' ? 'rgba(245,158,11,0.10)' :
                sc === 'bad' ? 'rgba(239,68,68,0.10)' :
                'rgba(96,165,250,0.10)';
              const phoneIconColor =
                sc === 'ok' ? pro.ok :
                sc === 'warn' ? pro.warn :
                sc === 'bad' ? pro.bad :
                pro.info;

              return (
                <div
                  key={call.id}
                  className="flex items-center gap-3.5 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                  onClick={() => setSelected(call)}
                >
                  {/* Phone icon */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: phoneIconBg }}
                  >
                    <Phone className="w-4 h-4" style={{ color: phoneIconColor }} />
                  </div>

                  {/* Left: name + niche + date */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>{name}</p>
                      {niche && <Pill color="accent">{niche}</Pill>}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: pro.textTer }}>
                      {format(new Date(call.createdAt), 'd MMM · HH:mm', { locale: fr })}
                    </p>
                  </div>

                  {/* Center: duration + interest score */}
                  <div className="hidden md:flex flex-col items-end gap-1 flex-shrink-0 min-w-[80px]">
                    <span className="text-[12.5px] tabular-nums font-medium" style={{ color: pro.textSec }}>
                      {fmtDuration(call.durationSeconds)}
                    </span>
                    {call.interestScore != null && (
                      <Pill color={scoreColor(call.interestScore)}>
                        {call.interestScore}/10
                      </Pill>
                    )}
                  </div>

                  {/* Right: detection result + detail button */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Pill color={sc}>{call.status}</Pill>
                    {call.detectionResult && (
                      <Pill color="neutral">{call.detectionResult}</Pill>
                    )}
                  </div>

                  <GhostBtn
                    size="sm"
                    onClick={() => setSelected(call)}
                  >
                    Détail
                  </GhostBtn>
                </div>
              );
            })}

            {/* Pagination */}
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${pro.border}` }}>
              <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
            </div>
          </>
        )}
      </Card>

      {/* Detail SlideSheet */}
      <SlideSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.prospect?.businessName ?? selected?.phoneNumber ?? 'Détail appel'}
        subtitle={selected ? [selected.status, fmtDuration(selected.durationSeconds)].filter(Boolean).join(' · ') : undefined}
      >
        {selected && (
          <div className="space-y-4">
            {/* Meta row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl p-3 text-center" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <p className="text-[17px] font-semibold tabular-nums" style={{ color: pro.text }}>
                  {selected.interestScore != null ? `${selected.interestScore}/10` : '—'}
                </p>
                <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: pro.textTer }}>Score intérêt</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <p className="text-[17px] font-semibold tabular-nums" style={{ color: pro.text }}>
                  {fmtDuration(selected.durationSeconds)}
                </p>
                <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: pro.textTer }}>Durée</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <div className="flex items-center justify-center" style={{ minHeight: 24 }}>
                  <Pill color={statusColor(selected.status)}>{selected.status}</Pill>
                </div>
                <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: pro.textTer }}>Résultat</p>
              </div>
            </div>

            {/* Sentiment / outcome */}
            {(selected.sentiment || selected.detectionResult) && (
              <div className="flex items-center gap-2 flex-wrap">
                {selected.sentiment && <Pill color="info">{selected.sentiment}</Pill>}
                {selected.detectionResult && <Pill color="neutral">{selected.detectionResult}</Pill>}
              </div>
            )}

            {/* Phone + date */}
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
              <Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: pro.textSec }} />
              <span className="text-[13px] font-mono flex-1" style={{ color: pro.text }}>{selected.phoneNumber}</span>
              <span className="text-[11px]" style={{ color: pro.textTer }}>
                {format(new Date(selected.createdAt), "d MMM yyyy 'à' HH:mm", { locale: fr })}
              </span>
            </div>

            {/* Summary */}
            {selected.summary && (
              <div>
                <p className="text-[11px] mb-2 font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>Résumé</p>
                <p
                  className="text-[12.5px] leading-relaxed rounded-xl p-3"
                  style={{ color: pro.text, background: pro.panel, border: `1px solid ${pro.border}` }}
                >
                  {selected.summary}
                </p>
              </div>
            )}

            {/* Transcript */}
            {selected.transcript && (
              <div>
                <p className="text-[11px] mb-2 font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>Transcription</p>
                <pre
                  className="text-[11.5px] leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl p-3 font-mono"
                  style={{ color: pro.text, background: pro.panel, border: `1px solid ${pro.border}` }}
                >
                  {selected.transcript}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="pt-1">
              <PrimaryBtn onClick={() => triggerFollowUp(selected)} disabled={followingUp}>
                {followingUp ? 'Déclenchement…' : 'Déclencher suivi'}
              </PrimaryBtn>
            </div>
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
