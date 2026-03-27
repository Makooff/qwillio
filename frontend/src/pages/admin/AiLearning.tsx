import { useState, useEffect } from 'react';
import { Download, RefreshCw, TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface ScriptMutation {
  id: string;
  niche: string;
  language: string;
  type: string;
  changeApplied: string;
  reason: string;
  date: string;
  callsBefore: number;
  conversionBefore: number;
  callsAfter: number;
  conversionAfter: number;
  status: 'testing' | 'validated' | 'reverted';
  confidenceScore: number;
}

export default function AiLearning() {
  const [mutations, setMutations] = useState<ScriptMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterNiche, setFilterNiche] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLang, setFilterLang] = useState('');

  useEffect(() => {
    fetchMutations();
  }, []);

  const fetchMutations = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ai/mutations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('qwillio_token')}` },
      });
      setMutations(res.data.mutations || []);
    } catch {
      setMutations([]);
    }
    setLoading(false);
  };

  const filtered = mutations.filter(m => {
    if (filterNiche && m.niche !== filterNiche) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    if (filterLang && m.language !== filterLang) return false;
    return true;
  });

  const exportCsv = () => {
    const rows = [
      ['Date', 'Niche', 'Language', 'Type', 'Change', 'Reason', 'Calls Before', 'Conv Before %', 'Calls After', 'Conv After %', 'Status', 'Confidence'],
      ...filtered.map(m => [
        new Date(m.date).toLocaleDateString(),
        m.niche, m.language, m.type, m.changeApplied, m.reason,
        m.callsBefore, (m.conversionBefore * 100).toFixed(1),
        m.callsAfter, (m.conversionAfter * 100).toFixed(1),
        m.status, m.confidenceScore,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ai-mutations.csv'; a.click();
  };

  const statusBadge = (status: string) => {
    if (status === 'validated') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><TrendingUp size={12} />Validated</span>;
    if (status === 'reverted') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><TrendingDown size={12} />Reverted</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock size={12} />Testing</span>;
  };

  const niches = [...new Set(mutations.map(m => m.niche))];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1d1d1f]">AI Learning Log</h1>
          <p className="text-sm text-[#86868b] mt-1">Script mutations applied by the self-correcting AI system</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchMutations} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#d2d2d7] text-sm hover:bg-[#f5f5f7] transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366f1] text-white text-sm hover:bg-[#4f46e5] transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total mutations', value: mutations.length, color: 'text-[#1d1d1f]' },
          { label: 'Validated', value: mutations.filter(m => m.status === 'validated').length, color: 'text-green-600' },
          { label: 'Reverted', value: mutations.filter(m => m.status === 'reverted').length, color: 'text-red-600' },
          { label: 'Testing', value: mutations.filter(m => m.status === 'testing').length, color: 'text-yellow-600' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#d2d2d7] p-4">
            <p className="text-xs text-[#86868b] mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={filterNiche} onChange={e => setFilterNiche(e.target.value)} className="border border-[#d2d2d7] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30">
          <option value="">All niches</option>
          {niches.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={filterLang} onChange={e => setFilterLang(e.target.value)} className="border border-[#d2d2d7] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30">
          <option value="">All languages</option>
          <option value="en">English</option>
          <option value="fr">French</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-[#d2d2d7] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30">
          <option value="">All statuses</option>
          <option value="validated">Validated</option>
          <option value="reverted">Reverted</option>
          <option value="testing">Testing</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-[#86868b]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#86868b] flex flex-col items-center gap-3">
          <AlertCircle size={32} className="opacity-40" />
          <p>No mutations yet. The AI will start learning after 50 failed calls per niche.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#d2d2d7] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f5f5f7] border-b border-[#d2d2d7]">
              <tr>
                {['Date', 'Niche', 'Lang', 'Change Applied', 'Reason', 'Conv Before→After', 'Confidence', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d2d2d7]/60">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-[#f5f5f7] transition-colors">
                  <td className="px-4 py-3 text-[#86868b] whitespace-nowrap">{new Date(m.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium capitalize">{m.niche}</td>
                  <td className="px-4 py-3 uppercase text-xs font-medium text-[#6366f1]">{m.language}</td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="truncate text-[#1d1d1f]" title={m.changeApplied}>{m.changeApplied}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="truncate text-[#86868b]" title={m.reason}>{m.reason}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[#86868b]">{(m.conversionBefore * 100).toFixed(1)}%</span>
                    <span className="mx-1">→</span>
                    <span className={m.conversionAfter > m.conversionBefore ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {(m.conversionAfter * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-[#f5f5f7] rounded-full h-1.5">
                        <div className="bg-[#6366f1] h-1.5 rounded-full" style={{ width: `${m.confidenceScore}%` }} />
                      </div>
                      <span className="text-xs text-[#86868b]">{m.confidenceScore}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(m.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
