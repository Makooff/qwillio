import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Download, Search, Play, Pause, CheckCircle2, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, X, Clock, Users, ChevronRight,
} from 'lucide-react';
import api from '../../services/api';
import SentimentBadge from '../../components/client-dashboard/SentimentBadge';
import Pagination from '../../components/client-dashboard/Pagination';
import EmptyState from '../../components/client-dashboard/EmptyState';
import { formatDuration, formatDateTime, exportToCSV } from '../../utils/format';
import { KpiSplit } from '../../components/dashboard/OverviewBlocks';

// ── Types ──────────────────────────────────────────────────────────────────

interface Call {
  id: string;
  callerNumber: string;
  callerName: string;
  durationSeconds: number;
  sentiment: string;
  outcome: string;
  summary: string;
  createdAt: string;
  isLead: boolean;
  bookingRequested: boolean;
  bookingDetails: string | Record<string, unknown> | null;
  emailCollected: string;
  leadScore: number | null;
  recordingUrl: string;
}

interface Overview {
  calls?: { total: number; avgDuration: number };
  sentiment?: { positive: number; neutral: number; negative: number };
  leads?: { thisMonth: number };
}

interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type SortKey = 'createdAt' | 'durationSeconds' | 'callerName' | 'sentiment';
type SortDir = 'asc' | 'desc';

// ── Styles ─────────────────────────────────────────────────────────────────

const inputCls = [
  'w-full px-4 py-2.5 text-sm rounded-xl outline-none transition-colors',
  'border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7]',
  'placeholder-[#8B8BA7] focus:border-[#493cbe]/50',
].join(' ');

// ── Component ──────────────────────────────────────────────────────────────

