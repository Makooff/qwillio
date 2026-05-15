import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { RefreshCw, Brain, Search, Info, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import SlideSheet from '../../components/ui/SlideSheet';
import Pagination from '../../components/ui/Pagination';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, GhostBtn, Pill, PrimaryBtn,
} from '../../components/pro/ProBlocks';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface AiDecision {
  id: string;
  type: string;
  outcome?: string;
  result?: string;
  action?: string;
  reasoning?: string;
  confidence?: number;
  niche?: string;
  data?: unknown;
  createdAt: string;
}

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const resolveOutcome = (d: AiDecision): string =>
  (d.outcome ?? d.result ?? '').toLowerCase();

const outcomeColor = (outcome: string): PillColor => {
  if (['approved', 'auto_approved', 'success', 'ok'].includes(outcome)) return 'ok';
  if (['rejected', 'failed', 'error', 'denied'].includes(outcome)) return 'bad';
  if (['pending', 'needs_review', 'review', ''].includes(outcome)) return 'warn';
  return 'neutral';
};

const outcomeLabel = (outcome: string): string => {
  if (outcome === 'approved' || outcome === 'auto_approved') return 'Approuvée';
  if (outcome === 'rejected') return 'Rejetée';
  if (outcome === 'pending' || outcome === 'needs_review' || outcome === '') return 'En attente';
  if (outcome === 'success' || outcome === 'ok') return 'Succès';
  if (outcome === 'failed' || outcome === 'error') return 'Échec';
  return outcome;
};

const isSettled = (outcome: string): boolean =>
  ['approved', 'auto_approved', 'rejected', 'success', 'ok', 'failed', 'error', 'denied'].includes(outcome);

const fmtRelative = (iso?: string): string => {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  } catch {
    return '—';
  }
};

const fmtDateTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${date} · ${time}`;
};

const matchesSearch = (d: AiDecision, q: string): boolean => {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    (d.action ?? '').toLowerCase().includes(s) ||
    (d.niche ?? '').toLowerCase().includes(s) ||
    (d.type ?? '').toLowerCase().includes(s)
  );
};

const matchesStatus = (d: AiDecision, filter: StatusFilter): boolean => {
  if (filter === 'all') return true;
  const outcome = resolveOutcome(d);
  if (filter === 'approved') return ['approved', 'auto_approved', 'success', 'ok'].includes(outcome);
  if (filter === 'rejected') return ['rejected', 'failed', 'error', 'denied'].includes(outcome);
  if (filter === 'pending') return ['pending', 'needs_review', 'review', ''].includes(outcome);
  return true;
};

/* ─── Skeleton row ───────────────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3 animate-pulse">
      <div className="w-9 h-9 rounded-lg flex-shrink-0"
           style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="flex-1 space-y-1.5">
        <div className="flex gap-2">
          <div className="h-4 w-16 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <div className="h-4 w-14 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>
        <div className="h-3 rounded-full w-3/5" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-2.5 rounded-full w-1/3" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-8 w-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-8 w-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
    </div>
  );
}

/* ─── Filter chip ────────────────────────────────────────────────────────── */

function FilterChip({
  active, label, onClick,
}: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-8 px-3.5 rounded-xl text-[12px] font-medium transition-colors"
      style={{
        background: active ? pro.accent : 'rgba(255,255,255,0.05)',
        color: active ? '#fff' : pro.textSec,
        border: `1px solid ${active ? pro.accent : pro.border}`,
      }}
    >
      {label}
    </button>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function AiDecisions() {
  const [decisions, setDecisions]   = useState<AiDecision[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState<StatusFilter>('all');
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<AiDecision | null>(null);
  const [acting, setActing]         = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 30;

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search && { search }),
      });
      const { data: res } = await api.get<{
        data?: AiDecision[];
        pagination?: { total: number };
      } | AiDecision[]>(`/ai/decisions?${params}`);

      if (Array.isArray(res)) {
        setDecisions(res);
        setTotal(res.length);
      } else {
        setDecisions(Array.isArray(res.data) ? res.data : []);
        setTotal(res.pagination?.total ?? 0);
      }
    } catch {
      toast('Erreur chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  /* ── Approve / Reject ── */
  const applyAction = async (
    id: string,
    action: 'approved' | 'rejected',
  ) => {
    setActing(id);

    // Optimistic update
    const prev = decisions;
    setDecisions(ds =>
      ds.map(d => d.id === id ? { ...d, outcome: action } : d),
    );
    if (selected?.id === id) {
      setSelected(s => s ? { ...s, outcome: action } : s);
    }

    try {
      await api.patch(`/ai/mutations/${id}`, { status: action });
      toast(action === 'approved' ? 'Décision approuvée' : 'Décision rejetée', 'success');
    } catch {
      // Revert
      setDecisions(prev);
      if (selected?.id === id) {
        const orig = prev.find(d => d.id === id);
        if (orig) setSelected(orig);
      }
      toast('Erreur — action annulée', 'error');
    } finally {
      setActing(null);
    }
  };

  /* ── Filtered view ── */
  const visible = decisions.filter(
    d => matchesStatus(d, statusFilter) && matchesSearch(d, search),
  );

  /* ── KPI counts ── */
  const approvedCount = decisions.filter(d => {
    const o = resolveOutcome(d);
    return ['approved', 'auto_approved', 'success', 'ok'].includes(o);
  }).length;
  const pendingCount = decisions.filter(d => {
    const o = resolveOutcome(d);
    return ['pending', 'needs_review', 'review', ''].includes(o);
  }).length;
  const rejectedCount = decisions.filter(d => {
    const o = resolveOutcome(d);
    return ['rejected', 'failed', 'error', 'denied'].includes(o);
  }).length;

  /* ── Render ── */
  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Décisions IA"
        subtitle="Mutations de scripts et décisions automatiques"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </IconBtn>
        }
      />

      {/* KPI stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total" value={total || decisions.length} hint="Toutes dates" />
        <Stat label="Approuvées" value={approvedCount} hint="Sur la page en cours" />
        <Stat label="En attente" value={pendingCount} hint="À examiner" />
        <Stat label="Rejetées" value={rejectedCount} hint="Sur la page en cours" />
      </div>

      {/* Filter bar */}
      <Card>
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: pro.textTer }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher action, niche…"
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: pro.text }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-[11px] flex-shrink-0"
                style={{ color: pro.textSec }}
              >
                Effacer
              </button>
            )}
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(
              [
                { value: 'all',      label: 'Tous' },
                { value: 'pending',  label: 'En attente' },
                { value: 'approved', label: 'Approuvées' },
                { value: 'rejected', label: 'Rejetées' },
              ] as { value: StatusFilter; label: string }[]
            ).map(chip => (
              <FilterChip
                key={chip.value}
                active={statusFilter === chip.value}
                label={chip.label}
                onClick={() => setStatus(chip.value)}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Decisions table */}
      <Card>
        {loading ? (
          <>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                <SkeletonRow />
              </div>
            ))}
          </>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <Brain className="w-7 h-7 mx-auto mb-3 opacity-40" />
            <p className="text-[13px]">Aucune décision IA</p>
          </div>
        ) : (
          visible.map((d, i) => {
            const outcome = resolveOutcome(d);
            const settled = isSettled(outcome);
            const isActing = acting === d.id;
            const iconBg = outcomeColor(outcome) === 'ok'
              ? 'rgba(34,197,94,0.10)'
              : outcomeColor(outcome) === 'bad'
                ? 'rgba(239,68,68,0.10)'
                : 'rgba(245,158,11,0.10)';
            const iconColor = outcomeColor(outcome) === 'ok'
              ? pro.ok
              : outcomeColor(outcome) === 'bad'
                ? pro.bad
                : pro.warn;

            return (
              <div
                key={d.id}
                className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: iconBg }}
                >
                  <Brain size={14} style={{ color: iconColor }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <Pill color="neutral">{d.type ?? 'decision'}</Pill>
                    <Pill color={outcomeColor(outcome)}>{outcomeLabel(outcome)}</Pill>
                    {d.confidence != null && (
                      <span className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>
                        {(d.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {d.niche && (
                      <span className="text-[11px]" style={{ color: pro.textTer }}>
                        {d.niche}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                    {d.action ?? '—'}
                  </p>
                  <p className="text-[11.5px]" style={{ color: pro.textTer }}>
                    {fmtRelative(d.createdAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <GhostBtn size="sm" onClick={() => setSelected(d)}>
                    <Info size={12} />
                    Détail
                  </GhostBtn>

                  {!settled && (
                    <>
                      {/* Approve */}
                      <button
                        onClick={() => applyAction(d.id, 'approved')}
                        disabled={isActing}
                        title="Approuver"
                        className="h-8 px-3 rounded-xl text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        style={{
                          background: 'rgba(34,197,94,0.10)',
                          color: pro.ok,
                          border: `1px solid rgba(34,197,94,0.20)`,
                        }}
                      >
                        <Check size={12} />
                        Approuver
                      </button>

                      {/* Reject */}
                      <button
                        onClick={() => applyAction(d.id, 'rejected')}
                        disabled={isActing}
                        title="Rejeter"
                        className="h-8 px-3 rounded-xl text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        style={{
                          background: 'rgba(239,68,68,0.10)',
                          color: pro.bad,
                          border: `1px solid rgba(239,68,68,0.20)`,
                        }}
                      >
                        <X size={12} />
                        Rejeter
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Pagination */}
        {!loading && total > LIMIT && (
          <div className="px-4 pb-4 pt-2" style={{ borderTop: `1px solid ${pro.border}` }}>
            <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
          </div>
        )}
      </Card>

      {/* Slide sheet detail */}
      <SlideSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Détail décision IA"
        subtitle={selected ? fmtDateTime(selected.createdAt) : ''}
        footer={
          selected && !isSettled(resolveOutcome(selected)) ? (
            <>
              <PrimaryBtn
                onClick={() => applyAction(selected.id, 'approved')}
                disabled={acting === selected.id}
              >
                <Check size={14} />
                Approuver
              </PrimaryBtn>
              <GhostBtn
                onClick={() => applyAction(selected.id, 'rejected')}
                disabled={acting === selected.id}
              >
                <X size={14} />
                Rejeter
              </GhostBtn>
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl p-3 text-center border"
                style={{ background: pro.panel, borderColor: pro.border }}
              >
                <Pill color="neutral">{selected.type ?? 'decision'}</Pill>
                <p className="text-[10px] mt-1.5 uppercase tracking-wider" style={{ color: pro.textTer }}>
                  Type
                </p>
              </div>
              <div
                className="rounded-xl p-3 text-center border"
                style={{ background: pro.panel, borderColor: pro.border }}
              >
                {selected.confidence != null ? (
                  <p className="text-xl font-semibold tabular-nums" style={{ color: pro.text }}>
                    {(selected.confidence * 100).toFixed(0)}%
                  </p>
                ) : (
                  <p className="text-xl font-semibold" style={{ color: pro.textSec }}>—</p>
                )}
                <p className="text-[10px] mt-1.5 uppercase tracking-wider" style={{ color: pro.textTer }}>
                  Confiance
                </p>
              </div>
            </div>

            {/* Outcome */}
            <div
              className="flex items-center justify-between text-xs p-3 rounded-xl border"
              style={{ background: pro.panel, borderColor: pro.border }}
            >
              <span style={{ color: pro.textSec }}>Statut</span>
              <Pill color={outcomeColor(resolveOutcome(selected))}>
                {outcomeLabel(resolveOutcome(selected))}
              </Pill>
            </div>

            {/* Niche */}
            {selected.niche && (
              <div
                className="flex items-center justify-between text-xs p-3 rounded-xl border"
                style={{ background: pro.panel, borderColor: pro.border }}
              >
                <span style={{ color: pro.textSec }}>Niche</span>
                <span style={{ color: pro.text }}>{selected.niche}</span>
              </div>
            )}

            {/* Action */}
            {selected.action && (
              <div>
                <p className="text-xs mb-2 uppercase tracking-wider" style={{ color: pro.textTer }}>
                  Action
                </p>
                <p
                  className="text-xs p-3 rounded-xl border leading-relaxed"
                  style={{ color: pro.text, background: pro.panel, borderColor: pro.border }}
                >
                  {selected.action}
                </p>
              </div>
            )}

            {/* Reasoning */}
            {selected.reasoning && (
              <div>
                <p className="text-xs mb-2 uppercase tracking-wider" style={{ color: pro.textTer }}>
                  Raisonnement
                </p>
                <p
                  className="text-xs leading-relaxed p-3 rounded-xl border"
                  style={{ color: pro.text, background: pro.panel, borderColor: pro.border }}
                >
                  {selected.reasoning}
                </p>
              </div>
            )}

            {/* Data JSON */}
            {selected.data != null && (
              <div>
                <p className="text-xs mb-2 uppercase tracking-wider" style={{ color: pro.textTer }}>
                  Données
                </p>
                <pre
                  className="text-[10px] overflow-x-auto leading-relaxed p-3 rounded-xl border"
                  style={{ color: pro.text, background: pro.panel, borderColor: pro.border }}
                >
                  {JSON.stringify(selected.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
