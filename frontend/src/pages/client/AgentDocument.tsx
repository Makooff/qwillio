import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Send, Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, PageHeader, SectionHead, PrimaryBtn, GhostBtn, Pill, Stat } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

interface DocActivity {
  id: string;
  type: string;
  documentType: string;
  recipientEmail: string | null;
  status: string;
  content: { title?: string; total?: number; lineItems?: Array<{ description: string }> };
  createdAt: string;
}

interface LineItem { description: string; qty: number; unitPrice: number }

export default function AgentDocument() {
  const [activity, setActivity] = useState<DocActivity[]>([]);
  const [docType, setDocType] = useState<'quote' | 'contract' | 'estimate' | 'invoice'>('quote');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ description: '', qty: 1, unitPrice: 0 }]);
  const [generating, setGenerating] = useState(false);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const reload = async () => {
    try {
      const r = await api.get('/agent/document/list');
      setActivity(r.data ?? []);
    } catch (e: any) {
      addToast(`Erreur: ${e?.response?.data?.error ?? e.message}`, 'error');
    }
  };

  useEffect(() => { void reload(); }, []);

  const addItem = () => setItems(s => [...s, { description: '', qty: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems(s => s.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<LineItem>) =>
    setItems(s => s.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const generate = async () => {
    if (!customerName.trim() || items.some(it => !it.description.trim())) {
      addToast('Nom client + items requis', 'error');
      return;
    }
    setGenerating(true);
    try {
      await api.post('/agent/document/generate', {
        docType,
        items,
        customerInfo: { name: customerName.trim(), email: customerEmail.trim() || undefined },
      });
      addToast('Document généré', 'success');
      setCustomerName(''); setCustomerEmail(''); setItems([{ description: '', qty: 1, unitPrice: 0 }]);
      await reload();
    } catch (e: any) {
      addToast(`Échec: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const sendDoc = async (id: string) => {
    try {
      await api.post(`/agent/document/send/${id}`);
      addToast('Envoyé pour signature', 'success');
      await reload();
    } catch (e: any) {
      addToast(`Échec: ${e?.response?.data?.error ?? e.message}`, 'error');
    }
  };

  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);

  return (
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />
      <PageHeader title="Document AI" subtitle="Génération de devis, contrats et estimates" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat icon={FileText} label="Documents (30j)" value={activity.length} />
        <Stat icon={FileText} label="Signés" value={activity.filter(a => a.status === 'signed').length} />
        <Stat icon={FileText} label="En attente" value={activity.filter(a => a.status === 'sent_for_signature').length} />
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <SectionHead title="Générer un document" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Type</span>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value as typeof docType)}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              >
                <option value="quote">Devis</option>
                <option value="contract">Contrat</option>
                <option value="estimate">Estimation</option>
                <option value="invoice">Facture</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Nom client</span>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Email client</span>
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold" style={{ color: pro.textSec }}>Items</span>
              <GhostBtn onClick={addItem}><Plus size={12} /> Ajouter</GhostBtn>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2">
                <input
                  type="text"
                  placeholder="Description"
                  value={it.description}
                  onChange={e => updateItem(i, { description: e.target.value })}
                  className="px-3 py-2 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-white/30"
                  style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Qté"
                  value={it.qty}
                  onChange={e => updateItem(i, { qty: parseFloat(e.target.value) || 0 })}
                  className="px-3 py-2 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-white/30 tabular-nums"
                  style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Prix unit."
                  value={it.unitPrice}
                  onChange={e => updateItem(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                  className="px-3 py-2 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-white/30 tabular-nums"
                  style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
                />
                <button
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  className="flex items-center justify-center rounded-lg disabled:opacity-30 active:scale-[0.97]"
                  style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.textSec }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[12.5px] tabular-nums" style={{ color: pro.text }}>
              Total : <span className="font-semibold">{total.toFixed(2)}</span>
            </span>
            <PrimaryBtn onClick={generate} disabled={generating}>
              {generating ? <RefreshCw size={12} className="animate-spin" /> : <FileText size={12} />}
              <span className="ml-1.5">{generating ? 'Génération…' : 'Générer'}</span>
            </PrimaryBtn>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <SectionHead title="Documents récents" />
          {activity.length === 0 ? (
            <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>Aucun document généré.</p>
          ) : (
            <ul className="space-y-0">
              {activity.slice(0, 20).map((a, i) => (
                <li key={a.id} className="py-2.5 flex items-center gap-3" style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[12px] font-semibold" style={{ color: pro.text }}>
                        {a.content.title ?? `${a.documentType} #${a.id.slice(0, 6)}`}
                      </span>
                      <Pill color={a.status === 'signed' ? 'ok' : a.status === 'sent_for_signature' ? 'warn' : 'info'}>{a.status}</Pill>
                    </div>
                    {a.content.total != null && (
                      <p className="text-[11px] tabular-nums" style={{ color: pro.textSec }}>Total: {a.content.total}</p>
                    )}
                  </div>
                  {a.status === 'draft' && a.recipientEmail && (
                    <GhostBtn onClick={() => sendDoc(a.id)}><Send size={11} /> Envoyer</GhostBtn>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
