import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Client } from '../types';
import { Search, RefreshCw, Eye, Building2, Crown, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import Badge from '../components/ui/Badge';
import SlideSheet from '../components/ui/SlideSheet';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { t, glass, inputStyle, cx } from '../styles/admin-theme';

const PLAN_OPTIONS = ['starter','pro','enterprise'];
const STATUS_OPTIONS = ['active','trial','paused','cancelled'];
function trialDaysLeft(end?: string) { if (!end) return null; return Math.ceil((new Date(end).getTime()-Date.now())/86400000); }

export default function Clients() {
  const [data, setData] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Client|null>(null);
  const [editing, setEditing] = useState<Partial<Client>|null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmPause, setConfirmPause] = useState<Client|null>(null);
  const [toDelete, setToDelete] = useState<Client|null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/clients/');
      const all: Client[] = Array.isArray(res.data)?res.data:(Array.isArray(res)?res:[]);
      let f = all;
      if (search) f=f.filter(c=>c.businessName.toLowerCase().includes(search.toLowerCase())||c.contactEmail.toLowerCase().includes(search.toLowerCase()));
      if (planFilter) f=f.filter(c=>c.planType===planFilter);
      if (statusFilter) f=f.filter(c=>c.subscriptionStatus===statusFilter);
      setTotal(f.length);
      setData(f.slice((page-1)*LIMIT, page*LIMIT));
    } catch { toast('Erreur chargement','error'); }
    finally { setLoading(false); }
  }, [page, search, planFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, planFilter, statusFilter]);

  const saveClient = async () => {
    if (!selected||!editing) return;
    setSaving(true);
    try { await api.put(`/clients/${selected.id}`,editing); toast('Client mis \à jour','success'); setSelected(null); setEditing(null); load(); }
    catch { toast('Erreur mise \à jour','error'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/clients/${toDelete.id}`);
      toast('Client supprim\é', 'success');
      setToDelete(null);
      load();
    } catch { toast('Erreur suppression', 'error'); }
    finally { setDeleting(false); }
  };

  const togglePause = async (c: Client) => {
    try {
      const s = c.subscriptionStatus==='paused'?'active':'paused';
      await api.put(`/clients/${c.id}`,{subscriptionStatus:s});
      toast(s==='paused'?'Client suspendu':'Client r\éactiv\é','success');
      setConfirmPause(null); load();
    } catch { toast('Erreur','error'); }
  };

  return (
    <div className={cx.pageWrap}>
      <ToastContainer toasts={toasts} remove={remove}/>
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cx.h1} style={{ color: t.text }}>Clients</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>{total} client{total>1?'s':''}</p>
        </div>
        <button onClick={load} className={cx.btnIcon} style={{ color: t.textSec }}><RefreshCw className="w-4 h-4"/></button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: t.textTer }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, email..."
            className="w-full pl-8 pr-3 py-2 rounded-[10px] text-sm placeholder-[#48484A] focus:outline-none"
            style={{ ...inputStyle, borderColor: t.border }} />
        </div>
        <select value={planFilter} onChange={e=>setPlanFilter(e.target.value)}
          className="px-3 py-2 rounded-[10px] text-sm focus:outline-none"
          style={inputStyle}>
          <option value="">Plan</option>{PLAN_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-[10px] text-sm focus:outline-none"
          style={inputStyle}>
          <option value="">Statut</option>{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-[14px] overflow-hidden" style={glass}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              <th className={cx.th} style={{ color: t.textTer }}>Client</th>
              <th className={cx.th} style={{ color: t.textTer }}>Plan</th>
              <th className={cx.th} style={{ color: t.textTer }}>Statut</th>
              <th className={`hidden md:table-cell ${cx.th}`} style={{ color: t.textTer }}>MRR</th>
              <th className={`hidden md:table-cell ${cx.th}`} style={{ color: t.textTer }}>Appels</th>
              <th className={`hidden md:table-cell ${cx.th}`} style={{ color: t.textTer }}>Trial</th>
              <th className="px-3 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({length:6}).map((_,i)=>(
              <tr key={i} className={cx.tr}>
                {[1,2,3].map(j=><td key={j} className={cx.td}><div className="h-3 bg-white/[0.06] rounded animate-pulse w-20"/></td>)}
                {[1,2,3].map(j=><td key={`h${j}`} className={`hidden md:table-cell ${cx.td}`}><div className="h-3 bg-white/[0.06] rounded animate-pulse w-14"/></td>)}
                <td/>
              </tr>
            )) : data.length===0 ? (
              <tr><td colSpan={7}><EmptyState icon={<Building2 className="w-7 h-7"/>} title="Aucun client"/></td></tr>
            ) : data.map(c=>{
              const daysLeft = trialDaysLeft(c.trialEndDate);
              return (
                <tr key={c.id} className={cx.tr} style={{ cursor: 'default' }}>
                  <td className={cx.td}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', color: t.textSec }}>
                        {(c.businessName??'X')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-xs truncate max-w-[100px] md:max-w-[160px]" style={{ color: t.text }}>{c.businessName}</p>
                        <p className="text-[10px] truncate hidden md:block" style={{ color: t.textTer }}>{c.contactEmail}</p>
                        <p className="text-[10px] md:hidden" style={{ color: t.textSec }}>${c.monthlyFee}/mo</p>
                      </div>
                    </div>
                  </td>
                  <td className={cx.td}>
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: t.textSec }}>
                      <Crown className="w-3 h-3"/>{c.planType}
                    </span>
                  </td>
                  <td className={cx.td}><Badge label={c.subscriptionStatus} dot size="xs"/></td>
                  <td className={`hidden md:table-cell ${cx.td}`}><span className="text-xs font-semibold" style={{ color: t.text }}>${c.monthlyFee}/mo</span></td>
                  <td className={`hidden md:table-cell ${cx.td}`}><span className="text-xs" style={{ color: t.text }}>{c.totalCallsMade}</span></td>
                  <td className={`hidden md:table-cell ${cx.td}`}>
                    {c.isTrial&&daysLeft!==null
                      ? <span className="flex items-center gap-1 text-xs" style={{ color: daysLeft<=3 ? t.danger : daysLeft<=7 ? t.warning : t.textSec }}><Clock className="w-3 h-3"/>{daysLeft}j</span>
                      : c.trialConvertedAt ? <span className="text-xs flex items-center gap-1" style={{ color: t.success }}><CheckCircle className="w-3 h-3"/>Converti</span>
                      : <span className="text-xs" style={{ color: t.textTer }}>\—</span>}
                  </td>
                  <td className={cx.td}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={()=>{setSelected(c);setEditing({subscriptionStatus:c.subscriptionStatus,planType:c.planType,monthlyFee:c.monthlyFee});}} className="p-1.5 rounded-[8px] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}><Eye className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>setConfirmPause(c)} className="p-1.5 rounded-[8px] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}>
                        {c.subscriptionStatus==='paused'?<CheckCircle className="w-3.5 h-3.5"/>:<XCircle className="w-3.5 h-3.5"/>}
                      </button>
                      <button onClick={()=>setToDelete(c)} className="p-1.5 rounded-[8px] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-3 pb-4"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage}/></div>
      </div>

      <SlideSheet open={!!selected} onClose={()=>{setSelected(null);setEditing(null);}} title={selected?.businessName??'Client'} subtitle={selected?.contactEmail}
        footer={
          <>
            <button onClick={()=>{setSelected(null);setEditing(null);}} className="flex-1 py-2.5 rounded-[14px] text-sm font-medium hover:bg-white/[0.06] transition-all" style={{ background: t.elevated, color: t.text }}>Annuler</button>
            <button onClick={saveClient} disabled={saving} className="flex-1 py-2.5 rounded-[14px] text-sm font-medium transition-all disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.10)', color: t.text }}>{saving?'...':'Enregistrer'}</button>
          </>
        }>
        {selected&&editing&&(
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[14px] p-4 text-center" style={{ background: t.bg }}>
                <p className="text-xl font-bold" style={{ color: t.text }}>${selected.monthlyFee}/mo</p>
                <p className="text-[10px] mt-1 uppercase" style={{ color: t.textTer }}>MRR</p>
              </div>
              <div className="rounded-[14px] p-4 text-center" style={{ background: t.bg }}>
                <p className="text-xl font-bold" style={{ color: t.text }}>{selected.totalCallsMade}</p>
                <p className="text-[10px] mt-1 uppercase" style={{ color: t.textTer }}>Appels</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: t.textSec }}>Plan</label>
                <select value={editing.planType??''} onChange={e=>setEditing(p=>({...p,planType:e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-[10px] text-sm focus:outline-none"
                  style={inputStyle}>
                  {PLAN_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: t.textSec }}>Statut</label>
                <select value={editing.subscriptionStatus??''} onChange={e=>setEditing(p=>({...p,subscriptionStatus:e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-[10px] text-sm focus:outline-none"
                  style={inputStyle}>
                  {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: t.textSec }}>Mensualit\é (\€)</label>
                <input type="number" value={editing.monthlyFee??0} onChange={e=>setEditing(p=>({...p,monthlyFee:Number(e.target.value)}))}
                  className="w-full px-3 py-2.5 rounded-[10px] text-sm focus:outline-none"
                  style={inputStyle} />
              </div>
            </div>
          </div>
        )}
      </SlideSheet>
      <ConfirmDialog open={!!confirmPause} title={confirmPause?.subscriptionStatus==='paused'?'R\éactiver':'Suspendre'} message={`${confirmPause?.subscriptionStatus==='paused'?'R\éactiver':'Suspendre'} "${confirmPause?.businessName}" ?`} confirmLabel={confirmPause?.subscriptionStatus==='paused'?'R\éactiver':'Suspendre'} danger={confirmPause?.subscriptionStatus!=='paused'} onConfirm={()=>confirmPause&&togglePause(confirmPause)} onCancel={()=>setConfirmPause(null)}/>
      <ConfirmDialog open={!!toDelete} title="Supprimer le client" message={`Supprimer d\éfinitivement "${toDelete?.businessName}" et toutes ses donn\ées ?`} confirmLabel="Supprimer" danger loading={deleting} onConfirm={doDelete} onCancel={()=>setToDelete(null)}/>
    </div>
  );
}
