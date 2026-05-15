import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, Flame, Zap, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, GhostBtn,
} from '../../components/pro/ProBlocks';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Anomaly {
  id: string;
  metric: string;
  current: number;
  avg: number;
  deviation: number;
  severity: string;
  diagnosis?: string;
  createdAt: string;
  resolvedAt?: string | null;
}

interface HotLead {
  id: string;
  businessName: string;
  niche?: string;
  city?: string;
  interestLevel?: number;
  lastCallDate?: string;
  createdAt: string;
}

interface EvolutionEvent {
  id: string;
  agentType: string;
  niche: string;
  version: number;
  winRate: number;
  sampleSize: number;
  evolvedAt: string;
}

interface AgentDashboard {
  anomalies: Anomaly[];
}

interface ProspectsResponse {
  data?: HotLead[];
  prospects?: HotLead[];
}

// ── Unified notification ──────────────────────────────────────────────────────

type NotifType = 'anomaly' | 'hot_lead' | 'evolution';

interface Notification {
  id: string;
  type: NotifType;
  date: string;
  read: boolean;
  // polymorphic payload
  anomaly?: Anomaly;
  hotLead?: HotLead;
  evolution?: EvolutionEvent;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  } catch {
    return '—';
  }
}

function formatMetricName(metric: string): string {
  return metric
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Icon components ───────────────────────────────────────────────────────────

function AnomalyIcon() {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: `${pro.bad}1A` }}
    >
      <AlertTriangle size={15} style={{ color: pro.bad }} />
    </div>
  );
}

function HotLeadIcon() {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: `${pro.warn}1A` }}
    >
      <Flame size={15} style={{ color: pro.warn }} />
    </div>
  );
}

function EvolutionIcon() {
  const purple = '#8B5CF6';
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: `${purple}1A` }}
    >
      <Zap size={15} style={{ color: purple }} />
    </div>
  );
}

// ── Notification Card Row ─────────────────────────────────────────────────────

interface NotifRowProps {
  notif: Notification;
  onMarkRead: (id: string) => void;
  onAction: (notif: Notification) => void;
}

