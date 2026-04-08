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
    try { await api.put(`/clients/${selected.id}`,editing); toast('Client mis à jour','success'); setSelected(null); setEditing(null); load(); }
    catch { toast('Erreur mise à jour','error'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/clients/${toDelete.id}`);
      toast('Client supprimé', 'success');
      setToDelete(null);
      load();
    } catch { toast('Erreur suppression', 'error'); }
    finally { setDeleting(false); }
  };

  const togglePause = async (c: Client) => {
    try {
      const s = c.subscriptionStatus==='paused'?'active':'paused';
      await api.put(`/clients/${c.id}`,{subscriptionStatus:s});
      toast(s==='paused'?'Client suspendu':'Client réactivé','success');
      setConfirmPause(null); load();
    } catch { toast('Erreur','error'); }
  };

  const planColor: Record<string,string> = {starter:'#8B8BA7',pro:'#7B5CF0',enterprise:'#F59E0B'};

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={remove}/>
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[#F8F8FF]">Clients</h1><p className="text-sm text-[#8B8BA7] mt-0.5">{total} client{total>1?'s':''}</p></div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7]"><RefreshCw className="w-4 h-4"/></button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B8BA7]"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, email..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50"/>
        </div>
        <select value={planFilter} onChange={e=>setPlanFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none">
          <option value="">Plan</option>{PLAN_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none">
          <option value="">Statut</option>{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Client</th>
              <th className="px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Plan</th>
              <th className="px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Statut</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">MRR</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Appels</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Trial</th>
              <th className="px-3 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({length:6}).map((_,i)=>(
              <tr key={i} className="border-b border-white/[0.04]">
                {[1,2,3].map(j=><td key={j} className="px-3 py-3"><div className="h-3 bg-white/[0.06] rounded animate-pulse w-20"/></td>)}
                {[1,2,3].map(j=><td key={`h${j}`} className="hidden md:table-cell px-3 py-3"><div className="h-3 bg-white/[0.06] rounded animate-pulse w-14"/></td>)}
                <td/>
              </tr>
            )) : data.length===0 ? (
              <tr><td colSpan={7}><EmptyState icon={<Building2 className="w-7 h-7"/>} title="Aucun client"/></td></tr>
            ) : data.map(c=>{
              const daysLeft = trialDaysLeft(c.trialEndDate);
              return (
                <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E] text-xs font-bold flex-shrink-0">{(c.businessName??'X')[0].toUpperCase()}</div>
                      <div className="min-w-0">
                        <p className="font-medium text-[#F8F8FF] text-xs truncate max-w-[100px] md:max-w-[160px]">{c.businessName}</p>
                        <p className="text-[10px] text-[#8B8BA7] truncate hidden md:block">{c.contactEmail}</p>
                        <p className="text-[10px] text-[#22C55E] md:hidden">${c.monthlyFee}/mo</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><span className="flex items-center gap-1 text-xs font-medium" style={{color:planColor[c.planType]??'#8B8BA7'}}><Crown className="w-3 h-3"/>{c.planType}</span></td>
                  <td className="px-3 py-3"><Badge label={c.subscriptionStatus} dot size="xs"/></td>
                  <td className="hidden md:table-cell px-3 py-3"><span className="text-xs font-semibold text-[#22C55E]">${c.monthlyFee}/mo</span></td>
                  <td className="hidden md:table-cell px-3 py-3"><span className="text-xs text-[#F8F8FF]">{c.totalCallsMade}</span></td>
                  <td className="hidden md:table-cell px-3 py-3">
                    {c.isTrial&&daysLeft!==null
                      ? <span className={`flex items-center gap-1 text-xs ${daysLeft<=3?'text-[#EF4444]':daysLeft<=7?'text-[#F59E0B]':'text-[#8B8BA7]'}`}><Clock className="w-3 h-3"/>{daysLeft}j</span>
                      : c.trialConvertedAt ? <span className="text-xs text-[#22C55E] flex items-center gap-1"><CheckCircle className="w-3 h-3"/>Converti</span>
                      : <span className="text-xs text-[#8B8BA7]">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={()=>{setSelected(c);setEditing({subscriptionStatus:c.subscriptionStatus,planType:c.planType,monthlyFee:c.monthlyFee});}} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#8B8BA7] hover:text-white"><Eye className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>setConfirmPause(c)} className={`p-1.5 rounded-lg transition-all ${c.subscriptionStatus==='paused'?'hover:bg-[#22C55E]/10 text-[#8B8BA7] hover:text-[#22C55E]':'hover:bg-[#F59E0B]/10 text-[#8B8BA7] hover:text-[#F59E0B]'}`}>
                        {c.subscriptionStatus==='paused'?<CheckCircle className="w-3.5 h-3.5"/>:<XCircle className="w-3.5 h-3.5"/>}
                      </button>
                      <button onClick={()=>setToDelete(c)} className="p-1.5 rounded-lg hover:bg-[#EF4444]/10 text-[#8B8BA7] hover:text-[#EF4444]"><Trash2 className="w-3.5 h-3.5"/></button>
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
        footer={<><button onClick={()=>{setSelected(null);setEditing(null);}} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-[#F8F8FF] text-sm font-medium hover:bg-white/[0.1]">Annuler</button><button onClick={saveClient} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#7B5CF0] text-white text-sm font-medium hover:bg-[#6D4FE0] disabled:opacity-50">{saving?'...':'Enregistrer'}</button></>}>
        {selected&&editing&&(
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0D0D15] rounded-xl p-4 text-center"><p className="text-xl font-bold text-[#22C55E]">${selected.monthlyFee}/mo</p><p className="text-[10px] text-[#8B8BA7] mt-1 uppercase">MRR</p></div>
              <div className="bg-[#0D0D15] rounded-xl p-4 text-center"><p className="text-xl font-bold text-[#F8F8FF]">{selected.totalCallsMade}</p><p className="text-[10px] text-[#8B8BA7] mt-1 uppercase">Appels</p></div>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-[#8B8BA7] mb-1.5 block">Plan</label>
                <select value={editing.planType??''} onChange={e=>setEditing(p=>({...p,planType:e.target.value}))} className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50">
                  {PLAN_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-[#8B8BA7] mb-1.5 block">Statut</label>
                <select value={editing.subscriptionStatus??''} onChange={e=>setEditing(p=>({...p,subscriptionStatus:e.target.value}))} className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50">
                  {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-[#8B8BA7] mb-1.5 block">Mensualité (€)</label>
                <input type="number" value={editing.monthlyFee??0} onChange={e=>setEditing(p=>({...p,monthlyFee:Number(e.target.value)}))} className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50"/>
              </div>
            </div>
          </div>
        )}
      </SlideSheet>
      <ConfirmDialog open={!!confirmPause} title={confirmPause?.subscriptionStatus==='paused'?'Réactiver':'Suspendre'} message={`${confirmPause?.subscriptionStatus==='paused'?'Réactiver':'Suspendre'} "${confirmPause?.businessName}" ?`} confirmLabel={confirmPause?.subscriptionStatus==='paused'?'Réactiver':'Suspendre'} danger={confirmPause?.subscriptionStatus!=='paused'} onConfirm={()=>confirmPause&&togglePause(confirmPause)} onCancel={()=>setConfirmPause(null)}/>
      <ConfirmDialog open={!!toDelete} title="Supprimer le client" message={`Supprimer définitivement "${toDelete?.businessName}" et toutes ses données ?`} confirmLabel="Supprimer" danger loading={deleting} onConfirm={doDelete} onCancel={()=>setToDelete(null)}/>
    </div>
  );
}
