import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Client } from '../types';
import { Search, RefreshCw, Eye, Building2, Crown, Clock, CheckCircle, XCircle } from 'lucide-react';
import Badge from '../components/ui/Badge';
import SlideSheet from '../components/ui/SlideSheet';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const PLAN_OPTIONS = ['starter', 'pro', 'enterprise'];
const STATUS_OPTIONS = ['active', 'trial', 'paused', 'cancelled'];

function trialDaysLeft(end?: string) {
  if (!end) return null;
  const diff = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  return diff;
}

export default function Clients() {
  const [data, setData] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Client | null>(null);
  const [editing, setEditing] = useState<Partial<Client> | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmPause, setConfirmPause] = useState<Client | null>(null);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/clients/');
      const all: Client[] = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      let filtered = all;
      if (search) filtered = filtered.filter(c =>
        c.businessName.toLowerCase().includes(search.toLowerCase()) ||
        c.contactEmail.toLowerCase().includes(search.toLowerCase())
      );
      if (planFilter) filtered = filtered.filter(c => c.planType === planFilter);
      if (statusFilter) filtered = filtered.filter(c => c.subscriptionStatus === statusFilter);
      setTotal(filtered.length);
      setData(filtered.slice((page - 1) * LIMIT, page * LIMIT));
    } catch { toast('Erreur chargement clients', 'error'); }
    finally { setLoading(false); }
  }, [page, search, planFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, planFilter, statusFilter]);

  const saveClient = async () => {
    if (!selected || !editing) return;
    setSaving(true);
    try {
      await api.put(`/clients/${selected.id}`, editing);
      toast('Client mis à jour', 'success');
      setSelected(null);
      setEditing(null);
      load();
    } catch { toast('Erreur mise à jour', 'error'); }
    finally { setSaving(false); }
  };

  const togglePause = async (c: Client) => {
    try {
      const newStatus = c.subscriptionStatus === 'paused' ? 'active' : 'paused';
      await api.put(`/clients/${c.id}`, { subscriptionStatus: newStatus });
      toast(`Client ${newStatus === 'paused' ? 'suspendu' : 'réactivé'}`, 'success');
      setConfirmPause(null);
      load();
    } catch { toast('Erreur', 'error'); }
  };

  const planColor: Record<string, string> = { starter: '#8B8BA7', pro: '#7B5CF0', enterprise: '#F59E0B' };

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Clients</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">{total} client{total > 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8BA7]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, email..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50" />
        </div>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none">
          <option value="">Tous les plans</option>
          {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none">
          <option value="">Tous statuts</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Client','Plan','Statut','MRR','Appels','Trial','Créé le',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                : data.length === 0
                  ? <tr><td colSpan={8}><EmptyState icon={<Building2 className="w-7 h-7" />} title="Aucun client" /></td></tr>
                  : data.map(c => {
                    const daysLeft = trialDaysLeft(c.trialEndDate);
                    return (
                      <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E] text-xs font-bold flex-shrink-0">
                              {(c.businessName ?? 'X')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-[#F8F8FF] text-xs truncate max-w-[150px]">{c.businessName}</p>
                              <p className="text-[10px] text-[#8B8BA7]">{c.contactEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: planColor[c.planType] ?? '#8B8BA7' }}>
                            <Crown className="w-3 h-3" />{c.planType}
                          </span>
                        </td>
                        <td className="px-4 py-3.5"><Badge label={c.subscriptionStatus} dot size="xs" /></td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-semibold text-[#22C55E]">${c.monthlyFee}/mo</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-[#F8F8FF]">{c.totalCallsMade}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {c.isTrial && daysLeft !== null ? (
                            <span className={`flex items-center gap-1 text-xs ${daysLeft <= 3 ? 'text-[#EF4444]' : daysLeft <= 7 ? 'text-[#F59E0B]' : 'text-[#8B8BA7]'}`}>
                              <Clock className="w-3 h-3" />{daysLeft}j
                            </span>
                          ) : c.trialConvertedAt ? (
                            <span className="text-xs text-[#22C55E] flex items-center gap-1"><CheckCircle className="w-3 h-3" />Converti</span>
                          ) : (
                            <span className="text-xs text-[#8B8BA7]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-[#8B8BA7]">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setSelected(c); setEditing({ subscriptionStatus: c.subscriptionStatus, planType: c.planType, monthlyFee: c.monthlyFee }); }}
                              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#8B8BA7] hover:text-white transition-all"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setConfirmPause(c)}
                              className={`p-1.5 rounded-lg transition-all ${c.subscriptionStatus === 'paused' ? 'hover:bg-[#22C55E]/10 text-[#8B8BA7] hover:text-[#22C55E]' : 'hover:bg-[#F59E0B]/10 text-[#8B8BA7] hover:text-[#F59E0B]'}`}>
                              {c.subscriptionStatus === 'paused' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage} /></div>
      </div>

      {/* Client Detail + Edit */}
      <SlideSheet open={!!selected} onClose={() => { setSelected(null); setEditing(null); }}
        title={selected?.businessName ?? 'Client'}
        subtitle={selected?.contactEmail}
        footer={
          <><button onClick={() => { setSelected(null); setEditing(null); }} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-[#F8F8FF] text-sm font-medium hover:bg-white/[0.1] transition-all">Annuler</button>
          <button onClick={saveClient} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#7B5CF0] text-white text-sm font-medium hover:bg-[#6D4FE0] transition-all disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button></>
        }>
        {selected && editing && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0D0D15] rounded-xl p-4 text-center">
                <p className="text-xl font-bold text-[#22C55E]">${selected.monthlyFee}/mo</p>
                <p className="text-[10px] text-[#8B8BA7] mt-1 uppercase tracking-wide">MRR</p>
              </div>
              <div className="bg-[#0D0D15] rounded-xl p-4 text-center">
                <p className="text-xl font-bold text-[#F8F8FF]">{selected.totalCallsMade}</p>
                <p className="text-[10px] text-[#8B8BA7] mt-1 uppercase tracking-wide">Appels total</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { l: 'Contact', v: selected.contactName },
                { l: 'Téléphone', v: selected.contactPhone },
                { l: 'Ville', v: selected.city },
                { l: 'Onboarding', v: selected.onboardingStatus },
                { l: 'Numéro Vapi', v: selected.vapiPhoneNumber },
              ].filter(x => x.v).map(({ l, v }) => (
                <div key={l} className="flex justify-between text-xs">
                  <span className="text-[#8B8BA7]">{l}</span>
                  <span className="text-[#F8F8FF]">{v}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-white/[0.06] pt-4">
              <p className="text-xs font-medium text-[#F8F8FF]">Modifier</p>
              <div>
                <label className="text-xs text-[#8B8BA7] mb-1.5 block">Plan</label>
                <select value={editing.planType ?? ''} onChange={e => setEditing(prev => ({ ...prev, planType: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50">
                  {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#8B8BA7] mb-1.5 block">Statut</label>
                <select value={editing.subscriptionStatus ?? ''} onChange={e => setEditing(prev => ({ ...prev, subscriptionStatus: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#8B8BA7] mb-1.5 block">Mensualité (€)</label>
                <input type="number" value={editing.monthlyFee ?? 0} onChange={e => setEditing(prev => ({ ...prev, monthlyFee: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50" />
              </div>
            </div>
          </div>
        )}
      </SlideSheet>

      <ConfirmDialog open={!!confirmPause}
        title={confirmPause?.subscriptionStatus === 'paused' ? 'Réactiver le client' : 'Suspendre le client'}
        message={`${confirmPause?.subscriptionStatus === 'paused' ? 'Réactiver' : 'Suspendre'} "${confirmPause?.businessName}" ?`}
        confirmLabel={confirmPause?.subscriptionStatus === 'paused' ? 'Réactiver' : 'Suspendre'}
        danger={confirmPause?.subscriptionStatus !== 'paused'}
        onConfirm={() => confirmPause && togglePause(confirmPause)}
        onCancel={() => setConfirmPause(null)} />
    </div>
  );
}
