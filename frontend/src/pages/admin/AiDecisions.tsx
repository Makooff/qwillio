import { useState, useEffect } from 'react';
import { RefreshCw, Shield, Zap, RotateCcw, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface AiDecision {
  id: string;
  timestamp: string;
  type: string;
  niche: string;
  language: string;
  confidenceScore: number;
  dataPointsUsed: number;
  outcome: string;
  details: Record<string, any>;
}

export default function AiDecisions() {
  const [decisions, setDecisions] = useState<AiDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');

  useEffect(() => {
    fetchDecisions();
  }, []);

  const fetchDecisions = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ai/decisions', {
        headers: { Authorization: `Bearer ${localStorage.getItem('qwillio_token')}` },
      });
      setDecisions(res.data.decisions || []);
    } catch {
      setDecisions([]);
    }
    setLoading(false);
  };

  const filtered = decisions.filter(d => {
    if (filterType && d.type !== filterType) return false;
    if (filterOutcome && d.outcome !== filterOutcome) return false;
    return true;
  });

  const typeIcon = (type: string) => {
    if (type === 'guard_blocked') return <Shield size={14} className="text-orange-500" />;
    if (type === 'revert') return <RotateCcw size={14} className="text-red-500" />;
    return <Zap size={14} className="text-[#6366f1]" />;
  };

  const outcomeBadge = (outcome: string) => {
    if (outcome === 'applied') return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Applied</span>;
    if (outcome === 'reverted') return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Reverted</span>;
    if (outcome === 'blocked') return <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">Blocked</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 font-medium">{outcome}</span>;
  };

  const thisMonth = decisions.filter(d => {
    const date = new Date(d.timestamp);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1d1d1f]">AI Decision Log</h1>
          <p className="text-sm text-[#86868b] mt-1">Full audit log of every AI system decision</p>
        </div>
        <button onClick={fetchDecisions} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#d2d2d7] text-sm hover:bg-[#f5f5f7] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Mutations this month', value: thisMonth.filter(d => d.type === 'script_mutation').length, color: 'text-[#6366f1]' },
          { label: 'Reverts', value: thisMonth.filter(d => d.outcome === 'reverted').length, color: 'text-red-600' },
          { label: 'Guard blocks', value: thisMonth.filter(d => d.outcome === 'blocked').length, color: 'text-orange-600' },
          { label: 'Avg confidence', value: decisions.length ? Math.round(decisions.reduce((s, d) => s + d.confidenceScore, 0) / decisions.length) + '%' : '—', color: 'text-green-600' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#d2d2d7] p-4">
            <p className="text-xs text-[#86868b] mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-[#d2d2d7] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30">
          <option value="">All types</option>
          <option value="script_mutation">Script mutation</option>
          <option value="objection_update">Objection update</option>
          <option value="revert">Revert</option>
          <option value="guard_blocked">Guard blocked</option>
        </select>
        <select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)} className="border border-[#d2d2d7] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30">
          <option value="">All outcomes</option>
          <option value="applied">Applied</option>
          <option value="reverted">Reverted</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#86868b]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#86868b] flex flex-col items-center gap-3">
          <AlertCircle size={32} className="opacity-40" />
          <p>No decisions logged yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#d2d2d7] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f5f5f7] border-b border-[#d2d2d7]">
              <tr>
                {['Timestamp', 'Type', 'Niche', 'Lang', 'Confidence', 'Data Points', 'Outcome'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d2d2d7]/60">
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-[#f5f5f7] transition-colors">
                  <td className="px-4 py-3 text-[#86868b] whitespace-nowrap text-xs">{new Date(d.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 font-medium">{typeIcon(d.type)}{d.type.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{d.niche || '—'}</td>
                  <td className="px-4 py-3 uppercase text-xs font-medium text-[#6366f1]">{d.language || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-[#f5f5f7] rounded-full h-1.5">
                        <div className="bg-[#6366f1] h-1.5 rounded-full" style={{ width: `${d.confidenceScore}%` }} />
                      </div>
                      <span className="text-xs">{d.confidenceScore}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#86868b]">{d.dataPointsUsed}</td>
                  <td className="px-4 py-3">{outcomeBadge(d.outcome)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
