import { useEffect, useState } from 'react';
import api from '../../services/api';
import {
  Bot, Mic2, Search, Save, RotateCcw, CheckCircle2, AlertCircle,
  Clock, MapPin, Sliders, Zap, Radio,
} from 'lucide-react';

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

interface Config {
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

const DEFAULT_CONFIG: Config = {
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

export default function MissionControl() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [botSave, setBotSave] = useState<SaveStatus>('idle');
  const [vapiSave, setVapiSave] = useState<SaveStatus>('idle');
  const [prospectSave, setProspectSave] = useState<SaveStatus>('idle');

  // Tag input state
  const [cityInput, setCityInput] = useState('');
  const [apifyCityInput, setApifyCityInput] = useState('');

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
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const set = (key: keyof Config, value: unknown) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: string) => {
    const days = config.activeDays.includes(day)
      ? config.activeDays.filter((d) => d !== day)
      : [...config.activeDays, day];
    set('activeDays', days);
  };

  const toggleNiche = (niche: string) => {
    const niches = config.targetNiches.includes(niche)
      ? config.targetNiches.filter((n) => n !== niche)
      : [...config.targetNiches, niche];
    set('targetNiches', niches);
  };

  const addCity = (field: 'targetCities' | 'apifyTargetCities', value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const list = config[field] as string[];
    if (!list.includes(trimmed)) {
      set(field, [...list, trimmed]);
    }
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
      const payload: Partial<Config> = {};
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/30">
          <Radio className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mission Control</h1>
          <p className="text-gray-500 text-sm">Configuration centralisée — tout contrôler à distance</p>
        </div>
      </div>

      {/* ── Bot Configuration ─────────────────────────────── */}
      <Section
        icon={<Bot className="w-5 h-5" />}
        title="Configuration du Bot"
        color="purple"
        saveStatus={botSave}
        onSave={() => saveSection('bot', setBotSave)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Calls per day */}
          <Field label="Appels par jour">
            <input
              type="number"
              min={1}
              max={500}
              value={config.callsPerDay}
              onChange={(e) => set('callsPerDay', +e.target.value)}
              className="input"
            />
          </Field>

          {/* Call interval */}
          <Field label={`Intervalle entre appels: ${config.callIntervalMinutes} min`}>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={config.callIntervalMinutes}
              onChange={(e) => set('callIntervalMinutes', +e.target.value)}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5 min</span><span>60 min</span>
            </div>
          </Field>

          {/* Call window */}
          <Field label="Plage d'appels (heure début)">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <input
                type="number"
                min={0}
                max={23}
                value={config.callWindowStart}
                onChange={(e) => set('callWindowStart', +e.target.value)}
                className="input"
              />
              <span className="text-gray-500">→</span>
              <input
                type="number"
                min={0}
                max={23}
                value={config.callWindowEnd}
                onChange={(e) => set('callWindowEnd', +e.target.value)}
                className="input"
              />
              <span className="text-xs text-gray-500">h</span>
            </div>
          </Field>

          {/* Prospection quota */}
          <Field label="Quota de prospection par jour">
            <input
              type="number"
              min={1}
              max={1000}
              value={config.prospectionQuotaPerDay}
              onChange={(e) => set('prospectionQuotaPerDay', +e.target.value)}
              className="input"
            />
          </Field>
        </div>

        {/* Active days */}
        <Field label="Jours actifs" className="mt-4">
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                  config.activeDays.includes(day)
                    ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600'
                }`}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>
        </Field>

        {/* Min priority score */}
        <Field label={`Score priorité minimum pour appeler: ${config.minPriorityScore}`} className="mt-4">
          <input
            type="range"
            min={0}
            max={22}
            step={1}
            value={config.minPriorityScore}
            onChange={(e) => set('minPriorityScore', +e.target.value)}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0 (tous)</span><span>22 (max)</span>
          </div>
        </Field>

        {/* Target cities */}
        <Field label="Villes cibles" className="mt-4">
          <TagInput
            tags={config.targetCities}
            inputValue={cityInput}
            onInputChange={setCityInput}
            onAdd={() => addCity('targetCities', cityInput)}
            onRemove={(c) => removeCity('targetCities', c)}
            placeholder="Ex: Houston, Dallas..."
            icon={<MapPin className="w-4 h-4 text-gray-400" />}
          />
        </Field>
      </Section>

      {/* ── VAPI Configuration ────────────────────────────── */}
      <Section
        icon={<Mic2 className="w-5 h-5" />}
        title="Configuration VAPI"
        color="indigo"
        saveStatus={vapiSave}
        onSave={() => saveSection('vapi', setVapiSave)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Assistant ID (VAPI)">
            <input
              type="text"
              value={config.vapiAssistantId}
              onChange={(e) => set('vapiAssistantId', e.target.value)}
              placeholder="vapi-assistant-xxxxx"
              className="input font-mono text-sm"
            />
          </Field>

          <Field label="Voice ID">
            <select
              value={config.vapiVoiceId}
              onChange={(e) => set('vapiVoiceId', e.target.value)}
              className="input"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
              <option value={config.vapiVoiceId}>{config.vapiVoiceId || 'Personnalisé…'}</option>
            </select>
          </Field>

          <Field label={`Durée max d'appel: ${config.maxCallDurationMin} min`}>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={config.maxCallDurationMin}
              onChange={(e) => set('maxCallDurationMin', +e.target.value)}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1 min</span><span>30 min</span>
            </div>
          </Field>

