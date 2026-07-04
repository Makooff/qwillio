import { useEffect, useState } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Play, Square, Cpu, Database, Mail, Phone, CreditCard,
  MessageSquare, Activity, CheckCircle2, XCircle, Clock, Zap, Search, Shield
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { t, glass } from '../../styles/admin-theme';

const CRON_JOBS = [
  { id: 'prospecting', label: 'Prospection', desc: 'Scraping + enrichissement' },
  { id: 'scoring', label: 'Scoring', desc: 'Re-score prospects' },
  { id: 'calling', label: 'Appels', desc: 'Cycle appels sortants' },
  { id: 'followup', label: 'Suivis', desc: 'Envoi séquences relance' },
  { id: 'prospection', label: 'Prospection bot', desc: 'Démarrer prospection immédiate' },
  { id: 'call', label: 'Appel manuel', desc: 'Tenter 1 appel' },
  { id: 'niche-learning', label: 'Apprentissage niche', desc: 'Analyse patterns niche' },
  { id: 'ab-analysis', label: 'A/B analyse', desc: 'Analyser tests A/B' },
  { id: 'best-time', label: 'Meilleurs horaires', desc: 'Calcul horaires optimaux' },
  { id: 'script-learning', label: 'Script learning', desc: 'Optimiser scripts' },
  { id: 'follow-ups', label: 'Follow-ups engine', desc: 'Traiter follow-ups dus' },
  { id: 'rescore', label: 'Re-scoring', desc: 'Rescorer prospects non scorés' },
];

const API_SERVICES = [
  { key: 'vapi',     label: 'VAPI',     icon: <Phone className="w-4 h-4" /> },
  { key: 'openai',   label: 'OpenAI',   icon: <Cpu className="w-4 h-4" /> },
  { key: 'stripe',   label: 'Stripe',   icon: <CreditCard className="w-4 h-4" /> },
  { key: 'resend',   label: 'Resend',   icon: <Mail className="w-4 h-4" /> },
  { key: 'database', label: 'Database', icon: <Database className="w-4 h-4" /> },
  { key: 'discord',  label: 'Discord',  icon: <MessageSquare className="w-4 h-4" /> },
  { key: 'twilio',   label: 'Twilio',   icon: <Shield className="w-4 h-4" /> },
  { key: 'apify',    label: 'Apify',    icon: <Search className="w-4 h-4" /> },
];

