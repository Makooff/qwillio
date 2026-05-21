import { useEffect, useState } from 'react';
import api from '../services/api';
import { BotStatus } from '../types';
import {
  Bot, Zap, Play, Square, Loader2,
  Bot as BotIcon, Mic2, Search, Save, RotateCcw, CheckCircle2, AlertCircle,
  Clock, MapPin, ChevronDown, ChevronUp, Radio,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer', thursday: 'Jeu',
  friday: 'Ven', saturday: 'Sam', sunday: 'Dim',
};
const VOICES = [
  { id: 'jennifer-playht', label: 'Jennifer (PlayHT)' },
  { id: 'ashley-playht', label: 'Ashley (PlayHT)' },
  { id: 'alloy', label: 'Alloy (OpenAI)' },
  { id: 'echo', label: 'Echo (OpenAI)' },
  { id: 'nova', label: 'Nova (OpenAI)' },
  { id: 'shimmer', label: 'Shimmer (OpenAI)' },
];
const NICHES = [
  { id: 'home_services', label: 'Home Services' },
  { id: 'dental', label: 'Dental' },
  { id: 'salon', label: 'Salon' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'law', label: 'Law' },
  { id: 'garage', label: 'Garage / Auto' },
];

// ── Types ──────────────────────────────────────────────────────────────────

interface BotConfig {
  callsPerDay: number;
  callWindowStart: number;
  callWindowEnd: number;
  activeDays: string[];
  callIntervalMinutes: number;
  prospectionQuotaPerDay: number;
  minPriorityScore: number;
  targetCities: string[];
  vapiAssistantId: string;
  vapiVoiceId: string;
  maxCallDurationMin: number;
  silenceTimeoutSeconds: number;
  apifyActorId: string;
  targetNiches: string[];
  apifyTargetCities: string[];
}

const DEFAULT_CONFIG: BotConfig = {
  callsPerDay: 50,
  callWindowStart: 9,
  callWindowEnd: 19,
  activeDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  callIntervalMinutes: 20,
  prospectionQuotaPerDay: 100,
  minPriorityScore: 0,
  targetCities: [],
  vapiAssistantId: '',
  vapiVoiceId: 'jennifer-playht',
  maxCallDurationMin: 10,
  silenceTimeoutSeconds: 30,
  apifyActorId: '',
  targetNiches: [],
  apifyTargetCities: [],
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Shared input styles ────────────────────────────────────────────────────

const inputCls = [
  'w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none transition-colors',
  'bg-white/[0.04] border border-white/[0.08]',
  'focus:border-[oklch(56%_0.22_264)/50] placeholder-white/25',
].join(' ');

const selectCls = inputCls + ' appearance-none cursor-pointer';

// ── Sub-components ─────────────────────────────────────────────────────────

function SaveIcon({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <><RotateCcw className="w-4 h-4 animate-spin" aria-hidden="true" /> Sauvegarde…</>;
  if (status === 'saved') return <><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Sauvegardé</>;
  if (status === 'error') return <><AlertCircle className="w-4 h-4" aria-hidden="true" /> Erreur</>;
  return <><Save className="w-4 h-4" aria-hidden="true" /> Sauvegarder</>;
}

function ConfigSection({
  icon, title, children, saveStatus, onSave, accent = 'indigo',
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  saveStatus: SaveStatus;
  onSave: () => void;
  accent?: 'indigo' | 'violet';
}) {
  const btnBg = accent === 'violet'
    ? 'bg-[oklch(67%_0.26_299)] hover:bg-[oklch(63%_0.24_299)]'
    : 'bg-[oklch(56%_0.22_264)] hover:bg-[oklch(52%_0.22_264)]';
  const iconColor = accent === 'violet' ? 'text-[oklch(67%_0.26_299)]' : 'text-[oklch(74%_0.18_264)]';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0 ${iconColor}`}>
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors disabled:opacity-50 ${btnBg}`}
        >
          <SaveIcon status={saveStatus} />
        </button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-white/50 mb-2">{label}</label>
      {children}
    </div>
  );
}

