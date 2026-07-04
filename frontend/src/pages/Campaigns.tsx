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
import { t, glass, inputStyle, cx } from '../styles/admin-theme';

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
      <label className="text-xs mb-1.5 block" style={{ color: t.textSec }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div className={cx.pageWrap}>
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cx.h1} style={{ color: t.text }}>Campagnes</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>{data.length} campagne{data.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className={cx.btnIcon} style={{ color: t.textSec }}><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)}
            className={cx.btnPrimary}
            style={{ background: 'rgba(255,255,255,0.08)', color: t.text }}>
            <Plus className="w-4 h-4 inline mr-1.5" />Nouvelle campagne
          </button>
        </div>
      </div>

      <div className="rounded-[14px] overflow-hidden" style={glass}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              <th className={cx.th} style={{ color: t.textTer }}>Nom</th>
              <th className={`hidden md:table-cell ${cx.th}`} style={{ color: t.textTer }}>Type</th>
              <th className={cx.th} style={{ color: t.textTer }}>Statut</th>
              <th className={`hidden md:table-cell ${cx.th}`} style={{ color: t.textTer }}>Envoyés</th>
              <th className={`hidden md:table-cell ${cx.th}`} style={{ color: t.textTer }}>Ouverts</th>
              <th className={`hidden md:table-cell ${cx.th}`} style={{ color: t.textTer }}>Clics</th>
              <th className={`hidden md:table-cell ${cx.th}`} style={{ color: t.textTer }}>Créée</th>
              <th className={cx.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
              : data.length === 0
                ? <tr><td colSpan={8}><EmptyState icon={<Megaphone className="w-7 h-7" />} title="Aucune campagne" action={
                    <button onClick={() => setShowCreate(true)} className={cx.btnPrimary} style={{ background: 'rgba(255,255,255,0.08)', color: t.text }}>Créer une campagne</button>
                  } /></td></tr>
                : data.map(c => (
                  <tr key={c.id} className={cx.tr} style={{ cursor: 'default' }}>
                    <td className={cx.td}>
                      <p className="text-xs font-medium truncate max-w-[120px] md:max-w-none" style={{ color: t.text }}>{c.name}</p>
                      <span className="md:hidden"><Badge label={c.type} variant="info" size="xs" /></span>
                    </td>
                    <td className={`hidden md:table-cell ${cx.td}`}><Badge label={c.type} variant="info" size="xs" /></td>
                    <td className={cx.td}><Badge label={c.status} dot size="xs" /></td>
                    <td className={`hidden md:table-cell ${cx.td}`}><span className="text-xs" style={{ color: t.text }}>{c.sentCount}</span></td>
                    <td className={`hidden md:table-cell ${cx.td}`}>
                      <span className="text-xs" style={{ color: t.text }}>
                        {c.openedCount}
                        {c.sentCount > 0 && <span className="ml-1" style={{ color: t.textSec }}>({Math.round(c.openedCount / c.sentCount * 100)}%)</span>}
                      </span>
                    </td>
                    <td className={`hidden md:table-cell ${cx.td}`}>
                      <span className="text-xs" style={{ color: t.text }}>
                        {c.clickedCount}
                        {c.sentCount > 0 && <span className="ml-1" style={{ color: t.textSec }}>({Math.round(c.clickedCount / c.sentCount * 100)}%)</span>}
                      </span>
                    </td>
                    <td className={`hidden md:table-cell ${cx.td}`}><span className="text-xs" style={{ color: t.textSec }}>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span></td>
                    <td className={cx.td}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(c.status === 'draft' || c.status === 'scheduled') && (
                          <button onClick={() => launchCampaign(c.id)} disabled={launching === c.id}
                            className="p-1.5 rounded-[8px] hover:bg-white/[0.08] transition-all disabled:opacity-40" style={{ color: t.success }}><Play className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => setToDelete(c)}
                          className="p-1.5 rounded-[8px] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle campagne" size="md"
        footer={
          <>
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-[14px] text-sm font-medium hover:bg-white/[0.06] transition-all" style={{ background: t.elevated, color: t.text }}>Annuler</button>
            <button onClick={createCampaign} disabled={creating} className="flex-1 py-2.5 rounded-[14px] text-sm font-medium transition-all disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.10)', color: t.text }}>
              {creating ? 'Création...' : 'Créer'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <Field label="Nom *">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Relance prospects Mars"
              className="w-full px-3 py-2.5 rounded-[10px] text-sm placeholder-[#48484A] focus:outline-none"
              style={inputStyle} />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-[10px] text-sm focus:outline-none"
              style={inputStyle}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </Field>
          <Field label="Objet">
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Objet de l'email..."
              className="w-full px-3 py-2.5 rounded-[10px] text-sm placeholder-[#48484A] focus:outline-none"
              style={inputStyle} />
          </Field>
          <Field label="Message">
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={5} placeholder="Contenu du message..."
              className="w-full px-3 py-2.5 rounded-[10px] text-sm placeholder-[#48484A] focus:outline-none resize-none"
              style={inputStyle} />
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
