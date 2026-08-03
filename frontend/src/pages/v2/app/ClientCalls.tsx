import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight,
  Download, Filter, Pause, Phone, Play, Search, X,
} from 'lucide-react';
import api from '../../../services/api';
import { exportToCSV, formatDateTime, formatDuration } from '../../../utils/format';
import {
  Card, EmptyState, Field, GhostBtn, Input, PageActions, Pill, Stat, tableCls,
} from '../../../components/v2/app/Blocks';

/* Appels, registre produit V2 (DA/v2-direction.md, addendum). Logique de
   données identique à la V1: /my-dashboard/overview + /my-dashboard/calls. */

interface Call {
  id: string;
  callerNumber: string;
  callerName: string;
  durationSeconds: number;
  sentiment: string;
  outcome: string;
  summary: string;
  transcript: string | null;
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

const SENTIMENT_META: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  positive: { label: 'Positif', tone: 'ok' },
  neutral: { label: 'Neutre', tone: 'warn' },
  negative: { label: 'Négatif', tone: 'bad' },
};

const SENTIMENT_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'positive', label: 'Positif' },
  { value: 'neutral', label: 'Neutre' },
  { value: 'negative', label: 'Négatif' },
];

function SentimentPill({ sentiment }: { sentiment?: string | null }) {
  const meta = SENTIMENT_META[(sentiment || 'neutral').toLowerCase()];
  return <Pill tone={meta ? meta.tone : 'neutral'}>{meta ? meta.label : sentiment}</Pill>;
}

