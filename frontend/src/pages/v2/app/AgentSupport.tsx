import { useEffect, useState } from 'react';
import { LifeBuoy, RefreshCw, Send } from '../../../components/icons';
import api from '../../../services/api';
import {
  Card,
  PageActions,
  SectionHead,
  Stat,
  PrimaryBtn,
  GhostBtn,
  Pill,
  Field,
  Select,
  Textarea,
  EmptyState,
} from '../../../components/v2/app/Blocks';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';

interface Ticket {
  id: string;
  type: string;
  channel: string | null;
  status: string;
  content: { category?: string; priority?: string; reply?: string; ticketText?: string; shouldEscalate?: boolean };
  createdAt: string;
}

interface Dashboard { last24h: number; last30d: number; sampleSize: number }

export default function AgentSupport() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [channel, setChannel] = useState<'email' | 'chat' | 'sms'>('email');
  const [ticketText, setTicketText] = useState('');
  const [classifying, setClassifying] = useState(false);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const reload = async () => {
    try {
      const [d, t] = await Promise.all([
        api.get('/agent/support/dashboard'),
        api.get('/agent/support/tickets'),
      ]);
      setDashboard(d.data);
      setTickets(t.data ?? []);
    } catch (e: any) {
      addToast(`Erreur: ${e?.response?.data?.error ?? e.message}`, 'error');
    }
  };

  useEffect(() => { void reload(); }, []);

  const classify = async () => {
    if (!ticketText.trim()) return;
    setClassifying(true);
    try {
      await api.post('/agent/support/classify', { channel, ticketText: ticketText.trim() });
      addToast('Ticket classé', 'success');
      setTicketText('');
      await reload();
    } catch (e: any) {
      addToast(`Échec: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setClassifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Triage tickets, draft réponses, escalade automatique">
        <GhostBtn onClick={() => void reload()}>
          <RefreshCw size={13} aria-hidden="true" />
          Actualiser
        </GhostBtn>
      </PageActions>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat icon={LifeBuoy} label="Tickets 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={LifeBuoy} label="Tickets 30j" value={dashboard?.last30d ?? 0} />
        <Stat
          icon={LifeBuoy}
          label="Escaladés"
          tone={tickets.some(t => t.status === 'escalated') ? 'warn' : undefined}
          value={tickets.filter(t => t.status === 'escalated').length}
        />
      </div>

      <Card>
        <SectionHead title="Classer et répondre à un ticket" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Canal">
            <Select value={channel} onChange={e => setChannel(e.target.value as 'email' | 'chat' | 'sms')}>
              <option value="email">Email</option>
              <option value="chat">Chat</option>
              <option value="sms">SMS</option>
            </Select>
          </Field>
          <Field label="Texte du ticket" className="md:col-span-2">
            <Textarea
              rows={4}
              value={ticketText}
              onChange={e => setTicketText(e.target.value)}
              placeholder="Collez ici le message du client…"
            />
          </Field>
        </div>
        <div className="flex justify-end mt-4">
          <PrimaryBtn onClick={classify} disabled={classifying || !ticketText.trim()}>
            {classifying
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <Send size={13} aria-hidden="true" />}
            {classifying ? 'Classification…' : 'Classer et répondre'}
          </PrimaryBtn>
        </div>
      </Card>

      <Card pad={false}>
        <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
          <SectionHead
            className="mb-0"
            title="Tickets récents"
            action={<span className="text-[11px] text-q2-fog tabular-nums">{tickets.length}</span>}
          />
        </div>
        {tickets.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title="Aucun ticket pour le moment."
            description="Les tickets classés par l'agent apparaîtront ici."
          />
        ) : (
          <ul>
            {tickets.slice(0, 20).map((t, i) => (
              <li key={t.id} className={`px-4 py-3 ${i === 0 ? '' : 'border-t border-q2-graphite-d'}`}>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[13.5px] font-medium text-white">{t.content.category ?? t.type}</span>
                  {t.content.priority && (
                    <Pill tone={t.content.priority === 'high' ? 'bad' : t.content.priority === 'normal' ? 'info' : 'neutral'}>
                      {t.content.priority}
                    </Pill>
                  )}
                  <Pill tone={t.status === 'escalated' ? 'warn' : t.status === 'sent' ? 'ok' : 'info'}>{t.status}</Pill>
                  {t.channel && <span className="text-[11px] text-q2-fog">{t.channel}</span>}
                </div>
                {t.content.ticketText && (
                  <p className="text-[12.5px] text-q2-fog q2-body-text">
                    « {String(t.content.ticketText).slice(0, 180)} »
                  </p>
                )}
                {t.content.reply && (
                  <p className="text-[13px] text-q2-mist q2-body-text mt-1.5">
                    {String(t.content.reply).slice(0, 240)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
