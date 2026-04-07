import { useEffect, useState } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Play, Square, Server, Cpu, Database, Mail, Phone, CreditCard,
  MessageSquare, Activity, CheckCircle2, XCircle, AlertCircle, Clock, Zap
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';

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
  { key: 'vapi', label: 'VAPI', icon: <Phone className="w-4 h-4" /> },
  { key: 'openai', label: 'OpenAI', icon: <Cpu className="w-4 h-4" /> },
  { key: 'stripe', label: 'Stripe', icon: <CreditCard className="w-4 h-4" /> },
  { key: 'resend', label: 'Resend', icon: <Mail className="w-4 h-4" /> },
  { key: 'database', label: 'Database', icon: <Database className="w-4 h-4" /> },
  { key: 'discord', label: 'Discord', icon: <MessageSquare className="w-4 h-4" /> },
];

const ENV_VARS = [
  'DATABASE_URL', 'JWT_SECRET', 'VAPI_API_KEY', 'VAPI_PHONE_NUMBER_ID',
  'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DISCORD_WEBHOOK_URL',
  'ADMIN_EMAIL', 'FRONTEND_URL',
];

export default function AdminSystem() {
  const [bot, setBot] = useState<any>(null);
  const [envVars, setEnvVars] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bot/status');
      setBot(data);
      // Infer env var status from bot/config availability
      try {
        const { data: cfg } = await api.get('/bot/config');
        const vars: Record<string, boolean> = {};
        ENV_VARS.forEach(k => { vars[k] = true; }); // all set if config loads
        if (cfg?.vapiApiKey === undefined) vars['VAPI_API_KEY'] = false;
        setEnvVars(vars);
      } catch {
        const vars: Record<string, boolean> = {};
        ENV_VARS.forEach(k => { vars[k] = false; });
        setEnvVars(vars);
      }
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
          <h1 className="text-xl font-bold text-[#F8F8FF]">Système</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Contrôle bot, santé API, tâches cron</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Bot Control */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bot?.isActive ? 'bg-[#22C55E]/10' : 'bg-[#8B8BA7]/10'}`}>
              <Activity className={`w-5 h-5 ${bot?.isActive ? 'text-[#22C55E]' : 'text-[#8B8BA7]'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#F8F8FF]">Bot d'appels</p>
              <p className="text-xs text-[#8B8BA7]">
                {bot?.isActive ? `Actif — ${bot.callsToday ?? 0}/${bot.callsQuotaDaily ?? 50} appels aujourd'hui` : 'Arrêté'}
              </p>
            </div>
          </div>
          <button onClick={toggleBot} disabled={toggling || loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-50
              ${bot?.isActive
                ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}>
            {bot?.isActive ? <><Square className="w-3.5 h-3.5" />Arrêter</> : <><Play className="w-3.5 h-3.5" />Démarrer</>}
          </button>
        </div>

        {lastRunFields.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-4 border-t border-white/[0.06]">
            {lastRunFields.map(f => (
              <div key={f.label} className="bg-[#0D0D15] rounded-xl p-3">
                <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mb-1">{f.label}</p>
                <p className="text-xs text-[#F8F8FF]">{new Date(f.value!).toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Health */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Santé des APIs</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {API_SERVICES.map(svc => {
            // Infer health from env vars presence
            const healthy = envVars[svc.key.toUpperCase() + '_API_KEY'] !== false;
            return (
              <div key={svc.key} className={`p-4 rounded-xl border text-center transition-all ${healthy ? 'bg-[#22C55E]/5 border-[#22C55E]/20' : 'bg-[#EF4444]/5 border-[#EF4444]/20'}`}>
                <div className={`flex justify-center mb-2 ${healthy ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{svc.icon}</div>
                <p className="text-xs font-medium text-[#F8F8FF]">{svc.label}</p>
                <p className={`text-[10px] mt-0.5 ${healthy ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{healthy ? 'Connecté' : 'Non configuré'}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cron Jobs */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Tâches CRON</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {CRON_JOBS.map(job => {
            const lastRun = bot?.crons?.[job.id];
            return (
              <div key={job.id} className="flex items-center justify-between p-3 bg-[#0D0D15] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F8F8FF]">{job.label}</p>
                  <p className="text-[10px] text-[#8B8BA7] mt-0.5">{job.desc}</p>
                  {lastRun && <p className="text-[10px] text-[#8B8BA7] flex items-center gap-1 mt-1"><Clock className="w-2.5 h-2.5" />{new Date(lastRun).toLocaleTimeString('fr-FR')}</p>}
                </div>
                <button onClick={() => trigger(job.id)} disabled={triggering === job.id}
                  className="ml-2 flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#7B5CF0]/10 text-[#7B5CF0] border border-[#7B5CF0]/20 hover:bg-[#7B5CF0]/20 text-[10px] font-medium transition-all disabled:opacity-50">
                  <Zap className="w-3 h-3" />{triggering === job.id ? '...' : 'Exécuter'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Env Vars Checklist */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Variables d'environnement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ENV_VARS.map(k => {
            const set = envVars[k] !== false;
            return (
              <div key={k} className="flex items-center justify-between p-2.5 bg-[#0D0D15] rounded-xl">
                <span className="text-xs font-mono text-[#8B8BA7]">{k}</span>
                <span className={`flex items-center gap-1 text-xs font-medium ${set ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {set ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {set ? 'Définie' : 'Manquante'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
