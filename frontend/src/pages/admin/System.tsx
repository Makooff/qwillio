import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Database, Phone, Bot, Mail, Search, Cpu,
  MessageSquare, Play, Square, Zap, FlaskConical, RotateCcw, Trash2,
  Activity, Server, Globe,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, GhostBtn, PrimaryBtn, Pill,
} from '../../components/pro/ProBlocks';

// ─── Types ────────────────────────────────────────────────────────────────────

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'accent';

interface BotStatus {
  isActive?: boolean;
  callsToday?: number;
  callsQuotaDaily?: number;
  queueDepth?: number;
  prospectsFound?: number;
  crons?: Record<string, string>;
  nodeVersion?: string;
}

interface DashboardStats {
  totalProspects?: number;
  costVapiCalls?: number;
  costTwilioSms?: number;
  costOpenAi?: number;
  costApify?: number;
}

// ─── Cron schedule metadata ───────────────────────────────────────────────────

const CRON_SCHEDULE = [
  { name: 'Scraping Apify',        schedule: 'Chaque 4h',       key: 'apifyScraping' },
  { name: 'Appels outbound',       schedule: 'Chaque 2min',     key: 'outboundEngine' },
  { name: 'Follow-ups',            schedule: 'Chaque 5min',     key: 'followUpSequences' },
  { name: 'Rescoring prospects',   schedule: 'Chaque 30min',    key: 'rescoreProspects' },
  { name: 'Validation téléphones', schedule: 'Chaque 10min',    key: 'phoneValidation' },
  { name: 'A/B Testing',           schedule: 'Mardi 4h',        key: 'abTesting' },
  { name: 'Script Learning',       schedule: 'Dimanche 1h',     key: 'scriptLearning' },
  { name: 'Call Intelligence',     schedule: 'Dimanche 2h',     key: 'callIntelligence' },
  { name: 'Évolution agents IA',   schedule: 'Dimanche 3h',     key: 'agentEvolution' },
  { name: 'Détection anomalies',   schedule: 'Horaire :30',     key: 'anomalyDetection' },
];

// ─── Service definitions ──────────────────────────────────────────────────────

const SERVICES = [
  { key: 'database', label: 'Database (Neon/Prisma)', icon: Database, hint: 'PostgreSQL via Neon' },
  { key: 'vapi',     label: 'VAPI',                   icon: Phone,    hint: 'Voice AI calls' },
  { key: 'twilio',   label: 'Twilio SMS',             icon: MessageSquare, hint: 'SMS & validation' },
  { key: 'openai',   label: 'OpenAI',                 icon: Cpu,      hint: 'GPT-4 Turbo' },
  { key: 'apify',    label: 'Apify',                  icon: Search,   hint: 'Google Maps scraping' },
  { key: 'resend',   label: 'Resend Email',           icon: Mail,     hint: 'Transactional emails' },
];

// ─── System test cards ────────────────────────────────────────────────────────

