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
import OrbsLoader from "../../components/OrbsLoader";

type SortKey = 'createdAt' | 'durationSeconds' | 'callerName' | 'sentiment';
type SortDir = 'asc' | 'desc';

const inputCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50 transition-all';

export default function ClientCalls() {
  const [calls, setCalls] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);

  const [search, setSearch] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedCall, setSelectedCall] = useState<any>(null);
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
    } catch (err) {
      console.error('Calls fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [sentimentFilter, dateFrom, dateTo]);

  useEffect(() => { fetchCalls(1); }, [fetchCalls]);
  useEffect(() => {
    api.get('/my-dashboard/overview').then(r => setOverview(r.data)).catch(() => {});
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

  const clearFilters = () => { setSentimentFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); };
  const hasActiveFilters = !!(sentimentFilter || dateFrom || dateTo || search);

  const sortedCalls = useMemo(() => {
    let filtered = search
      ? calls.filter(c =>
          (c.callerNumber || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.callerName || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.summary || '').toLowerCase().includes(search.toLowerCase()))
      : [...calls];
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === 'durationSeconds') cmp = (a.durationSeconds || 0) - (b.durationSeconds || 0);
      else if (sortKey === 'callerName') cmp = (a.callerName || '').localeCompare(b.callerName || '');
      else if (sortKey === 'sentiment') cmp = (a.sentiment || '').localeCompare(b.sentiment || '');
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return filtered;
  }, [calls, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown size={12} className="text-[#A1A1A8]" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-[#7B5CF0]" /> : <ArrowDown size={12} className="text-[#7B5CF0]" />;
  };

  const totalCalls = overview?.calls?.total || 0;
  const avgDuration = overview?.calls?.avgDuration || 0;
  const sentimentTotal = (overview?.sentiment?.positive || 0) + (overview?.sentiment?.neutral || 0) + (overview?.sentiment?.negative || 0);
  const positiveRate = sentimentTotal > 0 ? Math.round(((overview?.sentiment?.positive || 0) / sentimentTotal) * 100) : 0;
  const leadsMonth = overview?.leads?.thisMonth || 0;

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[#F5F5F7] tracking-tight">Appels</h1>
          <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">{pagination.total} appels au total</p>
        </div>
        <button
          onClick={handleExport}
          disabled={calls.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[#7B5CF0] bg-[#7B5CF0]/10 hover:bg-[#7B5CF0]/20 rounded-xl transition-colors disabled:opacity-40"
        >
          <Download size={15} />
          Exporter CSV
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total appels', value: totalCalls, icon: Phone },
          { label: 'Durée moy.', value: formatDuration(avgDuration), icon: Clock },
          { label: 'Taux positif', value: `${positiveRate}%`, icon: CheckCircle2 },
          { label: 'Leads ce mois', value: leadsMonth, icon: Users },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <s.icon size={14} className="text-[#A1A1A8]" />
              <span className="text-xs text-[#A1A1A8]">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-[#F5F5F7]">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A8]" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, résumé..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50 transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium rounded-xl border transition-all ${
            showFilters || hasActiveFilters
              ? 'bg-[#7B5CF0]/10 border-[#7B5CF0]/30 text-[#7B5CF0]'
              : 'bg-white/[0.03] border-white/[0.07] text-[#A1A1A8] hover:text-[#F5F5F7]'
          }`}
        >
          <Filter size={14} />
          Filtres
          {hasActiveFilters && (
            <span className="w-5 h-5 rounded-full bg-[#7B5CF0] text-white text-[10px] flex items-center justify-center font-bold">
              {[sentimentFilter, dateFrom, dateTo].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 space-y-4">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="text-xs text-[#A1A1A8] mb-1.5 block">Sentiment</label>
                  <div className="flex gap-1">
                    {['', 'positive', 'neutral', 'negative'].map(f => (
                      <button key={f} onClick={() => setSentimentFilter(f)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          sentimentFilter === f ? 'bg-[#7B5CF0] text-white' : 'bg-white/[0.04] text-[#A1A1A8] hover:bg-white/[0.08]'
                        }`}
                      >
                        {f || 'Tous'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#A1A1A8] mb-1.5 block">Du</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] focus:outline-none focus:border-[#7B5CF0]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#A1A1A8] mb-1.5 block">Au</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] focus:outline-none focus:border-[#7B5CF0]/50"
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-[#7B5CF0] hover:underline flex items-center gap-1">
                  <X size={12} /> Effacer les filtres
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16">
          <OrbsLoader size={120} fullscreen={false} />
        </div>
      ) : sortedCalls.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="Aucun appel trouvé"
          description={hasActiveFilters ? 'Essayez de modifier vos filtres' : 'Les appels apparaîtront ici une fois que votre IA commencera à répondre'}
        />
      ) : (
        <>
          {/* Table header — desktop */}
          <div className="hidden md:grid grid-cols-[1fr_120px_100px_140px_32px] gap-3 px-5 py-2.5 text-xs text-[#A1A1A8] font-medium border-b border-white/[0.07] mb-1">
            <button onClick={() => toggleSort('callerName')} className="flex items-center gap-1 hover:text-[#F5F5F7]">
              Appelant <SortIcon k="callerName" />
            </button>
            <button onClick={() => toggleSort('durationSeconds')} className="flex items-center gap-1 hover:text-[#F5F5F7]">
              Durée <SortIcon k="durationSeconds" />
            </button>
            <button onClick={() => toggleSort('sentiment')} className="flex items-center gap-1 hover:text-[#F5F5F7]">
              Sentiment <SortIcon k="sentiment" />
            </button>
            <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 hover:text-[#F5F5F7]">
              Date <SortIcon k="createdAt" />
            </button>
            <div />
          </div>

          <div className="space-y-1">
            {sortedCalls.map((call: any, idx: number) => (
              <motion.div key={call.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.03]/80 cursor-pointer transition-all group"
                onClick={() => setSelectedCall(call)}
              >
                {/* Desktop */}
                <div className="hidden md:grid grid-cols-[1fr_120px_100px_140px_32px] gap-3 items-center px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${call.isLead ? 'bg-amber-400/10' : 'bg-[#7B5CF0]/10'}`}>
                      {call.isLead ? <Users size={14} className="text-amber-400" /> : <Phone size={14} className="text-[#7B5CF0]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F7] truncate">{call.callerName || call.callerNumber || 'Inconnu'}</p>
                      {call.callerName && call.callerNumber && (
                        <p className="text-[11px] text-[#A1A1A8]">{call.callerNumber}</p>
                      )}
                    </div>
                    {call.isLead && (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full flex-shrink-0">LEAD</span>
                    )}
                  </div>
                  <span className="text-sm text-[#A1A1A8]">{formatDuration(call.durationSeconds)}</span>
                  <SentimentBadge sentiment={call.sentiment} />
                  <span className="text-xs text-[#A1A1A8]">{formatDateTime(call.createdAt)}</span>
                  <ChevronRight size={14} className="text-white/20 group-hover:text-[#7B5CF0] transition-colors" />
                </div>

                {/* Mobile */}
                <div className="md:hidden px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${call.isLead ? 'bg-amber-400/10' : 'bg-[#7B5CF0]/10'}`}>
                      {call.isLead ? <Users size={16} className="text-amber-400" /> : <Phone size={16} className="text-[#7B5CF0]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F7] truncate">{call.callerName || call.callerNumber || 'Inconnu'}</p>
                      <p className="text-[11px] text-[#A1A1A8]">{formatDuration(call.durationSeconds)} · {formatDateTime(call.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <SentimentBadge sentiment={call.sentiment} />
                      <ChevronRight size={14} className="text-white/20" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4">
            <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total}
              onPageChange={(p) => fetchCalls(p)} label="appels"
            />
          </div>
        </>
      )}

      {/* Slide-over detail panel */}
      <AnimatePresence>
        {selectedCall && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setSelectedCall(null)}
            />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white/[0.02] border-l border-white/[0.07] shadow-2xl z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white/[0.02]/90 backdrop-blur-xl border-b border-white/[0.07] px-6 py-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#F5F5F7]">Détails de l'appel</h2>
                <button onClick={() => setSelectedCall(null)}
                  className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.10] transition-colors text-[#A1A1A8] hover:text-[#F5F5F7]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedCall.isLead ? 'bg-amber-400/10' : 'bg-[#7B5CF0]/10'}`}>
                    {selectedCall.isLead ? <Users size={22} className="text-amber-400" /> : <Phone size={22} className="text-[#7B5CF0]" />}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#F5F5F7]">{selectedCall.callerName || 'Appelant inconnu'}</p>
                    <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">{selectedCall.callerNumber || 'Pas de numéro'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Durée', value: formatDuration(selectedCall.durationSeconds) },
                    { label: 'Date', value: formatDateTime(selectedCall.createdAt) },
                    { label: 'Résultat', value: selectedCall.outcome || 'N/A' },
                  ].map((m, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                      <p className="text-[10px] text-[#A1A1A8] uppercase tracking-wide mb-1">{m.label}</p>
                      <p className="text-sm font-medium text-[#F5F5F7] capitalize">{m.value}</p>
                    </div>
                  ))}
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                    <p className="text-[10px] text-[#A1A1A8] uppercase tracking-wide mb-1">Sentiment</p>
                    <SentimentBadge sentiment={selectedCall.sentiment} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedCall.isLead && (
                    <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">Lead qualifié</span>
                  )}
                  {selectedCall.bookingRequested && (
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={11} /> Réservation demandée
                    </span>
                  )}
                  {selectedCall.emailCollected && (
                    <span className="text-xs text-[#A1A1A8] bg-white/[0.04] px-2.5 py-1 rounded-full">{selectedCall.emailCollected}</span>
                  )}
                </div>

                {selectedCall.leadScore != null && (
                  <div>
                    <p className="text-xs text-[#A1A1A8] mb-2">Score lead</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-[#7B5CF0] rounded-full" style={{ width: `${selectedCall.leadScore * 10}%` }} />
                      </div>
                      <span className="text-sm font-bold text-[#7B5CF0]">{selectedCall.leadScore}/10</span>
                    </div>
                  </div>
                )}

                {selectedCall.summary && (
                  <div>
                    <p className="text-xs text-[#A1A1A8] mb-2">Résumé IA</p>
                    <p className="text-sm text-[#F5F5F7] leading-relaxed bg-white/[0.04] rounded-xl p-4 border border-white/[0.07]">{selectedCall.summary}</p>
                  </div>
                )}

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

                {selectedCall.recordingUrl && (
                  <div>
                    <p className="text-xs text-[#A1A1A8] mb-2">Enregistrement</p>
                    <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4">
                      <button
                        onClick={() => setPlayingId(playingId === selectedCall.id ? null : selectedCall.id)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[#7B5CF0] hover:underline mb-2"
                      >
                        {playingId === selectedCall.id ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Écouter</>}
                      </button>
                      {playingId === selectedCall.id && (
                        <audio controls autoPlay className="w-full mt-2" src={selectedCall.recordingUrl}>
                          Votre navigateur ne supporte pas l'audio.
                        </audio>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
