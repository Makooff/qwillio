import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, Phone, X, Zap, MapPin, Mail } from 'lucide-react';
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

interface Lead {
  id: string;
  businessName: string;
  niche?: string;
  businessType?: string;
  city?: string;
  phone?: string;
  email?: string;
  score: number;
  priorityScore: number;
  interestLevel?: number;
  status: string;
  callTranscript?: string;
  painPoints?: string[];
  notes?: string;
  callAttempts: number;
  createdAt: string;
  lastCallDate?: string;
}

interface LeadsResponse {
  leads?: Lead[];
  data?: Lead[];
  prospects?: Lead[];
  total?: number;
  pagination?: { total?: number };
}

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
type ScoreFilter = 'all' | '5' | '7' | '8';
type StatusFilterValue = 'all' | 'new' | 'contacted' | 'hot_lead';

const NICHES = [
  'Restaurant', 'Plomberie', 'Électricité', 'Coiffure', 'Auto', 'Santé',
  'Immobilier', 'Comptabilité', 'Nettoyage', 'Sport', 'Mode', 'Informatique',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string): PillColor {
  switch (s.toLowerCase()) {
    case 'hot_lead':   return 'ok';
    case 'contacted':  return 'info';
    case 'new':        return 'neutral';
    default:           return 'neutral';
  }
}

function scoreBarColor(n: number): string {
  return n >= 70 ? pro.ok : n >= 50 ? pro.warn : pro.bad;
}

function interestColor(n: number): PillColor {
  return n >= 7 ? 'ok' : n >= 5 ? 'warn' : 'bad';
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: scoreBarColor(pct) }}
      />
    </div>
  );
}

// ─── Filter chip ─────────────────────────────────────────────────────────────

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
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

