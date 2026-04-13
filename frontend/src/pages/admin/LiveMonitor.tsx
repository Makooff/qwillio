import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import {
  Play, Square, Activity, Phone, Search, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, Zap, Clock, TrendingUp, Wifi, WifiOff,
  Users, Database, Cpu, RotateCcw,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { t, glass } from '../../styles/admin-theme';

// ─── Types ──────────────────────────────────────────────────────────────────
interface BotStatus {
  isActive: boolean; isRunning: boolean;
  callsToday: number; callsQuotaDaily: number;
  prospectsFound: number; followUpsSent: number;
  lastActivity: string | null; lastCall: string | null;
  lastProspection: string | null; lastRunProspecting: string | null;
  lastRunScoring: string | null; lastRunCalling: string | null;
  lastRunFollowUp: string | null;
}
interface ProspectingStatus {
  isRunning?: boolean; lastScrape?: string; prospectsQueued?: number;
  prospectsFound?: number; callsToday?: number; abTestsActive?: number;
}
interface ActivityItem { icon?: string; message?: string; businessName?: string; date?: string; outcome?: string; interestScore?: number; }

// ─── Helper ──────────────────────────────────────────────────────────────────
function timeAgo(d?: string | null) {
  if (!d) return 'Jamais';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); } catch { return '—'; }
}
function scoreColor(s: number) { return s >= 7 ? t.success : s >= 4 ? t.warning : t.danger; }

