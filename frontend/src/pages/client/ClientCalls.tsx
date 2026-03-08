import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Download, Search, Play, Pause, CheckCircle2, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, X, Calendar, Clock,
  Users, Star, TrendingUp, ChevronRight, Volume2
} from 'lucide-react';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';
import SentimentBadge from '../../components/client-dashboard/SentimentBadge';
import Pagination from '../../components/client-dashboard/Pagination';
import EmptyState from '../../components/client-dashboard/EmptyState';
import { formatDuration, formatDateTime, exportToCSV } from '../../utils/format';

type SortKey = 'createdAt' | 'durationSeconds' | 'callerName' | 'sentiment';
type SortDir = 'asc' | 'desc';

export default function ClientCalls() {
  const { t } = useLang();
  const [calls, setCalls] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Slide-over
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
    const toExport = selected.size > 0 ? calls.filter(c => selected.has(c.id)) : calls;
    exportToCSV(toExport, 'qwillio-calls', [
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

  const hasActiveFilters = sentimentFilter || dateFrom || dateTo || search;

  const sortedCalls = useMemo(() => {
    let filtered = search
      ? calls.filter(c =>
          (c.callerNumber || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.callerName || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.summary || '').toLowerCase().includes(search.toLowerCase())
        )
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
    if (sortKey !== k) return <ArrowUpDown size={12} className="text-[#d2d2d7]" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-[#6366f1]" /> : <ArrowDown size={12} className="text-[#6366f1]" />;
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };
  const toggleAll = () => {
    if (selected.size === sortedCalls.length) setSelected(new Set());
    else setSelected(new Set(sortedCalls.map(c => c.id)));
  };

  // Stats
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
          <h1 className="text-2xl font-bold tracking-tight">Call history</h1>
          <p className="text-sm text-[#86868b]">{pagination.total} total calls</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <span className="text-xs text-[#6366f1] font-medium">{selected.size} selected</span>
          )}
          <button
            onClick={handleExport}
            disabled={calls.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[#6366f1] bg-[#6366f1]/5 hover:bg-[#6366f1]/10 rounded-xl transition-colors disabled:opacity-40"
          >
            <Download size={15} />
            Export {selected.size > 0 ? `(${selected.size})` : 'CSV'}
          </button>
        </div>
      </motion.div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total calls', value: totalCalls, icon: Phone, color: 'blue' },
          { label: 'Avg duration', value: formatDuration(avgDuration), icon: Clock, color: 'cyan' },
          { label: 'Positive rate', value: `${positiveRate}%`, icon: Star, color: 'emerald' },
          { label: 'Leads captured', value: leadsMonth, icon: Users, color: 'amber' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={14} className="text-[#86868b]" />
              <span className="text-xs text-[#86868b]">{s.label}</span>
            </div>
            <p className="text-xl font-bold">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
          <input
            type="text"
            placeholder="Search by name, phone, or summary..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium rounded-xl border transition-all ${
            showFilters || hasActiveFilters
              ? 'bg-[#6366f1]/5 border-[#6366f1]/20 text-[#6366f1]'
              : 'bg-white border-[#d2d2d7]/60 text-[#86868b] hover:text-[#1d1d1f]'
          }`}
        >
          <Filter size={14} />
          Filters
          {hasActiveFilters && (
            <span className="w-5 h-5 rounded-full bg-[#6366f1] text-white text-[10px] flex items-center justify-center font-bold">
              {[sentimentFilter, dateFrom, dateTo].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-4 space-y-4">
              <div className="flex flex-wrap gap-3">
                {/* Sentiment */}
                <div>
                  <label className="text-xs text-[#86868b] mb-1 block">Sentiment</label>
                  <div className="flex gap-1">
                    {['', 'positive', 'neutral', 'negative'].map(f => (
                      <button
                        key={f}
                        onClick={() => setSentimentFilter(f)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          sentimentFilter === f ? 'bg-[#6366f1] text-white' : 'bg-white text-[#86868b] hover:bg-[#e8e8ed]'
                        }`}
                      >
                        {f || 'All'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Date range */}
                <div>
                  <label className="text-xs text-[#86868b] mb-1 block">From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#86868b] mb-1 block">To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-[#6366f1] hover:underline flex items-center gap-1">
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sortedCalls.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No calls found"
          description={hasActiveFilters ? 'Try adjusting your filters' : 'Calls will appear here once your AI receptionist starts answering'}
        />
      ) : (
        <>
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[40px_1fr_120px_100px_100px_140px_40px] gap-3 px-5 py-2 text-xs text-[#86868b] font-medium border-b border-[#d2d2d7]/40 mb-1">
            <div>
              <input type="checkbox" checked={selected.size === sortedCalls.length && sortedCalls.length > 0}
                onChange={toggleAll} className="rounded border-[#d2d2d7]"
              />
            </div>
            <button onClick={() => toggleSort('callerName')} className="flex items-center gap-1 hover:text-[#1d1d1f]">
              Caller <SortIcon k="callerName" />
            </button>
            <button onClick={() => toggleSort('durationSeconds')} className="flex items-center gap-1 hover:text-[#1d1d1f]">
              Duration <SortIcon k="durationSeconds" />
            </button>
            <button onClick={() => toggleSort('sentiment')} className="flex items-center gap-1 hover:text-[#1d1d1f]">
              Sentiment <SortIcon k="sentiment" />
            </button>
            <div>Outcome</div>
            <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 hover:text-[#1d1d1f]">
              Date <SortIcon k="createdAt" />
            </button>
            <div />
          </div>

          {/* Call rows */}
          <div className="space-y-1">
            {sortedCalls.map((call: any, idx: number) => (
              <motion.div key={call.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                className={`rounded-2xl border bg-white overflow-hidden cursor-pointer transition-all hover:shadow-sm group ${
                  selected.has(call.id) ? 'border-[#6366f1]/40 bg-[#6366f1]/[0.02]' : 'border-[#d2d2d7]/60 hover:border-[#d2d2d7]'
                }`}
              >
                {/* Desktop row */}
                <div className="hidden md:grid grid-cols-[40px_1fr_120px_100px_100px_140px_40px] gap-3 items-center px-5 py-3.5"
                  onClick={() => setSelectedCall(call)}
                >
                  <div onClick={e => { e.stopPropagation(); toggleSelect(call.id); }}>
                    <input type="checkbox" checked={selected.has(call.id)} onChange={() => toggleSelect(call.id)}
                      className="rounded border-[#d2d2d7]"
                    />
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      call.isLead ? 'bg-amber-50' : 'bg-blue-50'
                    }`}>
                      {call.isLead ? <Users size={14} className="text-amber-600" /> : <Phone size={14} className="text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{call.callerName || call.callerNumber || 'Unknown'}</p>
                      {call.callerName && call.callerNumber && (
                        <p className="text-[11px] text-[#86868b]">{call.callerNumber}</p>
                      )}
                    </div>
                    {call.isLead && (
                      <span className="text-[10px] font-semibold text-[#6366f1] bg-[#6366f1]/10 px-2 py-0.5 rounded-full flex-shrink-0">LEAD</span>
                    )}
                  </div>
                  <span className="text-sm text-[#1d1d1f]">{formatDuration(call.durationSeconds)}</span>
                  <SentimentBadge sentiment={call.sentiment} />
                  <span className="text-sm text-[#86868b] capitalize">{call.outcome || '-'}</span>
                  <span className="text-xs text-[#86868b]">{formatDateTime(call.createdAt)}</span>
                  <ChevronRight size={14} className="text-[#d2d2d7] group-hover:text-[#6366f1] transition-colors" />
                </div>

                {/* Mobile row */}
                <div className="md:hidden px-4 py-3.5" onClick={() => setSelectedCall(call)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      call.isLead ? 'bg-amber-50' : 'bg-blue-50'
                    }`}>
                      {call.isLead ? <Users size={16} className="text-amber-600" /> : <Phone size={16} className="text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{call.callerName || call.callerNumber || 'Unknown'}</p>
                      <p className="text-[11px] text-[#86868b]">
                        {formatDuration(call.durationSeconds)} · {formatDateTime(call.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <SentimentBadge sentiment={call.sentiment} />
                      <ChevronRight size={14} className="text-[#d2d2d7]" />
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
              label="calls"
            />
          </div>
        </>
      )}

      {/* ── Slide-over detail panel ── */}
      <AnimatePresence>
        {selectedCall && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-50" onClick={() => setSelectedCall(null)}
            />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/60 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Call details</h2>
                <button onClick={() => setSelectedCall(null)} className="w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {/* Caller info */}
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    selectedCall.isLead ? 'bg-amber-50' : 'bg-blue-50'
                  }`}>
                    {selectedCall.isLead ? <Users size={24} className="text-amber-600" /> : <Phone size={24} className="text-blue-600" />}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{selectedCall.callerName || 'Unknown caller'}</p>
                    <p className="text-sm text-[#86868b]">{selectedCall.callerNumber || 'No number'}</p>
                  </div>
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Duration', value: formatDuration(selectedCall.durationSeconds) },
                    { label: 'Sentiment', value: selectedCall.sentiment || 'N/A', badge: true },
                    { label: 'Outcome', value: selectedCall.outcome || 'N/A' },
                    { label: 'Date', value: formatDateTime(selectedCall.createdAt) },
                  ].map((m, i) => (
                    <div key={i} className="rounded-xl bg-[#f5f5f7] p-3">
                      <p className="text-[10px] text-[#86868b] uppercase tracking-wide mb-0.5">{m.label}</p>
                      {m.badge ? <SentimentBadge sentiment={selectedCall.sentiment} /> : (
                        <p className="text-sm font-medium capitalize">{m.value}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {selectedCall.isLead && (
                    <span className="text-xs font-semibold text-[#6366f1] bg-[#6366f1]/10 px-2.5 py-1 rounded-full">Lead</span>
                  )}
                  {selectedCall.bookingRequested && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={11} /> Booking requested
                    </span>
                  )}
                  {selectedCall.emailCollected && (
                    <span className="text-xs text-[#86868b] bg-[#f5f5f7] px-2.5 py-1 rounded-full">{selectedCall.emailCollected}</span>
                  )}
                </div>

                {/* Lead score */}
                {selectedCall.leadScore != null && (
                  <div>
                    <p className="text-xs text-[#86868b] mb-1">Lead score</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-[#f5f5f7] rounded-full overflow-hidden">
                        <div className="h-full bg-[#6366f1] rounded-full transition-all" style={{ width: `${selectedCall.leadScore * 10}%` }} />
                      </div>
                      <span className="text-sm font-bold text-[#6366f1]">{selectedCall.leadScore}/10</span>
                    </div>
                  </div>
                )}

                {/* Summary */}
                {selectedCall.summary && (
                  <div>
                    <p className="text-xs text-[#86868b] mb-1">AI summary</p>
                    <p className="text-sm text-[#1d1d1f] leading-relaxed bg-[#f5f5f7] rounded-xl p-4">{selectedCall.summary}</p>
                  </div>
                )}

                {/* Booking details */}
                {selectedCall.bookingDetails && (
                  <div>
                    <p className="text-xs text-[#86868b] mb-1">Booking details</p>
                    <p className="text-sm text-[#1d1d1f] bg-[#f5f5f7] rounded-xl p-4">{
                      typeof selectedCall.bookingDetails === 'string'
                        ? selectedCall.bookingDetails
                        : JSON.stringify(selectedCall.bookingDetails, null, 2)
                    }</p>
                  </div>
                )}

                {/* Recording */}
                {selectedCall.recordingUrl && (
                  <div>
                    <p className="text-xs text-[#86868b] mb-2">Recording</p>
                    <div className="rounded-xl bg-[#f5f5f7] p-4">
                      <button
                        onClick={() => setPlayingId(playingId === selectedCall.id ? null : selectedCall.id)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[#6366f1] hover:underline mb-2"
                      >
                        {playingId === selectedCall.id ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play recording</>}
                      </button>
                      {playingId === selectedCall.id && (
                        <audio controls autoPlay className="w-full mt-2" src={selectedCall.recordingUrl}>
                          Your browser does not support audio.
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
