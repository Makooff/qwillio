import { useEffect, useState } from 'react';
import { LifeBuoy, RefreshCw, Send } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, PageHeader, SectionHead, PrimaryBtn, Pill, Stat } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

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
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />
      <PageHeader title="Support AI" subtitle="Triage tickets, draft réponses, escalade automatique" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat icon={LifeBuoy} label="Tickets 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={LifeBuoy} label="Tickets 30j" value={dashboard?.last30d ?? 0} />
        <Stat icon={LifeBuoy} label="Escaladés" value={tickets.filter(t => t.status === 'escalated').length} />
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <SectionHead title="Classer et répondre à un ticket" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Canal</span>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value as 'email' | 'chat' | 'sms')}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              >
                <option value="email">Email</option>
                <option value="chat">Chat</option>
                <option value="sms">SMS</option>
              </select>
            </label>
            <label className="block md:col-span-3">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Texte du ticket</span>
              <textarea
                rows={4}
                value={ticketText}
                onChange={e => setTicketText(e.target.value)}
                placeholder="Collez ici le message du client…"
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <PrimaryBtn onClick={classify} disabled={classifying || !ticketText.trim()}>
              {classifying ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
              <span className="ml-1.5">{classifying ? 'Classification…' : 'Classer et répondre'}</span>
            </PrimaryBtn>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <SectionHead title="Tickets récents" />
          {tickets.length === 0 ? (
            <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>Aucun ticket pour le moment.</p>
          ) : (
            <ul className="space-y-0">
              {tickets.slice(0, 20).map((t, i) => (
                <li key={t.id} className="py-2.5" style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[12px] font-semibold" style={{ color: pro.text }}>
                      {t.content.category ?? t.type}
                    </span>
                    {t.content.priority && <Pill color={t.content.priority === 'high' ? 'bad' : t.content.priority === 'normal' ? 'info' : 'neutral'}>{t.content.priority}</Pill>}
                    <Pill color={t.status === 'escalated' ? 'warn' : t.status === 'sent' ? 'ok' : 'info'}>{t.status}</Pill>
                    {t.channel && <span className="text-[10.5px]" style={{ color: pro.textTer }}>{t.channel}</span>}
                  </div>
                  {t.content.ticketText && (
                    <p className="text-[11px]" style={{ color: pro.textSec }}>« {String(t.content.ticketText).slice(0, 180)} »</p>
                  )}
                  {t.content.reply && (
                    <p className="text-[11.5px] mt-1" style={{ color: pro.text }}>↳ {String(t.content.reply).slice(0, 240)}</p>
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
