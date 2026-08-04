import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight,
  Download, Filter, Pause, Phone, Play, Search, Users, X,
} from 'lucide-react';
import api from '../../../services/api';
import { exportToCSV, formatDateTime, formatDuration } from '../../../utils/format';
import {
  EmptyState, Field, GhostBtn, Input, PageActions, Pill,
} from '../../../components/v2/app/Blocks';

/* Appels, mise en page « frameless » de la vue d'ensemble (ClientOverview):
   chiffres nus séparés par des filets, liste en rangées hairline, aucune carte.
   Logique de données identique: /my-dashboard/overview + /my-dashboard/calls. */

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

/* Libellés d'issue d'appel, mêmes clés que la vue d'ensemble. */
const OUTCOME_LABELS: Record<string, string> = {
  lead_captured: 'Lead capté',
  booking_made: 'Rendez-vous',
  transferred: 'Transféré',
  info_provided: 'Information',
  message_taken: 'Message',
  complaint: 'Réclamation',
  missed: 'Manqué',
  technical_issue: 'Incident',
  spam: 'Spam',
};

function outcomeLabel(outcome?: string | null): string {
  if (!outcome) return 'Non renseigné';
  return OUTCOME_LABELS[outcome] || outcome.replace(/_/g, ' ');
}

function SentimentPill({ sentiment }: { sentiment?: string | null }) {
  const meta = SENTIMENT_META[(sentiment || 'neutral').toLowerCase()];
  return <Pill tone={meta ? meta.tone : 'neutral'}>{meta ? meta.label : sentiment}</Pill>;
}

