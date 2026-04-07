import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Campaign } from '../types';
import { Plus, RefreshCw, Trash2, Play, Megaphone } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';

interface NewCampaign { name: string; type: string; subject: string; body: string; }

export default function Campaigns() {
  const [data, setData] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toDelete, setToDelete] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewCampaign>({ name: '', type: 'email', subject: '', body: '' });
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/campaigns/');
      setData(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch { toast('Erreur chargement campagnes', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createCampaign = async () => {
    if (!form.name) { toast('Nom requis', 'error'); return; }
    setCreating(true);
    try {
      await api.post('/campaigns/', form);
      toast('Campagne créée', 'success');
      setShowCreate(false);
      setForm({ name: '', type: 'email', subject: '', body: '' });
      load();
    } catch { toast('Erreur création', 'error'); }
    finally { setCreating(false); }
  };

  const launchCampaign = async (id: string) => {
    setLaunching(id);
    try {
      await api.post(`/campaigns/${id}/launch`);
      toast('Campagne lancée !', 'success');
      load();
    } catch { toast('Erreur lancement', 'error'); }
    finally { setLaunching(null); }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/campaigns/${toDelete.id}`);
      toast('Campagne supprimée', 'success');
      setToDelete(null);
      load();
    } catch { toast('Erreur suppression', 'error'); }
    finally { setDeleting(false); }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="text-xs text-[#8B8BA7] mb-1.5 block">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Campagnes</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">{data.length} campagne{data.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7B5CF0] hover:bg-[#6D4FE0] text-white text-sm font-medium transition-all">
            <Plus className="w-4 h-4" />Nouvelle campagne
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Nom','Type','Statut','Envoyés','Ouverts','Clics','Créée le',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                : data.length === 0
                  ? <tr><td colSpan={8}><EmptyState icon={<Megaphone className="w-7 h-7" />} title="Aucune campagne" action={<button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl bg-[#7B5CF0] text-white text-xs font-medium">Créer une campagne</button>} /></td></tr>
                  : data.map(c => (
                    <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                      <td className="px-4 py-3.5">
                        <p className="text-xs font-medium text-[#F8F8FF]">{c.name}</p>
                      </td>
                      <td className="px-4 py-3.5"><Badge label={c.type} variant="info" size="xs" /></td>
                      <td className="px-4 py-3.5"><Badge label={c.status} dot size="xs" /></td>
                      <td className="px-4 py-3.5"><span className="text-xs text-[#F8F8FF]">{c.sentCount}</span></td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-[#F8F8FF]">
                          {c.openedCount}
                          {c.sentCount > 0 && <span className="text-[#8B8BA7] ml-1">({Math.round(c.openedCount / c.sentCount * 100)}%)</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-[#F8F8FF]">
                          {c.clickedCount}
                          {c.sentCount > 0 && <span className="text-[#8B8BA7] ml-1">({Math.round(c.clickedCount / c.sentCount * 100)}%)</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5"><span className="text-xs text-[#8B8BA7]">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(c.status === 'draft' || c.status === 'scheduled') && (
                            <button onClick={() => launchCampaign(c.id)} disabled={launching === c.id}
                              className="p-1.5 rounded-lg hover:bg-[#22C55E]/10 text-[#8B8BA7] hover:text-[#22C55E] transition-all disabled:opacity-40"><Play className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => setToDelete(c)}
                            className="p-1.5 rounded-lg hover:bg-[#EF4444]/10 text-[#8B8BA7] hover:text-[#EF4444] transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle campagne" size="md"
        footer={
          <><button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-[#F8F8FF] text-sm font-medium hover:bg-white/[0.1] transition-all">Annuler</button>
          <button onClick={createCampaign} disabled={creating} className="flex-1 py-2.5 rounded-xl bg-[#7B5CF0] text-white text-sm font-medium hover:bg-[#6D4FE0] transition-all disabled:opacity-50">
            {creating ? 'Création...' : 'Créer'}
          </button></>
        }>
        <div className="space-y-4">
          <Field label="Nom *">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Relance prospects Mars"
              className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50" />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </Field>
          <Field label="Objet">
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Objet de l'email..."
              className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50" />
          </Field>
          <Field label="Message">
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={5} placeholder="Contenu du message..."
              className="w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50 resize-none" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!toDelete} title="Supprimer la campagne"
        message={`Supprimer "${toDelete?.name}" définitivement ?`}
        confirmLabel="Supprimer" loading={deleting}
        onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
