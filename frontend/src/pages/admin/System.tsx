import { useEffect, useState } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Play, Square, Cpu, Database, Mail, Phone, CreditCard,
  MessageSquare, Activity, Zap, Search, Shield,
} from 'lucide-react';
import OrbsLoader from '../../components/OrbsLoader';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, GhostBtn, Pill,
} from '../../components/pro/ProBlocks';

type StatusColor = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'accent';

const CRON_JOBS = [
  { id: 'prospecting',     label: 'Prospection',         desc: 'Scraping + enrichissement' },
  { id: 'scoring',         label: 'Scoring',             desc: 'Re-score prospects' },
  { id: 'calling',         label: 'Appels',              desc: 'Cycle appels sortants' },
  { id: 'followup',        label: 'Suivis',              desc: 'Envoi séquences relance' },
  { id: 'prospection',     label: 'Prospection bot',     desc: 'Démarrer prospection immédiate' },
  { id: 'call',            label: 'Appel manuel',        desc: 'Tenter 1 appel' },
  { id: 'niche-learning',  label: 'Apprentissage niche', desc: 'Analyse patterns niche' },
  { id: 'ab-analysis',     label: 'A/B analyse',         desc: 'Analyser tests A/B' },
  { id: 'best-time',       label: 'Meilleurs horaires',  desc: 'Calcul horaires optimaux' },
  { id: 'script-learning', label: 'Script learning',     desc: 'Optimiser scripts' },
  { id: 'follow-ups',      label: 'Follow-ups engine',   desc: 'Traiter follow-ups dus' },
  { id: 'rescore',         label: 'Re-scoring',          desc: 'Rescorer prospects non scorés' },
];

const API_SERVICES = [
  { key: 'database', label: 'Database (Prisma)', icon: Database },
  { key: 'vapi',     label: 'VAPI',              icon: Phone },
  { key: 'openai',   label: 'OpenAI',            icon: Cpu },
  { key: 'stripe',   label: 'Stripe',            icon: CreditCard },
  { key: 'twilio',   label: 'Twilio',            icon: Shield },
  { key: 'resend',   label: 'Resend',            icon: Mail },
  { key: 'discord',  label: 'Discord',           icon: MessageSquare },
  { key: 'apify',    label: 'Apify',             icon: Search },
];