export default function ClientCalls() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    total: 0, page: 1, limit: 20, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);

  const [search, setSearch] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const fetchCalls = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (sentimentFilter) params.set('sentiment', sentimentFilter);
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo) params.set('endDate', dateTo);
      const { data } = await api.get(`/my-dashboard/calls?${params}`);
      setCalls(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 });
    } catch {
      // calls unavailable — list stays empty
    } finally {
      setLoading(false);
    }
  }, [sentimentFilter, dateFrom, dateTo]);

  useEffect(() => { fetchCalls(1); }, [fetchCalls]);

  useEffect(() => {
    api.get('/my-dashboard/overview')
      .then((r) => setOverview(r.data))
      .catch(() => { /* overview unavailable */ });
  }, []);

  const handleExport = () => {
    exportToCSV(sortedCalls, 'qwillio-calls', [
      { key: 'callerNumber', label: 'Phone' },
      { key: 'callerName', label: 'Name' },
      { key: 'durationSeconds', label: 'Duration (s)' },
      { key: 'sentiment', label: 'Sentiment' },
      { key: 'outcome', label: 'Outcome' },
      { key: 'summary', label: 'Summary' },
      { key: 'createdAt', label: 'Date' },
    ]);
  };

  const clearFilters = () => {
    setSentimentFilter('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  const hasActiveFilters = !!(sentimentFilter || dateFrom || dateTo || search);

  const sortedCalls = useMemo(() => {
    const filtered = search
      ? calls.filter((c) =>
          (c.callerNumber || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.callerName || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.summary || '').toLowerCase().includes(search.toLowerCase()))
      : [...calls];

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortKey === 'durationSeconds') {
        cmp = (a.durationSeconds || 0) - (b.durationSeconds || 0);
      } else if (sortKey === 'callerName') {
        cmp = (a.callerName || '').localeCompare(b.callerName || '');
      } else if (sortKey === 'sentiment') {
        cmp = (a.sentiment || '').localeCompare(b.sentiment || '');
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return filtered;
  }, [calls, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown size={12} className="text-[#A1A1A8]" aria-hidden="true" />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="text-[#493cbe]" aria-hidden="true" />
      : <ArrowDown size={12} className="text-[#493cbe]" aria-hidden="true" />;
  };

  const totalCalls = overview?.calls?.total ?? 0;
  const avgDuration = overview?.calls?.avgDuration ?? 0;
  const sentimentTotal =
    (overview?.sentiment?.positive ?? 0) +
    (overview?.sentiment?.neutral ?? 0) +
    (overview?.sentiment?.negative ?? 0);
  const positiveRate =
    sentimentTotal > 0
      ? Math.round(((overview?.sentiment?.positive ?? 0) / sentimentTotal) * 100)
      : 0;
  const leadsMonth = overview?.leads?.thisMonth ?? 0;

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-[22px] font-semibold text-[#F5F5F7] tracking-tight">Appels</h1>
          <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">{pagination.total} appels au total</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={calls.length === 0}
          aria-label="Exporter les appels en CSV"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[#493cbe] bg-[#493cbe]/10 hover:bg-[#493cbe]/20 rounded-xl transition-colors disabled:opacity-40"
        >
          <Download size={15} aria-hidden="true" />
          Exporter CSV
        </button>
      </motion.div>

      {/* Stats — frameless figures split by hairlines (Overview style) */}
      <motion.section
        aria-label="Statistiques"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="pb-6 mb-6 border-b border-white/[0.06]"
      >
        <KpiSplit items={[
          { label: 'Total appels', value: totalCalls.toLocaleString('fr-FR') },
          { label: 'Durée moy.', value: formatDuration(avgDuration) },
          { label: 'Taux positif', value: `${positiveRate}%` },
          { label: 'Leads ce mois', value: leadsMonth.toLocaleString('fr-FR') },
        ]} />
      </motion.section>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A8]" aria-hidden="true" />
          <input
            type="search"
            placeholder="Rechercher par nom, téléphone, résumé…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher dans les appels"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-[#493cbe]/50 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-label="Filtres avancés"
          className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
            showFilters || hasActiveFilters
              ? 'bg-[#493cbe]/10 border-[#493cbe]/30 text-[#493cbe]'
              : 'bg-white/[0.03] border-white/[0.07] text-[#A1A1A8] hover:text-[#F5F5F7]'
          }`}
        >
          <Filter size={14} aria-hidden="true" />
          Filtres
          {hasActiveFilters && (
            <span
              className="w-5 h-5 rounded-full bg-[#493cbe] text-white text-[10px] flex items-center justify-center font-bold"
              aria-label={`${[sentimentFilter, dateFrom, dateTo].filter(Boolean).length} filtre(s) actif(s)`}
            >
              {[sentimentFilter, dateFrom, dateTo].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 space-y-4">
              <div className="flex flex-wrap gap-4">
                <fieldset>
                  <legend className="text-xs text-[#A1A1A8] mb-1.5">Sentiment</legend>
                  <div className="flex gap-1">
                    {(['', 'positive', 'neutral', 'negative'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setSentimentFilter(f)}
                        aria-pressed={sentimentFilter === f}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          sentimentFilter === f
                            ? 'bg-[#493cbe] text-white'
                            : 'bg-white/[0.04] text-[#A1A1A8] hover:bg-white/[0.08]'
                        }`}
                      >
                        {f || 'Tous'}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label className="text-xs text-[#A1A1A8] mb-1.5 block" htmlFor="date-from">Du</label>
                  <input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] focus:outline-none focus:border-[#493cbe]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#A1A1A8] mb-1.5 block" htmlFor="date-to">Au</label>
                  <input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] focus:outline-none focus:border-[#493cbe]/50"
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-[#493cbe] hover:underline flex items-center gap-1"
                >
                  <X size={12} aria-hidden="true" /> Effacer les filtres
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div role="status" aria-label="Chargement" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04]">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 rounded bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-24 rounded bg-white/[0.05] animate-pulse" />
              </div>
              <div className="h-5 w-16 rounded-full bg-white/[0.05] animate-pulse" />
            </div>
          ))}
        </div>
      ) : sortedCalls.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="Aucun appel trouvé"
          description={
            hasActiveFilters
              ? 'Essayez de modifier vos filtres'
              : "Les appels apparaîtront ici une fois que votre IA commencera à répondre"
          }
        />
      ) : (
        <>
          {/* Table header — desktop */}
          <div
            className="hidden md:grid grid-cols-[1fr_120px_100px_140px_32px] gap-3 px-5 py-2.5 text-xs text-[#A1A1A8] font-medium border-b border-white/[0.07] mb-1"
            role="row"
          >
            <button
              type="button"
              onClick={() => toggleSort('callerName')}
              className="flex items-center gap-1 hover:text-[#F5F5F7] text-left"
            >
              Appelant <SortIcon k="callerName" />
            </button>
            <button
              type="button"
              onClick={() => toggleSort('durationSeconds')}
              className="flex items-center gap-1 hover:text-[#F5F5F7]"
            >
              Durée <SortIcon k="durationSeconds" />
            </button>
            <button
              type="button"
              onClick={() => toggleSort('sentiment')}
              className="flex items-center gap-1 hover:text-[#F5F5F7]"
            >
              Sentiment <SortIcon k="sentiment" />
            </button>
            <button
              type="button"
              onClick={() => toggleSort('createdAt')}
              className="flex items-center gap-1 hover:text-[#F5F5F7]"
            >
              Date <SortIcon k="createdAt" />
            </button>
            <div aria-hidden="true" />
          </div>

          <div role="list" aria-label="Liste des appels">
            {sortedCalls.map((call, idx) => (
              <motion.div
                key={call.id}
                role="listitem"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3), ease: [0.16, 1, 0.3, 1] }}
                className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] cursor-pointer transition-colors group rounded-lg"
                onClick={() => setSelectedCall(call)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedCall(call); }}
                tabIndex={0}
                aria-label={`Appel de ${call.callerName || call.callerNumber || 'Inconnu'}`}
              >
                {/* Desktop */}
                <div className="hidden md:grid grid-cols-[1fr_120px_100px_140px_32px] gap-3 items-center px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        call.isLead ? 'bg-amber-400/10' : 'bg-[#493cbe]/10'
                      }`}
                      aria-hidden="true"
                    >
                      {call.isLead
                        ? <Users size={14} className="text-amber-400" />
                        : <Phone size={14} className="text-[#493cbe]" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F7] truncate">
                        {call.callerName || call.callerNumber || 'Inconnu'}
                      </p>
                      {call.callerName && call.callerNumber && (
                        <p className="text-[11px] text-[#A1A1A8]">{call.callerNumber}</p>
                      )}
                    </div>
                    {call.isLead && (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full flex-shrink-0">
                        LEAD
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[#A1A1A8]">{formatDuration(call.durationSeconds)}</span>
                  <SentimentBadge sentiment={call.sentiment} />
                  <span className="text-xs text-[#A1A1A8]">{formatDateTime(call.createdAt)}</span>
                  <ChevronRight size={14} className="text-white/20 group-hover:text-[#493cbe] transition-colors" aria-hidden="true" />
                </div>

                {/* Mobile */}
                <div className="md:hidden px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        call.isLead ? 'bg-amber-400/10' : 'bg-[#493cbe]/10'
                      }`}
                      aria-hidden="true"
                    >
                      {call.isLead
                        ? <Users size={16} className="text-amber-400" />
                        : <Phone size={16} className="text-[#493cbe]" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F7] truncate">
                        {call.callerName || call.callerNumber || 'Inconnu'}
                      </p>
                      <p className="text-[11px] text-[#A1A1A8]">
                        {formatDuration(call.durationSeconds)} · {formatDateTime(call.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <SentimentBadge sentiment={call.sentiment} />
                      <ChevronRight size={14} className="text-white/20" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={(p) => fetchCalls(p)}
              label="appels"
            />
          </div>
        </>
      )}

      {/* Slide-over detail panel */}
      <AnimatePresence>
        {selectedCall && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setSelectedCall(null)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[oklch(10%_0.012_265)] border-l border-white/[0.07] shadow-2xl z-50 overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Détails de l'appel"
            >
              <div className="sticky top-0 bg-[oklch(10%_0.012_265/90%)] backdrop-blur-xl border-b border-white/[0.07] px-6 py-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#F5F5F7]">Détails de l'appel</h2>
                <button
                  type="button"
                  onClick={() => setSelectedCall(null)}
                  aria-label="Fermer le panneau"
                  className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.10] transition-colors text-[#A1A1A8] hover:text-[#F5F5F7]"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      selectedCall.isLead ? 'bg-amber-400/10' : 'bg-[#493cbe]/10'
                    }`}
                    aria-hidden="true"
                  >
                    {selectedCall.isLead
                      ? <Users size={22} className="text-amber-400" />
                      : <Phone size={22} className="text-[#493cbe]" />
                    }
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#F5F5F7]">
                      {selectedCall.callerName || 'Appelant inconnu'}
                    </p>
                    <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">
                      {selectedCall.callerNumber || 'Pas de numéro'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Durée', value: formatDuration(selectedCall.durationSeconds) },
                    { label: 'Date', value: formatDateTime(selectedCall.createdAt) },
                    { label: 'Résultat', value: selectedCall.outcome || 'N/A' },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                      <p className="text-[10px] text-[#A1A1A8] uppercase tracking-wide mb-1">{m.label}</p>
                      <p className="text-sm font-medium text-[#F5F5F7] capitalize">{m.value}</p>
                    </div>
                  ))}
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                    <p className="text-[10px] text-[#A1A1A8] uppercase tracking-wide mb-1">Sentiment</p>
                    <SentimentBadge sentiment={selectedCall.sentiment} />
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {selectedCall.isLead && (
                    <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">
                      Lead qualifié
                    </span>
                  )}
                  {selectedCall.bookingRequested && (
                    <span className="text-xs font-semibold text-[oklch(74%_0.18_155)] bg-[oklch(74%_0.18_155)/10%] px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={11} aria-hidden="true" /> Réservation demandée
                    </span>
                  )}
                  {selectedCall.emailCollected && (
                    <span className="text-xs text-[#A1A1A8] bg-white/[0.04] px-2.5 py-1 rounded-full">
                      {selectedCall.emailCollected}
                    </span>
                  )}
                </div>

                {/* Lead score */}
                {selectedCall.leadScore != null && (
                  <div>
                    <p className="text-xs text-[#A1A1A8] mb-2">Score lead</p>
                    <div className="flex items-center gap-3">
                      <div
                        role="progressbar"
                        aria-valuenow={selectedCall.leadScore}
                        aria-valuemin={0}
                        aria-valuemax={10}
                        aria-label={`Score lead: ${selectedCall.leadScore}/10`}
                        className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden"
                      >
                        <div
                          className="h-full bg-[#493cbe] rounded-full"
                          style={{ width: `${selectedCall.leadScore * 10}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-[#493cbe]">{selectedCall.leadScore}/10</span>
                    </div>
                  </div>
                )}

                {/* Summary */}
                {selectedCall.summary && (
                  <div>
                    <p className="text-xs text-[#A1A1A8] mb-2">Résumé IA</p>
                    <p className="text-sm text-[#F5F5F7] leading-relaxed bg-white/[0.04] rounded-xl p-4 border border-white/[0.07]">
                      {selectedCall.summary}
                    </p>
                  </div>
                )}

                {/* Booking details */}
                {selectedCall.bookingDetails && (
                  <div>
                    <p className="text-xs text-[#A1A1A8] mb-2">Détails réservation</p>
                    <p className="text-sm text-[#F5F5F7] bg-white/[0.04] rounded-xl p-4 border border-white/[0.07]">
                      {typeof selectedCall.bookingDetails === 'string'
                        ? selectedCall.bookingDetails
                        : JSON.stringify(selectedCall.bookingDetails, null, 2)}
                    </p>
                  </div>
                )}

                {/* Recording */}
                {selectedCall.recordingUrl && (
                  <div>
                    <p className="text-xs text-[#A1A1A8] mb-2">Enregistrement</p>
                    <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4">
                      <button
                        type="button"
                        onClick={() => setPlayingId(playingId === selectedCall.id ? null : selectedCall.id)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[#493cbe] hover:underline mb-2"
                      >
                        {playingId === selectedCall.id
                          ? <><Pause size={14} aria-hidden="true" /> Pause</>
                          : <><Play size={14} aria-hidden="true" /> Écouter</>
                        }
                      </button>
                      {playingId === selectedCall.id && (
                        <audio
                          controls
                          autoPlay
                          className="w-full mt-2"
                          src={selectedCall.recordingUrl}
                          aria-label="Enregistrement de l'appel"
                        >
                          Votre navigateur ne supporte pas l'audio.
                        </audio>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
