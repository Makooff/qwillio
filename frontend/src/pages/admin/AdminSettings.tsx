import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import OrbsLoader from '../../components/OrbsLoader';
import {
  Save, AlertTriangle, Clock, Phone, Settings, Server, Database,
  CheckCircle2, XCircle, Loader2, Globe, Brain, Mail, DollarSign,
  Shield, Cpu, Users, Target, Zap, Hash, Mic, Radio, MapPin,
  RefreshCw, Volume2, Timer, BarChart3, FileText, Key, Lock,
  Webhook, MessageSquare, Search, Activity, ChevronDown, ChevronRight,
  Info, Bug,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { pro } from '../../styles/pro-theme';
import { Card as ProCard, SectionHead as ProSectionHead, Pill } from '../../components/pro/ProBlocks';

// ── Types for tabs ────────────────────────────────────────────────────────────

type SettingsTab = 'Configuration' | 'Système' | 'Logs';

// ── Tab: Système (lazy-loaded when first opened) ──────────────────────────────

interface ServiceHealth { [key: string]: boolean | string }
interface SysStats { uptime?: number; nodeVersion?: string; env?: string; prospects?: number; clients?: number; calls?: number }

const CRON_ROWS = [
  { label: 'Scraping Apify',        schedule: 'Chaque 4h' },
  { label: 'Appels outbound',       schedule: 'Chaque 2min' },
  { label: 'Follow-ups',            schedule: 'Chaque 5min' },
  { label: 'Rescoring prospects',   schedule: 'Chaque 30min' },
  { label: 'Validation téléphones', schedule: 'Chaque 10min' },
  { label: 'A/B Testing',           schedule: 'Mardi 4h' },
  { label: 'Script Learning',       schedule: 'Dimanche 1h' },
  { label: 'Évolution agents IA',   schedule: 'Dimanche 3h' },
  { label: 'Détection anomalies',   schedule: 'Horaire :30' },
];

const SERVICE_DEFS = [
  { key: 'vapi',     label: 'VAPI',      hint: 'Voice AI' },
  { key: 'openai',   label: 'OpenAI',    hint: 'GPT-4 Turbo' },
  { key: 'twilio',   label: 'Twilio',    hint: 'SMS & validation' },
  { key: 'stripe',   label: 'Stripe',    hint: 'Paiements' },
  { key: 'resend',   label: 'Resend',    hint: 'Emails' },
  { key: 'database', label: 'Database',  hint: 'PostgreSQL / Neon' },
  { key: 'discord',  label: 'Discord',   hint: 'Alertes' },
  { key: 'apify',    label: 'Apify',     hint: 'Scraping Maps' },
];

function fmtUptime2(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function TabSysteme({ active }: { active: boolean }) {
  const [health, setHealth]   = useState<ServiceHealth | null>(null);
  const [sys, setSys]         = useState<SysStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    if (!active || loaded) return;
    setLoading(true);
    Promise.allSettled([
      api.get('/bot/health').catch(() => ({ data: {} })),
      api.get('/admin/system').catch(() => ({ data: null })),
    ]).then(([h, s]) => {
      if (h.status === 'fulfilled') setHealth(h.value.data as ServiceHealth);
      if (s.status === 'fulfilled') setSys(s.value.data as SysStats);
      setLoaded(true);
    }).finally(() => setLoading(false));
  }, [active, loaded]);

  const reload = () => { setLoaded(false); };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => (
          <div key={i} className="animate-pulse rounded-2xl h-20" style={{ background: pro.panel, border: `1px solid ${pro.border}` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <ProSectionHead title="Services & santé" />
        <button onClick={reload} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors" style={{ color: pro.textSec }}>
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SERVICE_DEFS.map(s => {
          const val = health?.[s.key] ?? false;
          const isOpt = val === 'optional';
          const ok = isOpt || !!val;
          const color = isOpt ? pro.warn : ok ? pro.ok : pro.bad;
          return (
            <ProCard key={s.key}>
              <div className="p-3 flex items-center gap-2">
                {ok
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color }} />
                  : <XCircle      className="w-4 h-4 flex-shrink-0" style={{ color }} />}
                <div>
                  <p className="text-xs font-semibold" style={{ color: pro.text }}>{s.label}</p>
                  <p className="text-[10px]" style={{ color: pro.textSec }}>{s.hint}{isOpt ? ' (opt.)' : ''}</p>
                </div>
              </div>
            </ProCard>
          );
        })}
      </div>

      {sys && (
        <>
          <ProSectionHead title="Système" />
          <ProCard>
            <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-x-6">
              {[
                { l: 'Uptime',      v: sys.uptime ? fmtUptime2(sys.uptime) : '—', c: pro.ok },
                { l: 'Node.js',     v: sys.nodeVersion ?? '—' },
                { l: 'Environnement', v: sys.env ?? '—' },
                { l: 'Prospects',   v: String(sys.prospects ?? '—') },
                { l: 'Clients',     v: String(sys.clients ?? '—') },
                { l: 'Appels',      v: String(sys.calls ?? '—') },
              ].map(({ l, v, c }) => (
                <div key={l} className="flex justify-between py-2 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-[11px]" style={{ color: pro.textSec }}>{l}</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: c ?? pro.text }}>{v}</span>
                </div>
              ))}
            </div>
          </ProCard>
        </>
      )}

      <ProSectionHead title="Cron Jobs" />
      <ProCard>
        <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
          {CRON_ROWS.map(r => (
            <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[12px]" style={{ color: pro.textSec }}>{r.label}</span>
              <span className="text-[11px] font-mono" style={{ color: pro.text }}>{r.schedule}</span>
            </div>
          ))}
        </div>
      </ProCard>
    </div>
  );
}

