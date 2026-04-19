import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Zap, RefreshCw, Phone, CheckCircle, Star, Clock, MapPin, Download } from 'lucide-react';
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

function fmtDateTime(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Aujourd'hui · ${timeStr}`;
  if (diffDays === 1) return `Hier · ${timeStr}`;
  if (diffDays < 7) {
    const day = d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return `${day.charAt(0).toUpperCase() + day.slice(1)} · ${timeStr}`;
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ` · ${timeStr}`;
}

function downloadCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
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
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Leads chauds</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Prospects à fort potentiel</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(data.map(l => ({
              'Entreprise': l.businessName ?? l.prospect?.businessName ?? '',
              'Ville': l.city ?? l.prospect?.city ?? '',
              'Score': l.interestLevel ?? '',
              'Statut': l.status ?? l.outcome ?? '',
              'Téléphone': l.phoneNumber ?? l.prospect?.phoneNumber ?? '',
              'Date': fmtDateTime(l.createdAt) ?? '',
            })), 'leads-export.csv')}
            className="p-2 rounded-xl transition-all" style={{ background: t.elevated, color: t.textSec }}
            title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={load} className="p-2 rounded-xl transition-all" style={{ background: t.elevated, color: t.textSec }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Score filter */}
      <div className="flex items-center gap-1">
        <span className="text-[11px] mr-1" style={{ color: t.textSec }}>Score min</span>
        {[5, 6, 7, 8].map(s => (
          <button key={s} onClick={() => setMinScore(s)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${minScore === s ? 'bg-white/[0.08] border border-white/[0.12]' : 'border border-white/[0.06] hover:bg-white/[0.04]'}`}
            style={{ color: minScore === s ? t.text : t.textSec, background: minScore !== s ? t.elevated : undefined }}>
            ≥{s}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Total leads" value={data.length} icon={<Zap className="w-4 h-4" />} />
          <StatCard label="Leads chauds ≥8" value={hotLeads.length} icon={<Star className="w-4 h-4" />} />
          <StatCard label="Score moyen" value={Math.round(avgScore * 10) / 10} suffix="/10" icon={<Star className="w-4 h-4" />} />
          <StatCard label="Score min" value={minScore} suffix="/10" icon={<Zap className="w-4 h-4" />} />
        </>}
      </div>

      {/* Lead cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={<Zap className="w-7 h-7" />} title="Aucun lead" description={`Aucun prospect avec un score ≥ ${minScore}/10`} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.map((lead: any) => {
            const isHot = lead.interestLevel >= 8;
            const dateLabel = fmtDateTime(lead.createdAt ?? lead.lastCallAt);
            const phone = lead.phoneNumber ?? lead.prospect?.phoneNumber;
            const city = lead.city ?? lead.prospect?.city ?? lead.businessType;
            return (
              <div key={lead.id}
                className="rounded-2xl p-4 transition-all"
                style={{ background: t.elevated, border: isHot ? `1px solid rgba(255,255,255,0.12)` : `1px solid ${t.border}` }}>

                {/* Top row: name + score */}
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: t.text }}>
                      {lead.businessName ?? lead.prospect?.businessName ?? '—'}
                    </p>
                    {city && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: t.textTer }} />
                        <p className="text-[11px] truncate" style={{ color: t.textSec }}>{city}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{ background: `${scoreColor(lead.interestLevel)}20`, color: scoreColor(lead.interestLevel) }}>
                    {lead.interestLevel}/10
                  </div>
                </div>

                {/* Date + badge row — always visible */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    {isHot && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: t.success, background: `${t.success}18` }}>🔥 HOT</span>}
                    <Badge label={lead.status ?? lead.outcome ?? 'interested'} dot size="xs" />
                  </div>
                  {dateLabel && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 flex-shrink-0" style={{ color: t.textTer }} />
                      <span className="text-[11px]" style={{ color: t.textSec }}>{dateLabel}</span>
                    </div>
                  )}
                </div>

                {/* Phone */}
                {phone && (
                  <p className="text-[11px] font-mono mb-2" style={{ color: t.textTer }}>{phone}</p>
                )}

                {/* Summary */}
                {lead.summary && (
                  <p className="text-[11px] mb-3 line-clamp-2 leading-relaxed" style={{ color: t.textSec }}>{lead.summary}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => callBack(lead)} disabled={calling === lead.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.border}`, color: t.textSec }}>
                    <Phone className="w-3.5 h-3.5" />{calling === lead.id ? '…' : 'Rappeler'}
                  </button>
                  <button onClick={() => markDone(lead)} disabled={marking === lead.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.border}`, color: t.textSec }}>
                    <CheckCircle className="w-3.5 h-3.5" />{marking === lead.id ? '…' : 'Converti'}
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
