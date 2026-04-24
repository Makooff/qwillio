import { useEffect, useState, useCallback, useMemo } from 'react';
import type React from 'react';
import api from '../../services/api';
import {
  Search, RefreshCw, Phone, CheckCircle, Clock, MapPin, Download, Zap,
} from 'lucide-react';
import OrbsLoader from '../../components/OrbsLoader';
import SlideSheet from '../../components/ui/SlideSheet';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, Stat, IconBtn, Pill, GhostBtn, PrimaryBtn,
} from '../../components/pro/ProBlocks';

const STATUSES = ['', 'interested', 'callback', 'converted', 'not_interested', 'voicemail', 'no_answer'];

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

function statusColor(s?: string): PillColor {
  switch ((s || '').toLowerCase()) {
    case 'interested':     return 'ok';
    case 'converted':      return 'ok';
    case 'callback':       return 'info';
    case 'voicemail':
    case 'no_answer':      return 'warn';
    case 'not_interested': return 'bad';
    default:               return 'neutral';
  }
}

function scorePill(s: number): PillColor {
  return s >= 8 ? 'ok' : s >= 6 ? 'warn' : 'bad';
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${dateStr} · ${timeStr}`;
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

function ProSelect({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 px-3 text-[12.5px] rounded-xl outline-none cursor-pointer"
      style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}
    >
      {children}
    </select>
  );
}

export default function AdminLeads() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [calling, setCalling] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: res } = await api.get('/dashboard/leads?minScore=0');
      setData(Array.isArray(res.leads) ? res.leads : (Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])));
    } catch { toast('Erreur chargement leads', 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter(l => {
    const name = (l.businessName ?? l.prospect?.businessName ?? '').toLowerCase();
    const city = (l.city ?? l.prospect?.city ?? '').toLowerCase();
    const phone = (l.phoneNumber ?? l.prospect?.phoneNumber ?? '').toLowerCase();
    const q = search.toLowerCase();
    if (q && !name.includes(q) && !city.includes(q) && !phone.includes(q)) return false;
    if (statusFilter && (l.status ?? l.outcome) !== statusFilter) return false;
    if (minScore && (l.interestLevel ?? 0) < Number(minScore)) return false;
    return true;
  });

  const stats = useMemo(() => {
    const qualified = data.filter((l: any) => (l.interestLevel ?? l.interestScore ?? 0) >= 6).length;
    const converted = data.filter((l: any) => (l.status ?? l.outcome) === 'converted').length;
    const ratio = data.length ? Math.round((converted / data.length) * 100) : 0;
    return { qualified, converted, ratio };
  }, [data]);

  const callBack = async (lead: any) => {
    setCalling(lead.id);
    try {
      await api.post(`/prospects/${lead.prospectId ?? lead.id}/call`);
      toast(`Appel déclenché — ${lead.businessName ?? ''}`, 'success');
    } catch { toast('Erreur déclenchement', 'error'); }
    finally { setCalling(null); }
  };

  const markDone = async (lead: any) => {
    setMarking(lead.id);
    try {
      await api.put(`/prospects/${lead.prospectId ?? lead.id}`, { status: 'converted' });
      toast('Marqué comme converti', 'success');
      setData(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'converted' } : l));
      setSelected(null);
    } catch { toast('Erreur', 'error'); }
    finally { setMarking(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Leads"
        subtitle={`${filtered.length} sur ${data.length} lead${data.length > 1 ? 's' : ''}`}
        right={
          <>
            <IconBtn
              title="Export CSV"
              onClick={() => downloadCSV(filtered.map((l: any) => ({
                'Entreprise': l.businessName ?? l.prospect?.businessName ?? '',
                'Ville': l.city ?? l.prospect?.city ?? '',
                'Téléphone': l.phoneNumber ?? l.prospect?.phoneNumber ?? '',
                'Score': l.interestLevel ?? '',
                'Statut': l.status ?? l.outcome ?? '',
                'Date': fmtDateTime(l.createdAt),
              })), 'leads-export.csv')}
            >
              <Download className="w-4 h-4" />
            </IconBtn>
            <IconBtn onClick={load} title="Rafraîchir">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </IconBtn>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={data.length} hint="Leads récoltés" />
        <Stat label="Qualifiés" value={stats.qualified} hint="Score ≥ 6" />
        <Stat label="Convertis" value={stats.converted} hint="Clients signés" />
        <Stat label="Taux conversion" value={`${stats.ratio}%`} />
      </div>

      {/* Search + filters */}
      <Card>
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4" style={{ color: pro.textTer }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par entreprise, ville ou téléphone…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder-[#6B6B75]"
            style={{ color: pro.text }}
          />
          {search && <button onClick={() => setSearch('')} className="text-[11px]" style={{ color: pro.textSec }}>Effacer</button>}
        </div>
        <div className="flex flex-wrap gap-2 px-3 pb-3" style={{ borderTop: `1px solid ${pro.border}`, paddingTop: 12 }}>
          <ProSelect value={statusFilter} onChange={setStatusFilter}>
            <option value="">Tous les statuts</option>
            {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
          </ProSelect>
          <ProSelect value={minScore} onChange={setMinScore}>
            <option value="">Score minimum</option>
            {[5, 6, 7, 8, 9].map(s => <option key={s} value={String(s)}>≥ {s}</option>)}
          </ProSelect>
          {(statusFilter || minScore) && (
            <button
              onClick={() => { setStatusFilter(''); setMinScore(''); }}
              className="h-9 px-3 text-[12px] rounded-xl"
              style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.textSec }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </Card>

      {/* List */}
      <Card>
        {filtered.length === 0 ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <Zap className="w-6 h-6 mx-auto mb-3 opacity-60" />
            <p className="text-[13px]">Aucun lead trouvé</p>
          </div>
        ) : (
          filtered.map((lead: any, i: number) => {
            const name = lead.businessName ?? lead.prospect?.businessName ?? '—';
            const score = lead.interestLevel ?? lead.interestScore;
            const city = lead.city ?? lead.prospect?.city ?? lead.businessType;
            const phone = lead.phoneNumber ?? lead.prospect?.phoneNumber;
            const st = lead.status ?? lead.outcome ?? 'interested';
            return (
              <div
                key={lead.id ?? i}
                onClick={() => setSelected(lead)}
                className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02] cursor-pointer"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
                     style={{ background: 'rgba(255,255,255,0.05)', color: pro.text }}>
                  {(name?.charAt(0) || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>{name}</p>
                  <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                    {city || phone || '—'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1" style={{ color: pro.textTer }}>
                    <Clock size={11} />
                    <span className="text-[11px]">{fmtDateTime(lead.createdAt ?? lead.lastCallAt)}</span>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => callBack(lead)}
                    disabled={calling === lead.id}
                    title="Appeler"
                    className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                    style={{ color: pro.textSec }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => markDone(lead)}
                    disabled={marking === lead.id}
                    title="Marquer converti"
                    className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                    style={{ color: pro.textSec }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <Pill color={statusColor(st)}>{st}</Pill>
                  {score != null && (
                    <Pill color={scorePill(score)}>{score}/10</Pill>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* Detail sheet */}
      <SlideSheet
        open={!!selected} onClose={() => setSelected(null)}
        title={selected?.businessName ?? selected?.prospect?.businessName ?? 'Détail lead'}
        subtitle={[selected?.status ?? selected?.outcome, selected?.city ?? selected?.prospect?.city].filter(Boolean).join(' · ')}
      >
        {selected && (() => {
          const score = selected.interestLevel ?? selected.interestScore;
          const phone = selected.phoneNumber ?? selected.prospect?.phoneNumber;
          const city = selected.city ?? selected.prospect?.city ?? selected.businessType;
          const st = selected.status ?? selected.outcome ?? 'interested';
          return (
            <div className="space-y-4">
              {/* Date/time */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                   style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: pro.textSec }} />
                <span className="text-[13px] font-medium" style={{ color: pro.text }}>
                  {fmtDateTime(selected.createdAt ?? selected.lastCallAt)}
                </span>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-3 text-center"
                     style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                  <p className="text-[18px] font-semibold tabular-nums" style={{ color: pro.text }}>
                    {score != null ? `${score}/10` : '—'}
                  </p>
                  <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: pro.textTer }}>Score</p>
                </div>
                <div className="rounded-xl p-3 text-center"
                     style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                  <div className="flex items-center justify-center" style={{ minHeight: 24 }}>
                    <Pill color={statusColor(st)}>{st}</Pill>
                  </div>
                  <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: pro.textTer }}>Statut</p>
                </div>
                <div className="rounded-xl p-3 text-center"
                     style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                  <p className="text-[14px] font-semibold" style={{ color: pro.text }}>
                    {score >= 8 ? 'Élevé' : score >= 6 ? 'Moyen' : 'Faible'}
                  </p>
                  <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: pro.textTer }}>Potentiel</p>
                </div>
              </div>

              {/* Phone */}
              {phone && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                     style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                  <Phone className="w-3.5 h-3.5" style={{ color: pro.textSec }} />
                  <span className="text-[13px] font-mono" style={{ color: pro.text }}>{phone}</span>
                </div>
              )}

              {/* City */}
              {city && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                     style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                  <MapPin className="w-3.5 h-3.5" style={{ color: pro.textSec }} />
                  <span className="text-[13px]" style={{ color: pro.text }}>{city}</span>
                </div>
              )}

              {/* Summary */}
              {selected.summary && (
                <div>
                  <p className="text-[11px] mb-2 font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>Résumé</p>
                  <p className="text-[12.5px] leading-relaxed rounded-xl p-3"
                     style={{ color: pro.text, background: pro.panel, border: `1px solid ${pro.border}` }}>
                    {selected.summary}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <GhostBtn onClick={() => callBack(selected)} disabled={calling === selected.id}>
                  <Phone className="w-3.5 h-3.5" />
                  {calling === selected.id ? '…' : 'Déclencher un appel'}
                </GhostBtn>
                <PrimaryBtn onClick={() => markDone(selected)} disabled={marking === selected.id}>
                  <CheckCircle className="w-3.5 h-3.5" />
                  {marking === selected.id ? '…' : 'Marquer converti'}
                </PrimaryBtn>
              </div>
            </div>
          );
        })()}
      </SlideSheet>
    </div>
  );
}
