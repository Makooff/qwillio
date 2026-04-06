import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Phone, Play, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SlideSheet from '../../components/dashboard/SlideSheet';
import SkeletonLoader from '../../components/dashboard/SkeletonLoader';
import EmptyState from '../../components/dashboard/EmptyState';
import { formatDistanceToNow, format } from 'date-fns';

const SCORE_COLOR = (s: number) => s >= 7 ? '#22C55E' : s >= 4 ? '#F59E0B' : '#EF4444';
const NICHE_ICONS: Record<string, string> = {
  plumber: '🔧', dental: '🦷', salon: '💈', garage: '🔩',
  restaurant: '🍽️', law: '⚖️', hotel: '🏨', hvac: '❄️', medical: '🏥',
};

const PAGE_SIZE = 25;

export default function AdminCalls() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ outcome: '', score: '', search: '' });

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: PAGE_SIZE };
      if (filters.outcome) params.outcome = filters.outcome;
      if (filters.score) params.minScore = filters.score;
      if (filters.search) params.search = filters.search;
      const { data } = await api.get('/dashboard/calls', { params });
      setCalls(Array.isArray(data?.calls) ? data.calls : Array.isArray(data) ? data : []);
      setTotal(data?.total ?? 0);
    } catch { setCalls([]); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);
  useEffect(() => {
    const handler = () => fetchCalls();
    window.addEventListener('admin-refresh', handler);
    return () => window.removeEventListener('admin-refresh', handler);
  }, [fetchCalls]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const displayCalls = calls;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#F8F8FF]">Calls</h1>
        <p className="text-sm text-[#8B8BA7] mt-0.5">{total.toLocaleString()} total calls</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search business..."
          value={filters.search}
          onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
          className="px-3 py-2 text-sm bg-[#12121A] border border-white/[0.08] rounded-xl text-[#F8F8FF]
            placeholder-[#8B8BA7] outline-none focus:border-[#7B5CF0]/50 transition-colors w-52"
        />
        <select
          value={filters.outcome}
          onChange={e => { setFilters(f => ({ ...f, outcome: e.target.value })); setPage(1); }}
          className="px-3 py-2 text-sm bg-[#12121A] border border-white/[0.08] rounded-xl text-[#F8F8FF] outline-none focus:border-[#7B5CF0]/50"
        >
          <option value="">All outcomes</option>
          <option value="connected">Connected</option>
          <option value="voicemail">Voicemail</option>
          <option value="no_answer">No answer</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={filters.score}
          onChange={e => { setFilters(f => ({ ...f, score: e.target.value })); setPage(1); }}
          className="px-3 py-2 text-sm bg-[#12121A] border border-white/[0.08] rounded-xl text-[#F8F8FF] outline-none focus:border-[#7B5CF0]/50"
        >
          <option value="">All scores</option>
          <option value="7">Score ≥ 7</option>
          <option value="5">Score ≥ 5</option>
          <option value="1">All scored</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Business', 'Duration', 'Outcome', 'Score', 'Lead', 'Time', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold tracking-[0.08em] uppercase text-[#8B8BA7]">{h}</th>
                ))}
              </tr>
            </thead>
            {loading ? (
              <SkeletonLoader rows={10} cols={7} />
            ) : displayCalls.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<Phone className="w-6 h-6" />}
                      title="No calls found"
                      description="Calls will appear here once the bot starts dialing."
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {displayCalls.map((call: any, i: number) => (
                  <tr
                    key={call.id ?? i}
                    onClick={() => setSelected(call)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{NICHE_ICONS[call.niche?.toLowerCase()] ?? '📞'}</span>
                        <div>
                          <p className="text-sm font-medium text-[#F8F8FF]">{call.businessName ?? call.business ?? '—'}</p>
                          <p className="text-xs text-[#8B8BA7]">{call.city ?? ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#8B8BA7] tabular-nums">
                      {call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}` : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={call.outcome ?? call.callOutcome ?? 'unknown'} size="sm" />
                    </td>
                    <td className="px-4 py-3.5">
                      {call.interestScore != null ? (
                        <span className="text-sm font-bold tabular-nums" style={{ color: SCORE_COLOR(call.interestScore) }}>
                          {call.interestScore}/10
                        </span>
                      ) : <span className="text-[#8B8BA7]">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {call.leadCaptured
                        ? <span className="text-[#22C55E] text-sm">✓</span>
                        : <span className="text-[#8B8BA7]">—</span>
                      }
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#8B8BA7] whitespace-nowrap">
                      {call.createdAt ? formatDistanceToNow(new Date(call.createdAt), { addSuffix: true }) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {call.recordingUrl && (
                          <button className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#8B8BA7] hover:text-[#F8F8FF]" title="Play">
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#8B8BA7] hover:text-[#F8F8FF]" title="Transcript">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-xs text-[#8B8BA7]">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06] disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-all
                      ${p === page ? 'bg-[#7B5CF0] text-white' : 'text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06]'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06] disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Call detail sheet */}
      <SlideSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.businessName ?? selected?.business ?? 'Call Detail'}
        subtitle={selected?.city ? `${selected.city}${selected.niche ? ` · ${selected.niche}` : ''}` : selected?.niche}
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0D0D15] rounded-xl p-3">
                <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mb-1">Score</p>
                <p className="text-xl font-bold" style={{ color: SCORE_COLOR(selected.interestScore ?? 0) }}>
                  {selected.interestScore ?? '—'}/10
                </p>
              </div>
              <div className="bg-[#0D0D15] rounded-xl p-3">
                <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mb-1">Duration</p>
                <p className="text-xl font-bold text-[#F8F8FF] tabular-nums">
                  {selected.duration ? `${Math.floor(selected.duration / 60)}:${String(selected.duration % 60).padStart(2, '0')}` : '—'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mb-2">Outcome</p>
              <StatusBadge status={selected.outcome ?? selected.callOutcome ?? 'unknown'} />
            </div>

            {selected.transcript && (
              <div>
                <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mb-2">Transcript</p>
                <div className="bg-[#0D0D15] rounded-xl p-4 max-h-80 overflow-y-auto">
                  <pre className="text-xs text-[#F8F8FF] whitespace-pre-wrap font-sans leading-relaxed">
                    {selected.transcript}
                  </pre>
                </div>
              </div>
            )}

            {selected.summary && (
              <div>
                <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mb-2">AI Summary</p>
                <p className="text-sm text-[#F8F8FF] bg-[#0D0D15] rounded-xl p-4">{selected.summary}</p>
              </div>
            )}

            {selected.createdAt && (
              <p className="text-xs text-[#8B8BA7]">
                {format(new Date(selected.createdAt), 'PPpp')}
              </p>
            )}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