export default function AdminSystem() {
  const [bot, setBot] = useState<any>(null);
  const [envVars, setEnvVars] = useState<Record<string, boolean | string>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: botData }, { data: health }] = await Promise.all([
        api.get('/bot/status'),
        api.get('/bot/health').catch(() => ({ data: {} })),
      ]);
      setBot(botData);
      setEnvVars(health ?? {});
    } catch { toast('Erreur chargement statut', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleBot = async () => {
    setToggling(true);
    try {
      if (bot?.isActive) { await api.post('/bot/stop'); toast('Bot arrêté', 'success'); }
      else { await api.post('/bot/start'); toast('Bot démarré', 'success'); }
      const { data } = await api.get('/bot/status');
      setBot(data);
    } catch { toast('Erreur contrôle bot', 'error'); }
    finally { setToggling(false); }
  };

  const trigger = async (id: string) => {
    setTriggering(id);
    try {
      // Map to appropriate endpoint
      const runMap: Record<string, string> = {
        prospecting: '/bot/run/prospecting', scoring: '/bot/run/scoring',
        calling: '/bot/run/calling', followup: '/bot/run/followup',
      };
      const triggerMap: Record<string, string> = {
        prospection: '/bot/trigger/prospection', call: '/bot/trigger/call',
        'niche-learning': '/bot/trigger/niche-learning',
        reminders: '/bot/trigger/reminders',
      };
      const prospectingMap: Record<string, string> = {
        'ab-analysis': '/prospecting/trigger/ab-analysis',
        'best-time': '/prospecting/trigger/best-time',
        'script-learning': '/prospecting/trigger/script-learning',
        'follow-ups': '/prospecting/trigger/follow-ups',
        rescore: '/prospecting/trigger/rescore',
      };
      const endpoint = runMap[id] ?? triggerMap[id] ?? prospectingMap[id];
      if (endpoint) await api.post(endpoint);
      toast(`Tâche "${id}" déclenchée`, 'success');
    } catch { toast(`Erreur déclenchement "${id}"`, 'error'); }
    finally { setTriggering(null); }
  };

  const lastRunFields = [
    { label: 'Dernière prospection', value: bot?.lastRunProspecting ?? bot?.lastProspection },
    { label: 'Dernière notation', value: bot?.lastRunScoring },
    { label: 'Dernier appel', value: bot?.lastRunCalling ?? bot?.lastCall },
    { label: 'Dernier suivi', value: bot?.lastRunFollowUp },
    { label: 'Dernière activité', value: bot?.lastActivity },
  ].filter(x => x.value);

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Système</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Contrôle bot, santé API, tâches cron</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl hover:bg-white/[0.08] transition-all" style={{ background: t.elevated, color: t.textSec }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Bot Control */}
      <div className="p-5" style={{ ...glass, border: bot?.isActive ? `1px solid ${t.borderHi}` : glass.border }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: bot?.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)' }}>
              <Activity className="w-5 h-5" style={{ color: bot?.isActive ? t.live : t.textSec }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: t.text }}>Bot d'appels</p>
              <p className="text-xs" style={{ color: t.textSec }}>
                {bot?.isActive ? `Actif — ${bot.callsToday ?? 0}/${bot.callsQuotaDaily ?? 50} appels aujourd'hui` : 'Arrêté'}
              </p>
            </div>
          </div>
          <button onClick={toggleBot} disabled={toggling || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-50"
            style={bot?.isActive
              ? { background: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.3)', color: t.danger }
              : { background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)', color: t.live }}>
            {bot?.isActive ? <><Square className="w-3.5 h-3.5" />Arrêter</> : <><Play className="w-3.5 h-3.5" />Démarrer</>}
          </button>
        </div>

        {lastRunFields.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
            {lastRunFields.map(f => (
              <div key={f.label} className="rounded-xl p-3" style={{ background: t.inset }}>
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: t.textSec }}>{f.label}</p>
                <p className="text-xs" style={{ color: t.text }}>{new Date(f.value!).toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Health */}
      <div className="p-5" style={glass}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Santé des APIs</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {API_SERVICES.map(svc => {
            const val = envVars[svc.key];
            const isOptional = val === 'optional';
            const healthy = isOptional || (val !== false && val !== undefined);
            const color = isOptional ? t.warning : healthy ? t.success : t.danger;
            const label = isOptional ? 'Optionnel' : healthy ? 'Connecté' : 'Non configuré';
            const bg = isOptional ? 'rgba(251,191,36,0.05)' : healthy ? 'rgba(34,197,94,0.05)' : 'rgba(248,113,113,0.05)';
            return (
              <div key={svc.key} className="p-4 rounded-xl text-center transition-all"
                style={{
                  ...glass,
                  background: bg,
                }}>
                <div className="flex justify-center mb-2" style={{ color }}>{svc.icon}</div>
                <p className="text-xs font-medium" style={{ color: t.text }}>{svc.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color }}>{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cron Jobs */}
      <div className="p-5" style={glass}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Tâches CRON</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {CRON_JOBS.map(job => {
            const lastRun = bot?.crons?.[job.id];
            return (
              <div key={job.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: t.inset }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: t.text }}>{job.label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: t.textSec }}>{job.desc}</p>
                  {lastRun && !isNaN(new Date(lastRun).getTime()) && <p className="text-[10px] flex items-center gap-1 mt-1" style={{ color: t.textSec }}><Clock className="w-2.5 h-2.5" />{new Date(lastRun).toLocaleTimeString('fr-FR')}</p>}
                </div>
                <button onClick={() => trigger(job.id)} disabled={triggering === job.id}
                  className="ml-2 flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.06)', color: t.textSec, border: `1px solid ${t.border}` }}>
                  <Zap className="w-3 h-3" />{triggering === job.id ? '...' : 'Exécuter'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
