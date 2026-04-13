import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Prospect } from '../types';
import { Search, Phone, Trash2, Eye, RefreshCw, Star, MapPin, Building2, ChevronUp, ChevronDown, Download } from 'lucide-react';
import Badge from '../components/ui/Badge';
import SlideSheet from '../components/ui/SlideSheet';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';
import { t, glass, inputStyle, cx } from '../styles/admin-theme';

function downloadCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type SortKey = 'score'|'businessName'|'createdAt'|'interestLevel';
type SortDir = 'asc'|'desc';
const STATUS_OPTIONS = ['new','qualified','interested','converted','not_interested','do_not_call','voicemail','no_answer','callback'];

export default function Prospects() {
  const [data, setData] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Prospect|null>(null);
  const [toDelete, setToDelete] = useState<Prospect|null>(null);
  const [deleting, setDeleting] = useState(false);
  const [calling, setCalling] = useState<string|null>(null);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...(search&&{search}), ...(statusFilter&&{status:statusFilter}), sort:sortKey, dir:sortDir });
      const { data: res } = await api.get(`/prospects/?${params}`);
      setData(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
      setTotal(res.pagination?.total ?? (Array.isArray(res) ? res.length : 0));
    } catch { toast('Erreur chargement','error'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, sortKey, sortDir]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter, sortKey, sortDir]);

  const triggerCall = async (p: Prospect) => {
    setCalling(p.id);
    try { await api.post(`/prospects/${p.id}/call`); toast(`Appel — ${p.businessName}`,'success'); }
    catch { toast('Erreur appel','error'); }
    finally { setCalling(null); }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try { await api.delete(`/prospects/${toDelete.id}`); toast('Supprimé','success'); setToDelete(null); load(); }
    catch { toast('Erreur suppression','error'); }
    finally { setDeleting(false); }
  };

  const handleSort = (k: SortKey) => {
    if (k===sortKey) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  return (
    <div className={cx.pageWrap}>
      <ToastContainer toasts={toasts} remove={remove}/>
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cx.h1} style={{ color: t.text }}>Prospects</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>{total} au total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadCSV(data.map(p => ({
            'Business Name': p.businessName ?? '',
            'Status': p.status ?? '',
            'Score': p.score ?? '',
            'Sector': p.businessType ?? p.sector ?? '',
            'City': p.city ?? '',
            'Phone': p.phone ?? '',
            'Created': new Date(p.createdAt).toLocaleDateString('fr-FR'),
          })), 'prospects-export.csv')} className={cx.btnIcon} style={{ color: t.textSec }} title="Export CSV"><Download className="w-4 h-4"/></button>
          <button onClick={load} className={cx.btnIcon} style={{ color: t.textSec }}><RefreshCw className="w-4 h-4"/></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: t.textTer }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, ville..."
            className="w-full pl-8 pr-3 py-2 rounded-[10px] text-sm placeholder-[#48484A] focus:outline-none"
            style={{ ...inputStyle, borderColor: t.border }} />
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-[10px] text-sm focus:outline-none"
          style={inputStyle}>
          <option value="">Statut</option>
          {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-1">
          {(['score','businessName','createdAt','interestLevel'] as SortKey[]).map(k=>(
            <button key={k} onClick={()=>handleSort(k)}
              className="flex items-center gap-0.5 px-2.5 py-2 rounded-[10px] text-xs font-medium transition-all"
              style={sortKey===k
                ? { background: 'rgba(255,255,255,0.08)', color: t.text, border: `1px solid ${t.borderHi}` }
                : { background: t.inset, color: t.textSec, border: `1px solid ${t.border}` }}>
              {k==='score'?'Score':k==='businessName'?'Nom':k==='createdAt'?'Date':'Intérêt'}
              {sortKey===k&&(sortDir==='asc'?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] overflow-hidden" style={glass}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              <th className={cx.th} style={{ color: t.textTer }}>Entreprise</th>
              <th className={cx.th} style={{ color: t.textTer }}>Statut</th>
              <th className={cx.th} style={{ color: t.textTer }}>Score</th>
              <th className={`hidden md:table-cell ${cx.th}`} style={{ color: t.textTer }}>Secteur</th>
              <th className={`hidden md:table-cell ${cx.th}`} style={{ color: t.textTer }}>Créé</th>
              <th className="px-3 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({length:7}).map((_,i)=>(
              <tr key={i} className={cx.tr}>
                {[1,2,3].map(j=><td key={j} className={cx.td}><div className="h-3 bg-white/[0.06] rounded animate-pulse w-20"/></td>)}
                <td className={`hidden md:table-cell ${cx.td}`}><div className="h-3 bg-white/[0.06] rounded animate-pulse w-16"/></td>
                <td className={`hidden md:table-cell ${cx.td}`}><div className="h-3 bg-white/[0.06] rounded animate-pulse w-14"/></td>
                <td/>
              </tr>
            )) : data.length===0 ? (
              <tr><td colSpan={6}><EmptyState icon={<Building2 className="w-7 h-7"/>} title="Aucun prospect" description="Les prospects apparaîtront ici une fois le bot démarré."/></td></tr>
            ) : data.map(p=>(
              <tr key={p.id} className={cx.tr} style={{ cursor: 'default' }}>
                <td className={cx.td}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.06)', color: t.textSec }}>
                      {(p.businessName??'X')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-xs truncate max-w-[100px] md:max-w-[160px]" style={{ color: t.text }}>{p.businessName}</p>
                      {p.city&&<p className="text-[10px] flex items-center gap-0.5" style={{ color: t.textTer }}><MapPin className="w-2 h-2"/>{p.city}</p>}
                    </div>
                  </div>
                </td>
                <td className={cx.td}><Badge label={p.status} dot size="xs"/></td>
                <td className={cx.td}>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3" style={{ color: t.textTer }}/>
                    <span className="text-xs font-semibold" style={{ color: t.text }}>{p.score}</span>
                  </div>
                </td>
                <td className={`hidden md:table-cell ${cx.td}`}><span className="text-xs" style={{ color: t.textSec }}>{p.businessType??p.sector??'\—'}</span></td>
                <td className={`hidden md:table-cell ${cx.td}`}><span className="text-xs" style={{ color: t.textSec }}>{new Date(p.createdAt).toLocaleDateString('fr-FR')}</span></td>
                <td className={cx.td}>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>setSelected(p)} className="p-1.5 rounded-[8px] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}><Eye className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>triggerCall(p)} disabled={calling===p.id} className="p-1.5 rounded-[8px] hover:bg-white/[0.08] transition-all disabled:opacity-40" style={{ color: t.textSec }}><Phone className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>setToDelete(p)} className="p-1.5 rounded-[8px] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 pb-4"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage}/></div>
      </div>

      <SlideSheet open={!!selected} onClose={()=>setSelected(null)} title={selected?.businessName??'Prospect'} subtitle={[selected?.city,selected?.businessType].filter(Boolean).join(' \· ')}>
        {selected&&(
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[14px] p-4 text-center" style={{ background: t.bg }}>
                <p className="text-2xl font-bold" style={{ color: t.textSec }}>{selected.score}</p>
                <p className="text-[10px] mt-1 uppercase" style={{ color: t.textTer }}>Score</p>
              </div>
              <div className="rounded-[14px] p-4 text-center" style={{ background: t.bg }}>
                <p className="text-2xl font-bold" style={{ color: t.text }}>{selected.interestLevel??'\—'}{selected.interestLevel?'/10':''}</p>
                <p className="text-[10px] mt-1 uppercase" style={{ color: t.textTer }}>Intérêt</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-[14px]" style={{ background: t.bg }}><span className="text-sm" style={{ color: t.textSec }}>Statut</span><Badge label={selected.status} dot/></div>
            <div className="space-y-2">
              {[{l:'Contact',v:selected.contactName},{l:'Téléphone',v:selected.phone},{l:'Email',v:selected.email},{l:'Ville',v:selected.city},{l:'Secteur',v:selected.businessType??selected.sector}].filter(x=>x.v).map(({l,v})=>(
                <div key={l} className="flex justify-between text-xs"><span style={{ color: t.textSec }}>{l}</span><span className="text-right ml-4" style={{ color: t.text }}>{v}</span></div>
              ))}
            </div>
            {selected.callTranscript&&<div><p className="text-xs mb-2" style={{ color: t.textSec }}>Transcription</p><p className="text-xs rounded-[14px] p-3 max-h-48 overflow-y-auto" style={{ color: t.text, background: t.bg }}>{selected.callTranscript}</p></div>}
            <div className="flex gap-2 pt-2">
              <button onClick={()=>triggerCall(selected)} disabled={calling===selected.id}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-sm font-medium disabled:opacity-50 transition-all"
                style={{ background: `${t.success}15`, color: t.success, border: `1px solid ${t.success}30` }}>
                <Phone className="w-4 h-4"/>{calling===selected.id?'...':'Appeler'}
              </button>
              <button onClick={()=>{setToDelete(selected);setSelected(null);}}
                className="px-3 py-2.5 rounded-[14px] transition-all"
                style={{ background: `${t.danger}15`, color: t.danger, border: `1px solid ${t.danger}30` }}>
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          </div>
        )}
      </SlideSheet>
      <ConfirmDialog open={!!toDelete} title="Supprimer le prospect" message={`Supprimer "${toDelete?.businessName}" ?`} confirmLabel="Supprimer" loading={deleting} onConfirm={doDelete} onCancel={()=>setToDelete(null)}/>
    </div>
  );
}