const fmtTime = (v?: string) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

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
        'ab-analysis':     '/prospecting/trigger/ab-analysis',
        'best-time':       '/prospecting/trigger/best-time',
        'script-learning': '/prospecting/trigger/script-learning',
        'follow-ups':      '/prospecting/trigger/follow-ups',
        rescore:           '/prospecting/trigger/rescore',
      };
      const endpoint = runMap[id] ?? triggerMap[id] ?? prospectingMap[id];
      if (endpoint) await api.post(endpoint);
      toast(`Tâche "${id}" déclenchée`, 'success');
    } catch { toast(`Erreur déclenchement "${id}"`, 'error'); }
    finally { setTriggering(null); }
  };

  const serviceStatus = (key: string): { color: StatusColor; label: string } => {
    const val = envVars[key];
    if (val === 'optional') return { color: 'warn', label: 'Optionnel' };
    const healthy = val !== false && val !== undefined;
    return healthy ? { color: 'ok', label: 'Connecté' } : { color: 'bad', label: 'Inconfiguré' };
  };

  // Derived stats
  const totalServices = API_SERVICES.length;
  const okServices    = API_SERVICES.filter(s => serviceStatus(s.key).color === 'ok').length;
  const badServices   = API_SERVICES.filter(s => serviceStatus(s.key).color === 'bad').length;
  const uptimePct     = totalServices ? Math.round((okServices / totalServices) * 100) : 0;
  const callsToday    = bot?.callsToday ?? 0;
  const quota         = bot?.callsQuotaDaily ?? 50;
  const dbOk          = serviceStatus('database').color === 'ok';
  const queueDepth    = bot?.queueDepth ?? bot?.prospectsFound ?? 0;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Système"
        subtitle="Contrôle bot, santé des services et tâches cron"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className="w-4 h-4" />
          </IconBtn>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Uptime services" value={`${uptimePct}%`}          hint={`${okServices}/${totalServices} OK`} />
        <Stat label="Base de données" value={dbOk ? 'OK' : 'KO'}        hint={dbOk ? 'Prisma connecté' : 'Connexion interrompue'} />
        <Stat label="File d'attente"  value={queueDepth}                hint="Prospects en attente" />
        <Stat label="Erreurs"         value={badServices}               hint={badServices ? 'Services en échec' : 'Aucun service en échec'} />
      </div>

      {/* Bot control */}
      <section>
        <SectionHead
          title="Bot d'appels"
          action={
            <GhostBtn size="sm" onClick={toggleBot} disabled={toggling}>
              {bot?.isActive
                ? <><Square className="w-3 h-3" /> Arrêter</>
                : <><Play className="w-3 h-3" /> Démarrer</>}
            </GhostBtn>
          }
        />
        <Card>
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Activity size={18} style={{ color: pro.text }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full"
                      style={{ background: bot?.isActive ? pro.ok : pro.textTer }} />
                <span className="text-[13px] font-semibold" style={{ color: pro.text }}>
                  {bot?.isActive ? 'Bot actif' : 'Bot en pause'}
                </span>
              </div>
              <p className="text-[11.5px]" style={{ color: pro.textSec }}>
                {callsToday}/{quota} appels aujourd'hui
              </p>
            </div>
            <Pill color={bot?.isActive ? 'ok' : 'neutral'}>
              {bot?.isActive ? 'RUNNING' : 'IDLE'}
            </Pill>
          </div>
        </Card>
      </section>

      {/* API health rows */}
      <section>
        <SectionHead title="Services" />
        <Card>
          {API_SERVICES.map((svc, i) => {
            const s = serviceStatus(svc.key);
            const Icon = svc.icon;
            return (
              <div
                key={svc.key}
                className="flex items-center gap-3.5 px-4 h-[58px]"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Icon size={14} style={{ color: pro.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                    {svc.label}
                  </p>
                  <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                    {s.color === 'ok' ? 'Opérationnel' : s.color === 'warn' ? 'Service facultatif' : 'Clé API manquante'}
                  </p>
                </div>
                <Pill color={s.color}>{s.label}</Pill>
              </div>
            );
          })}
        </Card>
      </section>

      {/* Cron jobs */}
      <section>
        <SectionHead title="Tâches CRON" />
        <Card>
          {CRON_JOBS.map((job, i) => {
            const lastRun = bot?.crons?.[job.id];
            const hasRun  = lastRun && !isNaN(new Date(lastRun).getTime());
            return (
              <div
                key={job.id}
                className="flex items-center gap-3.5 px-4 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Zap size={14} style={{ color: pro.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                    {job.label}
                  </p>
                  <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                    {job.desc}{hasRun ? ` · dernier run ${fmtTime(lastRun)}` : ''}
                  </p>
                </div>
                <GhostBtn
                  size="sm"
                  onClick={() => trigger(job.id)}
                  disabled={triggering === job.id}
                >
                  {triggering === job.id ? '…' : 'Exécuter'}
                </GhostBtn>
              </div>
            );
          })}
        </Card>
      </section>

      <TestEmailCard />
    </div>
  );
}

const EMAIL_TEMPLATES: { v: string; l: string }[] = [
  { v: 'welcome',        l: 'Welcome (post-paiement)' },
  { v: 'trial-welcome',  l: 'Trial démarré' },
  { v: 'loom',           l: 'Loom vidéo (setup ready)' },
  { v: 'payment-failed', l: 'Paiement échoué' },
  { v: 'confirmation',   l: 'Confirmation inscription' },
];

function TestEmailCard() {
  const [to, setTo] = useState('matpol65@gmail.com');
  const [type, setType] = useState('welcome');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await api.post('/admin/test-email', { to, type });
      setResult({ ok: !!res.data?.ok, msg: res.data?.ok
        ? `Envoyé à ${to} · Resend ID ${res.data.resend?.id || res.data.resend?.data?.id || '—'}`
        : `Échec : ${res.data?.error || 'inconnu'}` });
    } catch (e: any) {
      setResult({ ok: false, msg: e?.response?.data?.error || e.message || 'Échec' });
    } finally { setSending(false); }
  };

  return (
    <section>
      <SectionHead title="Tester un email" />
      <Card>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="destinataire@email.com"
              className="md:col-span-2 h-10 px-3 text-[13px] rounded-lg outline-none"
              style={{ background: pro.bg, color: pro.text, border: `1px solid ${pro.border}` }}
            />
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="h-10 px-3 text-[13px] rounded-lg outline-none"
              style={{ background: pro.bg, color: pro.text, border: `1px solid ${pro.border}` }}
            >
              {EMAIL_TEMPLATES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={send}
              disabled={sending || !to.trim()}
              className="h-10 px-4 inline-flex items-center gap-2 text-[13px] font-medium rounded-lg disabled:opacity-40"
              style={{ background: pro.text, color: '#0B0B0D' }}
            >
              <Mail size={13} /> {sending ? 'Envoi…' : 'Envoyer test'}
            </button>
            {result && (
              <Pill color={result.ok ? 'ok' : 'bad'}>{result.ok ? 'OK' : 'Erreur'}</Pill>
            )}
          </div>
          {result && (
            <p className="text-[12px]" style={{ color: result.ok ? pro.ok : pro.bad }}>
              {result.msg}
            </p>
          )}
          <p className="text-[11.5px]" style={{ color: pro.textTer }}>
            Le mail part via Resend depuis Qwillio &lt;hello@qwillio.com&gt;. Vérifiez ensuite dans
            l'onglet Emails de Resend pour voir le statut de livraison.
          </p>
        </div>
      </Card>
    </section>
  );
}