function NotifRow({ notif, onMarkRead, onAction }: NotifRowProps) {
  const { type, anomaly, hotLead, evolution, read } = notif;

  let title = '';
  let subtitle = '';
  let actionLabel = '';

  if (type === 'anomaly' && anomaly) {
    title = formatMetricName(anomaly.metric);
    subtitle = `Actuel: ${anomaly.current.toFixed(2)} (moy: ${anomaly.avg.toFixed(2)}, déviation: ${anomaly.deviation > 0 ? '+' : ''}${anomaly.deviation.toFixed(1)}σ)${anomaly.diagnosis ? ` — ${anomaly.diagnosis}` : ''}`;
    actionLabel = 'Voir détails';
  } else if (type === 'hot_lead' && hotLead) {
    title = hotLead.businessName;
    const parts: string[] = [];
    if (hotLead.niche) parts.push(hotLead.niche);
    if (hotLead.city) parts.push(hotLead.city);
    if (hotLead.interestLevel != null) parts.push(`Intérêt: ${hotLead.interestLevel}/10`);
    subtitle = parts.join(' · ');
    actionLabel = 'Business plan →';
  } else if (type === 'evolution' && evolution) {
    title = `Stratégie évoluée: ${evolution.agentType} / ${evolution.niche}`;
    subtitle = `Version v${evolution.version} · Win rate ${evolution.winRate.toFixed(1)}% · ${evolution.sampleSize} samples`;
    actionLabel = 'Voir évolution';
  }

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.02] cursor-pointer"
      style={{
        borderBottom: `1px solid ${pro.border}`,
        opacity: read ? 0.6 : 1,
      }}
      onClick={() => {
        onMarkRead(notif.id);
        onAction(notif);
      }}
    >
      {/* Icon */}
      {type === 'anomaly' && <AnomalyIcon />}
      {type === 'hot_lead' && <HotLeadIcon />}
      {type === 'evolution' && <EvolutionIcon />}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold truncate" style={{ color: pro.text }}>
            {title}
          </p>
          <span className="text-[11px] flex-shrink-0 tabular-nums" style={{ color: pro.textSec }}>
            {timeAgo(notif.date)}
          </span>
        </div>
        <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: pro.textSec }}>
          {subtitle}
        </p>
        {!read && (
          <button
            className="mt-1.5 text-[11.5px] font-medium transition-colors hover:underline"
            style={{ color: pro.accent }}
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notif.id);
              onAction(notif);
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>

      {/* Unread dot */}
      {!read && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ background: pro.accent }}
        />
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function NotifSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse flex items-start gap-3 px-4 py-3.5"
          style={{ borderBottom: `1px solid ${pro.border}` }}
        >
          <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: pro.panel }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-48 rounded" style={{ background: pro.panel }} />
            <div className="h-2.5 w-72 rounded" style={{ background: pro.panel }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Notifications() {
  const navigate = useNavigate();
  const { toasts, add: toast, remove } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsRes, leadsRes, evolutionsRes] = await Promise.allSettled([
        api.get<AgentDashboard>('/ai-agents/dashboard'),
        api.get<ProspectsResponse>('/prospects?status=hot_lead&limit=20'),
        api.get<EvolutionEvent[]>('/ai-agents/strategies?limit=10'),
      ]);

      const notifs: Notification[] = [];

      // Anomalies (unresolved only)
      if (agentsRes.status === 'fulfilled') {
        const anomalies = agentsRes.value.data.anomalies ?? [];
        for (const a of anomalies) {
          if (!a.resolvedAt) {
            notifs.push({
              id: `anomaly-${a.id}`,
              type: 'anomaly',
              date: a.createdAt,
              read: false,
              anomaly: a,
            });
          }
        }
      }

      // Hot leads
      if (leadsRes.status === 'fulfilled') {
        const raw = leadsRes.value.data;
        const leads: HotLead[] = Array.isArray(raw)
          ? (raw as HotLead[])
          : (raw.data ?? raw.prospects ?? []);
        for (const lead of leads) {
          notifs.push({
            id: `lead-${lead.id}`,
            type: 'hot_lead',
            date: lead.lastCallDate ?? lead.createdAt,
            read: false,
            hotLead: lead,
          });
        }
      }

      // Evolution events
      if (evolutionsRes.status === 'fulfilled') {
        const evolutions: EvolutionEvent[] = evolutionsRes.value.data ?? [];
        for (const ev of evolutions) {
          notifs.push({
            id: `evo-${ev.id}`,
            type: 'evolution',
            date: ev.evolvedAt,
            read: false,
            evolution: ev,
          });
        }
      }

      // Sort newest first
      notifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setNotifications(notifs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleAction = useCallback(
    (notif: Notification) => {
      if (notif.type === 'anomaly') navigate('/admin/agents');
      else if (notif.type === 'hot_lead') navigate('/admin/agents/business-plan');
      else if (notif.type === 'evolution') navigate('/admin/agents');
    },
    [navigate]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Split by section
  const anomalyNotifs = notifications.filter((n) => n.type === 'anomaly');
  const leadNotifs = notifications.filter((n) => n.type === 'hot_lead');
  const evolutionNotifs = notifications.filter((n) => n.type === 'evolution');

  return (
    <div className="space-y-6 max-w-[900px]">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <PageHeader
        title="Notifications"
        subtitle="Anomalies, hot leads et évolutions IA"
        right={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <GhostBtn onClick={markAllRead} size="sm">
                Tout marquer lu
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: pro.accent + '22', color: pro.accent }}
                >
                  {unreadCount}
                </span>
              </GhostBtn>
            )}
            <GhostBtn onClick={load} size="sm">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </GhostBtn>
          </div>
        }
      />

      {loading ? (
        <Card>
          <NotifSkeleton />
        </Card>
      ) : notifications.length === 0 ? (
        /* Empty state */
        <Card>
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: `${pro.ok}1A` }}
            >
              <CheckCircle size={28} style={{ color: pro.ok }} />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold" style={{ color: pro.text }}>
                Tout est en ordre
              </p>
              <p className="text-[13px] mt-1" style={{ color: pro.textSec }}>
                Aucune anomalie, aucun hot lead en attente
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Section — Anomalies */}
          {anomalyNotifs.length > 0 && (
            <section>
              <SectionHead
                title={`Anomalies actives (${anomalyNotifs.length})`}
              />
              <Card>
                <div>
                  {anomalyNotifs.map((notif) => (
                    <NotifRow
                      key={notif.id}
                      notif={notif}
                      onMarkRead={markRead}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              </Card>
            </section>
          )}

          {/* Section — Hot Leads */}
          {leadNotifs.length > 0 && (
            <section>
              <SectionHead title={`Hot Leads (${leadNotifs.length})`} />
              <Card>
                <div>
                  {leadNotifs.map((notif) => (
                    <NotifRow
                      key={notif.id}
                      notif={notif}
                      onMarkRead={markRead}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              </Card>
            </section>
          )}

          {/* Section — Evolutions */}
          {evolutionNotifs.length > 0 && (
            <section>
              <SectionHead title={`Évolutions IA (${evolutionNotifs.length})`} />
              <Card>
                <div>
                  {evolutionNotifs.map((notif) => (
                    <NotifRow
                      key={notif.id}
                      notif={notif}
                      onMarkRead={markRead}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