          <Field label={`Silence timeout: ${config.silenceTimeoutSeconds}s`}>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={config.silenceTimeoutSeconds}
              onChange={(e) => set('silenceTimeoutSeconds', +e.target.value)}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5s</span><span>120s</span>
            </div>
          </Field>
        </div>
      </Section>

      {/* ── Prospecting Configuration ─────────────────────── */}
      <Section
        icon={<Search className="w-5 h-5" />}
        title="Configuration Prospection"
        color="emerald"
        saveStatus={prospectSave}
        onSave={() => saveSection('prospect', setProspectSave)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Apify Actor ID">
            <input
              type="text"
              value={config.apifyActorId}
              onChange={(e) => set('apifyActorId', e.target.value)}
              placeholder="apify/google-maps-scraper"
              className="input font-mono text-sm"
            />
          </Field>
        </div>

        {/* Target niches */}
        <Field label="Niches cibles" className="mt-4">
          <div className="flex gap-2 flex-wrap">
            {NICHES.map((n) => (
              <button
                key={n.id}
                onClick={() => toggleNiche(n.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                  config.targetNiches.includes(n.id)
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600'
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Apify target cities */}
        <Field label="Villes pour Apify" className="mt-4">
          <TagInput
            tags={config.apifyTargetCities}
            inputValue={apifyCityInput}
            onInputChange={setApifyCityInput}
            onAdd={() => addCity('apifyTargetCities', apifyCityInput)}
            onRemove={(c) => removeCity('apifyTargetCities', c)}
            placeholder="Ex: Houston, Austin..."
            icon={<MapPin className="w-4 h-4 text-gray-400" />}
          />
        </Field>
      </Section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────

function Section({
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
    purple: {
      bg: 'bg-purple-100', text: 'text-purple-600',
      btn: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 shadow-purple-500/25',
    },
    indigo: {
      bg: 'bg-indigo-100', text: 'text-indigo-600',
      btn: 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:opacity-90 shadow-indigo-500/25',
    },
    emerald: {
      bg: 'bg-emerald-100', text: 'text-emerald-600',
      btn: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 shadow-emerald-500/25',
    },
  }[color];

  return (
    <div className="card">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>{icon}</div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <button
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all shadow-md ${colors.btn} disabled:opacity-60`}
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

function Field({
  label, children, className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
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
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      onAdd();
    }
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
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
        >
          Ajouter
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
            >
              {tag}
              <button
                onClick={() => onRemove(tag)}
                className="hover:text-purple-900 font-bold leading-none"
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