// ── Tab: Logs (lazy-loaded, auto-refresh 5s) ──────────────────────────────────

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service?: string;
}

type LogLevel = 'all' | LogEntry['level'];

const LOG_LEVEL_COLOR: Record<string, string> = {
  error: pro.bad,
  warn:  pro.warn,
  info:  pro.info,
  debug: pro.textTer,
};

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral';

const LOG_PILL: Record<string, PillColor> = {
  error: 'bad',
  warn:  'warn',
  info:  'info',
  debug: 'neutral',
};

function TabLogs({ active }: { active: boolean }) {
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [levelFilter, setLevel] = useState<LogLevel>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/logs?limit=50');
      const d: unknown = res.data;
      setLogs(Array.isArray(d) ? d as LogEntry[] : (d as { logs: LogEntry[] }).logs ?? []);
      setLoaded(true);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!loaded) load();
    const id = setInterval(load, 5_000);
    return () => clearInterval(id);
  }, [active, loaded, load]);

  const filtered = levelFilter === 'all' ? logs : logs.filter(l => l.level === levelFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ProSectionHead title={`Logs (${filtered.length})`} />
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors ml-2" style={{ color: pro.textSec }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <div className="flex gap-1 ml-auto">
          {(['all', 'error', 'warn', 'info', 'debug'] as LogLevel[]).map(l => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={levelFilter === l
                ? { background: 'rgba(255,255,255,0.08)', color: l === 'all' ? pro.text : LOG_LEVEL_COLOR[l] }
                : { color: pro.textSec }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading && !loaded ? (
        <div className="animate-pulse rounded-2xl h-40" style={{ background: pro.panel, border: `1px solid ${pro.border}` }} />
      ) : (
        <ProCard>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[12px]" style={{ color: pro.textSec }}>Aucun log</div>
          ) : (
            <div className="divide-y font-mono text-[11px]" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
              {filtered.map((log, i) => (
                <div key={log.id ?? i} className="flex items-start gap-3 px-4 py-2.5">
                  <Pill color={LOG_PILL[log.level] ?? 'neutral'}>{log.level.toUpperCase()}</Pill>
                  <span className="flex-shrink-0 tabular-nums" style={{ color: pro.textTer }}>
                    {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                  </span>
                  {log.service && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.04)', color: pro.textSec }}>
                      {log.service}
                    </span>
                  )}
                  <span className="flex-1 min-w-0 break-all" style={{ color: LOG_LEVEL_COLOR[log.level] ?? pro.text }}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ProCard>
      )}
    </div>
  );
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const NICHES = [
  { id: 'dental',        label: 'Dentaire',        score: 7 },
  { id: 'medical',       label: 'Médical',         score: 6 },
  { id: 'law',           label: 'Juridique',       score: 5 },
  { id: 'salon',         label: 'Salon',           score: 5 },
  { id: 'restaurant',    label: 'Restaurant',      score: 4 },
  { id: 'garage',        label: 'Garage auto',     score: 6 },
  { id: 'hotel',         label: 'Hôtel',           score: 3 },
  { id: 'home_services', label: 'Services maison', score: 8 },
];

interface Config {
  startHour: number;
  endHour: number;
  callsPerDay: number;
  callIntervalSeconds: number;
  activeDays: number[];
  maxCallDuration: number;
  retryDelay: number;
  maxRetries: number;
  prospectionQuotaPerDay: number;
  minPriorityScore: number;
  targetCities: string[];
  targetNiches: string[];
  apifyTargetCities: string[];
  vapiModel: string;
  vapiVoiceId: string;
  vapiStability: number;
  vapiSimilarityBoost: number;
  vapiStyle: number;
  vapiLatency: number;
  vapiInterruptionMs: number;
  vapiSilenceTimeout: number;
  vapiMaxDuration: number;
  smsEnabled: boolean;
  prospectionRadius: number;
  timezone: string;
  resendFrom: string;
  resendReplyTo: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
}

const DEFAULT: Config = {
  startHour: 9, endHour: 18, callsPerDay: 50,
  callIntervalSeconds: 1200, activeDays: [1, 2, 3, 4, 5],
  maxCallDuration: 600, retryDelay: 3600, maxRetries: 3,
  prospectionQuotaPerDay: 30, minPriorityScore: 10,
  targetCities: [], targetNiches: [], apifyTargetCities: [],
  vapiModel: 'gpt-4-turbo', vapiVoiceId: '21m00Tcm4TlvDq8ikWAM',
  vapiStability: 0.45, vapiSimilarityBoost: 0.82, vapiStyle: 0.35,
  vapiLatency: 4, vapiInterruptionMs: 200, vapiSilenceTimeout: 10, vapiMaxDuration: 480,
  smsEnabled: false, prospectionRadius: 5000, timezone: 'Europe/Brussels',
  resendFrom: 'Qwillio <hello@qwillio.com>', resendReplyTo: 'contact@qwillio.com',
  jwtExpiresIn: '24h', bcryptRounds: 12,
};

function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden border"
         style={{ background: 'rgba(255,255,255,0.03)', borderColor: pro.border }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        {open
          ? <ChevronDown  className="w-3.5 h-3.5" style={{ color: pro.textTer }} />
          : <ChevronRight className="w-3.5 h-3.5" style={{ color: pro.textTer }} />}
        <Icon className="w-4 h-4" style={{ color: pro.textSec }} />
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: pro.textSec }}>
          {title}
        </span>
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminSettings() {
  const [activeTab, setActiveTab]   = useState<SettingsTab>('Configuration');
  const [config, setConfig]         = useState<Config>(DEFAULT);
  const [savedConfig, setSavedConfig] = useState<Config>(DEFAULT);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [confirmPause, setConfirmPause]   = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);
  const [health, setHealth]         = useState<Record<string, boolean | string> | null>(null);
  const [sysInfo, setSysInfo]       = useState<Record<string, unknown> | null>(null);
  const [prospecting, setProspecting] = useState<Record<string, unknown> | null>(null);
  const [aiStats, setAiStats]       = useState<Record<string, unknown> | null>(null);
  const [newCity, setNewCity]       = useState('');
  const [newApifyCity, setNewApifyCity] = useState('');
  const { toasts, add: toast, remove } = useToast();

  // ── Dirty detection ───────────────────────────────────────────────────────
  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [cfg, h, sys, p, ai] = await Promise.all([
        api.get('/admin/bot-config').catch(() => ({ data: null })),
        api.get('/bot/health').catch(() => ({ data: {} })),
        api.get('/admin/system').catch(() => ({ data: null })),
        api.get('/prospecting/status').catch(() => ({ data: null })),
        api.get('/ai/stats').catch(() => ({ data: null })),
      ]);
      const merged = cfg.data ? { ...DEFAULT, ...cfg.data } : DEFAULT;
      setConfig(merged);
      setSavedConfig(merged);
      setHealth(h.data);
      setSysInfo(sys.data);
      setProspecting(p.data);
      setAiStats(ai.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      await api.post('/admin/bot-config', config);
      setSavedConfig(config);
      toast('Configuration sauvegardée', 'success');
    } catch {
      toast('Erreur sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  };

  const pauseAll = async () => {
    try { await api.post('/bot/stop'); toast('Bot arrêté', 'success'); }
    catch { toast('Erreur', 'error'); }
    finally { setConfirmPause(false); }
  };

  const resumeAll = async () => {
    try { await api.post('/bot/start'); toast('Bot démarré', 'success'); }
    catch { toast('Erreur', 'error'); }
    finally { setConfirmResume(false); }
  };

  const toggleDay = (d: number) => {
    setConfig(prev => ({
      ...prev,
      activeDays: prev.activeDays.includes(d)
        ? prev.activeDays.filter(x => x !== d)
        : [...prev.activeDays, d].sort(),
    }));
  };

  const toggleNiche = (niche: string) => {
    setConfig(prev => ({
      ...prev,
      targetNiches: prev.targetNiches.includes(niche)
        ? prev.targetNiches.filter(x => x !== niche)
        : [...prev.targetNiches, niche],
    }));
  };

  const addCity = (type: 'targetCities' | 'apifyTargetCities', value: string, setter: (v: string) => void) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setConfig(prev => ({
      ...prev,
      [type]: prev[type].includes(trimmed) ? prev[type] : [...prev[type], trimmed],
    }));
    setter('');
  };

  const removeCity = (type: 'targetCities' | 'apifyTargetCities', city: string) => {
    setConfig(prev => ({ ...prev, [type]: prev[type].filter(c => c !== city) }));
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inputStyle = {
    background: pro.bg,
    color: pro.text,
    border: `1px solid ${pro.border}`,
    borderRadius: '12px',
  };
  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none tabular-nums";
  const rowCls   = "flex justify-between py-2 border-b last:border-0";

  const InfoRow = ({ l, v, c }: { l: string; v: string | number; c?: string }) => (
    <div className={rowCls} style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
      <span className="text-[11px]" style={{ color: pro.textSec }}>{l}</span>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: c ?? pro.text }}>{v}</span>
    </div>
  );

  const NumInput = ({ label, value, onChange, min, max, step, unit }: {
    label: string; value: number; onChange: (v: number) => void;
    min?: number; max?: number; step?: number; unit?: string;
  }) => (
    <div>
      <label className="text-[10px] mb-1 block" style={{ color: pro.textSec }}>
        {label}{unit ? ` (${unit})` : ''}
      </label>
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={inputCls}
        style={inputStyle}
      />
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: pro.text }}>Paramètres</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: pro.textSec }}>
            Configuration complète du système
          </p>
        </div>
        {activeTab === 'Configuration' && (
          <div className="flex items-center gap-2">
            {isDirty && (
              <div className="flex items-center gap-1.5 mr-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pro.warn }} />
                <span className="text-[11.5px]" style={{ color: pro.warn }}>Modifications non sauvegardées</span>
              </div>
            )}
            <button onClick={load} title="Rafraîchir"
              className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors" style={{ color: pro.textSec }}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 px-4 h-9 text-[12.5px] font-medium rounded-xl transition-colors disabled:opacity-50"
              style={{ background: pro.text, color: '#0B0B0D' }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        )}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {(['Configuration', 'Système', 'Logs'] as SettingsTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 rounded-lg text-[12.5px] font-medium transition-all"
            style={activeTab === tab
              ? { background: 'rgba(255,255,255,0.08)', color: pro.text }
              : { color: pro.textSec }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Système tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'Système' && <TabSysteme active={activeTab === 'Système'} />}

      {/* ── Logs tab ──────────────────────────────────────────────────────────── */}
      {activeTab === 'Logs' && <TabLogs active={activeTab === 'Logs'} />}

      {/* ── Configuration tab ─────────────────────────────────────────────────── */}
      {activeTab === 'Configuration' && (<>

      {/* ── SECTION 1: Planning & Appels ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Planning des appels" icon={Clock}>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <NumInput label="Heure début" value={config.startHour} min={0} max={23}
              onChange={v => setConfig(p => ({ ...p, startHour: v }))} />
            <NumInput label="Heure fin" value={config.endHour} min={0} max={23}
              onChange={v => setConfig(p => ({ ...p, endHour: v }))} />
            <NumInput label="Appels / jour" value={config.callsPerDay} min={1} max={500}
              onChange={v => setConfig(p => ({ ...p, callsPerDay: v }))} />
            <NumInput label="Intervalle" value={config.callIntervalSeconds} min={30} unit="sec"
              onChange={v => setConfig(p => ({ ...p, callIntervalSeconds: v }))} />
          </div>
          <label className="text-[10px] mb-2 block" style={{ color: pro.textSec }}>Jours actifs</label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((day, i) => {
              const d  = i + 1;
              const on = config.activeDays.includes(d);
              return (
                <button key={d} onClick={() => toggleDay(d)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={on
                    ? { background: 'rgba(255,255,255,0.06)', borderColor: pro.borderHi, color: pro.text }
                    : { background: 'rgba(255,255,255,0.02)', borderColor: pro.border, color: pro.textSec }}>
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <div className="mt-4 pt-3" style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
            <InfoRow l="Timezone"          v={config.timezone} />
            <InfoRow l="Blackout lundi"    v="< 10h" />
            <InfoRow l="Blackout vendredi" v="> 14h" />
            <InfoRow l="Jours prioritaires" v="Mar, Mer, Jeu" c={pro.ok} />
          </div>
        </Section>

        <Section title="Paramètres appels" icon={Phone}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <NumInput label="Durée max" value={config.maxCallDuration} min={60} unit="sec"
              onChange={v => setConfig(p => ({ ...p, maxCallDuration: v }))} />
            <NumInput label="Délai re-tentative" value={config.retryDelay} min={300} unit="sec"
              onChange={v => setConfig(p => ({ ...p, retryDelay: v }))} />
            <NumInput label="Tentatives max" value={config.maxRetries} min={1} max={10}
              onChange={v => setConfig(p => ({ ...p, maxRetries: v }))} />
            <NumInput label="Silence timeout" value={config.vapiSilenceTimeout} min={5} max={60} unit="sec"
              onChange={v => setConfig(p => ({ ...p, vapiSilenceTimeout: v }))} />
          </div>
          <div className="pt-3" style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
            <InfoRow l="Durée max VAPI"   v={`${config.vapiMaxDuration}s (${Math.round(config.vapiMaxDuration / 60)}min)`} />
            <InfoRow l="Seuil interruption" v={`${config.vapiInterruptionMs}ms`} />
            <InfoRow l="Seuil lead chaud"  v="Score ≥ 8/10" c={pro.ok} />
            <InfoRow l="Seuil lead qualifié" v="Score ≥ 6/10" c={pro.warn} />
            <InfoRow l="SMS activé"        v={config.smsEnabled ? 'Oui' : 'Non'} c={config.smsEnabled ? pro.ok : pro.bad} />
          </div>
        </Section>
      </div>

      {/* ── SECTION 2: VAPI Voice & Prospection ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Voix & VAPI" icon={Mic}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[10px] mb-1 block" style={{ color: pro.textSec }}>Modèle AI</label>
              <input type="text" value={config.vapiModel} readOnly
                className={`${inputCls} opacity-60`} style={inputStyle} />
            </div>
            <div>
              <label className="text-[10px] mb-1 block" style={{ color: pro.textSec }}>Voice ID (ElevenLabs)</label>
              <input type="text" value={config.vapiVoiceId} readOnly
                className={`${inputCls} opacity-60 text-[10px]`} style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { l: 'Stabilité',  v: config.vapiStability },
              { l: 'Similarité', v: config.vapiSimilarityBoost },
              { l: 'Style',      v: config.vapiStyle },
            ].map(s => (
              <div key={s.l} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-lg font-bold tabular-nums" style={{ color: pro.text }}>{s.v}</p>
                <p className="text-[8px] uppercase mt-1" style={{ color: pro.textSec }}>{s.l}</p>
              </div>
            ))}
          </div>
          <InfoRow l="Latence optimisée" v={`Niveau ${config.vapiLatency}`} />
          <InfoRow l="Voix Ashley (EN)"  v="Rachel — ElevenLabs" />
          <InfoRow l="Voix Marie (FR)"   v="Amélie — ElevenLabs" />
          <InfoRow l="Filler injection"  v="Activé" c={pro.ok} />
          <InfoRow l="Speaker boost"     v="Activé" c={pro.ok} />
          <InfoRow l="Streaming TTS"     v="Activé (FR)" c={pro.ok} />
          <InfoRow l="Tutoiement FR"     v="salon, restaurant, garage" />
          <InfoRow l="Vouvoiement FR"    v="law, medical, hotel" />
        </Section>

        <Section title="Prospection" icon={Target}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <NumInput label="Quota / jour" value={config.prospectionQuotaPerDay} min={1} max={500}
              onChange={v => setConfig(p => ({ ...p, prospectionQuotaPerDay: v }))} />
            <NumInput label="Score minimum" value={config.minPriorityScore} min={0} max={22}
              onChange={v => setConfig(p => ({ ...p, minPriorityScore: v }))} />
          </div>

          <label className="text-[10px] mb-2 block" style={{ color: pro.textSec }}>Niches ciblées</label>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {NICHES.map(n => {
              const on = config.targetNiches.includes(n.id);
              return (
                <button key={n.id} onClick={() => toggleNiche(n.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={on
                    ? { background: 'rgba(255,255,255,0.06)', borderColor: pro.borderHi, color: pro.text }
                    : { background: 'rgba(255,255,255,0.02)', borderColor: pro.border, color: pro.textSec }}>
                  {n.label} ({n.score}pts)
                </button>
              );
            })}
          </div>

          <label className="text-[10px] mb-1.5 block" style={{ color: pro.textSec }}>Villes de prospection</label>
          <div className="flex gap-2 mb-2">
            <input type="text" value={newCity} onChange={e => setNewCity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCity('targetCities', newCity, setNewCity)}
              placeholder="Ajouter une ville..."
              className={`${inputCls} flex-1`} style={inputStyle} />
            <button onClick={() => addCity('targetCities', newCity, setNewCity)}
              className="px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', color: pro.textSec, border: `1px solid ${pro.border}` }}>+</button>
          </div>
          <div className="flex flex-wrap gap-1 mb-4">
            {config.targetCities.map(c => (
              <span key={c} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${pro.border}`, color: pro.text }}>
                {c}
                <button onClick={() => removeCity('targetCities', c)} className="ml-0.5" style={{ color: pro.bad }}>×</button>
              </span>
            ))}
          </div>

          <div className="pt-3" style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
            <InfoRow l="Rayon scraping"   v={`${config.prospectionRadius}m`} />
            <InfoRow l="Score max possible" v="22 points" />
            <InfoRow l="Local presence"   v={`${prospecting?.localPresenceNumbers ?? 20} numéros US`} />
            <InfoRow l="Variantes A/B"    v="2 scripts / niche" />
            <InfoRow l="Seuil A/B winner" v="200 appels + 15% diff" c={pro.ok} />
          </div>
        </Section>
      </div>

      {/* ── SECTION 3: Apify Scraping ────────────────────────────────────────── */}
      <Section title="Scraping Apify (Google Maps)" icon={Search} defaultOpen={false}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] mb-1.5 block" style={{ color: pro.textSec }}>Villes Apify scraping</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newApifyCity} onChange={e => setNewApifyCity(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCity('apifyTargetCities', newApifyCity, setNewApifyCity)}
                placeholder="Ajouter une ville..."
                className={`${inputCls} flex-1`} style={inputStyle} />
              <button onClick={() => addCity('apifyTargetCities', newApifyCity, setNewApifyCity)}
                className="px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.06)', color: pro.textSec, border: `1px solid ${pro.border}` }}>+</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {config.apifyTargetCities.map(c => (
                <span key={c} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${pro.border}`, color: pro.text }}>
                  {c}
                  <button onClick={() => removeCity('apifyTargetCities', c)} className="ml-0.5" style={{ color: pro.bad }}>×</button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <InfoRow l="Actor Apify"     v="compass~crawler-google-places" />
            <InfoRow l="Schedule"        v="Tous les jours 2h UTC" />
            <InfoRow l="Niches scrapées" v="home_services, dental" />
            <InfoRow l="Résultats / niche" v="~50-200 prospects" />
          </div>
        </div>
      </Section>

      {/* ── SECTION 4: AI & Follow-ups ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Intelligence artificielle" icon={Brain}>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { l: 'Mutations', v: aiStats?.totalMutations ?? 0 },
              { l: 'Tests A/B', v: aiStats?.activeTests ?? 0 },
              { l: 'Décisions', v: aiStats?.totalDecisions ?? 0 },
            ].map(s => (
              <div key={s.l} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-lg font-bold tabular-nums" style={{ color: pro.text }}>{String(s.v)}</p>
                <p className="text-[8px] uppercase mt-0.5" style={{ color: pro.textSec }}>{s.l}</p>
              </div>
            ))}
          </div>
          <InfoRow l="Ce mois"           v={String(aiStats?.mutationsThisMonth ?? 0)} c={pro.warn} />
          <InfoRow l="Reverts"           v={String(aiStats?.reverts ?? 0)}            c={pro.bad} />
          <InfoRow l="Confiance moyenne" v={`${Number(aiStats?.avgConfidenceScore ?? 0).toFixed(0)}%`} />
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: pro.textSec }}>Garde-fous IA</p>
            <InfoRow l="Max mutations / niche / sem."    v="1" />
            <InfoRow l="Max changements opening / mois"  v="1" />
            <InfoRow l="Max mots script"                v="195 (90sec)" />
            <InfoRow l="Confiance minimum"              v="75%" c={pro.warn} />
            <InfoRow l="Min data points"                v="20 appels" />
            <InfoRow l="Appels validation"              v="50 appels" />
            <InfoRow l="Moteurs"                        v="Claude + GPT-4 Turbo" />
          </div>
        </Section>

        <Section title="Follow-ups & séquences" icon={MessageSquare}>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: pro.textSec }}>Après appel qualifié</p>
          <div className="space-y-1.5 mb-4">
            {[
              { time: 'Immédiat',  type: 'SMS',   desc: 'Lien vers devis',                    color: pro.info },
              { time: 'T + 5 min', type: 'Email', desc: 'Vidéo Loom de démo',                color: pro.info },
              { time: 'T + 24h',   type: 'Email', desc: 'Rappel si devis non vu',            color: pro.warn },
              { time: 'T + 48h',   type: 'Email', desc: 'Dashboard preview + témoignage',    color: pro.bad },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.04)` }}>
                <div className="w-1 h-8 rounded-full" style={{ background: s.color }} />
                <div className="flex-1">
                  <p className="text-xs font-medium" style={{ color: pro.text }}>{s.type} — {s.desc}</p>
                  <p className="text-[10px]" style={{ color: pro.textSec }}>{s.time}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: pro.textSec }}>Callback retry (pas de réponse)</p>
          <InfoRow l="1er rappel"  v="+ 2 heures" />
          <InfoRow l="2ème rappel" v="+ 24 heures" />
          <InfoRow l="3ème rappel" v="+ 72 heures" />
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: pro.textSec }}>Détection lead chaud</p>
            <InfoRow l="Score ≥ 8" v="Discord alert + callback 5min" c={pro.ok} />
            <InfoRow l="Critères"  v="Durée, questions, prix, démo" />
          </div>
        </Section>
      </div>

      {/* ── SECTION 5: Scoring ───────────────────────────────────────────────── */}
      <Section title="Scoring prospects (max 22 pts)" icon={BarChart3} defaultOpen={false}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: pro.textSec }}>Signaux business (max 10 pts)</p>
            <InfoRow l="Google rating ≥ 4.5"     v="+3 pts" c={pro.ok} />
            <InfoRow l="Avis ≥ 50"               v="+2 pts" c={pro.ok} />
            <InfoRow l="Site web"                v="+2 pts" c={pro.ok} />
            <InfoRow l="Avis ≥ 30"               v="+2 pts" c={pro.ok} />
            <InfoRow l="Avis < 20 & rating ≥ 4.0" v="+1 pt"  c={pro.ok} />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: pro.textSec }}>Points par niche (max 8 pts)</p>
            {NICHES.map(n => (
              <InfoRow key={n.id} l={n.label} v={`${n.score} pts`} c={pro.warn} />
            ))}
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: pro.textSec }}>Signaux timing (max 4 pts)</p>
            <InfoRow l="États prioritaires (TX, FL)" v="+2 pts" c={pro.info} />
            <InfoRow l="Grandes villes US"           v="+1 pt"  c={pro.info} />
            <InfoRow l="Ancienneté business"         v="+1 pt"  c={pro.info} />
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: pro.textSec }}>Top villes</p>
              <p className="text-[10px] leading-relaxed" style={{ color: pro.textSec }}>
                Houston, Dallas, LA, Miami, Atlanta, Phoenix, San Antonio, San Diego, Orlando, Tampa
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SECTION 6: Services & santé ──────────────────────────────────────── */}
      <Section title="Services & santé" icon={Shield}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {health && [
            { k: 'vapi',     label: 'VAPI',     desc: 'Appels Voice AI' },
            { k: 'openai',   label: 'OpenAI',   desc: 'GPT-4 Turbo' },
            { k: 'twilio',   label: 'Twilio',   desc: 'SMS & validation' },
            { k: 'stripe',   label: 'Stripe',   desc: 'Paiements' },
            { k: 'resend',   label: 'Resend',   desc: 'Emails' },
            { k: 'database', label: 'Database', desc: 'PostgreSQL / Neon' },
            { k: 'discord',  label: 'Discord',  desc: 'Alertes' },
            { k: 'apify',    label: 'Apify',    desc: 'Scraping Maps' },
          ].map(s => {
            const val        = health[s.k] ?? false;
            const isOptional = val === 'optional';
            const ok         = isOptional || !!val;
            const color      = isOptional ? pro.warn : ok ? pro.ok : pro.bad;
            const bg         = isOptional ? 'rgba(245,158,11,0.05)' : ok ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)';
            return (
              <div key={s.k} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: bg, border: `1px solid ${pro.border}` }}>
                {ok
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color }} />
                  : <XCircle      className="w-4 h-4 flex-shrink-0" style={{ color }} />}
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: pro.text }}>{s.label}</p>
                  <p className="text-[9px]" style={{ color: pro.textSec }}>
                    {s.desc}{isOptional ? ' (optionnel)' : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── SECTION 7: System, DB, Crons ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Système" icon={Server}>
          <InfoRow l="Backend"      v="Render (Express/TS)" />
          <InfoRow l="Frontend"     v="Vercel (React 19/Vite)" />
          <InfoRow l="Domaine"      v="qwillio.com" />
          <InfoRow l="API"          v="qwillio.onrender.com" />
          <InfoRow l="Uptime"       v={sysInfo?.uptime ? fmtUptime(Number(sysInfo.uptime)) : '—'} c={pro.ok} />
          <InfoRow l="Node.js"      v={String(sysInfo?.nodeVersion ?? '—')} />
          <InfoRow l="Environnement" v={String(sysInfo?.env ?? '—')} />
          <InfoRow l="Timezone"     v={config.timezone} />
          <InfoRow l="Rate limit"   v="500 req / 15min" />
        </Section>

        <Section title="Base de données" icon={Database}>
          <div className="flex items-center gap-2 mb-3 p-2 rounded-xl"
            style={{ background: 'rgba(34,197,94,0.05)', border: `1px solid rgba(34,197,94,0.15)` }}>
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: pro.ok }} />
            <span className="text-xs font-semibold" style={{ color: pro.ok }}>Connectée</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { l: 'Prospects', v: sysInfo?.prospects ?? '—' },
              { l: 'Clients',   v: sysInfo?.clients   ?? '—' },
              { l: 'Appels',    v: sysInfo?.calls      ?? '—' },
            ].map(s => (
              <div key={s.l} className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-base font-bold tabular-nums" style={{ color: pro.text }}>{String(s.v)}</p>
                <p className="text-[8px] uppercase" style={{ color: pro.textSec }}>{s.l}</p>
              </div>
            ))}
          </div>
          <InfoRow l="ORM"      v="Prisma" />
          <InfoRow l="Modèles"  v="45 tables" />
          <InfoRow l="Provider" v="Neon (prod) / PG16 (local)" />
          <InfoRow l="Logs max" v="500 entrées in-memory" />
        </Section>

        <Section title="Cron Jobs (26)" icon={Timer}>
          <div className="space-y-0 text-[10px]">
            {[
              { l: 'Prospection',          v: '9h Lun-Ven' },
              { l: 'Appels sortants',      v: '*/20min 9-17h' },
              { l: 'Follow-ups',           v: '*/30min' },
              { l: 'Follow-ups client',    v: 'Chaque heure' },
              { l: 'Analytics',            v: '23h55' },
              { l: 'Reset quotidien',      v: '00h01' },
              { l: 'Trial check',          v: '8h' },
              { l: 'Onboarding retry',     v: '*/5min' },
              { l: 'Booking rappels',      v: '*/h à :30' },
              { l: 'Client analytics',     v: '23h50' },
              { l: 'AI optimization',      v: 'Dim 0h' },
              { l: 'Phone validation',     v: '*/10min' },
              { l: 'Niche learning',       v: 'Dim 1h' },
              { l: 'Stale call cleanup',   v: '*/15min' },
              { l: 'Agent payments',       v: '*/h à :15' },
              { l: 'Agent accounting',     v: '1er du mois 2h' },
              { l: 'Agent inventory',      v: '*/6h' },
              { l: 'Agent inv. forecast',  v: '3h' },
              { l: 'Agent email sync',     v: '*/10min' },
              { l: 'Agent email follow',   v: '*/h à :30' },
              { l: 'Apify scraping',       v: '2h UTC' },
              { l: 'Outbound engine',      v: '*/20min 9-17 CT' },
              { l: 'A/B analysis',         v: '6h UTC' },
              { l: 'Best-time learning',   v: '4h UTC' },
              { l: 'Script learning',      v: 'Dim 1h UTC' },
              { l: 'Rescoring',            v: 'On-demand' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1 last:border-0"
                   style={{ borderBottom: `1px solid rgba(255,255,255,0.02)` }}>
                <span style={{ color: pro.textSec }}>{r.l}</span>
                <span className="font-mono" style={{ color: pro.text }}>{r.v}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── SECTION 8: Tarifs + Email + Sécurité ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Grille tarifaire" icon={DollarSign}>
          <div className="space-y-2">
            {[
              { plan: 'Starter',    monthly: '$197', setup: '$697',   calls: '200',  overage: '$0.22', color: pro.info },
              { plan: 'Pro',        monthly: '$347', setup: '$997',   calls: '500',  overage: '$0.18', color: pro.textSec },
              { plan: 'Enterprise', monthly: '$497', setup: '$1,497', calls: '1000', overage: '$0.15', color: pro.warn },
            ].map(p => (
              <div key={p.plan} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.04)` }}>
                <div className="w-1.5 h-10 rounded-full" style={{ background: p.color }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: pro.text }}>{p.plan}</p>
                  <p className="text-[10px]" style={{ color: pro.textSec }}>{p.calls} appels/mois · Surplus: {p.overage}/appel</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: pro.text }}>{p.monthly}/mo</p>
                  <p className="text-[10px]" style={{ color: pro.textSec }}>+ {p.setup} setup</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Email & notifications" icon={Mail}>
          <InfoRow l="Provider"    v="Resend" />
          <InfoRow l="From"        v={config.resendFrom} />
          <InfoRow l="Reply-to"    v={config.resendReplyTo} />
          <InfoRow l="SMS Provider" v="Twilio" />
          <InfoRow l="SMS actif"   v={config.smsEnabled ? 'Oui' : 'Non'} c={config.smsEnabled ? pro.ok : pro.bad} />
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: pro.textSec }}>Discord Webhooks</p>
            <InfoRow l="Principal" v="Configuré"     c={pro.ok} />
            <InfoRow l="Appels"    v="Canal dédié" />
            <InfoRow l="Leads"     v="Canal dédié" />
            <InfoRow l="Système"   v="Canal dédié" />
            <InfoRow l="Alertes"   v="Canal dédié" />
          </div>
        </Section>

        <Section title="Sécurité & auth" icon={Lock}>
          <InfoRow l="JWT expiration"  v={config.jwtExpiresIn} />
          <InfoRow l="Refresh token"   v="7 jours" />
          <InfoRow l="Bcrypt rounds"   v={String(config.bcryptRounds)} />
          <InfoRow l="Google OAuth"    v="Activé"    c={pro.ok} />
          <InfoRow l="DocuSign"        v="Configuré" c={pro.ok} />
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: pro.textSec }}>Protection</p>
            <InfoRow l="Rate limiting" v="500 req / 15min" />
            <InfoRow l="CORS"          v="Whitelist domains" />
            <InfoRow l="Helmet"        v="Security headers" />
            <InfoRow l="Trial abuse"   v="Fingerprinting actif" c={pro.ok} />
          </div>
        </Section>
      </div>

      {/* ── SECTION 9: Env vars ───────────────────────────────────────────────── */}
      <Section title="Variables d'environnement (45+)" icon={Key} defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
          {[
            { cat: 'VAPI',        vars: ['VAPI_PRIVATE_KEY', 'VAPI_PUBLIC_KEY', 'VAPI_ASSISTANT_ID', 'VAPI_PHONE_NUMBER_ID', 'VAPI_WEBHOOK_SECRET'] },
            { cat: 'AI',          vars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'] },
            { cat: 'Twilio',      vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_PHONE_NUMBER'] },
            { cat: 'Stripe',      vars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'] },
            { cat: 'Email',       vars: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_REPLY_TO'] },
            { cat: 'Discord',     vars: ['DISCORD_WEBHOOK_URL', 'DISCORD_WEBHOOK_CALLS', 'DISCORD_WEBHOOK_LEADS', 'DISCORD_WEBHOOK_SYSTEM', 'DISCORD_WEBHOOK_ALERTS'] },
            { cat: 'Auth',        vars: ['JWT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_PLACES_API_KEY'] },
            { cat: 'DocuSign',    vars: ['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_USER_ID', 'DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_PRIVATE_KEY'] },
            { cat: 'Infra',       vars: ['DATABASE_URL', 'NODE_ENV', 'PORT', 'FRONTEND_URL', 'API_BASE_URL', 'TZ', 'SENTRY_DSN'] },
            { cat: 'Prospection', vars: ['APIFY_API_KEY', 'APIFY_ACTOR_ID', 'CALLS_PER_DAY', 'AUTOMATION_START_HOUR', 'AUTOMATION_END_HOUR', 'CALL_INTERVAL_MINUTES', 'MIN_PRIORITY_SCORE'] },
            { cat: 'Admin',       vars: ['ADMIN_EMAIL', 'ADMIN_SECRET'] },
            { cat: 'Démo',        vars: ['DEMO_LINK_EN', 'DEMO_LINK_FR'] },
          ].map(group => (
            <div key={group.cat} className="mb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: pro.textSec }}>{group.cat}</p>
              {group.vars.map(v => (
                <div key={v} className="flex items-center gap-1.5 py-1"
                     style={{ borderBottom: `1px solid rgba(255,255,255,0.02)` }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pro.ok }} />
                  <span className="text-[10px] font-mono truncate" style={{ color: pro.textSec }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* ── SECTION 10: Local Presence ────────────────────────────────────────── */}
      <Section title="Local presence dialing (20 numéros)" icon={MapPin} defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {[
            { code: '212', city: 'New York' },      { code: '310', city: 'Los Angeles' },
            { code: '312', city: 'Chicago' },        { code: '713', city: 'Houston' },
            { code: '602', city: 'Phoenix' },        { code: '215', city: 'Philadelphia' },
            { code: '210', city: 'San Antonio' },    { code: '619', city: 'San Diego' },
            { code: '214', city: 'Dallas' },         { code: '408', city: 'San Jose' },
            { code: '512', city: 'Austin' },         { code: '617', city: 'Boston' },
            { code: '415', city: 'San Francisco' },  { code: '303', city: 'Denver' },
            { code: '404', city: 'Atlanta' },        { code: '305', city: 'Miami' },
            { code: '702', city: 'Las Vegas' },      { code: '206', city: 'Seattle' },
            { code: '615', city: 'Nashville' },      { code: '504', city: 'New Orleans' },
          ].map(n => (
            <div key={n.code} className="p-2 rounded-lg text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.04)` }}>
              <p className="text-sm font-bold font-mono" style={{ color: pro.textSec }}>{n.code}</p>
              <p className="text-[9px]" style={{ color: pro.textTer }}>{n.city}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── DANGER ZONE ───────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl"
           style={{ background: 'rgba(239,68,68,0.05)', border: `1px solid rgba(239,68,68,0.2)` }}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4" style={{ color: pro.bad }} />
          <h3 className="text-sm font-semibold" style={{ color: pro.bad }}>Zone dangereuse</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setConfirmPause(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(239,68,68,0.10)', border: `1px solid rgba(239,68,68,0.3)`, color: pro.bad }}>
            Arrêter le bot
          </button>
          <button
            onClick={() => setConfirmResume(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(34,197,94,0.10)', border: `1px solid rgba(34,197,94,0.3)`, color: pro.ok }}>
            Démarrer le bot
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPause}
        title="Arrêter le bot"
        message="Arrêter immédiatement toutes les opérations du bot ?"
        confirmLabel="Arrêter"
        onConfirm={pauseAll}
        onCancel={() => setConfirmPause(false)}
      />
      <ConfirmDialog
        open={confirmResume}
        title="Démarrer le bot"
        message="Relancer le bot et reprendre les opérations ?"
        confirmLabel="Démarrer"
        danger={false}
        onConfirm={resumeAll}
        onCancel={() => setConfirmResume(false)}
      />
      </>)}
    </div>
  );
}
