import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Zap, RefreshCw, Phone, CheckCircle, Star } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import { StatCardSkeleton } from '../../components/ui/Skeleton';
import StatCard from '../../components/ui/StatCard';

function scoreColor(s: number) {
  return s >= 8 ? '#22C55E' : s >= 6 ? '#F59E0B' : '#8B8BA7';
}

export default function AdminLeads() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(6);
  const [calling, setCalling] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/dashboard/leads?minScore=${minScore}`);
      setData(Array.isArray(res.leads) ? res.leads : (Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])));
    } catch { toast('Erreur chargement leads', 'error'); }
    finally { setLoading(false); }
  }, [minScore]);

  useEffect(() => { load(); }, [load]);

  const callBack = async (lead: any) => {
    setCalling(lead.id);
    try {
      await api.post(`/prospects/${lead.prospectId ?? lead.id}/call`);
      toast(`Appel déclenché — ${lead.businessName}`, 'success');
    } catch { toast('Erreur déclenchement', 'error'); }
    finally { setCalling(null); }
  };

  const markDone = async (lead: any) => {
    setMarking(lead.id);
    try {
      await api.put(`/prospects/${lead.prospectId ?? lead.id}`, { status: 'converted' });
      toast('Marqué comme converti', 'success');
      load();
    } catch { toast('Erreur', 'error'); }
    finally { setMarking(null); }
  };

  const hotLeads = data.filter(l => l.interestLevel >= 8);
  const avgScore = data.length > 0 ? data.reduce((a, l) => a + (l.interestLevel ?? 0), 0) / data.length : 0;

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Leads chauds</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Prospects à fort potentiel</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[5, 6, 7, 8].map(s => (
              <button key={s} onClick={() => setMinScore(s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${minScore === s ? 'bg-[#7B5CF0]/10 text-[#7B5CF0] border border-[#7B5CF0]/20' : 'bg-[#12121A] border border-white/[0.06] text-[#8B8BA7] hover:text-white'}`}>
                ≥{s}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total leads" value={data.length} icon={<Zap className="w-4 h-4" />} />
        <StatCard label="Leads chauds (≥8)" value={hotLeads.length} icon={<Star className="w-4 h-4" />} color="#F59E0B" />
        <StatCard label="Score moyen" value={Math.round(avgScore * 10) / 10} suffix="/10" icon={<Star className="w-4 h-4" />} color="#22C55E" />
        <StatCard label="Score min" value={minScore} suffix="/10" icon={<Zap className="w-4 h-4" />} color="#7B5CF0" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={<Zap className="w-7 h-7" />} title="Aucun lead" description={`Aucun prospect avec un score ≥ ${minScore}/10`} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((lead: any) => {
            const isHot = lead.interestLevel >= 8;
            return (
              <div key={lead.id}
                className={`rounded-2xl bg-[#12121A] border p-5 transition-all hover:border-white/[0.15]
                  ${isHot ? 'border-[#22C55E]/30 shadow-[0_0_20px_rgba(34,197,94,0.05)]' : 'border-white/[0.06]'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#F8F8FF] truncate">{lead.businessName ?? lead.prospect?.businessName}</p>
                    <p className="text-xs text-[#8B8BA7] mt-0.5">{lead.city ?? lead.prospect?.city ?? lead.businessType}</p>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold"
                      style={{ background: `${scoreColor(lead.interestLevel)}20`, color: scoreColor(lead.interestLevel) }}>
                      {lead.interestLevel}/10
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Badge label={lead.status ?? lead.outcome ?? 'interested'} dot size="xs" />
                  {isHot && <span className="text-[10px] text-[#22C55E] font-medium bg-[#22C55E]/10 px-1.5 py-0.5 rounded-full">🔥 HOT</span>}
                </div>

                {lead.summary && (
                  <p className="text-xs text-[#8B8BA7] mb-4 line-clamp-2">{lead.summary}</p>
                )}

                <div className="flex gap-2">
                  <button onClick={() => callBack(lead)} disabled={calling === lead.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 hover:bg-[#22C55E]/20 text-xs font-medium transition-all disabled:opacity-50">
                    <Phone className="w-3.5 h-3.5" />{calling === lead.id ? '...' : 'Rappeler'}
                  </button>
                  <button onClick={() => markDone(lead)} disabled={marking === lead.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#7B5CF0]/10 text-[#7B5CF0] border border-[#7B5CF0]/20 hover:bg-[#7B5CF0]/20 text-xs font-medium transition-all disabled:opacity-50">
                    <CheckCircle className="w-3.5 h-3.5" />{marking === lead.id ? '...' : 'Converti'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
