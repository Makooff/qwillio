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
function scoreColor(s: number) { return s >= 7 ? '#22C55E' : s >= 4 ? '#F59E0B' : '#EF4444'; }

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

  // ── Fetch all live data ──
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
    }, 8000); // poll toutes les 8s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [poll]);

  // ── Start bot avec vérification ──
  const startBot = async () => {
    setBotOp('starting');
    setBotVerified(null);
    try {
      await api.post('/bot/start');
      toast('Démarrage en cours...', 'info');
      // Vérifier après 3s que le bot est bien actif
      await new Promise(r => setTimeout(r, 3000));
      const { data } = await api.get('/bot/status');
      setBot(data);
      if (data.isActive || data.isRunning) {
        setBotVerified(true);
        toast('✓ Bot démarré et vérifié', 'success');
      } else {
        setBotVerified(false);
        toast('⚠ Bot démarré mais statut incertain — vérifiez les logs', 'warning');
      }
    } catch (e: any) {
      setBotVerified(false);
      toast(e?.response?.data?.message ?? 'Erreur démarrage bot', 'error');
    } finally {
      setBotOp(null);
    }
  };

  // ── Stop bot ──
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

  // ── Lancer scraping avec vérification ──
  const startScraping = async () => {
    setScrapeOp('running');
    setScrapeVerified(null);
    try {
      const { data: triggerData } = await api.post('/prospecting/trigger/scrape');
      toast('Scraping démarré en arrière-plan...', 'info');
      // Poll status after 5s to confirm
      await new Promise(r => setTimeout(r, 5000));
      const { data } = await api.get('/prospecting/status');
      setProspecting(data);
      if (triggerData?.status === 'running' || data?.lastScrape || (data?.prospectsFound ?? 0) > 0) {
        setScrapeVerified(true);
        toast('✓ Scraping confirmé — s\'exécute en arrière-plan', 'success');
      } else {
        setScrapeVerified(null);
        toast('Scraping lancé — vérifiez les logs pour les résultats', 'info');
      }
    } catch (e: any) {
      setScrapeVerified(false);
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? 'Erreur lancement scraping';
      toast(msg, 'error');
    } finally {
      setScrapeOp(null);
    }
  };

  // ── Lancer scoring ──
  const runScoring = async () => {
    try {
      await api.post('/bot/run/scoring');
      toast('Scoring lancé', 'success');
      setTimeout(() => poll(true), 3000);
    } catch { toast('Erreur scoring', 'error'); }
  };

  // ── Lancer follow-ups ──
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
          <h1 className="text-xl font-bold text-[#F8F8FF]">Moniteur live</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {connected
              ? <span className="flex items-center gap-1 text-xs text-[#22C55E]"><Wifi className="w-3 h-3" />Connecté · mise à jour auto 8s</span>
              : <span className="flex items-center gap-1 text-xs text-[#EF4444]"><WifiOff className="w-3 h-3" />Déconnecté</span>}
          </div>
        </div>
        <button onClick={() => poll()} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── BOT CONTROL CARD ── */}
      <div className={`rounded-2xl border p-5 transition-all ${
        isActive ? 'bg-[#22C55E]/5 border-[#22C55E]/25' : 'bg-[#12121A] border-white/[0.06]'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              isActive ? 'bg-[#22C55E]/15' : 'bg-white/[0.06]'
            }`}>
              <Activity className={`w-6 h-6 ${isActive ? 'text-[#22C55E]' : 'text-[#8B8BA7]'}`} />
            </div>
            <div>
              <p className="text-base font-bold text-[#F8F8FF]">Bot d'appels Qwillio</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#22C55E] animate-pulse' : 'bg-[#8B8BA7]'}`} />
                <span className={`text-xs font-medium ${isActive ? 'text-[#22C55E]' : 'text-[#8B8BA7]'}`}>
                  {botOp === 'starting' ? 'Démarrage...' : botOp === 'stopping' ? 'Arrêt...' : isActive ? 'ACTIF' : 'ARRÊTÉ'}
                </span>
                {botVerified === true && <span className="text-xs text-[#22C55E] flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />vérifié</span>}
                {botVerified === false && <span className="text-xs text-[#EF4444] flex items-center gap-0.5"><AlertCircle className="w-3 h-3" />problème</span>}
              </div>
            </div>
          </div>

          <button
            onClick={isActive ? stopBot : startBot}
            disabled={!!botOp}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50
              ${isActive
                ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}
          >
            {botOp
              ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : isActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {botOp === 'starting' ? 'Démarrage...' : botOp === 'stopping' ? 'Arrêt...' : isActive ? 'Arrêter' : 'Démarrer'}
          </button>
        </div>

        {/* Quota bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-[#8B8BA7]">Appels aujourd'hui</span>
            <span className="font-semibold text-[#F8F8FF]">{bot?.callsToday ?? 0} / {quota}</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${callsPct}%`, background: callsPct >= 90 ? '#EF4444' : callsPct >= 70 ? '#F59E0B' : '#22C55E' }} />
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
            <div key={f.label} className="bg-black/20 rounded-xl p-2.5">
              <p className="text-[9px] text-[#8B8BA7] uppercase tracking-wide mb-0.5">{f.label}</p>
              <p className="text-[11px] text-[#F8F8FF]">{timeAgo(f.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SCRAPING + ACTIONS RAPIDES ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Scraping card */}
        <div className={`rounded-2xl border p-5 transition-all ${
          scrapeVerified === true ? 'bg-[#7B5CF0]/5 border-[#7B5CF0]/25' :
          scrapeVerified === false ? 'bg-[#EF4444]/5 border-[#EF4444]/20' :
          'bg-[#12121A] border-white/[0.06]'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#7B5CF0]/10 flex items-center justify-center">
                <Search className="w-5 h-5 text-[#7B5CF0]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F8F8FF]">Scraping prospects</p>
                <p className="text-xs text-[#8B8BA7]">
                  {prospecting?.prospectsFound ? `${prospecting.prospectsFound} trouvés` : 'Apify Google Maps'}
                  {prospecting?.lastScrape ? ` · ${timeAgo(prospecting.lastScrape)}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={startScraping}
              disabled={!!scrapeOp}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7B5CF0]/10 border border-[#7B5CF0]/30 text-[#7B5CF0] text-sm font-medium hover:bg-[#7B5CF0]/20 transition-all disabled:opacity-50"
            >
              {scrapeOp ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#7B5CF0] border-t-transparent animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              {scrapeOp ? 'Scraping...' : 'Lancer scraping'}
            </button>
          </div>

          {scrapeVerified !== null && (
            <div className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium ${
              scrapeVerified ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
            }`}>
              {scrapeVerified ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {scrapeVerified
                ? 'Scraping en cours — résultats dans quelques minutes'
                : 'APIFY_API_KEY manquante — ajoutez-la dans Render > Environment'}
            </div>
          )}
          {!scrapeVerified && prospecting && (prospecting as any).apifyConfigured === false && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs bg-[#F59E0B]/10 text-[#F59E0B]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Configurez <code className="font-mono bg-black/20 px-1 rounded">APIFY_API_KEY</code> sur Render pour activer le scraping réel</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { label: 'File d\'attente', value: prospecting?.prospectsQueued ?? '—' },
              { label: 'Tests A/B', value: prospecting?.abTestsActive ?? '—' },
              { label: 'Appels', value: prospecting?.callsToday ?? '—' },
            ].map(s => (
              <div key={s.label} className="bg-black/20 rounded-xl p-2.5 text-center">
                <p className="text-base font-bold text-[#F8F8FF]">{s.value}</p>
                <p className="text-[9px] text-[#8B8BA7] uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions rapides */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <p className="text-sm font-semibold text-[#F8F8FF] mb-4">Actions rapides</p>
          <div className="space-y-2">
            {[
              { label: 'Scorer les prospects', desc: 'Recalculer scores IA', icon: <TrendingUp className="w-4 h-4" />, color: '#22C55E', action: runScoring },
              { label: 'Envoyer follow-ups', desc: 'Traiter relances dues', icon: <Clock className="w-4 h-4" />, color: '#F59E0B', action: runFollowUps },
              {
                label: 'Tentative d\'appel', desc: 'Forcer 1 appel sortant', icon: <Phone className="w-4 h-4" />, color: '#7B5CF0',
                action: async () => {
                  try { await api.post('/bot/trigger/call'); toast('Appel déclenché', 'success'); }
                  catch { toast('Erreur déclenchement appel', 'error'); }
                }
              },
              {
                label: 'Re-scorer prospects', desc: 'Scorer les non-scorés', icon: <RotateCcw className="w-4 h-4" />, color: '#a78bfa',
                action: async () => {
                  try { await api.post('/prospecting/trigger/rescore'); toast('Re-scoring lancé', 'success'); }
                  catch { toast('Erreur re-scoring', 'error'); }
                }
              },
            ].map(a => (
              <button key={a.label} onClick={a.action}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#0D0D15] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.12] text-left transition-all group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: `${a.color}18`, color: a.color }}>
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F8F8FF]">{a.label}</p>
                  <p className="text-[10px] text-[#8B8BA7]">{a.desc}</p>
                </div>
                <Play className="w-3.5 h-3.5 text-[#8B8BA7] opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── HEALTH API ── */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <p className="text-sm font-semibold text-[#F8F8FF] mb-3">Santé système</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Backend API', ok: connected, icon: <Cpu className="w-4 h-4" /> },
            { label: 'Bot engine', ok: bot !== null, icon: <Activity className="w-4 h-4" /> },
            { label: 'Prospects DB', ok: (bot?.prospectsFound ?? 0) >= 0, icon: <Database className="w-4 h-4" /> },
            { label: 'File d\'appels', ok: isActive, icon: <Phone className="w-4 h-4" /> },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
              s.ok ? 'bg-[#22C55E]/5 border-[#22C55E]/20' : 'bg-[#EF4444]/5 border-[#EF4444]/20'
            }`}>
              <span className={s.ok ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{s.icon}</span>
              <div>
                <p className="text-[11px] font-medium text-[#F8F8FF]">{s.label}</p>
                <p className={`text-[9px] ${s.ok ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {s.ok ? 'OK' : 'Problème'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── LIVE ACTIVITY FEED ── */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[#F8F8FF]">Activité en direct</p>
          <span className="flex items-center gap-1.5 text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />LIVE
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-white/[0.06] rounded w-2/3" />
                  <div className="h-2 bg-white/[0.04] rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="w-8 h-8 text-[#8B8BA7] mx-auto mb-3" />
            <p className="text-sm text-[#8B8BA7]">Aucune activité — démarrez le bot</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-hide">
            {activity.slice(0, 20).map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-all">
                <div className="w-9 h-9 rounded-xl bg-[#7B5CF0]/10 flex items-center justify-center flex-shrink-0 text-base">
                  {item.icon ?? '📞'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F8F8FF] truncate">{item.message ?? item.businessName ?? 'Événement'}</p>
                  <p className="text-[10px] text-[#8B8BA7] mt-0.5">{timeAgo(item.date)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.interestScore !== undefined && (
                    <span className="text-xs font-bold" style={{ color: scoreColor(item.interestScore) }}>
                      {item.interestScore}/10
                    </span>
                  )}
                  {item.outcome && (
                    <span className="text-[10px] text-[#8B8BA7]">{item.outcome}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#8B8BA7]">
          <span>Mise à jour toutes les 8s</span>
          <span>{activity.length} événements</span>
        </div>
      </div>
    </div>
  );
}
