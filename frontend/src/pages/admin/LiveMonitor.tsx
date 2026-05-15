import { useEffect, useState, useCallback, useRef } from 'react';
import {
  RefreshCw, Phone, Search, Mail, MessageSquare, Play, Square,
  Activity, RotateCcw, ShieldCheck, type LucideIcon,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, PrimaryBtn, GhostBtn, Pill,
} from '../../components/pro/ProBlocks';

// ─── Types ───────────────────────────────────────────────────────────────────

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'accent';

interface BotStatus {
  isActive: boolean;
  callsToday: number;
  callsQuotaDaily: number;
  lastCall?: string;
  lastProspection?: string;
  activeCalls?: unknown[];
}

interface ProspectingStatus {
  totalProspects: number;
  eligibleProspects: number;
  pendingFollowUps: number;
  abTestsActive: number;
  callsToday: number;
  lastScrape?: string;
}

interface ActivityItem {
  icon?: string;
  message: string;
  date: string;
  outcome?: string;
}

interface HourBin {
  hour: number;
  calls: number;
}

type ActionKey = 'scrape' | 'call' | 'follow-ups' | 'rescore' | 'validate';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso?: string | null) {
  if (!iso) return 'Jamais';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr }); } catch { return '—'; }
}

function fmtDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function activityIcon(item: ActivityItem) {
  const t = (item.icon ?? item.message ?? '').toLowerCase();
  if (t.includes('appel') || t.includes('call') || t.includes('phone')) return Phone;
  if (t.includes('scrap') || t.includes('search') || t.includes('prospect')) return Search;
  if (t.includes('email') || t.includes('mail')) return Mail;
  if (t.includes('sms') || t.includes('message')) return MessageSquare;
  return Activity;
}

function outcomeColor(outcome?: string): PillColor {
  if (!outcome) return 'neutral';
  const o = outcome.toLowerCase();
  if (o.includes('intéressé') || o.includes('success') || o.includes('lead')) return 'ok';
  if (o.includes('rappel') || o.includes('pending')) return 'warn';
  if (o.includes('refus') || o.includes('fail') || o.includes('no answer')) return 'bad';
  return 'neutral';
}