export default function AdminLeads() {
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [niche, setNiche] = useState('');
  const [minScore, setMinScore] = useState<ScoreFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        status: 'qualified',
        page: String(page),
        limit: String(LIMIT),
        ...(search && { search }),
        ...(niche && { niche }),
        ...(minScore !== 'all' && { minScore }),
      });
      const { data: res } = await api.get<LeadsResponse>(`/prospects?${params}`);
      const list = res.leads ?? res.data ?? res.prospects ?? [];
      setLeads(list);
      setTotal(res.total ?? res.pagination?.total ?? list.length);
    } catch {
      toast('Erreur chargement des leads', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, niche, minScore, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, niche, minScore, statusFilter]);

  // ── Client-side status filter (applied after fetch) ───────────────────────

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return leads;
    return leads.filter(l => l.status.toLowerCase() === statusFilter);
  }, [leads, statusFilter]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const hotLeads = leads.filter(
      l => (l.interestLevel ?? 0) >= 8 || l.status.toLowerCase() === 'hot_lead',
    ).length;
    const scores = leads.map(l => l.interestLevel ?? 0).filter(n => n > 0);
    const avgScore = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0;
    const thisWeek = leads.filter(l => isThisWeek(l.createdAt)).length;
    return { total, hotLeads, avgScore, thisWeek };
  }, [leads, total]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const callLead = async (lead: Lead) => {
    if (!lead.phone) { toast('Numéro de téléphone manquant', 'error'); return; }
    setCallingId(lead.id);
    try {
      await api.post('/prospecting/trigger/call', { prospectId: lead.id });
      toast(`Appel déclenché — ${lead.businessName}`, 'success');
    } catch {
      toast('Erreur déclenchement appel', 'error');
    } finally {
      setCallingId(null);
    }
  };

  const triggerCloserSequence = async (lead: Lead) => {
    setClosingId(lead.id);
    try {
      await api.post(`/closer/sequence/${lead.id}`);
      toast('Séquence closer déclenchée', 'success');
    } catch {
      toast('Erreur séquence closer', 'error');
    } finally {
      setClosingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <PageHeader
        title="Leads qualifiés"
        subtitle="Prospects avec score d'intérêt ≥ 5"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </IconBtn>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total qualifiés" value={stats.total} hint="Score ≥ 5" />
        <Stat label="Hot leads" value={stats.hotLeads} hint="Score ≥ 8 ou hot_lead" />
        <Stat label="Score moyen" value={stats.avgScore > 0 ? `${stats.avgScore}/10` : '—'} hint="Intérêt moyen" />
        <Stat label="Cette semaine" value={stats.thisWeek} hint="Créés < 7j" />
      </div>

      {/* Filters */}
      <Card>
        {/* Search */}
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: pro.textTer }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone, email…"
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: pro.text }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} style={{ color: pro.textTer }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Niche + score + status filters */}
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3"
          style={{ borderTop: `1px solid ${pro.border}` }}
        >
          {/* Niche select */}
          <select
            value={niche}
            onChange={e => setNiche(e.target.value)}
            className="h-8 px-3 text-[12px] rounded-xl outline-none cursor-pointer"
            style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}
          >
            <option value="">Toutes les niches</option>
            {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>

          {/* Score min tabs */}
          <div className="flex items-center gap-1.5">
            {(['all', '5', '7', '8'] as ScoreFilter[]).map(s => (
              <Chip key={s} active={minScore === s} onClick={() => setMinScore(s)}>
                {s === 'all' ? 'Tous' : s === '8' ? '8+ 🔥' : `${s}+`}
              </Chip>
            ))}
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1.5">
            {(['all', 'new', 'contacted', 'hot_lead'] as StatusFilterValue[]).map(s => (
              <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {s === 'all' ? 'Tous' : s === 'new' ? 'Nouveau' : s === 'contacted' ? 'Contacté' : 'Hot lead'}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      {/* Leads table */}
      <Card>
        {/* Table header */}
        <div
          className="hidden md:grid px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider"
          style={{
            color: pro.textTer,
            borderBottom: `1px solid ${pro.border}`,
            gridTemplateColumns: '24px 1fr 100px 80px 70px 60px 80px 80px 120px',
            gap: '12px',
          }}
        >
          <span>#</span>
          <span>Business</span>
          <span>Niche</span>
          <span>Ville</span>
          <span>Score</span>
          <span>Intérêt</span>
          <span>Âge</span>
          <span>Statut</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-3 opacity-40" />
            <p className="text-[13px]">Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <Zap className="w-6 h-6 mx-auto mb-3 opacity-40" />
            <p className="text-[13px]">Aucun lead qualifié trouvé</p>
          </div>
        ) : (
          <>
            {filtered.map((lead, i) => (
              <div
                key={lead.id}
                onClick={() => setSelected(lead)}
                className="flex md:grid items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                style={{
                  borderTop: i > 0 ? `1px solid ${pro.border}` : undefined,
                  gridTemplateColumns: '24px 1fr 100px 80px 70px 60px 80px 80px 120px',
                }}
              >
                {/* # */}
                <span className="text-[11.5px] tabular-nums hidden md:block" style={{ color: pro.textTer }}>
                  {(page - 1) * LIMIT + i + 1}
                </span>

                {/* Business */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                    {lead.businessName}
                  </p>
                  {lead.phone && (
                    <p className="text-[11px] font-mono truncate hidden md:block" style={{ color: pro.textTer }}>
                      {lead.phone}
                    </p>
                  )}
                </div>

                {/* Niche */}
                <div className="hidden md:flex items-center">
                  {lead.niche
                    ? <Pill color="accent">{lead.niche}</Pill>
                    : <span style={{ color: pro.textTer }}>—</span>
                  }
                </div>

                {/* Ville */}
                <div className="hidden md:flex items-center">
                  <span className="text-[12px] truncate" style={{ color: pro.textSec }}>
                    {lead.city ?? '—'}
                  </span>
                </div>

                {/* Score bar */}
                <div className="hidden md:flex flex-col gap-1">
                  <ScoreBar value={lead.priorityScore ?? lead.score} />
                  <span className="text-[10px] tabular-nums" style={{ color: pro.textTer }}>
                    {lead.priorityScore ?? lead.score}
                  </span>
                </div>

                {/* Interest score */}
                <div className="hidden md:flex items-center">
                  {lead.interestLevel != null ? (
                    <span
                      className="text-[18px] font-bold tabular-nums leading-none"
                      style={{ color: lead.interestLevel >= 7 ? pro.ok : lead.interestLevel >= 5 ? pro.warn : pro.bad }}
                    >
                      {lead.interestLevel}
                    </span>
                  ) : (
                    <span style={{ color: pro.textTer }}>—</span>
                  )}
                </div>

                {/* Âge */}
                <div className="hidden md:flex items-center">
                  <span className="text-[11px]" style={{ color: pro.textTer }}>
                    {formatDistanceToNow(new Date(lead.createdAt), { locale: fr, addSuffix: false })}
                  </span>
                </div>

                {/* Statut */}
                <div className="hidden md:flex items-center">
                  <Pill color={statusColor(lead.status)}>{lead.status}</Pill>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-1.5 justify-end flex-shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  <GhostBtn
                    size="sm"
                    onClick={() => callLead(lead)}
                    disabled={callingId === lead.id || !lead.phone}
                  >
                    {callingId === lead.id ? '…' : '📞'}
                  </GhostBtn>
                  <GhostBtn
                    size="sm"
                    onClick={() => navigate('/admin/agents/business-plan', { state: { prospectId: lead.id } })}
                  >
                    📋
                  </GhostBtn>
                  <GhostBtn
                    size="sm"
                    onClick={() => navigate('/admin/agents/branding', { state: { prospectId: lead.id } })}
                  >
                    🎨
                  </GhostBtn>
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${pro.border}` }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: pro.textTer }}>
                  {total} lead{total !== 1 ? 's' : ''} au total
                </span>
                <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Detail SlideSheet */}
      <SlideSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.businessName ?? 'Détail lead'}
        subtitle={selected
          ? [selected.city, selected.niche].filter(Boolean).join(' · ')
          : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl p-3 text-center" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <p
                  className="text-[22px] font-bold tabular-nums leading-none"
                  style={{
                    color: (selected.interestLevel ?? 0) >= 7
                      ? pro.ok
                      : (selected.interestLevel ?? 0) >= 5
                        ? pro.warn
                        : pro.bad,
                  }}
                >
                  {selected.interestLevel ?? '—'}
                </p>
                <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: pro.textTer }}>Intérêt</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <p className="text-[17px] font-semibold tabular-nums" style={{ color: pro.text }}>
                  {selected.callAttempts}
                </p>
                <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: pro.textTer }}>Appels</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <div className="flex items-center justify-center" style={{ minHeight: 24 }}>
                  <Pill color={statusColor(selected.status)}>{selected.status}</Pill>
                </div>
                <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: pro.textTer }}>Statut</p>
              </div>
            </div>

            {/* Contact info */}
            <div className="space-y-2">
              {selected.phone && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: pro.textSec }} />
                  <span className="text-[13px] font-mono" style={{ color: pro.text }}>{selected.phone}</span>
                </div>
              )}
              {selected.email && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: pro.textSec }} />
                  <span className="text-[13px]" style={{ color: pro.text }}>{selected.email}</span>
                </div>
              )}
              {selected.city && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: pro.textSec }} />
                  <span className="text-[13px]" style={{ color: pro.text }}>{selected.city}</span>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="text-[11.5px] space-y-1" style={{ color: pro.textTer }}>
              <p>Créé {formatDistanceToNow(new Date(selected.createdAt), { locale: fr, addSuffix: true })}</p>
              {selected.lastCallDate && (
                <p>Dernier appel {formatDistanceToNow(new Date(selected.lastCallDate), { locale: fr, addSuffix: true })}</p>
              )}
            </div>

            {/* Pain points */}
            {selected.painPoints && selected.painPoints.length > 0 && (
              <div>
                <p className="text-[11px] mb-2 font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>Points de douleur</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.painPoints.map((p, i) => (
                    <Pill key={i} color="warn">{p}</Pill>
                  ))}
                </div>
              </div>
            )}

            {/* Last call transcript */}
            {selected.callTranscript && (
              <div>
                <p className="text-[11px] mb-2 font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>Dernier appel — transcription</p>
                <pre
                  className="text-[11.5px] leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl p-3 font-mono"
                  style={{ color: pro.text, background: pro.panel, border: `1px solid ${pro.border}` }}
                >
                  {selected.callTranscript}
                </pre>
              </div>
            )}

            {/* Notes */}
            {selected.notes && (
              <div>
                <p className="text-[11px] mb-2 font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>Notes</p>
                <p
                  className="text-[12.5px] leading-relaxed rounded-xl p-3"
                  style={{ color: pro.text, background: pro.panel, border: `1px solid ${pro.border}` }}
                >
                  {selected.notes}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <GhostBtn onClick={() => callLead(selected)} disabled={callingId === selected.id || !selected.phone}>
                <Phone className="w-3.5 h-3.5" />
                {callingId === selected.id ? 'Appel…' : 'Appeler'}
              </GhostBtn>
              <GhostBtn onClick={() => navigate('/admin/agents/business-plan', { state: { prospectId: selected.id } })}>
                Business plan
              </GhostBtn>
              <GhostBtn onClick={() => navigate('/admin/agents/branding', { state: { prospectId: selected.id } })}>
                Branding
              </GhostBtn>
              <PrimaryBtn onClick={() => triggerCloserSequence(selected)} disabled={closingId === selected.id}>
                {closingId === selected.id ? 'Déclenchement…' : 'Séquence closer'}
              </PrimaryBtn>
            </div>
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