const SYSTEM_TESTS = [
  { key: 'sms',         label: 'Test SMS',       desc: 'Envoyer un SMS via Twilio',     icon: MessageSquare, endpoint: '/bot/test/sms' },
  { key: 'email',       label: 'Test Email',     desc: 'Envoyer un email via Resend',   icon: Mail,          endpoint: '/bot/test/email' },
  { key: 'vapi',        label: 'Test VAPI',      desc: 'Vérifier la connexion VAPI',    icon: Phone,         endpoint: '/bot/test/vapi' },
  { key: 'clear-cache', label: 'Purge cache',    desc: 'Vider le cache en mémoire',     icon: Trash2,        endpoint: '/bot/clear-cache' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(v?: string) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtCost(v?: number) {
  if (v == null) return '—';
  return `$${v.toFixed(2)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminSystem() {
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [envVars, setEnvVars] = useState<Record<string, boolean | string>>({});
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [botRes, healthRes, statsRes] = await Promise.all([
        api.get('/bot/status').catch(() => ({ data: {} })),
        api.get('/bot/health').catch(() => ({ data: {} })),
        api.get('/dashboard/stats').catch(() => ({ data: {} })),
      ]);
      setBot(botRes.data ?? {});
      setEnvVars(healthRes.data ?? {});
      setStats(statsRes.data ?? {});
    } catch {
      toast('Erreur chargement statut système', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleBot = async () => {
    setToggling(true);
    try {
      if (bot?.isActive) {
        await api.post('/bot/stop');
        toast('Bot arrêté', 'success');
      } else {
        await api.post('/bot/start');
        toast('Bot démarré', 'success');
      }
      const { data } = await api.get('/bot/status');
      setBot(data);
    } catch {
      toast('Erreur contrôle bot', 'error');
    } finally {
      setToggling(false);
    }
  };

  const runTest = async (key: string, endpoint: string) => {
    setTesting(key);
    try {
      await api.post(endpoint);
      toast(`Test "${key}" réussi`, 'success');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (e as { message?: string })?.message ?? 'Échec';
      toast(`Erreur test "${key}": ${msg}`, 'error');
    } finally {
      setTesting(null);
    }
  };

  const serviceStatus = (key: string): { color: PillColor; label: string } => {
    const val = envVars[key];
    if (val === 'optional') return { color: 'warn', label: 'Optionnel' };
    const healthy = val !== false && val !== undefined && val !== null;
    return healthy
      ? { color: 'ok', label: 'Configuré' }
      : { color: 'bad', label: 'Inconfiguré' };
  };

  const okServices  = SERVICES.filter(s => serviceStatus(s.key).color === 'ok').length;
  const badServices = SERVICES.filter(s => serviceStatus(s.key).color === 'bad').length;
  const callsToday  = bot?.callsToday ?? 0;
  const quota       = bot?.callsQuotaDaily ?? 50;
  const queueDepth  = bot?.queueDepth ?? bot?.prospectsFound ?? 0;
  const env = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE?.includes('localhost')
    ? 'development' : 'production';

  const totalCost = [stats?.costVapiCalls, stats?.costTwilioSms, stats?.costOpenAi, stats?.costApify]
    .filter((v): v is number => v != null)
    .reduce((a, b) => a + b, 0);
  const hasCosts = totalCost > 0;

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Système"
        subtitle="Santé de l'infrastructure et jobs planifiés"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className="w-4 h-4" />
          </IconBtn>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Services OK"    value={`${okServices}/${SERVICES.length}`} hint="Services configurés" />
        <Stat label="Appels aujourd'hui" value={callsToday}                    hint={`Quota : ${quota}/jour`} />
        <Stat label="File d'attente" value={queueDepth}                        hint="Prospects en attente" />
        <Stat label="Environnement"  value={env}                               hint={bot?.nodeVersion ? `Node ${bot.nodeVersion}` : 'Backend Render'} />
      </div>

      {/* ── Health + Quick Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Service status */}
        <section>
          <SectionHead title="Statut des services" />
          <Card>
            {SERVICES.map((svc, i) => {
              const s = serviceStatus(svc.key);
              const Icon = svc.icon;
              return (
                <div
                  key={svc.key}
                  className="flex items-center gap-3.5 px-4 h-[58px]"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: s.color === 'ok' ? pro.ok : s.color === 'warn' ? pro.warn : pro.bad }}
                  />
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Icon size={13} style={{ color: pro.textSec }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                      {svc.label}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                      {svc.hint}
                    </p>
                  </div>
                  <Pill color={s.color}>{s.label}</Pill>
                </div>
              );
            })}
          </Card>
        </section>

        {/* Quick stats + Bot control */}
        <div className="space-y-4">
          <section>
            <SectionHead title="Informations rapides" />
            <Card>
              {[
                { label: 'Statut',        value: bot?.isActive ? 'En ligne' : 'En pause' },
                { label: 'Uptime',        value: 'En ligne' },
                { label: 'Environnement', value: env },
                { label: 'Node.js',       value: bot?.nodeVersion ?? '—' },
                { label: 'DB prospects',  value: stats?.totalProspects != null ? String(stats.totalProspects) : '—' },
                { label: 'Services KO',   value: badServices > 0 ? `${badServices} service${badServices > 1 ? 's' : ''}` : 'Aucun' },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-4 h-10"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <span className="text-[12px]" style={{ color: pro.textSec }}>{row.label}</span>
                  <span className="text-[12px] font-medium tabular-nums" style={{ color: pro.text }}>{row.value}</span>
                </div>
              ))}
            </Card>
          </section>

          {/* Bot toggle */}
          <section>
            <SectionHead
              title="Contrôle bot"
              action={
                <GhostBtn size="sm" onClick={toggleBot} disabled={toggling}>
                  {bot?.isActive
                    ? <><Square className="w-3 h-3" /> Arrêter</>
                    : <><Play  className="w-3 h-3" /> Démarrer</>}
                </GhostBtn>
              }
            />
            <Card>
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Activity size={16} style={{ color: pro.text }} />
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
        </div>
      </div>

      {/* ── Cron jobs table ───────────────────────────────────────────────────── */}
      <section>
        <SectionHead title="Jobs planifiés" />
        <Card>
          {/* Table header */}
          <div
            className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-4 h-9 items-center"
            style={{ borderBottom: `1px solid ${pro.border}` }}
          >
            {['Nom du job', 'Fréquence', 'Dernier run', 'Statut'].map(h => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: pro.textTer }}>
                {h}
              </span>
            ))}
          </div>
          {CRON_SCHEDULE.map((job, i) => {
            const lastRunRaw = bot?.crons?.[job.key];
            const lastRun    = fmtTime(lastRunRaw);
            const hasRun     = lastRun !== '—';
            const statusColor: PillColor = hasRun ? 'ok' : 'neutral';
            const statusLabel = hasRun ? 'OK' : 'En attente';
            return (
              <div
                key={job.key}
                className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-4 h-[50px] items-center hover:bg-white/[0.02] transition-colors"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <Zap size={11} style={{ color: pro.textTer }} />
                  </div>
                  <span className="text-[12.5px] font-medium truncate" style={{ color: pro.text }}>
                    {job.name}
                  </span>
                </div>
                <span className="text-[11.5px] tabular-nums" style={{ color: pro.textSec }}>
                  {job.schedule}
                </span>
                <span className="text-[11.5px] tabular-nums font-mono" style={{ color: hasRun ? pro.textSec : pro.textTer }}>
                  {lastRun}
                </span>
                <Pill color={statusColor}>{statusLabel}</Pill>
              </div>
            );
          })}
        </Card>
      </section>

      {/* ── System tests ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHead title="Tests système" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SYSTEM_TESTS.map(test => {
            const Icon = test.icon;
            const running = testing === test.key;
            return (
              <Card key={test.key}>
                <div className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Icon size={15} style={{ color: pro.textSec }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold" style={{ color: pro.text }}>{test.label}</p>
                    <p className="text-[11.5px]" style={{ color: pro.textTer }}>{test.desc}</p>
                  </div>
                  <GhostBtn
                    size="sm"
                    onClick={() => runTest(test.key, test.endpoint)}
                    disabled={running || testing !== null}
                  >
                    <FlaskConical size={12} />
                    {running ? 'Test…' : 'Tester'}
                  </GhostBtn>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Cost tracker ──────────────────────────────────────────────────────── */}
      {hasCosts && (
        <section>
          <SectionHead title="Coûts du jour" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="VAPI appels"  value={fmtCost(stats?.costVapiCalls)}  hint="Appels Voice AI" />
            <Stat label="Twilio SMS"   value={fmtCost(stats?.costTwilioSms)}  hint="SMS envoyés" />
            <Stat label="OpenAI"       value={fmtCost(stats?.costOpenAi)}     hint="GPT-4 Turbo tokens" />
            <Stat label="Apify"        value={fmtCost(stats?.costApify)}       hint="Google Maps scraping" />
          </div>
          <div className="mt-2 flex justify-end">
            <span className="text-[12px]" style={{ color: pro.textSec }}>
              Total du jour : <span className="font-semibold tabular-nums" style={{ color: pro.text }}>{fmtCost(totalCost)}</span>
            </span>
          </div>
        </section>
      )}

      {/* ── SMS test card (full, preserved from original) ──────────────────── */}
      <TestSmsCard />

      {/* ── Email test card (full, preserved from original) ─────────────────── */}
      <TestEmailCard />
    </div>
  );
}

// ─── SMS Templates ────────────────────────────────────────────────────────────

const SMS_TEMPLATES: { v: string; l: string }[] = [
  { v: 'welcome',          l: 'Welcome (post-appel qualifié)' },
  { v: 'voicemail',        l: 'Voicemail follow-up' },
  { v: 'interested',       l: 'Prospect intéressé' },
  { v: 'callback',         l: 'Rappel demandé' },
  { v: 'noanswer',         l: 'Pas de réponse' },
  { v: 'email-bounce',     l: 'Email a bounced' },
  { v: 'exhausted',        l: 'Tentatives épuisées' },
  { v: 'booking-confirm',  l: 'Confirmation rendez-vous' },
  { v: 'booking-reminder', l: 'Rappel rendez-vous J-1' },
  { v: 'custom',           l: 'Message personnalisé…' },
];

function TestSmsCard() {
  const [to, setTo]       = useState('+1');
  const [type, setType]   = useState('welcome');
  const [body, setBody]   = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; preview?: string } | null>(null);
  const [diag, setDiag]   = useState<Record<string, unknown> | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const runDiag = async () => {
    setDiagLoading(true);
    setDiag(null);
    try {
      const res = await api.get('/admin/twilio-info');
      setDiag(res.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (e as { message?: string })?.message ?? 'Erreur inconnue';
      setDiag({ ok: false, error: msg });
    } finally {
      setDiagLoading(false);
    }
  };

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      const payload: Record<string, string> = { to, type };
      if (type === 'custom') payload.body = body;
      const res = await api.post('/admin/test-sms', payload);
      setResult({
        ok: !!res.data?.ok,
        msg: res.data?.ok
          ? `Envoyé à ${to} · SID ${res.data.messageId || '—'}`
          : `Échec : ${res.data?.error || 'inconnu'}`,
        preview: res.data?.body,
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (e as { message?: string })?.message ?? 'Échec';
      setResult({ ok: false, msg });
    } finally {
      setSending(false);
    }
  };

  const inputStyle = { background: pro.bg, color: pro.text, border: `1px solid ${pro.border}` };

  return (
    <section>
      <SectionHead title="Tester un SMS" />
      <Card>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="tel"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="+14155552671"
              className="h-10 px-3 text-[13px] rounded-lg outline-none tabular-nums"
              style={inputStyle}
            />
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="md:col-span-2 h-10 px-3 text-[13px] rounded-lg outline-none"
              style={inputStyle}
            >
              {SMS_TEMPLATES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>

          {type === 'custom' && (
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              maxLength={1600}
              placeholder="Tapez votre message SMS…"
              className="w-full px-3 py-2 text-[13px] rounded-lg outline-none resize-y"
              style={{ ...inputStyle, minHeight: 70 }}
            />
          )}

          <div className="flex items-center gap-2">
            <PrimaryBtn
              onClick={send}
              disabled={sending || !to.trim() || to.length < 10 || (type === 'custom' && !body.trim())}
            >
              <MessageSquare size={13} />
              {sending ? 'Envoi…' : 'Envoyer test'}
            </PrimaryBtn>
            {result && <Pill color={result.ok ? 'ok' : 'bad'}>{result.ok ? 'OK' : 'Erreur'}</Pill>}
          </div>

          {result && (
            <>
              <p className="text-[12px]" style={{ color: result.ok ? pro.ok : pro.bad }}>{result.msg}</p>
              {result.ok && result.preview && (
                <p className="text-[11.5px] leading-relaxed p-3 rounded-lg"
                   style={{ background: pro.bg, color: pro.textSec, border: `1px solid ${pro.border}` }}>
                  {result.preview}
                </p>
              )}
            </>
          )}

          <p className="text-[11.5px]" style={{ color: pro.textTer }}>
            Envoyé via Twilio. Format E.164 (commence par +indicatif). Vérifie ensuite Twilio Console &rarr; SMS Logs.
          </p>

          <div className="pt-3 mt-1" style={{ borderTop: `1px solid ${pro.border}` }}>
            <GhostBtn size="sm" onClick={runDiag} disabled={diagLoading}>
              <Bot size={12} />
              {diagLoading ? 'Diagnostic…' : 'Diagnostiquer Twilio'}
            </GhostBtn>

            {diag && (
              <div className="mt-3 space-y-2 text-[12px]" style={{ color: pro.textSec }}>
                {diag.ok ? (
                  <>
                    <p>
                      <span style={{ color: pro.textTer }}>Compte :</span>{' '}
                      {String(diag.accountName)} · {String(diag.accountStatus)} ·{' '}
                      <span style={{ color: pro.textTer }}>Solde :</span>{' '}
                      {diag.balance != null ? String(diag.balance) : '—'}
                    </p>
                    <p style={{ color: diag.configuredOk ? pro.ok : pro.bad }}>{String(diag.hint ?? '')}</p>
                    <p style={{ color: pro.textTer }}>
                      {Array.isArray(diag.numbers) ? diag.numbers.length : 0} numéro
                      {(Array.isArray(diag.numbers) ? diag.numbers.length : 0) > 1 ? 's' : ''} dans le compte :
                    </p>
                    <ul className="space-y-1">
                      {Array.isArray(diag.numbers) && diag.numbers.map((n: Record<string, unknown>) => (
                        <li
                          key={String(n.phoneNumber)}
                          className="px-3 py-2 rounded-lg flex items-center justify-between"
                          style={{
                            background: pro.panelHi,
                            border: n.isConfigured ? `1px solid ${pro.accent}66` : `1px solid ${pro.border}`,
                          }}
                        >
                          <span className="tabular-nums">
                            {String(n.phoneNumber)}{' '}
                            <span style={{ color: pro.textTer }}>· {String(n.friendlyName)}</span>
                          </span>
                          <span className="text-[10.5px]">
                            {n.smsEnabled
                              ? <span style={{ color: pro.ok }}>SMS ✓</span>
                              : <span style={{ color: pro.bad }}>SMS ✗</span>}
                            {!!n.isConfigured && (
                              <span className="ml-2" style={{ color: pro.accent }}>← configuré</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p style={{ color: pro.bad }}>{String(diag.error ?? 'Erreur inconnue')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}

// ─── Email Templates ──────────────────────────────────────────────────────────

const EMAIL_TEMPLATES: { v: string; l: string }[] = [
  { v: 'welcome',                l: 'Welcome (post-paiement)' },
  { v: 'trial-welcome',          l: 'Trial démarré' },
  { v: 'loom',                   l: 'Loom vidéo (setup ready)' },
  { v: 'payment-failed',         l: 'Paiement échoué' },
  { v: 'confirmation',           l: 'Confirmation inscription' },
  { v: 'quote',                  l: 'Devis personnalisé' },
  { v: 'followup-day1',          l: 'Relance J+1' },
  { v: 'followup-day3',          l: 'Relance J+3' },
  { v: 'followup-day7',          l: 'Relance J+7 (last chance)' },
  { v: 'trial-ending-7d',        l: 'Trial finit dans 7j' },
  { v: 'trial-ending-1d',        l: 'Trial finit demain' },
  { v: 'trial-expired',          l: 'Trial expiré' },
  { v: 'callback-3months',       l: 'Rappel 3 mois' },
  { v: 'onboarding',             l: 'Onboarding client' },
  { v: 'trial-end-invoice',      l: 'Facture fin de trial' },
  { v: 'account-deactivated',    l: 'Compte désactivé' },
  { v: 'payment-link-signature', l: 'Lien paiement post-signature' },
  { v: 'booking-reminder',       l: 'Rappel rendez-vous client' },
  { v: 'reschedule',             l: 'Reprogrammation' },
  { v: 'email-confirmation',     l: 'Confirmation double opt-in' },
  { v: 'digest',                 l: 'Digest quotidien' },
  { v: 'registration-invite',    l: "Invitation à s'inscrire" },
];

function TestEmailCard() {
  const [to, setTo]       = useState('matpol65@gmail.com');
  const [type, setType]   = useState('welcome');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await api.post('/admin/test-email', { to, type });
      setResult({
        ok: !!res.data?.ok,
        msg: res.data?.ok
          ? `Envoyé à ${to} · Resend ID ${res.data.resend?.id || res.data.resend?.data?.id || '—'}`
          : `Échec : ${res.data?.error || 'inconnu'}`,
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (e as { message?: string })?.message ?? 'Échec';
      setResult({ ok: false, msg });
    } finally {
      setSending(false);
    }
  };

  const inputStyle = { background: pro.bg, color: pro.text, border: `1px solid ${pro.border}` };

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
              style={inputStyle}
            />
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="h-10 px-3 text-[13px] rounded-lg outline-none"
              style={inputStyle}
            >
              {EMAIL_TEMPLATES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <PrimaryBtn onClick={send} disabled={sending || !to.trim()}>
              <Mail size={13} />
              {sending ? 'Envoi…' : 'Envoyer test'}
            </PrimaryBtn>
            {result && <Pill color={result.ok ? 'ok' : 'bad'}>{result.ok ? 'OK' : 'Erreur'}</Pill>}
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
