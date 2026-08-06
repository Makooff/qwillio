import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Send, Plus, Trash2 } from '../../../components/icons';
import api from '../../../services/api';
import {
  Card,
  PageActions,
  SectionHead,
  Stat,
  Row,
  PrimaryBtn,
  GhostBtn,
  Pill,
  Field,
  Input,
  Select,
  EmptyState,
} from '../../../components/v2/app/Blocks';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';

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
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Génération de devis, contrats et estimates">
        <GhostBtn onClick={() => void reload()}>
          <RefreshCw size={13} aria-hidden="true" />
          Actualiser
        </GhostBtn>
      </PageActions>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat icon={FileText} label="Documents (30j)" value={activity.length} />
        <Stat icon={FileText} label="Signés" tone="ok" value={activity.filter(a => a.status === 'signed').length} />
        <Stat icon={FileText} label="En attente" value={activity.filter(a => a.status === 'sent_for_signature').length} />
      </div>

      <Card>
        <SectionHead title="Générer un document" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Type">
            <Select value={docType} onChange={e => setDocType(e.target.value as typeof docType)}>
              <option value="quote">Devis</option>
              <option value="contract">Contrat</option>
              <option value="estimate">Estimation</option>
              <option value="invoice">Facture</option>
            </Select>
          </Field>
          <Field label="Nom client">
            <Input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </Field>
          <Field label="Email client">
            <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
          </Field>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="q2-eyebrow text-q2-fog">Items</span>
            <GhostBtn onClick={addItem}>
              <Plus size={13} aria-hidden="true" />
              Ajouter
            </GhostBtn>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_76px_100px_auto] gap-2">
                <Input
                  type="text"
                  placeholder="Description"
                  value={it.description}
                  onChange={e => updateItem(i, { description: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Qté"
                  value={it.qty}
                  onChange={e => updateItem(i, { qty: parseFloat(e.target.value) || 0 })}
                  className="tabular-nums"
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Prix unit."
                  value={it.unitPrice}
                  onChange={e => updateItem(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                  className="tabular-nums"
                />
                <GhostBtn
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  aria-label="Retirer la ligne"
                  className="px-3"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </GhostBtn>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 mt-5">
          <span className="text-[13px] text-q2-mist tabular-nums">
            Total : <span className="text-white font-medium">{total.toFixed(2)}</span>
          </span>
          <PrimaryBtn onClick={generate} disabled={generating}>
            {generating
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <FileText size={13} aria-hidden="true" />}
            {generating ? 'Génération…' : 'Générer'}
          </PrimaryBtn>
        </div>
      </Card>

      <Card pad={false}>
        <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
          <SectionHead
            className="mb-0"
            title="Documents récents"
            action={<span className="text-[11px] text-q2-fog tabular-nums">{activity.length}</span>}
          />
        </div>
        {activity.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucun document généré."
            description="Composez un devis ou un contrat ci-dessus."
          />
        ) : (
          <ul>
            {activity.slice(0, 20).map((a, i) => (
              <li key={a.id}>
                <Row
                  first={i === 0}
                  label={a.content.title ?? `${a.documentType} #${a.id.slice(0, 6)}`}
                  hint={a.content.total != null ? `Total: ${a.content.total}` : undefined}
                  right={
                    <>
                      <Pill tone={a.status === 'signed' ? 'ok' : a.status === 'sent_for_signature' ? 'warn' : 'info'}>
                        {a.status}
                      </Pill>
                      {a.status === 'draft' && a.recipientEmail && (
                        <GhostBtn onClick={() => sendDoc(a.id)}>
                          <Send size={12} aria-hidden="true" />
                          Envoyer
                        </GhostBtn>
                      )}
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
