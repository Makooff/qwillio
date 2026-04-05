import { useEffect, useState } from 'react';
import api from '../services/api';
import { BotStatus } from '../types';
import {
  Bot, Zap, Play, Square, Loader2,
  Bot as BotIcon, Mic2, Search, Save, RotateCcw, CheckCircle2, AlertCircle,
  Clock, MapPin, ChevronDown, ChevronUp, Radio,
} from 'lucide-react';

// ── Mission Control types ──────────────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────

function ConfigSection({
  icon, title, color, children, saveStatus, onSave,
}: {
  icon: React.ReactNode;
  title: string;
  color: 'purple' | 'indigo' | 'emerald';
  children: React.ReactNode;
  saveStatus: SaveStatus;
  onSave: () => void;
}) {
  const colors = {
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', btn: 'bg-violet-600 hover:bg-violet-700' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', btn: 'bg-indigo-600 hover:bg-indigo-700' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  }[color];

  return (
    <div className="border border-gray-100 rounded-xl p-5 bg-white">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>{icon}</div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <button
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60 ${colors.btn}`}
        >
          <SaveIcon status={saveStatus} />
        </button>
      </div>
      {children}
    </div>
  );
}

function SaveIcon({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <><RotateCcw className="w-4 h-4 animate-spin" /> Sauvegarde…</>;
  if (status === 'saved') return <><CheckCircle2 className="w-4 h-4" /> Sauvegardé !</>;
  if (status === 'error') return <><AlertCircle className="w-4 h-4" /> Erreur</>;
  return <><Save className="w-4 h-4" /> Sauvegarder</>;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      {children}
    </div>
  );
}

function TagInput({ tags, inputValue, onInputChange, onAdd, onRemove, placeholder, icon }: {
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            className="input pl-9"
          />
        </div>
        <button onClick={onAdd} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
          Ajouter
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-sm">
              {tag}
              <button onClick={() => onRemove(tag)} className="hover:text-violet-900 font-bold leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Settings Component ────────────────────────────────────────────────

export default function Settings() {
  // Bot status state
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState('');
  const [message, setMessage] = useState('');

  // Mission Control state
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
    const interval = setInterval(fetchBotStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.get('/admin/bot-config').then(({ data }) => {
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
    }).catch(console.error).finally(() => setConfigLoading(false));
  }, []);

  const fetchBotStatus = async () => {
    try {
      const { data } = await api.get('/bot/status');
      setBotStatus(data);
    } catch (error) {
      console.error('Failed to fetch bot status:', error);
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
        setMessage('Bot démarré ! Tous les crons sont actifs.');
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
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Erreur');
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

  const saveSection = async (section: 'bot' | 'vapi' | 'prospect', setSave: (s: SaveStatus) => void) => {
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
      setTimeout(() => setSave('idle'), 2500);
    } catch {
      setSave('error');
      setTimeout(() => setSave('idle'), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 rounded-full border-2 border-transparent border-t-violet-600 border-r-violet-600 animate-spin" />
      </div>
    );
  }

  const isActive = botStatus?.isActive ?? false;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Réglages</h1>
        <p className="text-gray-500 text-sm mt-0.5">Configuration du bot et du système automatique</p>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
          message.startsWith('Erreur')
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {message}
        </div>
      )}

      {/* ── Bot Control ───────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-600" /> Contrôle du Bot
        </h2>

        <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl mb-5">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
            <div>
              <p className="font-semibold text-gray-900">{isActive ? 'Bot Actif' : 'Bot Inactif'}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {botStatus?.callsToday ?? 0} appels aujourd'hui · quota {botStatus?.callsQuotaDaily ?? 50}
              </p>
            </div>
          </div>
          <button
            onClick={toggleBot}
            disabled={toggling}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 ${
              isActive
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-violet-600 hover:bg-violet-700 shadow-md shadow-violet-500/25'
            }`}
          >
            {toggling
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</>
              : isActive
                ? <><Square className="w-4 h-4" /> Arrêter</>
                : <><Play className="w-4 h-4" /> Démarrer</>
            }
          </button>
        </div>

        {/* Cron Status */}
        {botStatus?.crons && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
            {Object.entries(botStatus.crons).slice(0, 5).map(([name, status]) => {
              const isRunning = status === 'active';
              const isIdle = status === 'idle';
              return (
                <div
                  key={name}
                  className={`p-3 rounded-lg text-center ${
                    isRunning
                      ? 'bg-emerald-50 border border-emerald-200'
                      : isIdle
                      ? 'bg-violet-50 border border-violet-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mx-auto mb-1.5 ${
                    isRunning ? 'bg-emerald-500' : isIdle ? 'bg-violet-400' : 'bg-gray-400'
                  }`} />
                  <p className="text-xs font-medium capitalize text-gray-700 truncate">{name}</p>
                  <p className={`text-xs ${isRunning ? 'text-emerald-600' : isIdle ? 'text-violet-500' : 'text-gray-400'}`}>
                    {isRunning ? 'Actif' : isIdle ? 'En attente' : 'Inactif'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Last Activity */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-400 text-xs mb-0.5">Dernière prospection</p>
            <p className="font-medium text-gray-800">
              {botStatus?.lastProspection ? new Date(botStatus.lastProspection).toLocaleString('fr-FR') : 'Jamais'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-400 text-xs mb-0.5">Dernier appel</p>
            <p className="font-medium text-gray-800">
              {botStatus?.lastCall ? new Date(botStatus.lastCall).toLocaleString('fr-FR') : 'Jamais'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Manual Triggers ───────────────────────────────────── */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" /> Actions Manuelles (Test)
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Déclenchez manuellement les actions du bot pour tester.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => triggerAction('call')}
            disabled={triggerLoading === 'call'}
            className="p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-2xl">📞</span>
              <span className="font-semibold text-gray-800">
                {triggerLoading === 'call' ? 'En cours...' : 'Appeler'}
              </span>
            </div>
            <p className="text-xs text-gray-500">Appeler le prochain prospect avec Ashley (VAPI)</p>
          </button>
          <button
            onClick={() => triggerAction('reminders')}
            disabled={triggerLoading === 'reminders'}
            className="p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-2xl">📧</span>
              <span className="font-semibold text-gray-800">
                {triggerLoading === 'reminders' ? 'En cours...' : 'Relances'}
              </span>
            </div>
            <p className="text-xs text-gray-500">Envoyer les relances email en attente</p>
          </button>
        </div>
      </div>

      {/* ── Automation Info ───────────────────────────────────── */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Boucle Automatique</h2>
        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2 font-mono text-gray-700">
          <p><strong>Prospection:</strong> Tous les jours à 9h (lun-ven)</p>
          <p><strong>Appels:</strong> Toutes les 20 min, 9h-19h (lun-ven)</p>
          <p><strong>Relances:</strong> Toutes les heures</p>
          <p><strong>Analytics:</strong> Tous les jours à 23h55</p>
          <p><strong>Reset quotidien:</strong> Tous les jours à 00h01</p>
        </div>
      </div>

      {/* ── Configuration Avancée (Mission Control) ───────────── */}
      <div className="card">
        <button
          onClick={() => setConfigOpen(!configOpen)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
              <Radio className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-gray-900">Configuration avancée</h2>
              <p className="text-sm text-gray-400 mt-0.5">Bot, VAPI, Prospection — configuration complète</p>
            </div>
          </div>
          {configOpen
            ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
            : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
          }
        </button>

        {configOpen && (
          <div className="mt-6 space-y-5">
            {configLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-violet-600 animate-spin" />
              </div>
            ) : (
              <>
                {/* Bot Configuration */}
                <ConfigSection
                  icon={<BotIcon className="w-5 h-5" />}
                  title="Configuration du Bot"
                  color="purple"
                  saveStatus={botSave}
                  onSave={() => saveSection('bot', setBotSave)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Appels par jour">
                      <input
                        type="number" min={1} max={500}
                        value={config.callsPerDay}
                        onChange={(e) => set('callsPerDay', +e.target.value)}
                        className="input"
                      />
                    </Field>
                    <Field label={`Intervalle entre appels: ${config.callIntervalMinutes} min`}>
                      <input
                        type="range" min={5} max={60} step={5}
                        value={config.callIntervalMinutes}
                        onChange={(e) => set('callIntervalMinutes', +e.target.value)}
                        className="w-full accent-violet-600"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1"><span>5 min</span><span>60 min</span></div>
                    </Field>
                    <Field label="Plage d'appels (début → fin)">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <input type="number" min={0} max={23} value={config.callWindowStart}
                          onChange={(e) => set('callWindowStart', +e.target.value)} className="input" />
                        <span className="text-gray-400">→</span>
                        <input type="number" min={0} max={23} value={config.callWindowEnd}
                          onChange={(e) => set('callWindowEnd', +e.target.value)} className="input" />
                        <span className="text-xs text-gray-400">h</span>
                      </div>
                    </Field>
                    <Field label="Quota de prospection par jour">
                      <input type="number" min={1} max={1000}
                        value={config.prospectionQuotaPerDay}
                        onChange={(e) => set('prospectionQuotaPerDay', +e.target.value)}
                        className="input"
                      />
                    </Field>
                  </div>
                  <Field label="Jours actifs" className="mt-4">
                    <div className="flex gap-2 flex-wrap">
                      {DAYS.map((day) => (
                        <button key={day} onClick={() => toggleDay(day)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2 ${
                            config.activeDays.includes(day)
                              ? 'bg-violet-600 border-violet-600 text-white'
                              : 'border-gray-200 text-gray-500 hover:border-violet-300'
                          }`}>
                          {DAY_LABELS[day]}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={`Score priorité minimum: ${config.minPriorityScore}`} className="mt-4">
                    <input type="range" min={0} max={22} step={1}
                      value={config.minPriorityScore}
                      onChange={(e) => set('minPriorityScore', +e.target.value)}
                      className="w-full accent-violet-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0 (tous)</span><span>22 (max)</span></div>
                  </Field>
                  <Field label="Villes cibles" className="mt-4">
                    <TagInput
                      tags={config.targetCities} inputValue={cityInput}
                      onInputChange={setCityInput}
                      onAdd={() => addCity('targetCities', cityInput)}
                      onRemove={(c) => removeCity('targetCities', c)}
                      placeholder="Ex: Paris, Lyon..."
                      icon={<MapPin className="w-4 h-4 text-gray-400" />}
                    />
                  </Field>
                </ConfigSection>

                {/* VAPI Configuration */}
                <ConfigSection
                  icon={<Mic2 className="w-5 h-5" />}
                  title="Configuration VAPI"
                  color="indigo"
                  saveStatus={vapiSave}
                  onSave={() => saveSection('vapi', setVapiSave)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Assistant ID (VAPI)">
                      <input type="text" value={config.vapiAssistantId}
                        onChange={(e) => set('vapiAssistantId', e.target.value)}
                        placeholder="vapi-assistant-xxxxx"
                        className="input font-mono text-sm"
                      />
                    </Field>
                    <Field label="Voice ID">
                      <select value={config.vapiVoiceId}
                        onChange={(e) => set('vapiVoiceId', e.target.value)} className="input">
                        {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        {!VOICES.find(v => v.id === config.vapiVoiceId) && (
                          <option value={config.vapiVoiceId}>{config.vapiVoiceId || 'Personnalisé…'}</option>
                        )}
                      </select>
                    </Field>
                    <Field label={`Durée max d'appel: ${config.maxCallDurationMin} min`}>
                      <input type="range" min={1} max={30} step={1}
                        value={config.maxCallDurationMin}
                        onChange={(e) => set('maxCallDurationMin', +e.target.value)}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1 min</span><span>30 min</span></div>
                    </Field>
                    <Field label={`Silence timeout: ${config.silenceTimeoutSeconds}s`}>
                      <input type="range" min={5} max={120} step={5}
                        value={config.silenceTimeoutSeconds}
                        onChange={(e) => set('silenceTimeoutSeconds', +e.target.value)}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1"><span>5s</span><span>120s</span></div>
                    </Field>
                  </div>
                </ConfigSection>

                {/* Prospecting Configuration */}
                <ConfigSection
                  icon={<Search className="w-5 h-5" />}
                  title="Configuration Prospection"
                  color="emerald"
                  saveStatus={prospectSave}
                  onSave={() => saveSection('prospect', setProspectSave)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Apify Actor ID">
                      <input type="text" value={config.apifyActorId}
                        onChange={(e) => set('apifyActorId', e.target.value)}
                        placeholder="apify/google-maps-scraper"
                        className="input font-mono text-sm"
                      />
                    </Field>
                  </div>
                  <Field label="Niches cibles" className="mt-4">
                    <div className="flex gap-2 flex-wrap">
                      {NICHES.map((n) => (
                        <button key={n.id} onClick={() => toggleNiche(n.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2 ${
                            config.targetNiches.includes(n.id)
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-gray-200 text-gray-500 hover:border-emerald-300'
                          }`}>
                          {n.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Villes pour Apify" className="mt-4">
                    <TagInput
                      tags={config.apifyTargetCities} inputValue={apifyCityInput}
                      onInputChange={setApifyCityInput}
                      onAdd={() => addCity('apifyTargetCities', apifyCityInput)}
                      onRemove={(c) => removeCity('apifyTargetCities', c)}
                      placeholder="Ex: Paris, Lyon..."
                      icon={<MapPin className="w-4 h-4 text-gray-400" />}
                    />
                  </Field>
                </ConfigSection>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
