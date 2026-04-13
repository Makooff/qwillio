import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Zap, RefreshCw, Phone, CheckCircle, Star } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import { StatCardSkeleton } from '../../components/ui/Skeleton';
import StatCard from '../../components/ui/StatCard';
import { t, glass } from '../../styles/admin-theme';

function scoreColor(s: number) {
  return s >= 8 ? t.success : s >= 6 ? t.warning : t.textSec;
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
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Leads chauds</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Prospects à fort potentiel</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[5, 6, 7, 8].map(s => (
              <button key={s} onClick={() => setMinScore(s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${minScore === s ? 'bg-white/[0.08] border border-white/[0.12]' : 'border border-white/[0.06] hover:bg-white/[0.04]'}`}
                style={{ color: minScore === s ? t.text : t.textSec, background: minScore !== s ? t.elevated : undefined }}>
                ≥{s}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total leads" value={data.length} icon={<Zap className="w-4 h-4" />} />
        <StatCard label="Leads chauds (≥8)" value={hotLeads.length} icon={<Star className="w-4 h-4" />} />
        <StatCard label="Score moyen" value={Math.round(avgScore * 10) / 10} suffix="/10" icon={<Star className="w-4 h-4" />} />
        <StatCard label="Score min" value={minScore} suffix="/10" icon={<Zap className="w-4 h-4" />} />
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
                className="p-5 transition-all hover:border-white/[0.15]"
                style={{ ...glass, border: isHot ? `1px solid rgba(255,255,255,0.12)` : `1px solid ${t.border}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: t.text }}>{lead.businessName ?? lead.prospect?.businessName}</p>
                    <p className="text-xs mt-0.5" style={{ color: t.textSec }}>{lead.city ?? lead.prospect?.city ?? lead.businessType}</p>
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
                  {isHot && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: t.success, background: `${t.success}18` }}>🔥 HOT</span>}
                </div>

                {lead.summary && (
                  <p className="text-xs mb-4 line-clamp-2" style={{ color: t.textSec }}>{lead.summary}</p>
                )}

                <div className="flex gap-2">
                  <button onClick={() => callBack(lead)} disabled={calling === lead.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] text-xs font-medium transition-all disabled:opacity-50"
                    style={{ color: t.textSec }}>
                    <Phone className="w-3.5 h-3.5" />{calling === lead.id ? '...' : 'Rappeler'}
                  </button>
                  <button onClick={() => markDone(lead)} disabled={marking === lead.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] text-xs font-medium transition-all disabled:opacity-50"
                    style={{ color: t.textSec }}>
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
