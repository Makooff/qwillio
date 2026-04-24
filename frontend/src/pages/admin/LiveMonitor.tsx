import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import {
  Play, Square, Activity, Phone, Search, RefreshCw, Zap, Clock,
  TrendingUp, RotateCcw,
} from 'lucide-react';
import OrbsLoader from '../../components/OrbsLoader';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, PrimaryBtn, GhostBtn, Pill,
} from '../../components/pro/ProBlocks';

type StatusColor = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'accent';

// ─── Types ──────────────────────────────────────────────────────────────────
interface BotStatus {
  isActive: boolean; isRunning: boolean;
  callsToday: number; callsQuotaDaily: number;
  prospectsFound: number; followUpsSent: number;
  lastActivity: string | null; lastCall: string | null;
  lastProspection: string | null; lastRunProspecting: string | null;
  lastRunScoring: string | null; lastRunCalling: string | null;
  lastRunFollowUp: string | null;
  activeCalls?: any[];
  avgCallDuration?: number;
}
interface ProspectingStatus {
  isRunning?: boolean; lastScrape?: string; prospectsQueued?: number;
  prospectsFound?: number; callsToday?: number; abTestsActive?: number;
  apifyConfigured?: boolean;
}
interface ActivityItem {
  icon?: string;
  message?: string;
  businessName?: string;
  date?: string;
  outcome?: string;
  interestScore?: number;
  status?: string;
  duration?: number;
  startedAt?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(d?: string | null) {
  if (!d) return 'Jamais';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); } catch { return '—'; }
}

function fmtDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function scorePillColor(s?: number): StatusColor {
  if (s === undefined) return 'neutral';
  return s >= 7 ? 'ok' : s >= 4 ? 'warn' : 'bad';
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function LiveMonitor() {
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [prospecting, setProspecting] = useState<ProspectingStatus | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [botOp, setBotOp] = useState<'starting' | 'stopping' | null>(null);
  const [scrapeOp, setScrapeOp] = useState<'running' | null>(null);
  const [, setBotVerified] = useState<boolean | null>(null);
  const [, setScrapeVerified] = useState<boolean | null>(null);
  const [now, setNow] = useState(Date.now());
  const { toasts, add: toast, remove } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(0);

  const poll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [b, p, a] = await Promise.all([
        api.get('/bot/status'),
        api.get('/prospecting/status').catch(() => ({ data: null })),
        api.get('/dashboard/activity').catch(() => ({ data: [] })),
      ]);
      setBot(b.data);
      setProspecting(p.data);
      setActivity(Array.isArray(a.data) ? a.data : []);
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(() => {
      tickRef.current += 1;
      poll(true);
    }, 8000);
    // Second-by-second ticker for live duration counters
    tickerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickerRef.current)   clearInterval(tickerRef.current);
    };
  }, [poll]);

  const startBot = async () => {
    setBotOp('starting');
    setBotVerified(null);
    try {
      await api.post('/bot/start');
      toast('Démarrage en cours…', 'info');
      await new Promise(r => setTimeout(r, 3000));
      const { data } = await api.get('/bot/status');
      setBot(data);
      if (data.isActive || data.isRunning) {
        setBotVerified(true);
        toast('Bot démarré et vérifié', 'success');
      } else {
        setBotVerified(false);
        toast('Bot démarré mais statut incertain', 'warning');
      }
    } catch (e: any) {
      setBotVerified(false);
      toast(e?.response?.data?.message ?? 'Erreur démarrage bot', 'error');
    } finally {
      setBotOp(null);
    }
  };

  const stopBot = async () => {
    setBotOp('stopping');
    try {
      await api.post('/bot/stop');
      await new Promise(r => setTimeout(r, 1500));
      const { data } = await api.get('/bot/status');
      setBot(data);
      toast('Bot arrêté', 'success');
    } catch { toast('Erreur arrêt bot', 'error'); }
    finally { setBotOp(null); }
  };

  const startScraping = async () => {
    setScrapeOp('running');
    setScrapeVerified(null);
    try {
      const { data: triggerData } = await api.post('/prospecting/trigger/scrape');
      toast('Scraping démarré en arrière-plan…', 'info');
      await new Promise(r => setTimeout(r, 5000));
      const { data } = await api.get('/prospecting/status');
      setProspecting(data);
      if (triggerData?.status === 'running' || data?.lastScrape || (data?.prospectsFound ?? 0) > 0) {
        setScrapeVerified(true);
        toast('Scraping confirmé', 'success');
      } else {
        setScrapeVerified(null);
        toast('Scraping lancé — vérifiez les logs', 'info');
      }
    } catch (e: any) {
      setScrapeVerified(false);
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? 'Erreur lancement scraping';
      toast(msg, 'error');
    } finally {
      setScrapeOp(null);
    }
  };

  const runScoring = async () => {
    try {
      await api.post('/bot/run/scoring');
      toast('Scoring lancé', 'success');
      setTimeout(() => poll(true), 3000);
    } catch { toast('Erreur scoring', 'error'); }
  };

  const runFollowUps = async () => {
    try {
      await api.post('/prospecting/trigger/follow-ups');
      toast('Follow-ups lancés', 'success');
    } catch { toast('Erreur follow-ups', 'error'); }
  };

  const runCall = async () => {
    try { await api.post('/bot/trigger/call'); toast('Appel déclenché', 'success'); }
    catch { toast('Erreur déclenchement appel', 'error'); }
  };

  const runRescore = async () => {
    try { await api.post('/prospecting/trigger/rescore'); toast('Re-scoring lancé', 'success'); }
    catch { toast('Erreur re-scoring', 'error'); }
  };

  const isActive    = !!(bot?.isActive || bot?.isRunning);
  const quota       = bot?.callsQuotaDaily ?? 50;
  const callsToday  = bot?.callsToday ?? 0;
  const quotaPct    = Math.min(Math.round((callsToday / quota) * 100), 100);
  const avgDuration = bot?.avgCallDuration ?? 0;

  // Active calls derived from activity feed (items tagged as in-progress)
  const activeCalls: ActivityItem[] = (bot?.activeCalls && Array.isArray(bot.activeCalls) && bot.activeCalls.length)
    ? bot.activeCalls
    : activity.filter(a => a.status === 'in_progress' || a.status === 'ringing' || a.status === 'active');

  const callsInProgress = activeCalls.length;

  const statusPill = (s?: string): { color: StatusColor; label: string } => {
    switch ((s || '').toLowerCase()) {
      case 'in_progress':
      case 'active':       return { color: 'ok',   label: 'En cours' };
      case 'ringing':      return { color: 'info', label: 'Sonne' };
      case 'completed':    return { color: 'neutral', label: 'Terminé' };
      case 'failed':       return { color: 'bad',  label: 'Échec' };
      case 'no_answer':    return { color: 'warn', label: 'Pas de réponse' };
      default:             return { color: 'neutral', label: s || '—' };
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Moniteur live"
        subtitle={
          connected
            ? 'Connecté · mise à jour auto toutes les 8s'
            : 'Connexion interrompue — les données peuvent être obsolètes'
        }
        right={
          <>
            {isActive
              ? <GhostBtn size="sm" onClick={stopBot} disabled={!!botOp}>
                  {botOp === 'stopping' ? '…' : (<><Square className="w-3 h-3" /> Arrêter</>)}
                </GhostBtn>
              : <PrimaryBtn size="sm" onClick={startBot} disabled={!!botOp}>
                  {botOp === 'starting' ? '…' : (<><Play className="w-3 h-3" /> Démarrer</>)}
                </PrimaryBtn>}
            <IconBtn onClick={() => poll()} title="Rafraîchir">
              <RefreshCw className="w-4 h-4" />
            </IconBtn>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={Activity}
          label="Appels en cours"
          value={callsInProgress}
          hint={isActive ? 'Bot actif' : 'Bot en pause'}
        />
        <Stat
          icon={Phone}
          label="Appels aujourd'hui"
          value={callsToday}
          hint={`Quota : ${quota}`}
        />
        <Stat
          icon={Clock}
          label="Durée moyenne"
          value={fmtDuration(avgDuration)}
          hint="Par appel complété"
        />
        <Stat
          icon={TrendingUp}
          label="Quota utilisé"
          value={`${quotaPct}%`}
          hint={`${callsToday}/${quota}`}
        />
      </div>

      {/* Bot status */}
      <section>
        <SectionHead title="Bot d'appels" />
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Activity size={18} style={{ color: pro.text }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: isActive ? pro.ok : pro.textTer,
                      animation: isActive ? 'qwPulse 1.4s ease infinite' : undefined,
                    }}
                  />
                  <span className="text-[13px] font-semibold" style={{ color: pro.text }}>
                    {botOp === 'starting' ? 'Démarrage…' : botOp === 'stopping' ? 'Arrêt…' : isActive ? 'Bot actif' : 'Bot en pause'}
                  </span>
                </div>
                <p className="text-[11.5px]" style={{ color: pro.textSec }}>
                  Dernière activité {timeAgo(bot?.lastActivity)}
                </p>
              </div>
              <Pill color={connected ? 'ok' : 'bad'}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </Pill>
            </div>

            {/* Quota bar */}
            <div>
              <div className="flex justify-between text-[11.5px] mb-1.5">
                <span style={{ color: pro.textSec }}>Appels aujourd'hui</span>
                <span className="tabular-nums" style={{ color: pro.text }}>{callsToday} / {quota}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full transition-all"
                     style={{
                       width: `${quotaPct}%`,
                       background: quotaPct >= 90 ? pro.bad : quotaPct >= 70 ? pro.warn : pro.accent,
                     }} />
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Active calls */}
      <section>
        <SectionHead
          title="Appels actifs"
          action={
            <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ color: pro.textSec }}>
              <span className="w-1.5 h-1.5 rounded-full"
                    style={{ background: pro.ok, animation: 'qwPulse 1.4s ease infinite' }} />
              Temps réel
            </span>
          }
        />
        <Card>
          {activeCalls.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: pro.textTer }} />
              <p className="text-[13px]" style={{ color: pro.textSec }}>
                Aucun appel en cours
              </p>
            </div>
          ) : (
            activeCalls.slice(0, 10).map((call, i) => {
              const startedMs = call.startedAt ? new Date(call.startedAt).getTime() : null;
              const duration  = startedMs ? Math.max(0, Math.floor((now - startedMs) / 1000)) : (call.duration ?? 0);
              const s = statusPill(call.status);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3.5 px-4 h-[58px]"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 relative"
                       style={{ background: 'rgba(34,197,94,0.08)' }}>
                    <Phone size={14} style={{ color: pro.ok }} />
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                      style={{ background: pro.ok, animation: 'qwPulse 1.2s ease infinite' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                      {call.businessName ?? call.message ?? 'Appel en cours'}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                      {call.outcome ?? 'Conversation en direct'}
                    </p>
                  </div>
                  <span className="text-[12px] font-medium tabular-nums" style={{ color: pro.text }}>
                    {fmtDuration(duration)}
                  </span>
                  <Pill color={s.color}>{s.label}</Pill>
                </div>
              );
            })
          )}
        </Card>
      </section>

      {/* Scraping control */}
      <section>
        <SectionHead title="Scraping prospects" />
        <Card>
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Search size={18} style={{ color: pro.text }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: pro.text }}>
                Apify · Google Maps
              </p>
              <p className="text-[11.5px]" style={{ color: pro.textSec }}>
                {prospecting?.prospectsFound ? `${prospecting.prospectsFound} prospects trouvés` : 'Aucun prospect récent'}
                {prospecting?.lastScrape ? ` · ${timeAgo(prospecting.lastScrape)}` : ''}
              </p>
            </div>
            {prospecting?.apifyConfigured === false && (
              <Pill color="warn">Clé manquante</Pill>
            )}
            <GhostBtn size="sm" onClick={startScraping} disabled={!!scrapeOp}>
              {scrapeOp ? '…' : (<><Zap className="w-3 h-3" /> Lancer</>)}
            </GhostBtn>
          </div>
        </Card>
      </section>

      {/* Quick actions */}
      <section>
        <SectionHead title="Actions rapides" />
        <Card>
          {[
            { label: 'Scorer les prospects', desc: 'Recalculer scores IA',     icon: TrendingUp, onClick: runScoring },
            { label: 'Envoyer follow-ups',   desc: 'Traiter relances dues',    icon: Clock,      onClick: runFollowUps },
            { label: "Tentative d'appel",    desc: 'Forcer 1 appel sortant',   icon: Phone,      onClick: runCall },
            { label: 'Re-scorer prospects',  desc: 'Scorer les non-scorés',    icon: RotateCcw,  onClick: runRescore },
          ].map((a, i) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={a.onClick}
                className="w-full flex items-center gap-3.5 px-4 h-[58px] text-left transition-colors hover:bg-white/[0.02]"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Icon size={14} style={{ color: pro.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>{a.label}</p>
                  <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>{a.desc}</p>
                </div>
                <Play size={12} style={{ color: pro.textTer }} />
              </button>
            );
          })}
        </Card>
      </section>

      {/* Activity feed */}
      <section>
        <SectionHead title="Activité en direct" />
        <Card>
          {activity.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: pro.textTer }} />
              <p className="text-[13px]" style={{ color: pro.textSec }}>
                Aucune activité — démarrez le bot
              </p>
            </div>
          ) : (
            activity.slice(0, 20).map((item, i) => {
              const scoreColor = scorePillColor(item.interestScore);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3.5 px-4 py-3"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Phone size={14} style={{ color: pro.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                      {item.message ?? item.businessName ?? 'Événement'}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                      {timeAgo(item.date)}{item.outcome ? ` · ${item.outcome}` : ''}
                    </p>
                  </div>
                  {item.interestScore !== undefined && (
                    <Pill color={scoreColor}>{item.interestScore}/10</Pill>
                  )}
                </div>
              );
            })
          )}
        </Card>
      </section>

      <style>{`@keyframes qwPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
    </div>
  );
}
