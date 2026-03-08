import { useEffect, useState, useCallback } from 'react';
import { Phone, Download, ChevronDown, ChevronUp, Search, Play, CheckCircle2, Filter } from 'lucide-react';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';
import SentimentBadge from '../../components/client-dashboard/SentimentBadge';
import Pagination from '../../components/client-dashboard/Pagination';
import EmptyState from '../../components/client-dashboard/EmptyState';
import { formatDuration, formatDateTime, exportToCSV } from '../../utils/format';

export default function ClientCalls() {
  const { t } = useLang();
  const [calls, setCalls] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const fetchCalls = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (sentimentFilter) params.set('sentiment', sentimentFilter);
      const { data } = await api.get(`/my-dashboard/calls?${params}`);
      setCalls(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 });
    } catch (err) {
      console.error('Calls fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [sentimentFilter]);

  useEffect(() => { fetchCalls(1); }, [fetchCalls]);

  const handleExport = () => {
    exportToCSV(calls, 'qwillio-calls', [
      { key: 'callerNumber', label: t('cdash.calls.caller') },
      { key: 'callerName', label: 'Name' },
      { key: 'durationSeconds', label: t('cdash.calls.duration') },
      { key: 'sentiment', label: t('cdash.calls.sentiment') },
      { key: 'outcome', label: t('cdash.calls.outcome') },
      { key: 'summary', label: t('cdash.calls.summary') },
      { key: 'createdAt', label: t('cdash.calls.date') },
    ]);
  };

  const filteredCalls = search
    ? calls.filter(c =>
        (c.callerNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.callerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.summary || '').toLowerCase().includes(search.toLowerCase())
      )
    : calls;

  const sentimentFilters = [
    { value: '', label: t('cdash.calls.filter.all') },
    { value: 'positive', label: t('cdash.calls.filter.positive') },
    { value: 'neutral', label: t('cdash.calls.filter.neutral') },
    { value: 'negative', label: t('cdash.calls.filter.negative') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('cdash.calls.title')}</h1>
        <button
          onClick={handleExport}
          disabled={calls.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#6366f1] hover:bg-[#6366f1]/5 rounded-xl transition-colors disabled:opacity-40"
        >
          <Download size={16} />
          {t('cdash.calls.export')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
          <input
            type="text"
            placeholder={t('cdash.calls.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-[#f5f5f7] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]"
          />
        </div>
        <div className="flex gap-1 items-center">
          <Filter size={14} className="text-[#86868b] mr-1" />
          {sentimentFilters.map(f => (
            <button
              key={f.value}
              onClick={() => setSentimentFilter(f.value)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                sentimentFilter === f.value
                  ? 'bg-[#6366f1] text-white'
                  : 'text-[#86868b] hover:bg-[#f5f5f7]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCalls.length === 0 ? (
        <EmptyState
          icon={Phone}
          title={t('cdash.calls.empty')}
          description={t('cdash.calls.emptyDesc')}
        />
      ) : (
        <>
          {/* Call list */}
          <div className="space-y-2">
            {filteredCalls.map((call: any) => {
              const isExpanded = expandedCall === call.id;
              return (
                <div key={call.id} className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] overflow-hidden">
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#e8e8ed]/50 transition-colors"
                    onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Phone size={15} className="text-[#86868b] flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium block truncate">
                          {call.callerName || call.callerNumber || t('cdash.calls.unknown')}
                        </span>
                        {call.callerName && call.callerNumber && (
                          <span className="text-xs text-[#86868b]">{call.callerNumber}</span>
                        )}
                      </div>
                      <SentimentBadge sentiment={call.sentiment} />
                      {call.isLead && (
                        <span className="text-xs font-medium text-[#6366f1] bg-[#6366f1]/10 px-2 py-0.5 rounded-full">
                          {t('cdash.calls.lead')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[#86868b] flex-shrink-0">
                      <span className="hidden sm:inline">{formatDuration(call.durationSeconds)}</span>
                      <span className="hidden md:inline">{formatDateTime(call.createdAt)}</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-[#d2d2d7]/40 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-[#86868b] text-xs block">{t('cdash.calls.duration')}</span>
                          <span className="font-medium">{formatDuration(call.durationSeconds)}</span>
                        </div>
                        <div>
                          <span className="text-[#86868b] text-xs block">{t('cdash.calls.outcome')}</span>
                          <span className="font-medium">{call.outcome || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[#86868b] text-xs block">{t('cdash.calls.date')}</span>
                          <span className="font-medium">{formatDateTime(call.createdAt)}</span>
                        </div>
                        <div>
                          <span className="text-[#86868b] text-xs block">{t('cdash.calls.sentiment')}</span>
                          <SentimentBadge sentiment={call.sentiment} />
                        </div>
                      </div>
                      {call.summary && (
                        <div>
                          <span className="text-xs text-[#86868b]">{t('cdash.calls.summary')}</span>
                          <p className="text-sm text-[#1d1d1f]/80 mt-0.5">{call.summary}</p>
                        </div>
                      )}
                      {call.bookingRequested && (
                        <p className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                          <CheckCircle2 size={14} /> {t('cdash.calls.bookingReq')}
                        </p>
                      )}
                      {call.recordingUrl && (
                        <div>
                          <span className="text-xs text-[#86868b] block mb-1">{t('cdash.calls.recording')}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setPlayingId(playingId === call.id ? null : call.id); }}
                              className="inline-flex items-center gap-1 text-sm text-[#6366f1] hover:underline"
                            >
                              <Play size={14} /> {t('cdash.calls.listen')}
                            </button>
                          </div>
                          {playingId === call.id && (
                            <audio controls autoPlay className="mt-2 w-full max-w-md" src={call.recordingUrl}>
                              Your browser does not support audio.
                            </audio>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={(p) => fetchCalls(p)}
              label={t('cdash.nav.calls').toLowerCase()}
            />
          </div>
        </>
      )}
    </div>
  );
}