/** Build 24 hourly bins from activity data or return mock zeros */
function buildHourBins(activity: ActivityItem[]): HourBin[] {
  const bins: HourBin[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, calls: 0 }));
  const today = new Date().toDateString();
  for (const item of activity) {
    const d = new Date(item.date);
    if (d.toDateString() === today) {
      bins[d.getHours()].calls += 1;
    }
  }
  return bins;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LiveMonitor() {
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [prospecting, setProspecting] = useState<ProspectingStatus | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [botOp, setBotOp] = useState<'starting' | 'stopping' | null>(null);
  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);
  const [now, setNow] = useState(Date.now());
  const { toasts, add: toast, remove } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [b, p, a] = await Promise.all([
        api.get('/bot/status'),
        api.get('/prospecting/status').catch(() => ({ data: null })),
        api.get('/bot/activity').catch(() => ({ data: [] })),
      ]);
      setBot(b.data as BotStatus);
      setProspecting(p.data as ProspectingStatus | null);
      const raw = a.data;
      setActivity(Array.isArray(raw) ? (raw as ActivityItem[]) : []);
    } catch {
      // stay with stale data
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(() => poll(true), 10000);
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [poll]);

  const toggleBot = async () => {
    const isActive = !!(bot?.isActive);
    setBotOp(isActive ? 'stopping' : 'starting');
    try {
      await api.patch('/bot/status', { active: !isActive });
      toast(isActive ? 'Bot arrêté' : 'Bot démarré', 'success');
      await poll(true);
    } catch {
      toast('Erreur changement statut bot', 'error');
    } finally {
      setBotOp(null);
    }
  };

  const runAction = async (key: ActionKey, path: string, label: string) => {
    setActionLoading(key);
    try {
      await api.post(path);
      toast(`${label} lancé`, 'success');
    } catch {
      toast(`Erreur: ${label}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const isActive = !!(bot?.isActive);
  const callsToday = bot?.callsToday ?? 0;
  const quota = bot?.callsQuotaDaily ?? 50;
  const quotaPct = Math.min(Math.round((callsToday / Math.max(quota, 1)) * 100), 100);
  const quotaRemaining = Math.max(0, quota - callsToday);

  const activeCalls = (bot?.activeCalls && Array.isArray(bot.activeCalls))
    ? (bot.activeCalls as ActivityItem[])
    : [];

  const hourBins = buildHourBins(activity);

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Live Monitor"
        subtitle="Surveillance temps réel du moteur IA"
        right={
          <div className="flex items-center gap-3">
            {/* Auto-refresh indicator */}
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: pro.ok,
                  animation: 'lmPulse 2s ease infinite',
                }}
              />
              <span className="text-[11.5px]" style={{ color: pro.textSec }}>
                Auto-refresh
              </span>
            </div>
            <IconBtn onClick={() => poll()} title="Rafraîchir">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </IconBtn>
          </div>
        }
      />

      {/* ── STATUS HERO ── */}
      <Card>
        <div className="p-6">
          {/* Big status badge */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="text-2xl font-bold mb-1 px-6 py-2 rounded-xl"
              style={{
                background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: isActive ? pro.ok : pro.bad,
              }}
            >
              {isActive ? '🟢 ACTIF' : '🔴 INACTIF'}
            </div>
            <p className="text-[12px]" style={{ color: pro.textSec }}>
              {botOp === 'starting' ? 'Démarrage en cours…'
                : botOp === 'stopping' ? 'Arrêt en cours…'
                : isActive ? `Dernière prospection ${timeAgo(bot?.lastProspection)}`
                : 'Bot en pause'}
            </p>
          </div>

          {/* 3 key numbers */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums" style={{ color: pro.text }}>{callsToday}</p>
              <p className="text-[11px] mt-0.5" style={{ color: pro.textSec }}>Appels aujourd'hui</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums" style={{ color: pro.text }}>{quotaRemaining}</p>
              <p className="text-[11px] mt-0.5" style={{ color: pro.textSec }}>Quota restant</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums" style={{ color: pro.text }}>
                {activeCalls.length}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: pro.textSec }}>Appels actifs</p>
            </div>
          </div>

          {/* Quota bar */}
          <div className="mb-6">
            <div className="flex justify-between text-[11.5px] mb-2">
              <span style={{ color: pro.textSec }}>Utilisation quota</span>
              <span className="tabular-nums font-semibold" style={{ color: pro.text }}>
                {callsToday} / {quota}
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${quotaPct}%`,
                  background: quotaPct >= 90 ? pro.bad : quotaPct >= 70 ? pro.warn : pro.accent,
                }}
              />
            </div>
            <p className="text-[10.5px] mt-1 text-right" style={{ color: pro.textTer }}>
              {quotaPct}% utilisé
            </p>
          </div>

          {/* Start/Stop */}
          <div className="flex justify-center">
            {isActive ? (
              <GhostBtn onClick={toggleBot} disabled={!!botOp}>
                <Square className="w-4 h-4" />
                {botOp === 'stopping' ? 'Arrêt…' : 'Arrêter le bot'}
              </GhostBtn>
            ) : (
              <PrimaryBtn onClick={toggleBot} disabled={!!botOp}>
                <Play className="w-4 h-4" />
                {botOp === 'starting' ? 'Démarrage…' : 'Démarrer le bot'}
              </PrimaryBtn>
            )}
          </div>
        </div>
      </Card>

      {/* ── STATS GRID (6 cards) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat
          label="Prospects trouvés"
          value={prospecting?.totalProspects ?? '—'}
          hint="Total en base"
        />
        <Stat
          label="Éligibles"
          value={prospecting?.eligibleProspects ?? '—'}
          hint="eligibleForCall=true"
        />
        <Stat
          label="Follow-ups"
          value={prospecting?.pendingFollowUps ?? '—'}
          hint="En attente"
        />
        <Stat
          label="A/B tests"
          value={prospecting?.abTestsActive ?? '—'}
          hint="Actifs"
        />
        <Stat
          label="Dernière prosp."
          value={timeAgo(bot?.lastProspection)}
          hint="Scraping"
        />
        <Stat
          label="Dernier appel"
          value={timeAgo(bot?.lastCall)}
          hint="Sortant"
        />
      </div>

      {/* ── CALLS PER HOUR CHART ── */}
      <section>
        <SectionHead title="Distribution des appels (aujourd'hui)" />
        <Card>
          <div className="p-4" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourBins} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(v: number) => `${v}h`}
                  tick={{ fontSize: 10, fill: pro.textTer }}
                  axisLine={false}
                  tickLine={false}
                  interval={3}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: pro.textTer }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: pro.panel, border: `1px solid ${pro.border}`, borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v: number) => `${v}h00`}
                  formatter={(v: number) => [`${v} appel${v !== 1 ? 's' : ''}`, '']}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="calls" fill={pro.accent} radius={[3, 3, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* ── ACTIVE CALLS ── */}
      {activeCalls.length > 0 && (
        <section>
          <SectionHead
            title="Appels en cours"
            action={
              <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{ color: pro.textSec }}>
                <span className="w-1.5 h-1.5 rounded-full"
                      style={{ background: pro.ok, animation: 'lmPulse 1.4s ease infinite' }} />
                Live
              </span>
            }
          />
          <Card>
            {activeCalls.map((call, i) => {
              const startedMs = call.date ? new Date(call.date).getTime() : null;
              const duration = startedMs ? Math.max(0, Math.floor((now - startedMs) / 1000)) : 0;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3.5 px-4 h-[58px]"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(34,197,94,0.08)' }}
                  >
                    <Phone size={14} style={{ color: pro.ok }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                      {call.message || 'Appel en cours'}
                    </p>
                    <p className="text-[11.5px]" style={{ color: pro.textTer }}>
                      {fmtDuration(duration)}
                    </p>
                  </div>
                  <Pill color="ok">En cours</Pill>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {/* ── ACTIVITY FEED ── */}
      <section>
        <SectionHead title="Activité récente" />
        <Card>
          {activity.length === 0 ? (
            <div className="p-12 text-center" style={{ color: pro.textTer }}>
              <Activity className="w-8 h-8 mx-auto mb-3" />
              <p className="text-[13px]">Aucune activité — démarrez le bot</p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {activity.slice(0, 20).map((item, i) => {
                const Icon = activityIcon(item);
                const oc = item.outcome;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3.5 px-4 py-3"
                    style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      <Icon size={14} style={{ color: pro.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] truncate" style={{ color: pro.text }}>
                        {item.message}
                      </p>
                      <p className="text-[11.5px]" style={{ color: pro.textTer }}>
                        {timeAgo(item.date)}
                      </p>
                    </div>
                    {oc && <Pill color={outcomeColor(oc)}>{oc}</Pill>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      {/* ── QUICK ACTIONS ── */}
      <section>
        <SectionHead title="Actions rapides" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {([
            { key: 'scrape'     as ActionKey, label: 'Lancer scraping',     icon: Search,      path: '/prospecting/trigger/scrape' },
            { key: 'call'       as ActionKey, label: 'Déclencher appel',    icon: Phone,       path: '/prospecting/trigger/call' },
            { key: 'follow-ups' as ActionKey, label: 'Traiter follow-ups',  icon: Mail,        path: '/prospecting/trigger/follow-ups' },
            { key: 'rescore'    as ActionKey, label: 'Rescorer',            icon: RotateCcw,   path: '/prospecting/trigger/rescore' },
            { key: 'validate'   as ActionKey, label: 'Valider téléphones',  icon: ShieldCheck, path: '/bot/trigger/validate' },
          ] as { key: ActionKey; label: string; icon: LucideIcon; path: string }[]).map(({ key, label, icon: Icon, path }) => {
            const isLoading = actionLoading === key;
            return (
              <button
                key={key}
                onClick={() => runAction(key, path, label)}
                disabled={actionLoading !== null}
                className="flex flex-col items-center gap-2.5 p-4 rounded-xl text-center transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${pro.border}`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(123,92,240,0.15)' }}
                >
                  {isLoading
                    ? <RefreshCw size={16} style={{ color: pro.accent }} className="animate-spin" />
                    : <Icon size={16} style={{ color: pro.accent }} />}
                </div>
                <span className="text-[12px] font-medium leading-tight" style={{ color: pro.text }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <style>{`
        @keyframes lmPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}