// ─── Component ───────────────────────────────────────────────────────────────
export default function LiveMonitor() {
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [prospecting, setProspecting] = useState<ProspectingStatus | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [botOp, setBotOp] = useState<'starting' | 'stopping' | null>(null);
  const [scrapeOp, setScrapeOp] = useState<'running' | null>(null);
  const [botVerified, setBotVerified] = useState<boolean | null>(null);
  const [scrapeVerified, setScrapeVerified] = useState<boolean | null>(null);
  const { toasts, add: toast, remove } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [poll]);

  const startBot = async () => {
    setBotOp('starting');
    setBotVerified(null);
    try {
      await api.post('/bot/start');
      toast('Démarrage en cours...', 'info');
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
      toast('Scraping démarré en arrière-plan...', 'info');
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

  const isActive = bot?.isActive || bot?.isRunning;
  const quota = bot?.callsQuotaDaily ?? 50;
  const callsPct = Math.min(((bot?.callsToday ?? 0) / quota) * 100, 100);

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Moniteur live</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {connected
              ? <span className="flex items-center gap-1 text-xs" style={{ color: t.live }}><Wifi className="w-3 h-3" />Connecté · mise à jour auto 8s</span>
              : <span className="flex items-center gap-1 text-xs" style={{ color: t.danger }}><WifiOff className="w-3 h-3" />Déconnecté</span>}
          </div>
        </div>
        <button onClick={() => poll()} className="p-2 rounded-xl hover:bg-white/[0.08] transition-all" style={{ background: t.elevated, color: t.textSec }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* BOT CONTROL CARD */}
      <div className="p-5 transition-all" style={{ ...glass, border: isActive ? `1px solid ${t.borderHi}` : glass.border }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)' }}>
              <Activity className="w-6 h-6" style={{ color: isActive ? t.live : t.textSec }} />
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: t.text }}>Bot d'appels Qwillio</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? t.live : t.textSec, animation: isActive ? 'pulse 2s infinite' : 'none' }} />
                <span className="text-xs font-medium" style={{ color: isActive ? t.live : t.textSec }}>
                  {botOp === 'starting' ? 'Démarrage...' : botOp === 'stopping' ? 'Arrêt...' : isActive ? 'ACTIF' : 'ARRÊTÉ'}
                </span>
                {botVerified === true && <span className="text-xs flex items-center gap-0.5" style={{ color: t.success }}><CheckCircle2 className="w-3 h-3" />vérifié</span>}
                {botVerified === false && <span className="text-xs flex items-center gap-0.5" style={{ color: t.danger }}><AlertCircle className="w-3 h-3" />problème</span>}
              </div>
            </div>
          </div>

          <button
            onClick={isActive ? stopBot : startBot}
            disabled={!!botOp}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50"
            style={isActive
              ? { background: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.3)', color: t.danger }
              : { background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)', color: t.live }}>
            {botOp
              ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : isActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {botOp === 'starting' ? 'Démarrage...' : botOp === 'stopping' ? 'Arrêt...' : isActive ? 'Arrêter' : 'Démarrer'}
          </button>
        </div>

        {/* Quota bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span style={{ color: t.textSec }}>Appels aujourd'hui</span>
            <span className="font-semibold" style={{ color: t.text }}>{bot?.callsToday ?? 0} / {quota}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${callsPct}%`, background: callsPct >= 90 ? t.danger : callsPct >= 70 ? t.warning : 'rgba(255,255,255,0.25)' }} />
          </div>
        </div>

        {/* Last run times */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Dernière activité', value: bot?.lastActivity },
            { label: 'Dernier appel', value: bot?.lastCall ?? bot?.lastRunCalling },
            { label: 'Dernière prospection', value: bot?.lastProspection ?? bot?.lastRunProspecting },
            { label: 'Dernier suivi', value: bot?.lastRunFollowUp },
          ].map(f => (
            <div key={f.label} className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <p className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: t.textSec }}>{f.label}</p>
              <p className="text-[11px]" style={{ color: t.text }}>{timeAgo(f.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SCRAPING + ACTIONS RAPIDES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Scraping card */}
        <div className="p-5 transition-all" style={{
          ...glass,
          background: scrapeVerified === false ? 'rgba(248,113,113,0.05)' : glass.background,
          border: scrapeVerified === false ? `1px solid rgba(248,113,113,0.2)` : glass.border,
        }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <Search className="w-5 h-5" style={{ color: t.textSec }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: t.text }}>Scraping prospects</p>
                <p className="text-xs" style={{ color: t.textSec }}>
                  {prospecting?.prospectsFound ? `${prospecting.prospectsFound} trouvés` : 'Apify Google Maps'}
                  {prospecting?.lastScrape ? ` · ${timeAgo(prospecting.lastScrape)}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={startScraping}
              disabled={!!scrapeOp}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.border}`, color: t.textSec }}>
              {scrapeOp ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              {scrapeOp ? 'Scraping...' : 'Lancer scraping'}
            </button>
          </div>

          {scrapeVerified !== null && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium"
              style={{
                background: scrapeVerified ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                color: scrapeVerified ? t.success : t.danger,
              }}>
              {scrapeVerified ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {scrapeVerified
                ? 'Scraping en cours — résultats dans quelques minutes'
                : 'APIFY_API_KEY manquante — ajoutez-la dans Render > Environment'}
            </div>
          )}
          {!scrapeVerified && prospecting && (prospecting as any).apifyConfigured === false && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(251,191,36,0.1)', color: t.warning }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Configurez <code className="font-mono px-1 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>APIFY_API_KEY</code> sur Render pour activer le scraping réel</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { label: 'File d\'attente', value: prospecting?.prospectsQueued ?? '—' },
              { label: 'Tests A/B', value: prospecting?.abTestsActive ?? '—' },
              { label: 'Appels', value: prospecting?.callsToday ?? '—' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <p className="text-base font-bold" style={{ color: t.text }}>{s.value}</p>
                <p className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: t.textSec }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions rapides */}
        <div className="p-5" style={glass}>
          <p className="text-sm font-semibold mb-4" style={{ color: t.text }}>Actions rapides</p>
          <div className="space-y-2">
            {[
              { label: 'Scorer les prospects', desc: 'Recalculer scores IA', icon: <TrendingUp className="w-4 h-4" />, action: runScoring },
              { label: 'Envoyer follow-ups', desc: 'Traiter relances dues', icon: <Clock className="w-4 h-4" />, action: runFollowUps },
              {
                label: 'Tentative d\'appel', desc: 'Forcer 1 appel sortant', icon: <Phone className="w-4 h-4" />,
                action: async () => {
                  try { await api.post('/bot/trigger/call'); toast('Appel déclenché', 'success'); }
                  catch { toast('Erreur déclenchement appel', 'error'); }
                }
              },
              {
                label: 'Re-scorer prospects', desc: 'Scorer les non-scorés', icon: <RotateCcw className="w-4 h-4" />,
                action: async () => {
                  try { await api.post('/prospecting/trigger/rescore'); toast('Re-scoring lancé', 'success'); }
                  catch { toast('Erreur re-scoring', 'error'); }
                }
              },
            ].map(a => (
              <button key={a.label} onClick={a.action}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all group hover:bg-white/[0.04]"
                style={{ background: t.inset, border: `1px solid ${t.border}` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)', color: t.textSec }}>
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: t.text }}>{a.label}</p>
                  <p className="text-[10px]" style={{ color: t.textSec }}>{a.desc}</p>
                </div>
                <Play className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: t.textSec }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* HEALTH API */}
      <div className="p-5" style={glass}>
        <p className="text-sm font-semibold mb-3" style={{ color: t.text }}>Santé système</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Backend API', ok: connected, icon: <Cpu className="w-4 h-4" /> },
            { label: 'Bot engine', ok: bot !== null, icon: <Activity className="w-4 h-4" /> },
            { label: 'Prospects DB', ok: (bot?.prospectsFound ?? 0) >= 0, icon: <Database className="w-4 h-4" /> },
            { label: 'File d\'appels', ok: isActive, icon: <Phone className="w-4 h-4" /> },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2.5 p-3 rounded-xl transition-all"
              style={{ ...glass, background: s.ok ? 'rgba(52,211,153,0.05)' : 'rgba(248,113,113,0.05)' }}>
              <span style={{ color: s.ok ? t.success : t.danger }}>{s.icon}</span>
              <div>
                <p className="text-[11px] font-medium" style={{ color: t.text }}>{s.label}</p>
                <p className="text-[9px]" style={{ color: s.ok ? t.success : t.danger }}>
                  {s.ok ? 'OK' : 'Problème'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LIVE ACTIVITY FEED */}
      <div className="p-5" style={glass}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold" style={{ color: t.text }}>Activité en direct</p>
          <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full"
            style={{ color: t.live, background: 'rgba(34,197,94,0.1)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: t.live }} />LIVE
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded w-2/3" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="h-2 rounded w-1/3" style={{ background: 'rgba(255,255,255,0.04)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: t.textSec }} />
            <p className="text-sm" style={{ color: t.textSec }}>Aucune activité — démarrez le bot</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-hide">
            {activity.slice(0, 20).map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-all">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {item.icon ?? '📞'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: t.text }}>{item.message ?? item.businessName ?? 'Événement'}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: t.textSec }}>{timeAgo(item.date)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.interestScore !== undefined && (
                    <span className="text-xs font-bold" style={{ color: scoreColor(item.interestScore) }}>
                      {item.interestScore}/10
                    </span>
                  )}
                  {item.outcome && (
                    <span className="text-[10px]" style={{ color: t.textSec }}>{item.outcome}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 flex items-center justify-between text-xs" style={{ borderTop: `1px solid ${t.border}`, color: t.textSec }}>
          <span>Mise à jour toutes les 8s</span>
          <span>{activity.length} événements</span>
        </div>
      </div>
    </div>
  );
}