/* Barre de chargement neutre: jamais de spinner sur cette page. */
function Bone({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />;
}

/**
 * Rangée de chiffres nue, vocabulaire de la vue d'ensemble: pas de cadre, des
 * filets verticaux, un chiffre par colonne. En 2x2 sur mobile, le filet gauche
 * de la première cellule de chaque ligne est neutralisé.
 */
function KpiSplit({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-6 divide-x divide-q2-graphite-d [&>*:nth-child(2n+1)]:border-l-0 sm:[&>*:nth-child(2n+1)]:border-l">
      {items.map((k) => (
        <div key={k.label} className="px-3 sm:px-6 first:pl-0 last:pr-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog">{k.label}</p>
          <p className="text-[22px] sm:text-[26px] font-light tracking-tight tabular-nums leading-none mt-2.5 text-white truncate">
            {k.value}
          </p>
          {k.hint && <p className="text-[11.5px] mt-2.5 text-q2-fog truncate">{k.hint}</p>}
        </div>
      ))}
    </div>
  );
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
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 pt-4">
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

/* Rangée de détail du panneau: libellé en eyebrow à gauche, valeur à droite. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-q2-graphite-d last:border-b-0">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog">{label}</span>
      <span className="text-[13px] text-white text-right min-w-0 truncate">{value}</span>
    </div>
  );
}

function Eyebrow({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3">
      <p className="q2-eyebrow text-q2-fog">{children}</p>
      {right}
    </div>
  );
}

/**
 * Transcript: les tours de parole sont préfixés par le locuteur (AI:, User:).
 * Quand le motif est là on rend des rangées propres, sinon le texte brut.
 */
interface Turn { who: 'ai' | 'human'; text: string }

function parseTranscript(raw: string): Turn[] | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const re = /^(ai|assistant|bot|agent|ia|user|customer|caller|client|humain)\s*[:\-]\s*(.*)$/i;
  const turns: Turn[] = [];
  for (const line of lines) {
    const m = line.match(re);
    if (!m) {
      if (turns.length === 0) return null;
      turns[turns.length - 1].text += ` ${line}`;
      continue;
    }
    const speaker = m[1].toLowerCase();
    const who: Turn['who'] = ['ai', 'assistant', 'bot', 'agent', 'ia'].includes(speaker) ? 'ai' : 'human';
    turns.push({ who, text: m[2] });
  }
  return turns.length > 1 ? turns : null;
}

function Transcript({ raw }: { raw: string }) {
  const turns = useMemo(() => parseTranscript(raw), [raw]);
  if (!turns) {
    return (
      <p className="text-[12.5px] text-q2-mist leading-relaxed whitespace-pre-wrap max-h-[340px] overflow-y-auto">
        {raw}
      </p>
    );
  }
  return (
    <div className="max-h-[380px] overflow-y-auto">
      {turns.map((t, i) => (
        <div key={i} className="py-3 border-b border-q2-graphite-d last:border-b-0">
          <p
            className="text-[10.5px] font-medium uppercase tracking-[0.1em] mb-1.5"
            style={{ color: t.who === 'ai' ? 'var(--q2-lift)' : 'var(--q2-fog)' }}
          >
            {t.who === 'ai' ? 'Réceptionniste' : 'Appelant'}
          </p>
          <p className="text-[12.5px] leading-relaxed text-q2-mist q2-body-text">{t.text}</p>
        </div>
      ))}
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

  const SortBtn = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      aria-pressed={sortKey === k}
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded ${className}`}
    >
      {children}
      {sortKey !== k
        ? <ArrowUpDown size={11} aria-hidden="true" />
        : sortDir === 'asc'
          ? <ArrowUp size={11} aria-hidden="true" className="text-q2-lift" />
          : <ArrowDown size={11} aria-hidden="true" className="text-q2-lift" />}
    </button>
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

  /* Grille commune à l'en-tête de tri et aux rangées: une seule définition. */
  const gridCols = 'md:grid md:grid-cols-[minmax(0,1fr)_100px_110px_150px_24px] md:items-center md:gap-4';

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

      {/* Chiffres d'ouverture, sans cartes, filet dessous */}
      <section aria-label="Statistiques" className="pb-6 border-b border-q2-graphite-d">
        <KpiSplit
          items={[
            { label: 'Total appels', value: totalCalls.toLocaleString('fr-FR'), hint: 'depuis le début' },
            { label: 'Durée moyenne', value: formatDuration(avgDuration), hint: 'par appel traité' },
            {
              label: 'Taux positif',
              value: sentimentTotal > 0 ? `${positiveRate} %` : 'Sans donnée',
              hint: sentimentTotal > 0 ? 'sentiment des appelants' : 'analyse en attente',
            },
            { label: 'Leads ce mois', value: leadsMonth.toLocaleString('fr-FR'), hint: 'contacts qualifiés' },
          ]}
        />
      </section>

      {/* Filtres avancés, dépliés à la demande, sans cadre */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-b border-q2-graphite-d"
          >
            <div className="flex flex-wrap items-end gap-5 py-5">
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste des appels: rangées nues, un filet entre chacune */}
      <section aria-label="Appels" className="pt-6">
        {loading ? (
          <div role="status" aria-busy="true" aria-label="Chargement des appels">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3.5 py-3.5 border-b border-q2-graphite-d">
                <Bone className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-3.5 w-44" />
                  <Bone className="h-2.5 w-28" />
                </div>
                <Bone className="h-3 w-12 hidden md:block" />
                <Bone className="h-5 w-16 rounded-full" />
                <Bone className="h-3 w-24 hidden md:block" />
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
            <div className={`hidden ${gridCols} pb-2.5 border-b border-q2-graphite-d`}>
              <SortBtn k="callerName">Appelant</SortBtn>
              <SortBtn k="durationSeconds">Durée</SortBtn>
              <SortBtn k="sentiment">Sentiment</SortBtn>
              <SortBtn k="createdAt">Date</SortBtn>
              <span className="sr-only">Détail</span>
            </div>

            <ul role="list">
              {sortedCalls.map((call) => (
                <li key={call.id} className="border-b border-q2-graphite-d">
                  <button
                    type="button"
                    onClick={() => openCall(call)}
                    aria-label={`Voir le détail de l'appel de ${call.callerName || call.callerNumber || 'appelant inconnu'}`}
                    className={`group w-full text-left py-3.5 px-2 -mx-2 rounded-lg hover:bg-q2-obsidian/40 transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${gridCols}`}
                  >
                    <span className="flex items-center gap-3.5 min-w-0">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-q2-obsidian flex items-center justify-center">
                        {call.isLead
                          ? <Users size={14} className="text-q2-lift" aria-hidden="true" />
                          : <Phone size={14} className="text-q2-fog" aria-hidden="true" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-[13.5px] font-medium text-white truncate">
                            {call.callerName || call.callerNumber || 'Inconnu'}
                          </span>
                          {call.isLead && <Pill tone="accent">Lead</Pill>}
                        </span>
                        <span className="block text-[11.5px] text-q2-fog truncate tabular-nums">
                          {call.callerName && call.callerNumber ? `${call.callerNumber} · ` : ''}
                          {outcomeLabel(call.outcome)}
                          <span className="md:hidden">
                            {` · ${formatDuration(call.durationSeconds)} · ${formatDateTime(call.createdAt)}`}
                          </span>
                        </span>
                      </span>
                    </span>

                    <span className="hidden md:block text-[12.5px] text-q2-mist tabular-nums">
                      {formatDuration(call.durationSeconds)}
                    </span>

                    <span className="hidden md:flex">
                      <SentimentPill sentiment={call.sentiment} />
                    </span>

                    <span className="hidden md:block text-[12px] text-q2-fog tabular-nums whitespace-nowrap">
                      {formatDateTime(call.createdAt)}
                    </span>

                    <span className="hidden md:flex justify-end">
                      <ChevronRight
                        size={14}
                        aria-hidden="true"
                        className="text-white/20 group-hover:text-white/50 transition-colors duration-150"
                      />
                    </span>
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
      </section>

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
              role="dialog"
              aria-modal="true"
              aria-label="Détail de l'appel"
              className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-q2-carbon border-l border-q2-graphite-d overflow-y-auto"
            >
              <header className="sticky top-0 z-10 bg-q2-carbon border-b border-q2-graphite-d px-6 h-14 flex items-center justify-between gap-3">
                <p className="q2-eyebrow text-q2-fog">Détail de l'appel</p>
                <button
                  type="button"
                  onClick={() => setSelectedCall(null)}
                  aria-label="Fermer le panneau"
                  className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-q2-fog hover:text-white hover:bg-q2-obsidian transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </header>

              <div className="px-6">
                {/* Identité de l'appelant */}
                <div className="flex items-center gap-4 py-6 border-b border-q2-graphite-d">
                  <span className="w-11 h-11 shrink-0 rounded-full bg-q2-obsidian flex items-center justify-center">
                    {selectedCall.isLead
                      ? <Users size={18} className="text-q2-lift" aria-hidden="true" />
                      : <Phone size={18} className="text-q2-fog" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-medium text-white truncate">
                      {selectedCall.callerName || selectedCall.callerNumber || 'Appelant inconnu'}
                    </p>
                    <p className="text-[12px] text-q2-fog truncate tabular-nums">
                      {selectedCall.callerName && selectedCall.callerNumber
                        ? selectedCall.callerNumber
                        : formatDateTime(selectedCall.createdAt)}
                    </p>
                  </div>
                </div>

                {(selectedCall.isLead || selectedCall.bookingRequested) && (
                  <div className="flex flex-wrap gap-2 py-5 border-b border-q2-graphite-d">
                    {selectedCall.isLead && <Pill tone="accent">Lead qualifié</Pill>}
                    {selectedCall.bookingRequested && (
                      <Pill tone="ok">
                        <CheckCircle2 size={11} aria-hidden="true" /> Réservation demandée
                      </Pill>
                    )}
                  </div>
                )}

                {/* Faits de l'appel */}
                <section className="py-6 border-b border-q2-graphite-d">
                  <Eyebrow>Appel</Eyebrow>
                  <Detail label="Durée" value={<span className="tabular-nums">{formatDuration(selectedCall.durationSeconds)}</span>} />
                  <Detail label="Date" value={<span className="tabular-nums">{formatDateTime(selectedCall.createdAt)}</span>} />
                  <Detail label="Résultat" value={outcomeLabel(selectedCall.outcome)} />
                  <Detail label="Sentiment" value={<SentimentPill sentiment={selectedCall.sentiment} />} />
                  {selectedCall.leadScore != null && (
                    <Detail label="Score lead" value={<span className="tabular-nums">{selectedCall.leadScore}/10</span>} />
                  )}
                  {selectedCall.emailCollected && (
                    <Detail label="Email" value={selectedCall.emailCollected} />
                  )}
                </section>

                {selectedCall.summary && (
                  <section className="py-6 border-b border-q2-graphite-d">
                    <Eyebrow>Résumé IA</Eyebrow>
                    <p className="text-[13.5px] text-q2-mist leading-relaxed q2-body-text max-w-[62ch]">
                      {selectedCall.summary}
                    </p>
                  </section>
                )}

                {selectedCall.bookingDetails && (
                  <section className="py-6 border-b border-q2-graphite-d">
                    <Eyebrow>Détails réservation</Eyebrow>
                    <p className="text-[12.5px] text-q2-mist leading-relaxed whitespace-pre-wrap">
                      {typeof selectedCall.bookingDetails === 'string'
                        ? selectedCall.bookingDetails
                        : JSON.stringify(selectedCall.bookingDetails, null, 2)}
                    </p>
                  </section>
                )}

                {selectedCall.recordingUrl && (
                  <section className="py-6 border-b border-q2-graphite-d">
                    <Eyebrow>Enregistrement</Eyebrow>
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
                        className="w-full mt-4"
                        src={selectedCall.recordingUrl}
                        aria-label="Enregistrement de l'appel"
                      >
                        Votre navigateur ne supporte pas l'audio.
                      </audio>
                    )}
                  </section>
                )}

                {selectedCall.transcript && (
                  <section className="py-6">
                    <Eyebrow
                      right={
                        <button
                          type="button"
                          onClick={() => setShowTranscript(!showTranscript)}
                          aria-expanded={showTranscript}
                          className="text-[12px] text-q2-lift hover:text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
                        >
                          {showTranscript ? 'Masquer' : 'Afficher'}
                        </button>
                      }
                    >
                      Transcript
                    </Eyebrow>
                    <AnimatePresence initial={false}>
                      {showTranscript && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <Transcript raw={selectedCall.transcript} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
