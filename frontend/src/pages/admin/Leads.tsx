import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Zap, PhoneCall, CheckCircle, Phone } from 'lucide-react';
import SlideSheet from '../../components/dashboard/SlideSheet';
import StatusBadge from '../../components/dashboard/StatusBadge';
import EmptyState from '../../components/dashboard/EmptyState';
import { formatDistanceToNow } from 'date-fns';

const SCORE_COLOR = (s: number) => s >= 8 ? '#22C55E' : s >= 6 ? '#F59E0B' : '#EF4444';
const SCORE_BG = (s: number) => s >= 8 ? 'border-[#22C55E]/30' : s >= 6 ? 'border-[#F59E0B]/30' : 'border-white/[0.06]';
const PULSE = (s: number) => s >= 8 ? 'animate-pulse' : '';

export default function AdminLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, avgScore: 0, demos: 0, converted: 0 });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/dashboard/leads');
      const items = Array.isArray(data?.leads) ? data.leads : Array.isArray(data) ? data : [];
      setLeads(items);
      setStats({
        total: data?.total ?? items.length,
        avgScore: data?.avgScore ?? (items.reduce((a: number, l: any) => a + (l.interestScore ?? 0), 0) / (items.length || 1)),
        demos: data?.demosSent ?? 0,
        converted: data?.converted ?? 0,
      });
    } catch { setLeads([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => {
    const h = () => fetchLeads();
    window.addEventListener('admin-refresh', h);
    return () => window.removeEventListener('admin-refresh', h);
  }, [fetchLeads]);

  const markDone = async (lead: any) => {
    try {
      await api.patch(`/prospects/${lead.prospectId ?? lead.id}`, { status: 'called' });
      fetchLeads();
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#F8F8FF]">Leads</h1>
        <p className="text-sm text-[#8B8BA7] mt-0.5">Hot prospects with score ≥ 6</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Hot Leads Today', value: stats.total, color: 'text-[#22C55E]' },
          { label: 'Avg Score', value: stats.avgScore.toFixed(1), color: 'text-[#F59E0B]' },
          { label: 'Demos Sent', value: stats.demos, color: 'text-[#7B5CF0]' },
          { label: 'Converted', value: stats.converted, color: 'text-[#6EE7B7]' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-4">
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lead cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5 animate-pulse">
              <div className="flex justify-between mb-3">
                <div className="h-4 bg-white/[0.08] rounded w-32" />
                <div className="h-5 bg-white/[0.08] rounded-full w-16" />
              </div>
              <div className="h-3 bg-white/[0.06] rounded w-24 mb-4" />
              <div className="flex gap-2">
                <div className="h-8 bg-white/[0.06] rounded-lg flex-1" />
                <div className="h-8 bg-white/[0.06] rounded-lg flex-1" />
              </div>
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Zap className="w-6 h-6" />}
          title="No hot leads yet"
          description="Leads with score ≥ 6 will appear here after calls."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {leads.map((lead: any, i: number) => (
            <div
              key={lead.id ?? i}
              className={`rounded-2xl bg-[#12121A] border p-5 transition-all hover:bg-[#14141E] cursor-pointer ${SCORE_BG(lead.interestScore ?? 0)} ${PULSE(lead.interestScore ?? 0)}`}
              onClick={() => setSelected(lead)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[#F8F8FF] truncate">{lead.businessName ?? lead.business ?? 'Unknown'}</h3>
                  <p className="text-xs text-[#8B8BA7] mt-0.5">{lead.niche ?? ''}</p>
                </div>
                <span
                  className="ml-2 text-sm font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    color: SCORE_COLOR(lead.interestScore ?? 0),
                    background: `${SCORE_COLOR(lead.interestScore ?? 0)}18`,
                  }}
                >
                  {lead.interestScore ?? 0}/10
                </span>
              </div>

              {/* Info */}
              <div className="space-y-1 mb-4">
                {lead.city && <p className="text-xs text-[#8B8BA7]">📍 {lead.city}</p>}
                {lead.phone && <p className="text-xs text-[#8B8BA7]">📞 {lead.phone}</p>}
                {lead.email && <p className="text-xs text-[#8B8BA7] truncate">✉️ {lead.email}</p>}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#8B8BA7]">
                  {lead.createdAt ? formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true }) : ''}
                </p>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => markDone(lead)}
                    className="p-1.5 rounded-lg bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 transition-all"
                    title="Mark done"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1.5 rounded-lg bg-[#7B5CF0]/10 text-[#7B5CF0] hover:bg-[#7B5CF0]/20 transition-all"
                    title="Call back"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lead detail sheet */}
      <SlideSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.businessName ?? 'Lead Detail'}
        subtitle={selected?.city}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold" style={{ color: SCORE_COLOR(selected.interestScore ?? 0) }}>
                {selected.interestScore ?? 0}
              </span>
              <span className="text-[#8B8BA7]">/ 10</span>
              <StatusBadge status={selected.status ?? 'interested'} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Business', value: selected.businessName },
                { label: 'Niche', value: selected.niche },
                { label: 'City', value: selected.city },
                { label: 'Phone', value: selected.phone },
                { label: 'Email', value: selected.email },
              ].filter(f => f.value).map((f) => (
                <div key={f.label} className="bg-[#0D0D15] rounded-xl p-3">
                  <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mb-1">{f.label}</p>
                  <p className="text-sm text-[#F8F8FF]">{f.value}</p>
                </div>
              ))}
            </div>

            {selected.transcript && (
              <div>
                <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mb-2">Call Transcript</p>
                <div className="bg-[#0D0D15] rounded-xl p-4 max-h-72 overflow-y-auto">
                  <pre className="text-xs text-[#F8F8FF] whitespace-pre-wrap font-sans leading-relaxed">{selected.transcript}</pre>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button className="w-full px-4 py-2.5 bg-[#7B5CF0] hover:bg-[#6C47FF] text-white text-sm font-medium rounded-xl transition-all">
                Send Demo Link
              </button>
              <button
                onClick={() => { markDone(selected); setSelected(null); }}
                className="w-full px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.08] text-[#F8F8FF] text-sm font-medium rounded-xl transition-all"
              >
                Mark as Done
              </button>
            </div>
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
