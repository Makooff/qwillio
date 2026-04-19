import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Search, RefreshCw, Phone, CheckCircle, Star, Clock, MapPin, Download, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import SlideSheet from '../../components/ui/SlideSheet';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { t, glass, inputStyle } from '../../styles/admin-theme';

const STATUSES = ['', 'interested', 'callback', 'converted', 'not_interested', 'voicemail', 'no_answer'];

function scoreColor(s: number) {
  return s >= 8 ? t.success : s >= 6 ? t.warning : t.danger;
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

// ── Mobile lead card ──────────────────────────────────────────────────────────
function LeadCard({ lead, onSelect }: { lead: any; onSelect: (l: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const score = lead.interestLevel ?? lead.interestScore;
  const isHot = score >= 8;
  const hasSummary = !!lead.summary;
  const phone = lead.phoneNumber ?? lead.prospect?.phoneNumber;
  const city = lead.city ?? lead.prospect?.city ?? lead.businessType;

  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ background: t.elevated, border: `1px solid ${isHot ? 'rgba(255,255,255,0.12)' : t.border}` }}>
      {/* Main row */}
      <div className="p-3.5" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2 mb-2">
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
            {!city && phone && (
              <p className="text-[11px] mt-0.5 font-mono" style={{ color: t.textSec }}>{phone}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {score != null && (
              <span className="text-sm font-bold" style={{ color: scoreColor(score) }}>{score}<span className="text-[10px] font-normal" style={{ color: t.textSec }}>/10</span></span>
            )}
            <Badge label={lead.status ?? lead.outcome ?? 'interested'} dot size="xs" />
          </div>
        </div>

        {/* Date + hot badge row — always visible */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 flex-shrink-0" style={{ color: t.textSec }} />
            <span className="text-[11px] font-medium" style={{ color: t.textSec }}>
              {fmtDateTime(lead.createdAt ?? lead.lastCallAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isHot && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: t.success, background: `${t.success}18` }}>🔥 HOT</span>
            )}
            {hasSummary && (
              <span style={{ color: t.textSec }}>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded: summary + detail button */}
      {expanded && hasSummary && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t" style={{ borderColor: t.border }}>
          <div className="pt-3 rounded-xl p-2.5" style={{ background: t.inset }}>
            <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: t.textTer }}>Résumé</p>
            <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: t.textSec }}>{lead.summary}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(lead); }}
            className="w-full py-2 rounded-xl text-[11px] font-medium transition-all"
            style={{ background: `${t.brand}15`, color: t.brand, border: `1px solid ${t.brand}30` }}>
            Voir le détail complet
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminLeads() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [calling, setCalling] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/dashboard/leads?minScore=0');
      setData(Array.isArray(res.leads) ? res.leads : (Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])));
    } catch { toast('Erreur chargement leads', 'error'); }
    finally { setLoading(false); }
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

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Prospects</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>{filtered.length} prospect{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(filtered.map(l => ({
              'Entreprise': l.businessName ?? l.prospect?.businessName ?? '',
              'Ville': l.city ?? l.prospect?.city ?? '',
              'Téléphone': l.phoneNumber ?? l.prospect?.phoneNumber ?? '',
              'Score': l.interestLevel ?? '',
              'Statut': l.status ?? l.outcome ?? '',
              'Date': fmtDateTime(l.createdAt),
            })), 'prospects-export.csv')}
            className="p-2 rounded-xl transition-all" style={{ background: t.elevated, color: t.textSec }}
            title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={load} className="p-2 rounded-xl transition-all" style={{ background: t.elevated, color: t.textSec }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: t.textSec }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            style={inputStyle} className="w-full pl-8 pr-3 py-2 placeholder-[#48484A] focus:outline-none focus:border-white/[0.18]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle} className="px-3 py-2 focus:outline-none">
          <option value="">Statut</option>
          {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={minScore} onChange={e => setMinScore(e.target.value)} style={inputStyle} className="px-3 py-2 focus:outline-none">
          <option value="">Score</option>
          {[5, 6, 7, 8, 9].map(s => <option key={s} value={String(s)}>≥{s}</option>)}
        </select>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-3.5 animate-pulse" style={{ background: t.elevated, height: 88 }} />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl py-12" style={glass}>
            <EmptyState icon={<Zap className="w-7 h-7" />} title="Aucun prospect" />
          </div>
        ) : (
          filtered.map((lead: any) => <LeadCard key={lead.id} lead={lead} onSelect={setSelected} />)
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-hidden" style={glass}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Entreprise</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Date & heure</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Statut</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Score</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Ville</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                {[1,2,3,4,5,6].map(j => (
                  <td key={j} className="px-3 py-3"><div className="h-3 bg-white/[0.06] rounded animate-pulse w-20" /></td>
                ))}
              </tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={6}><EmptyState icon={<Zap className="w-7 h-7" />} title="Aucun prospect" /></td></tr>
            ) : filtered.map((lead: any) => {
              const score = lead.interestLevel ?? lead.interestScore;
              const city = lead.city ?? lead.prospect?.city ?? lead.businessType;
              return (
                <tr key={lead.id} onClick={() => setSelected(lead)}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer">
                  <td className="px-3 py-3">
                    <p className="text-xs font-medium" style={{ color: t.text }}>{lead.businessName ?? lead.prospect?.businessName ?? '—'}</p>
                    {(lead.phoneNumber ?? lead.prospect?.phoneNumber) && (
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: t.textTer }}>{lead.phoneNumber ?? lead.prospect?.phoneNumber}</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs" style={{ color: t.text }}>{fmtDateTime(lead.createdAt ?? lead.lastCallAt)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge label={lead.status ?? lead.outcome ?? 'interested'} dot size="xs" />
                      {score >= 8 && <span className="text-[10px]">🔥</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {score != null
                      ? <span className="text-xs font-bold" style={{ color: scoreColor(score) }}>{score}/10</span>
                      : <span style={{ color: t.textSec }}>—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs" style={{ color: t.textSec }}>{city ?? '—'}</span>
                  </td>
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      <button onClick={() => callBack(lead)} disabled={calling === lead.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.06)', color: t.textSec }}>
                        <Phone className="w-3 h-3" />{calling === lead.id ? '…' : 'Appeler'}
                      </button>
                      <button onClick={() => markDone(lead)} disabled={marking === lead.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.06)', color: t.textSec }}>
                        <CheckCircle className="w-3 h-3" />{marking === lead.id ? '…' : 'Converti'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail sheet */}
      <SlideSheet
        open={!!selected} onClose={() => setSelected(null)}
        title={selected?.businessName ?? selected?.prospect?.businessName ?? 'Détail prospect'}
        subtitle={[selected?.status ?? selected?.outcome, selected?.city ?? selected?.prospect?.city].filter(Boolean).join(' · ')}>
        {selected && (() => {
          const score = selected.interestLevel ?? selected.interestScore;
          const phone = selected.phoneNumber ?? selected.prospect?.phoneNumber;
          const city = selected.city ?? selected.prospect?.city ?? selected.businessType;
          return (
            <div className="space-y-4">
              {/* Date/time prominent */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: t.elevated }}>
                <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.brand }} />
                <span className="text-sm font-medium" style={{ color: t.text }}>{fmtDateTime(selected.createdAt ?? selected.lastCallAt)}</span>
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-3 text-center" style={{ background: t.elevated }}>
                  <p className="text-base font-bold" style={{ color: score != null ? scoreColor(score) : t.textSec }}>
                    {score != null ? `${score}/10` : '—'}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: t.textSec }}>Score</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: t.elevated }}>
                  <Badge label={selected.status ?? selected.outcome ?? 'interested'} dot size="xs" />
                  <p className="text-[10px] mt-1" style={{ color: t.textSec }}>Statut</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: t.elevated }}>
                  <p className="text-base font-bold" style={{ color: t.text }}>{score >= 8 ? '🔥' : score >= 6 ? '⚡' : '—'}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: t.textSec }}>Potentiel</p>
                </div>
              </div>

              {/* Phone */}
              {phone && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: t.elevated }}>
                  <Phone className="w-3.5 h-3.5" style={{ color: t.textSec }} />
                  <span className="text-sm font-mono" style={{ color: t.text }}>{phone}</span>
                </div>
              )}

              {/* City */}
              {city && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: t.elevated }}>
                  <MapPin className="w-3.5 h-3.5" style={{ color: t.textSec }} />
                  <span className="text-sm" style={{ color: t.text }}>{city}</span>
                </div>
              )}

              {/* Summary */}
              {selected.summary && (
                <div>
                  <p className="text-xs mb-2 font-medium" style={{ color: t.textSec }}>Résumé</p>
                  <p className="text-xs leading-relaxed rounded-xl p-3" style={{ color: t.text, background: t.elevated }}>{selected.summary}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => callBack(selected)} disabled={calling === selected.id}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                  style={{ background: `${t.brand}15`, color: t.brand, border: `1px solid ${t.brand}30` }}>
                  <Phone className="w-3.5 h-3.5" />{calling === selected.id ? '…' : 'Déclencher un appel'}
                </button>
                <button onClick={() => markDone(selected)} disabled={marking === selected.id}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                  style={{ background: `${t.success}15`, color: t.success, border: `1px solid ${t.success}30` }}>
                  <CheckCircle className="w-3.5 h-3.5" />{marking === selected.id ? '…' : 'Marquer converti'}
                </button>
              </div>
            </div>
          );
        })()}
      </SlideSheet>
    </div>
  );
}
