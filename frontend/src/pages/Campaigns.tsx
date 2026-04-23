import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Campaign } from '../types';
import { Plus, RefreshCw, Trash2, Play, Megaphone } from 'lucide-react';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';
import QwillioLoader from '../components/QwillioLoader';
import { pro } from '../styles/pro-theme';
import { PageHeader, Card, SectionHead, Stat, IconBtn, PrimaryBtn, GhostBtn, Pill } from '../components/pro/ProBlocks';

interface NewCampaign { name: string; type: string; subject: string; body: string; }

const pillColor = (status: string): 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent' => {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'running' || s === 'sent') return 'ok';
  if (s === 'scheduled') return 'info';
  if (s === 'draft') return 'neutral';
  if (s === 'paused') return 'warn';
  if (s === 'failed' || s === 'cancelled') return 'bad';
  return 'neutral';
};

export default function Campaigns() {
  const [data, setData] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [toDelete, setToDelete] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewCampaign>({ name: '', type: 'email', subject: '', body: '' });
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: res } = await api.get('/campaigns/');
      setData(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch { toast('Erreur chargement campagnes', 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [toast]);

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
      toast('Campagne lancée', 'success');
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

  // KPIs
  const active = data.filter(c => {
    const s = (c.status || '').toLowerCase();
    return s === 'active' || s === 'running' || s === 'scheduled';
  }).length;
  const totalSent = data.reduce((acc, c) => acc + (c.sentCount || 0), 0);
  const totalDelivered = data.reduce((acc, c) => acc + (c.deliveredCount || 0), 0);
  const totalClicked = data.reduce((acc, c) => acc + (c.clickedCount || 0), 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const conversionRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <QwillioLoader size={120} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Campagnes"
        subtitle={`${data.length} campagne${data.length > 1 ? 's' : ''} au total`}
        right={
          <>
            <IconBtn onClick={load} title="Rafraîchir">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </IconBtn>
            <PrimaryBtn onClick={() => setShowCreate(true)} size="sm">
              <Plus className="w-3.5 h-3.5" /> Nouvelle campagne
            </PrimaryBtn>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Campagnes actives" value={active} hint={`${data.length} au total`} />
        <Stat label="Envoyés" value={totalSent.toLocaleString('fr-FR')} hint="Tous canaux" />
        <Stat label="Taux livraison" value={`${deliveryRate}%`} hint={`${totalDelivered.toLocaleString('fr-FR')} livrés`} />
        <Stat label="Conversions" value={`${conversionRate}%`} hint={`${totalClicked.toLocaleString('fr-FR')} clics`} />
      </div>

      {/* Campaign list */}
      <section>
        <SectionHead title="Liste des campagnes" />
        <Card>
          {data.length === 0 ? (
            <div className="p-12 text-center">
              <Megaphone className="w-7 h-7 mx-auto mb-3" style={{ color: pro.textTer }} />
              <p className="text-[13px] mb-4" style={{ color: pro.textSec }}>Aucune campagne</p>
              <div className="inline-block">
                <PrimaryBtn onClick={() => setShowCreate(true)} size="sm">
                  <Plus className="w-3.5 h-3.5" /> Créer une campagne
                </PrimaryBtn>
              </div>
            </div>
          ) : (
            data.map((c, i) => {
              const openRate = c.sentCount > 0 ? Math.round((c.openedCount / c.sentCount) * 100) : 0;
              const clickRate = c.sentCount > 0 ? Math.round((c.clickedCount / c.sentCount) * 100) : 0;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02] group"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Megaphone size={14} style={{ color: pro.textSec }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>{c.name}</p>
                      <Pill color={pillColor(c.status)}>{c.status || '—'}</Pill>
                    </div>
                    <p className="text-[11.5px] truncate mt-0.5" style={{ color: pro.textTer }}>
                      {c.type} · créée le {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>

                  <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wider" style={{ color: pro.textTer }}>Envoyés</p>
                      <p className="text-[13px] font-medium tabular-nums" style={{ color: pro.text }}>
                        {c.sentCount.toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wider" style={{ color: pro.textTer }}>Ouverts</p>
                      <p className="text-[13px] font-medium tabular-nums" style={{ color: pro.text }}>
                        {c.openedCount.toLocaleString('fr-FR')} <span style={{ color: pro.textTer }}>({openRate}%)</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wider" style={{ color: pro.textTer }}>Clics</p>
                      <p className="text-[13px] font-medium tabular-nums" style={{ color: pro.text }}>
                        {c.clickedCount.toLocaleString('fr-FR')} <span style={{ color: pro.textTer }}>({clickRate}%)</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(c.status === 'draft' || c.status === 'scheduled') && (
                      <IconBtn
                        onClick={() => launchCampaign(c.id)}
                        title={launching === c.id ? 'Lancement…' : 'Lancer'}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </IconBtn>
                    )}
                    <IconBtn onClick={() => setToDelete(c)} title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconBtn>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle campagne" size="md"
        footer={
          <>
            <GhostBtn onClick={() => setShowCreate(false)}>Annuler</GhostBtn>
            <PrimaryBtn onClick={createCampaign} disabled={creating}>
              {creating ? 'Création…' : 'Créer'}
            </PrimaryBtn>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="text-[11.5px] mb-1.5 block" style={{ color: pro.textSec }}>Nom *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Relance prospects Mars"
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none placeholder-[#6B6B75]"
              style={{ background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` }}
            />
          </div>
          <div>
            <label className="text-[11.5px] mb-1.5 block" style={{ color: pro.textSec }}>Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
              style={{ background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` }}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <div>
            <label className="text-[11.5px] mb-1.5 block" style={{ color: pro.textSec }}>Objet</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Objet de l'email…"
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none placeholder-[#6B6B75]"
              style={{ background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` }}
            />
          </div>
          <div>
            <label className="text-[11.5px] mb-1.5 block" style={{ color: pro.textSec }}>Message</label>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={5}
              placeholder="Contenu du message…"
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none resize-none placeholder-[#6B6B75]"
              style={{ background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` }}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!toDelete} title="Supprimer la campagne"
        message={`Supprimer "${toDelete?.name}" définitivement ?`}
        confirmLabel="Supprimer" loading={deleting}
        onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