function TagInput({
  tags, inputValue, onInputChange, onAdd, onRemove, placeholder, icon,
}: {
  tags: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
  placeholder: string;
  icon: React.ReactNode;
}) {
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); onAdd(); }
  };
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" aria-hidden="true">{icon}</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            className={inputCls + ' pl-9'}
          />
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 bg-white/[0.05] hover:bg-white/[0.08] transition-colors"
        >
          Ajouter
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: 'oklch(56% 0.22 264 / 0.15)', color: 'oklch(74% 0.18 264)' }}
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="leading-none font-bold hover:opacity-70 transition-opacity"
                aria-label={`Retirer ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Settings ──────────────────────────────────────────────────────────

export default function Settings() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState('');
  const [message, setMessage] = useState('');

  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [botSave, setBotSave] = useState<SaveStatus>('idle');
  const [vapiSave, setVapiSave] = useState<SaveStatus>('idle');
  const [prospectSave, setProspectSave] = useState<SaveStatus>('idle');
  const [cityInput, setCityInput] = useState('');
  const [apifyCityInput, setApifyCityInput] = useState('');
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 10_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.get('/admin/bot-config')
      .then(({ data }) => {
        setConfig({
          callsPerDay: data.callsPerDay ?? 50,
          callWindowStart: data.callWindowStart ?? 9,
          callWindowEnd: data.callWindowEnd ?? 19,
          activeDays: data.activeDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          callIntervalMinutes: data.callIntervalMinutes ?? 20,
          prospectionQuotaPerDay: data.prospectionQuotaPerDay ?? 100,
          minPriorityScore: data.minPriorityScore ?? 0,
          targetCities: data.targetCities ?? [],
          vapiAssistantId: data.vapiAssistantId ?? '',
          vapiVoiceId: data.vapiVoiceId ?? 'jennifer-playht',
          maxCallDurationMin: data.maxCallDurationMin ?? 10,
          silenceTimeoutSeconds: data.silenceTimeoutSeconds ?? 30,
          apifyActorId: data.apifyActorId ?? '',
          targetNiches: data.targetNiches ?? [],
          apifyTargetCities: data.apifyTargetCities ?? [],
        });
      })
      .catch(() => { /* config unavailable — defaults remain */ })
      .finally(() => setConfigLoading(false));
  }, []);

  const fetchBotStatus = async () => {
    try {
      const { data } = await api.get('/bot/status');
      setBotStatus(data);
    } catch {
      // status unavailable — ignore
    } finally {
      setLoading(false);
    }
  };

  const toggleBot = async () => {
    setToggling(true);
    setMessage('');
    try {
      if (botStatus?.isActive) {
        await api.post('/bot/stop');
        setMessage('Bot arrêté');
      } else {
        await api.post('/bot/start');
        setMessage('Bot démarré — tous les crons sont actifs.');
      }
      await fetchBotStatus();
    } catch {
      setMessage('Erreur lors du basculement du bot');
    } finally {
      setToggling(false);
    }
  };

  const triggerAction = async (action: string) => {
    setTriggerLoading(action);
    setMessage('');
    try {
      const { data } = await api.post(`/bot/trigger/${action}`);
      setMessage(data.message);
      await fetchBotStatus();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur';
      setMessage(msg);
    } finally {
      setTriggerLoading('');
    }
  };

  const set = (key: keyof BotConfig, value: unknown) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: string) => {
    set('activeDays', config.activeDays.includes(day)
      ? config.activeDays.filter((d) => d !== day)
      : [...config.activeDays, day]);
  };

  const toggleNiche = (niche: string) => {
    set('targetNiches', config.targetNiches.includes(niche)
      ? config.targetNiches.filter((n) => n !== niche)
      : [...config.targetNiches, niche]);
  };

  const addCity = (field: 'targetCities' | 'apifyTargetCities', value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const list = config[field] as string[];
    if (!list.includes(trimmed)) set(field, [...list, trimmed]);
    if (field === 'targetCities') setCityInput('');
    else setApifyCityInput('');
  };

  const removeCity = (field: 'targetCities' | 'apifyTargetCities', city: string) => {
    set(field, (config[field] as string[]).filter((c) => c !== city));
  };

  const saveSection = async (
    section: 'bot' | 'vapi' | 'prospect',
    setSave: (s: SaveStatus) => void,
  ) => {
    setSave('saving');
    try {
      const payload: Partial<BotConfig> = {};
      if (section === 'bot') {
        Object.assign(payload, {
          callsPerDay: config.callsPerDay,
          callWindowStart: config.callWindowStart,
          callWindowEnd: config.callWindowEnd,
          activeDays: config.activeDays,
          callIntervalMinutes: config.callIntervalMinutes,
          prospectionQuotaPerDay: config.prospectionQuotaPerDay,
          minPriorityScore: config.minPriorityScore,
          targetCities: config.targetCities,
        });
      } else if (section === 'vapi') {
        Object.assign(payload, {
          vapiAssistantId: config.vapiAssistantId,
          vapiVoiceId: config.vapiVoiceId,
          maxCallDurationMin: config.maxCallDurationMin,
          silenceTimeoutSeconds: config.silenceTimeoutSeconds,
        });
      } else {
        Object.assign(payload, {
          apifyActorId: config.apifyActorId,
          targetNiches: config.targetNiches,
          apifyTargetCities: config.apifyTargetCities,
        });
      }
      await api.post('/admin/bot-config', payload);
      setSave('saved');
      setTimeout(() => setSave('idle'), 2_500);
    } catch {
      setSave('error');
      setTimeout(() => setSave('idle'), 3_000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Chargement">
        <div
          className="w-9 h-9 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: 'oklch(56% 0.22 264)', borderRightColor: 'oklch(56% 0.22 264)' }}
        />
      </div>
    );
  }

  const isActive = botStatus?.isActive ?? false;

  return (
    <main aria-label="Réglages" className="space-y-5 max-w-3xl">
      {/* Page header */}
      <header>
        <h1 className="text-2xl font-bold text-white tracking-tight">Réglages</h1>
        <p className="text-sm text-white/35 mt-0.5">Configuration du bot et du système automatique</p>
      </header>

      {/* Feedback banner */}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="px-4 py-3 rounded-xl text-sm font-medium border"
          style={
            message.startsWith('Erreur')
              ? { background: 'oklch(60% 0.22 25 / 0.08)', borderColor: 'oklch(60% 0.22 25 / 0.25)', color: 'oklch(68% 0.22 25)' }
              : { background: 'oklch(74% 0.18 155 / 0.08)', borderColor: 'oklch(74% 0.18 155 / 0.25)', color: 'oklch(74% 0.18 155)' }
          }
        >
          {message}
        </div>
      )}

      {/* ── Bot Control ─────────────────────────────────────────── */}
      <section
        aria-labelledby="bot-control-heading"
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-5"
      >
        <h2 id="bot-control-heading" className="text-base font-semibold text-white flex items-center gap-2">
          <Bot className="w-5 h-5" style={{ color: 'oklch(67% 0.26 299)' }} aria-hidden="true" />
          Contrôle du Bot
        </h2>

        {/* Status row */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className={`w-3 h-3 rounded-full flex-shrink-0 ${isActive ? 'animate-pulse' : ''}`}
              style={{ background: isActive ? 'oklch(74% 0.18 155)' : 'oklch(50% 0 0)' }}
            />
            <div>
              <p className="text-sm font-semibold text-white">
                {isActive ? 'Bot actif' : 'Bot inactif'}
              </p>
              <p className="text-xs text-white/35 mt-0.5">
                {botStatus?.callsToday ?? 0} appels aujourd'hui — quota {botStatus?.callsQuotaDaily ?? 50}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleBot}
            disabled={toggling}
            aria-label={isActive ? 'Arrêter le bot' : 'Démarrer le bot'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{
              background: isActive ? 'oklch(60% 0.22 25)' : 'oklch(56% 0.22 264)',
            }}
          >
            {toggling
              ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Chargement…</>
              : isActive
                ? <><Square className="w-4 h-4" aria-hidden="true" /> Arrêter</>
                : <><Play className="w-4 h-4" aria-hidden="true" /> Démarrer</>
            }
          </button>
        </div>

        {/* Cron status */}
        {botStatus?.crons && (
          <div
            role="list"
            aria-label="État des crons"
            className="grid grid-cols-2 md:grid-cols-5 gap-2"
          >
            {Object.entries(botStatus.crons).slice(0, 5).map(([name, status]) => {
              const isRunning = status === 'active';
              const isIdle = status === 'idle';
              return (
                <div
                  key={name}
                  role="listitem"
                  className="p-3 rounded-xl text-center border"
                  style={{
                    background: isRunning
                      ? 'oklch(74% 0.18 155 / 0.06)'
                      : isIdle
                        ? 'oklch(56% 0.22 264 / 0.06)'
                        : 'oklch(50% 0 0 / 0.06)',
                    borderColor: isRunning
                      ? 'oklch(74% 0.18 155 / 0.2)'
                      : isIdle
                        ? 'oklch(56% 0.22 264 / 0.2)'
                        : 'oklch(100% 0 0 / 0.06)',
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full mx-auto mb-1.5"
                    style={{
                      background: isRunning
                        ? 'oklch(74% 0.18 155)'
                        : isIdle
                          ? 'oklch(56% 0.22 264)'
                          : 'oklch(50% 0 0)',
                    }}
                  />
                  <p className="text-xs font-medium text-white/70 truncate capitalize">{name}</p>
                  <p className="text-[10px] mt-0.5"
                    style={{
                      color: isRunning
                        ? 'oklch(74% 0.18 155)'
                        : isIdle
                          ? 'oklch(74% 0.18 264)'
                          : 'oklch(50% 0 0)',
                    }}
                  >
                    {isRunning ? 'Actif' : isIdle ? 'En attente' : 'Inactif'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Last activity */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <p className="text-xs text-white/30 mb-1">Dernière prospection</p>
            <p className="text-sm font-medium text-white/80">
              {botStatus?.lastProspection
                ? new Date(botStatus.lastProspection).toLocaleString('fr-FR')
                : 'Jamais'}
            </p>
          </div>
          <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <p className="text-xs text-white/30 mb-1">Dernier appel</p>
            <p className="text-sm font-medium text-white/80">
              {botStatus?.lastCall
                ? new Date(botStatus.lastCall).toLocaleString('fr-FR')
                : 'Jamais'}
            </p>
          </div>
        </div>
      </section>

      {/* ── Manual Triggers ─────────────────────────────────────── */}
      <section
        aria-labelledby="triggers-heading"
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
      >
        <h2 id="triggers-heading" className="text-base font-semibold text-white flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-amber-400" aria-hidden="true" />
          Actions manuelles
        </h2>
        <p className="text-xs text-white/35 mb-4">Déclenchez les actions du bot pour tester.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              action: 'call',
              label: 'Appeler',
              description: 'Appeler le prochain prospect via VAPI',
              icon: (
                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              ),
            },
            {
              action: 'reminders',
              label: 'Relances',
              description: 'Envoyer les relances email en attente',
              icon: (
                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              ),
            },
          ].map(({ action, label, description, icon }) => (
            <button
              key={action}
              type="button"
              onClick={() => triggerAction(action)}
              disabled={triggerLoading === action}
              className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] text-left transition-colors disabled:opacity-50"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'oklch(56% 0.22 264 / 0.12)', color: 'oklch(74% 0.18 264)' }}
              >
                {triggerLoading === action
                  ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  : icon
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {triggerLoading === action ? 'En cours…' : label}
                </p>
                <p className="text-xs text-white/35 mt-0.5">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Automation schedule ──────────────────────────────────── */}
      <section
        aria-labelledby="schedule-heading"
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
      >
        <h2 id="schedule-heading" className="text-base font-semibold text-white mb-4">Boucle automatique</h2>
        <dl className="space-y-2 font-mono text-xs text-white/50">
          {[
            ['Prospection', 'Tous les jours à 9h (lun–ven)'],
            ['Appels', 'Toutes les 20 min, 9h–19h (lun–ven)'],
            ['Relances', 'Toutes les heures'],
            ['Analytics', 'Tous les jours à 23h55'],
            ['Reset quotidien', 'Tous les jours à 00h01'],
          ].map(([term, detail]) => (
            <div key={term} className="flex gap-3">
              <dt className="font-semibold text-white/60 flex-shrink-0 w-36">{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Advanced config (collapsible) ───────────────────────── */}
      <section aria-labelledby="advanced-heading" className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setConfigOpen(!configOpen)}
          aria-expanded={configOpen}
          aria-controls="advanced-config-panel"
          className="w-full flex items-center justify-between p-5"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'oklch(67% 0.26 299 / 0.12)', color: 'oklch(67% 0.26 299)' }}
            >
              <Radio className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="text-left">
              <h2 id="advanced-heading" className="text-sm font-semibold text-white">Configuration avancée</h2>
              <p className="text-xs text-white/35 mt-0.5">Bot, VAPI, Prospection</p>
            </div>
          </div>
          {configOpen
            ? <ChevronUp className="w-4 h-4 text-white/30 flex-shrink-0" aria-hidden="true" />
            : <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" aria-hidden="true" />
          }
        </button>

        {configOpen && (
          <div id="advanced-config-panel" className="px-5 pb-5 space-y-4">
            {configLoading ? (
              <div className="flex items-center justify-center py-10" role="status" aria-label="Chargement">
                <div
                  className="w-8 h-8 rounded-full border-2 border-transparent animate-spin"
                  style={{ borderTopColor: 'oklch(56% 0.22 264)' }}
                />
              </div>
            ) : (
              <>
                {/* Bot config */}
                <ConfigSection
                  icon={<BotIcon className="w-5 h-5" />}
                  title="Configuration du Bot"
                  saveStatus={botSave}
                  onSave={() => saveSection('bot', setBotSave)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Appels par jour">
                      <input
                        type="number" min={1} max={500}
                        value={config.callsPerDay}
                        onChange={(e) => set('callsPerDay', +e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                    <Field label={`Intervalle entre appels: ${config.callIntervalMinutes} min`}>
                      <input
                        type="range" min={5} max={60} step={5}
                        value={config.callIntervalMinutes}
                        onChange={(e) => set('callIntervalMinutes', +e.target.value)}
                        className="w-full accent-[oklch(56%_0.22_264)]"
                      />
                      <div className="flex justify-between text-xs text-white/25 mt-1"><span>5 min</span><span>60 min</span></div>
                    </Field>
                    <Field label="Plage d'appels (début vers fin)">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-white/30 flex-shrink-0" aria-hidden="true" />
                        <input type="number" min={0} max={23} value={config.callWindowStart}
                          onChange={(e) => set('callWindowStart', +e.target.value)} className={inputCls} />
                        <span className="text-white/30" aria-hidden="true">→</span>
                        <input type="number" min={0} max={23} value={config.callWindowEnd}
                          onChange={(e) => set('callWindowEnd', +e.target.value)} className={inputCls} />
                        <span className="text-xs text-white/30" aria-hidden="true">h</span>
                      </div>
                    </Field>
                    <Field label="Quota de prospection par jour">
                      <input type="number" min={1} max={1000}
                        value={config.prospectionQuotaPerDay}
                        onChange={(e) => set('prospectionQuotaPerDay', +e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Jours actifs" className="mt-4">
                    <div className="flex gap-2 flex-wrap" role="group" aria-label="Jours actifs">
                      {DAYS.map((day) => {
                        const active = config.activeDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            aria-pressed={active}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                            style={{
                              background: active ? 'oklch(56% 0.22 264)' : 'oklch(100% 0 0 / 0.04)',
                              borderColor: active ? 'oklch(56% 0.22 264)' : 'oklch(100% 0 0 / 0.08)',
                              color: active ? 'oklch(98% 0.004 265)' : 'oklch(70% 0 0)',
                            }}
                          >
                            {DAY_LABELS[day]}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label={`Score priorité minimum: ${config.minPriorityScore}`} className="mt-4">
                    <input type="range" min={0} max={22} step={1}
                      value={config.minPriorityScore}
                      onChange={(e) => set('minPriorityScore', +e.target.value)}
                      className="w-full accent-[oklch(56%_0.22_264)]"
                    />
                    <div className="flex justify-between text-xs text-white/25 mt-1"><span>0 (tous)</span><span>22 (max)</span></div>
                  </Field>
                  <Field label="Villes cibles" className="mt-4">
                    <TagInput
                      tags={config.targetCities} inputValue={cityInput}
                      onInputChange={setCityInput}
                      onAdd={() => addCity('targetCities', cityInput)}
                      onRemove={(c) => removeCity('targetCities', c)}
                      placeholder="Ex: Paris, Lyon…"
                      icon={<MapPin className="w-4 h-4" />}
                    />
                  </Field>
                </ConfigSection>

                {/* VAPI config */}
                <ConfigSection
                  icon={<Mic2 className="w-5 h-5" />}
                  title="Configuration VAPI"
                  saveStatus={vapiSave}
                  onSave={() => saveSection('vapi', setVapiSave)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Assistant ID (VAPI)">
                      <input type="text" value={config.vapiAssistantId}
                        onChange={(e) => set('vapiAssistantId', e.target.value)}
                        placeholder="vapi-assistant-xxxxx"
                        className={inputCls + ' font-mono text-xs'}
                      />
                    </Field>
                    <Field label="Voice ID">
                      <select value={config.vapiVoiceId}
                        onChange={(e) => set('vapiVoiceId', e.target.value)}
                        className={selectCls}
                      >
                        {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        {!VOICES.find((v) => v.id === config.vapiVoiceId) && (
                          <option value={config.vapiVoiceId}>{config.vapiVoiceId || 'Personnalisé…'}</option>
                        )}
                      </select>
                    </Field>
                    <Field label={`Durée max d'appel: ${config.maxCallDurationMin} min`}>
                      <input type="range" min={1} max={30} step={1}
                        value={config.maxCallDurationMin}
                        onChange={(e) => set('maxCallDurationMin', +e.target.value)}
                        className="w-full accent-[oklch(56%_0.22_264)]"
                      />
                      <div className="flex justify-between text-xs text-white/25 mt-1"><span>1 min</span><span>30 min</span></div>
                    </Field>
                    <Field label={`Silence timeout: ${config.silenceTimeoutSeconds}s`}>
                      <input type="range" min={5} max={120} step={5}
                        value={config.silenceTimeoutSeconds}
                        onChange={(e) => set('silenceTimeoutSeconds', +e.target.value)}
                        className="w-full accent-[oklch(56%_0.22_264)]"
                      />
                      <div className="flex justify-between text-xs text-white/25 mt-1"><span>5s</span><span>120s</span></div>
                    </Field>
                  </div>
                </ConfigSection>

                {/* Prospecting config */}
                <ConfigSection
                  icon={<Search className="w-5 h-5" />}
                  title="Configuration Prospection"
                  saveStatus={prospectSave}
                  onSave={() => saveSection('prospect', setProspectSave)}
                  accent="violet"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Apify Actor ID">
                      <input type="text" value={config.apifyActorId}
                        onChange={(e) => set('apifyActorId', e.target.value)}
                        placeholder="apify/google-maps-scraper"
                        className={inputCls + ' font-mono text-xs'}
                      />
                    </Field>
                  </div>
                  <Field label="Niches cibles" className="mt-4">
                    <div className="flex gap-2 flex-wrap" role="group" aria-label="Niches cibles">
                      {NICHES.map((n) => {
                        const selected = config.targetNiches.includes(n.id);
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => toggleNiche(n.id)}
                            aria-pressed={selected}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                            style={{
                              background: selected ? 'oklch(67% 0.26 299)' : 'oklch(100% 0 0 / 0.04)',
                              borderColor: selected ? 'oklch(67% 0.26 299)' : 'oklch(100% 0 0 / 0.08)',
                              color: selected ? 'oklch(98% 0.004 265)' : 'oklch(70% 0 0)',
                            }}
                          >
                            {n.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Villes pour Apify" className="mt-4">
                    <TagInput
                      tags={config.apifyTargetCities} inputValue={apifyCityInput}
                      onInputChange={setApifyCityInput}
                      onAdd={() => addCity('apifyTargetCities', apifyCityInput)}
                      onRemove={(c) => removeCity('apifyTargetCities', c)}
                      placeholder="Ex: Paris, Lyon…"
                      icon={<MapPin className="w-4 h-4" />}
                    />
                  </Field>
                </ConfigSection>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