function Segmented({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-full bg-q2-obsidian border border-q2-graphite-d p-1"
    >
      {options.map((o) => (
        <button
          key={o.value || 'all'}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`h-7 px-3 rounded-full text-[12px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
            value === o.value ? 'bg-q2-indigo text-white' : 'text-q2-fog hover:text-q2-mist'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PageNav({
  page,
  totalPages,
  total,
  label,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  label: string;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const btn =
    'w-8 h-8 rounded-lg flex items-center justify-center text-q2-fog border border-q2-graphite-d hover:text-q2-mist hover:border-q2-smoke-d transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50';
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 px-4 py-3 border-t border-q2-graphite-d"
    >
      <p className="text-[11.5px] text-q2-fog tabular-nums">
        {total.toLocaleString('fr-FR')} {label} · page {page} sur {totalPages}
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Page précédente" className={btn}>
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Page suivante" className={btn}>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-q2-graphite-d first:border-t-0">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog">{label}</span>
      <span className="text-[13px] text-white tabular-nums text-right">{value}</span>
    </div>
  );
}

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
  const [showTranscript, setShowTranscript] = useState(false);

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
      /* appels indisponibles: la liste reste vide */
    } finally {
      setLoading(false);
    }
  }, [sentimentFilter, dateFrom, dateTo]);

  useEffect(() => { fetchCalls(1); }, [fetchCalls]);

  useEffect(() => {
    api.get('/my-dashboard/overview')
      .then((r) => setOverview(r.data))
      .catch(() => { /* overview indisponible */ });
  }, []);

  useEffect(() => {
    if (!selectedCall) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedCall(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCall]);

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
  const activeFilterCount = [sentimentFilter, dateFrom, dateTo].filter(Boolean).length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortHead = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th scope="col" className={`${tableCls.th} ${className}`} aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1.5 uppercase tracking-[0.08em] hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
      >
        {children}
        {sortKey !== k
          ? <ArrowUpDown size={11} aria-hidden="true" />
          : sortDir === 'asc'
            ? <ArrowUp size={11} aria-hidden="true" className="text-q2-lift" />
            : <ArrowDown size={11} aria-hidden="true" className="text-q2-lift" />}
      </button>
    </th>
  );

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

  const openCall = (call: Call) => {
    setSelectedCall(call);
    setShowTranscript(false);
  };

  return (
    <div>
      <PageActions subtitle={`${pagination.total.toLocaleString('fr-FR')} appels au total`}>
        <div className="relative w-[190px] sm:w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-q2-fog" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un appel"
            aria-label="Rechercher dans les appels"
            className="pl-9 !py-[7px]"
          />
        </div>
        <GhostBtn
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          className={showFilters || activeFilterCount > 0 ? 'border-q2-smoke-d text-white' : ''}
        >
          <Filter size={13} aria-hidden="true" />
          Filtres
          {activeFilterCount > 0 && (
            <span className="tabular-nums text-[11px] text-q2-lift">{activeFilterCount}</span>
          )}
        </GhostBtn>
        <GhostBtn type="button" onClick={handleExport} disabled={sortedCalls.length === 0} aria-label="Exporter les appels en CSV">
          <Download size={13} aria-hidden="true" />
          CSV
        </GhostBtn>
      </PageActions>

      <section aria-label="Statistiques" className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Total appels" value={totalCalls.toLocaleString('fr-FR')} />
        <Stat label="Durée moyenne" value={formatDuration(avgDuration)} />
        <Stat label="Taux positif" value={`${positiveRate} %`} tone={positiveRate >= 60 ? 'ok' : undefined} />
        <Stat label="Leads ce mois" value={leadsMonth.toLocaleString('fr-FR')} />
      </section>

      {showFilters && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <p className="text-[12px] font-medium text-q2-mist mb-1.5">Sentiment</p>
              <Segmented
                options={SENTIMENT_FILTERS}
                value={sentimentFilter}
                onChange={setSentimentFilter}
                ariaLabel="Filtrer par sentiment"
              />
            </div>
            <Field label="Du" className="w-[150px]">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="!py-[7px]" />
            </Field>
            <Field label="Au" className="w-[150px]">
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="!py-[7px]" />
            </Field>
            {hasActiveFilters && (
              <GhostBtn type="button" onClick={clearFilters}>
                <X size={13} aria-hidden="true" />
                Effacer
              </GhostBtn>
            )}
          </div>
        </Card>
      )}

      <Card pad={false}>
        {loading ? (
          <div role="status" aria-busy="true" aria-label="Chargement des appels" className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-40 rounded bg-q2-obsidian animate-pulse" />
                <div className="h-3 w-16 rounded bg-q2-obsidian animate-pulse ml-auto" />
                <div className="h-3 w-24 rounded bg-q2-obsidian animate-pulse" />
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
            {/* Desktop */}
            <div className={`hidden md:block ${tableCls.wrap}`}>
              <table className={tableCls.table}>
                <thead>
                  <tr>
                    <SortHead k="callerName">Appelant</SortHead>
                    <SortHead k="durationSeconds">Durée</SortHead>
                    <SortHead k="sentiment">Sentiment</SortHead>
                    <SortHead k="createdAt">Date</SortHead>
                    <th scope="col" className={tableCls.th}><span className="sr-only">Détail</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCalls.map((call) => (
                    <tr key={call.id} className={`${tableCls.tr} cursor-pointer`} onClick={() => openCall(call)}>
                      <td className={tableCls.td}>
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-white truncate">
                            {call.callerName || call.callerNumber || 'Inconnu'}
                          </span>
                          {call.isLead && <Pill tone="accent">Lead</Pill>}
                        </span>
                        {call.callerName && call.callerNumber && (
                          <span className="block text-[11.5px] text-q2-fog mt-0.5">{call.callerNumber}</span>
                        )}
                      </td>
                      <td className={tableCls.td}>{formatDuration(call.durationSeconds)}</td>
                      <td className={tableCls.td}><SentimentPill sentiment={call.sentiment} /></td>
                      <td className={`${tableCls.td} text-q2-fog whitespace-nowrap`}>{formatDateTime(call.createdAt)}</td>
                      <td className={`${tableCls.td} w-10`}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openCall(call); }}
                          aria-label={`Voir le détail de l'appel de ${call.callerName || call.callerNumber || 'appelant inconnu'}`}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-q2-fog hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                        >
                          <ChevronRight size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <ul className="md:hidden">
              {sortedCalls.map((call) => (
                <li key={call.id} className="border-b border-q2-graphite-d last:border-b-0">
                  <button
                    type="button"
                    onClick={() => openCall(call)}
                    className="w-full text-left px-4 py-3.5 hover:bg-q2-obsidian/50 transition-colors duration-100 focus:outline-none focus-visible:bg-q2-obsidian"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13.5px] font-medium text-white truncate">
                        {call.callerName || call.callerNumber || 'Inconnu'}
                      </span>
                      <SentimentPill sentiment={call.sentiment} />
                    </div>
                    <p className="text-[11.5px] text-q2-fog mt-1 tabular-nums">
                      {formatDuration(call.durationSeconds)} · {formatDateTime(call.createdAt)}
                      {call.isLead && ' · Lead'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>

            <PageNav
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              label="appels"
              onChange={(p) => fetchCalls(p)}
            />
          </>
        )}
      </Card>

      {/* Panneau latéral de détail */}
      <AnimatePresence>
        {selectedCall && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setSelectedCall(null)}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-q2-void/70"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              aria-label="Détail de l'appel"
              className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-q2-carbon border-l border-q2-graphite-d overflow-y-auto"
            >
              <header className="sticky top-0 bg-q2-carbon border-b border-q2-graphite-d px-5 h-14 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-white truncate">
                    {selectedCall.callerName || selectedCall.callerNumber || 'Appelant inconnu'}
                  </p>
                  <p className="text-[11.5px] text-q2-fog truncate">
                    {selectedCall.callerName && selectedCall.callerNumber
                      ? selectedCall.callerNumber
                      : "Détail de l'appel"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCall(null)}
                  aria-label="Fermer le panneau"
                  className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-q2-fog hover:text-white hover:bg-q2-obsidian transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </header>

              <div className="p-5 space-y-5">
                <div className="rounded-xl border border-q2-graphite-d overflow-hidden">
                  <Detail label="Durée" value={formatDuration(selectedCall.durationSeconds)} />
                  <Detail label="Date" value={formatDateTime(selectedCall.createdAt)} />
                  <Detail label="Résultat" value={<span className="capitalize">{selectedCall.outcome || 'Non renseigné'}</span>} />
                  <Detail label="Sentiment" value={<SentimentPill sentiment={selectedCall.sentiment} />} />
                  {selectedCall.leadScore != null && (
                    <Detail label="Score lead" value={`${selectedCall.leadScore}/10`} />
                  )}
                  {selectedCall.emailCollected && (
                    <Detail label="Email" value={<span className="tabular-nums">{selectedCall.emailCollected}</span>} />
                  )}
                </div>

                {(selectedCall.isLead || selectedCall.bookingRequested) && (
                  <div className="flex flex-wrap gap-2">
                    {selectedCall.isLead && <Pill tone="accent">Lead qualifié</Pill>}
                    {selectedCall.bookingRequested && (
                      <Pill tone="ok">
                        <CheckCircle2 size={11} aria-hidden="true" /> Réservation demandée
                      </Pill>
                    )}
                  </div>
                )}

                {selectedCall.summary && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-2">Résumé IA</p>
                    <p className="text-[13px] text-q2-mist leading-relaxed bg-q2-obsidian border border-q2-graphite-d rounded-xl p-4 q2-body-text">
                      {selectedCall.summary}
                    </p>
                  </div>
                )}

                {selectedCall.bookingDetails && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-2">Détails réservation</p>
                    <p className="text-[13px] text-q2-mist bg-q2-obsidian border border-q2-graphite-d rounded-xl p-4 whitespace-pre-wrap">
                      {typeof selectedCall.bookingDetails === 'string'
                        ? selectedCall.bookingDetails
                        : JSON.stringify(selectedCall.bookingDetails, null, 2)}
                    </p>
                  </div>
                )}

                {selectedCall.recordingUrl && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-2">Enregistrement</p>
                    <GhostBtn
                      type="button"
                      onClick={() => setPlayingId(playingId === selectedCall.id ? null : selectedCall.id)}
                    >
                      {playingId === selectedCall.id
                        ? <><Pause size={13} aria-hidden="true" /> Pause</>
                        : <><Play size={13} aria-hidden="true" /> Écouter</>}
                    </GhostBtn>
                    {playingId === selectedCall.id && (
                      <audio
                        controls
                        autoPlay
                        className="w-full mt-3"
                        src={selectedCall.recordingUrl}
                        aria-label="Enregistrement de l'appel"
                      >
                        Votre navigateur ne supporte pas l'audio.
                      </audio>
                    )}
                  </div>
                )}

                {selectedCall.transcript && (
                  <div>
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog">Transcript</p>
                      <button
                        type="button"
                        onClick={() => setShowTranscript(!showTranscript)}
                        aria-expanded={showTranscript}
                        className="text-[12px] text-q2-lift hover:text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
                      >
                        {showTranscript ? 'Masquer' : 'Afficher'}
                      </button>
                    </div>
                    {showTranscript && (
                      <p className="text-[12.5px] text-q2-mist leading-relaxed bg-q2-obsidian border border-q2-graphite-d rounded-xl p-4 whitespace-pre-wrap max-h-[320px] overflow-y-auto">
                        {selectedCall.transcript}
                      </p>
                    )}
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
