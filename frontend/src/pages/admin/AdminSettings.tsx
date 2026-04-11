import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import {
  Save, AlertTriangle, Clock, Phone, Settings, Server, Database,
  CheckCircle2, XCircle, Loader2, Globe, Brain, Mail, DollarSign,
  Shield, Cpu, Users, Target, Zap, Hash, Mic, Radio, MapPin,
  RefreshCw, Volume2, Timer, BarChart3, FileText, Key, Lock,
  Webhook, MessageSquare, Search, Activity, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const NICHES = [
  { id: 'dental', label: 'Dentaire', score: 7 },
  { id: 'medical', label: 'Médical', score: 6 },
  { id: 'law', label: 'Juridique', score: 5 },
  { id: 'salon', label: 'Salon', score: 5 },
  { id: 'restaurant', label: 'Restaurant', score: 4 },
  { id: 'garage', label: 'Garage auto', score: 6 },
  { id: 'hotel', label: 'Hôtel', score: 3 },
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
  // Prospecting
  prospectionQuotaPerDay: number;
  minPriorityScore: number;
  targetCities: string[];
  targetNiches: string[];
  apifyTargetCities: string[];
  // VAPI
  vapiModel: string;
  vapiVoiceId: string;
  vapiStability: number;
  vapiSimilarityBoost: number;
  vapiStyle: number;
  vapiLatency: number;
  vapiInterruptionMs: number;
  vapiSilenceTimeout: number;
  vapiMaxDuration: number;
  // Read-only
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

// Collapsible section
function Section({ title, icon: Icon, color, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        {open ? <ChevronDown className="w-3.5 h-3.5 text-[#8B8BA7]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8B8BA7]" />}
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color }}>{title}</span>
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  );
}

export default function AdminSettings() {
  const [config, setConfig] = useState<Config>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);
  const [health, setHealth] = useState<Record<string, boolean> | null>(null);
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [prospecting, setProspecting] = useState<any>(null);
  const [aiStats, setAiStats] = useState<any>(null);
  const [newCity, setNewCity] = useState('');
  const [newApifyCity, setNewApifyCity] = useState('');
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    try {
      const [cfg, h, sys, p, ai] = await Promise.all([
        api.get('/admin/bot-config').catch(() => ({ data: null })),
        api.get('/bot/health').catch(() => ({ data: {} })),
        api.get('/admin/system').catch(() => ({ data: null })),
        api.get('/prospecting/status').catch(() => ({ data: null })),
        api.get('/ai/stats').catch(() => ({ data: null })),
      ]);
      if (cfg.data) setConfig(prev => ({ ...prev, ...cfg.data }));
      setHealth(h.data); setSysInfo(sys.data);
      setProspecting(p.data); setAiStats(ai.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/admin/bot-config', config);
      toast('Configuration sauvegardée', 'success');
    } catch { toast('Erreur sauvegarde', 'error'); }
    finally { setSaving(false); }
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

  const inputCls = "w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50 tabular-nums";
  const rowCls = "flex justify-between py-2 border-b border-white/[0.03] last:border-0";

  const Row = ({ l, v, c }: { l: string; v: string | number; c?: string }) => (
    <div className={rowCls}>
      <span className="text-[11px] text-[#8B8BA7]">{l}</span>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: c ?? '#F8F8FF' }}>{v}</span>
    </div>
  );

  const NumInput = ({ label, value, onChange, min, max, step, unit }: {
    label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string;
  }) => (
    <div>
      <label className="text-[10px] text-[#8B8BA7] mb-1 block">{label}{unit ? ` (${unit})` : ''}</label>
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} className={inputCls} />
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-[#7B5CF0]" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-[1400px]">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Paramètres</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Configuration complète du système Qwillio</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-2.5 rounded-xl bg-[#12121A] border border-white/[0.06] text-[#8B8BA7] hover:text-[#F8F8FF] transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7B5CF0] hover:bg-[#6D4FE0] text-white text-sm font-semibold transition-all disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 1: Planning & Appels                       */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Planning des appels" icon={Clock} color="#7B5CF0">
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
          <label className="text-[10px] text-[#8B8BA7] mb-2 block">Jours actifs</label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((day, i) => {
              const d = i + 1;
              const on = config.activeDays.includes(d);
              return (
                <button key={d} onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    on ? 'bg-[#7B5CF0]/10 border-[#7B5CF0]/30 text-[#7B5CF0]' : 'bg-[#0D0D15] border-white/[0.06] text-[#8B8BA7]'
                  }`}>{day.slice(0, 3)}</button>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-white/[0.04]">
            <Row l="Timezone" v={config.timezone} />
            <Row l="Blackout lundi" v="< 10h" />
            <Row l="Blackout vendredi" v="> 14h" />
            <Row l="Jours prioritaires" v="Mar, Mer, Jeu" c="#22C55E" />
          </div>
        </Section>

        <Section title="Paramètres appels" icon={Phone} color="#3B82F6">
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
          <div className="pt-3 border-t border-white/[0.04]">
            <Row l="Durée max VAPI" v={`${config.vapiMaxDuration}s (${Math.round(config.vapiMaxDuration / 60)}min)`} />
            <Row l="Seuil interruption" v={`${config.vapiInterruptionMs}ms`} />
            <Row l="Seuil lead chaud" v="Score ≥ 8/10" c="#22C55E" />
            <Row l="Seuil lead qualifié" v="Score ≥ 6/10" c="#F59E0B" />
            <Row l="SMS activé" v={config.smsEnabled ? 'Oui' : 'Non'} c={config.smsEnabled ? '#22C55E' : '#EF4444'} />
          </div>
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 2: VAPI Voice & Prospection                */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Voix & VAPI" icon={Mic} color="#EC4899">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[10px] text-[#8B8BA7] mb-1 block">Modèle AI</label>
              <input type="text" value={config.vapiModel} readOnly className={`${inputCls} opacity-60`} />
            </div>
            <div>
              <label className="text-[10px] text-[#8B8BA7] mb-1 block">Voice ID (ElevenLabs)</label>
              <input type="text" value={config.vapiVoiceId} readOnly className={`${inputCls} opacity-60 text-[10px]`} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#0D0D15] rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-[#EC4899] tabular-nums">{config.vapiStability}</p>
              <p className="text-[8px] text-[#8B8BA7] uppercase mt-1">Stabilité</p>
            </div>
            <div className="bg-[#0D0D15] rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-[#EC4899] tabular-nums">{config.vapiSimilarityBoost}</p>
              <p className="text-[8px] text-[#8B8BA7] uppercase mt-1">Similarité</p>
            </div>
            <div className="bg-[#0D0D15] rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-[#EC4899] tabular-nums">{config.vapiStyle}</p>
              <p className="text-[8px] text-[#8B8BA7] uppercase mt-1">Style</p>
            </div>
          </div>
          <Row l="Latence optimisée" v={`Niveau ${config.vapiLatency}`} />
          <Row l="Voix Ashley (EN)" v="Rachel — ElevenLabs" />
          <Row l="Voix Marie (FR)" v="Amélie — ElevenLabs" />
          <Row l="Filler injection" v="Activé" c="#22C55E" />
          <Row l="Speaker boost" v="Activé" c="#22C55E" />
          <Row l="Streaming TTS" v="Activé (FR)" c="#22C55E" />
          <Row l="Tutoiement FR" v="salon, restaurant, garage" />
          <Row l="Vouvoiement FR" v="law, medical, hotel" />
        </Section>

        <Section title="Prospection" icon={Target} color="#F59E0B">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <NumInput label="Quota / jour" value={config.prospectionQuotaPerDay} min={1} max={500}
              onChange={v => setConfig(p => ({ ...p, prospectionQuotaPerDay: v }))} />
            <NumInput label="Score minimum" value={config.minPriorityScore} min={0} max={22}
              onChange={v => setConfig(p => ({ ...p, minPriorityScore: v }))} />
          </div>

          {/* Niches */}
          <label className="text-[10px] text-[#8B8BA7] mb-2 block">Niches ciblées</label>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {NICHES.map(n => {
              const on = config.targetNiches.includes(n.id);
              return (
                <button key={n.id} onClick={() => toggleNiche(n.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    on ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]' : 'bg-[#0D0D15] border-white/[0.06] text-[#8B8BA7]'
                  }`}>{n.label} ({n.score}pts)</button>
              );
            })}
          </div>

          {/* Target cities */}
          <label className="text-[10px] text-[#8B8BA7] mb-1.5 block">Villes de prospection</label>
          <div className="flex gap-2 mb-2">
            <input type="text" value={newCity} onChange={e => setNewCity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCity('targetCities', newCity, setNewCity)}
              placeholder="Ajouter une ville..." className={`${inputCls} flex-1`} />
            <button onClick={() => addCity('targetCities', newCity, setNewCity)}
              className="px-3 py-2 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-medium border border-[#F59E0B]/20">+</button>
          </div>
          <div className="flex flex-wrap gap-1 mb-4">
            {config.targetCities.map(c => (
              <span key={c} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0D0D15] border border-white/[0.06] text-[10px] text-[#F8F8FF]">
                {c}
                <button onClick={() => removeCity('targetCities', c)} className="text-[#EF4444] hover:text-[#EF4444]/80 ml-0.5">×</button>
              </span>
            ))}
          </div>

          <div className="pt-3 border-t border-white/[0.04]">
            <Row l="Rayon scraping" v={`${config.prospectionRadius}m`} />
            <Row l="Score max possible" v="22 points" />
            <Row l="Local presence" v={`${prospecting?.localPresenceNumbers ?? 20} numéros US`} />
            <Row l="Variantes A/B" v="2 scripts / niche" />
            <Row l="Seuil A/B winner" v="200 appels + 15% diff" c="#22C55E" />
          </div>
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 3: Apify Scraping                          */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section title="Scraping Apify (Google Maps)" icon={Search} color="#10B981" defaultOpen={false}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] text-[#8B8BA7] mb-1.5 block">Villes Apify scraping</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newApifyCity} onChange={e => setNewApifyCity(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCity('apifyTargetCities', newApifyCity, setNewApifyCity)}
                placeholder="Ajouter une ville..." className={`${inputCls} flex-1`} />
              <button onClick={() => addCity('apifyTargetCities', newApifyCity, setNewApifyCity)}
                className="px-3 py-2 rounded-xl bg-[#10B981]/10 text-[#10B981] text-xs font-medium border border-[#10B981]/20">+</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {config.apifyTargetCities.map(c => (
                <span key={c} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0D0D15] border border-white/[0.06] text-[10px] text-[#F8F8FF]">
                  {c}
                  <button onClick={() => removeCity('apifyTargetCities', c)} className="text-[#EF4444] hover:text-[#EF4444]/80 ml-0.5">×</button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <Row l="Actor Apify" v="compass~crawler-google-places" />
            <Row l="Schedule" v="Tous les jours 2h UTC" />
            <Row l="Niches scrapées" v="home_services, dental" />
            <Row l="Résultats par niche" v="~50-200 prospects" />
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 4: AI & Follow-ups                         */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Intelligence artificielle" icon={Brain} color="#8B5CF6">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { l: 'Mutations', v: aiStats?.totalMutations ?? 0, c: '#8B5CF6' },
              { l: 'Tests A/B', v: aiStats?.activeTests ?? 0, c: '#22C55E' },
              { l: 'Décisions', v: aiStats?.totalDecisions ?? 0, c: '#3B82F6' },
            ].map(s => (
              <div key={s.l} className="bg-[#0D0D15] rounded-xl p-3 text-center">
                <p className="text-lg font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
                <p className="text-[8px] text-[#8B8BA7] uppercase mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
          <Row l="Ce mois" v={aiStats?.mutationsThisMonth ?? 0} c="#F59E0B" />
          <Row l="Reverts" v={aiStats?.reverts ?? 0} c="#EF4444" />
          <Row l="Confiance moyenne" v={`${(aiStats?.avgConfidenceScore ?? 0).toFixed(0)}%`} />
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Garde-fous IA</p>
            <Row l="Max mutations / niche / sem." v="1" />
            <Row l="Max changements opening / mois" v="1" />
            <Row l="Max mots script" v="195 (90sec)" />
            <Row l="Confiance minimum" v="75%" c="#F59E0B" />
            <Row l="Min data points" v="20 appels" />
            <Row l="Appels validation" v="50 appels" />
            <Row l="Moteurs" v="Claude + GPT-4 Turbo" />
          </div>
        </Section>

        <Section title="Follow-ups & séquences" icon={MessageSquare} color="#06B6D4">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Après appel qualifié</p>
          <div className="space-y-1.5 mb-4">
            {[
              { time: 'Immédiat', type: 'SMS', desc: 'Lien vers devis', color: '#06B6D4' },
              { time: 'T + 5 min', type: 'Email', desc: 'Vidéo Loom de démo', color: '#3B82F6' },
              { time: 'T + 24h', type: 'Email', desc: 'Rappel si devis non vu', color: '#F59E0B' },
              { time: 'T + 48h', type: 'Email', desc: 'Dashboard preview + témoignage', color: '#EF4444' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.04]">
                <div className="w-1 h-8 rounded-full" style={{ background: s.color }} />
                <div className="flex-1">
                  <p className="text-xs font-medium text-[#F8F8FF]">{s.type} — {s.desc}</p>
                  <p className="text-[10px] text-[#8B8BA7]">{s.time}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Callback retry (pas de réponse)</p>
          <Row l="1er rappel" v="+ 2 heures" />
          <Row l="2ème rappel" v="+ 24 heures" />
          <Row l="3ème rappel" v="+ 72 heures" />
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Détection lead chaud</p>
            <Row l="Score ≥ 8" v="Discord alert + callback 5min" c="#22C55E" />
            <Row l="Critères" v="Durée, questions, prix, démo" />
          </div>
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 5: Scoring                                 */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section title="Scoring prospects (max 22 pts)" icon={BarChart3} color="#F97316" defaultOpen={false}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Signaux business (max 10 pts)</p>
            <Row l="Google rating ≥ 4.5" v="+3 pts" c="#22C55E" />
            <Row l="Avis ≥ 50" v="+2 pts" c="#22C55E" />
            <Row l="Site web" v="+2 pts" c="#22C55E" />
            <Row l="Avis ≥ 30" v="+2 pts" c="#22C55E" />
            <Row l="Avis < 20 & rating ≥ 4.0" v="+1 pt" c="#22C55E" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Points par niche (max 8 pts)</p>
            {NICHES.map(n => (
              <Row key={n.id} l={n.label} v={`${n.score} pts`} c="#F59E0B" />
            ))}
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Signaux timing (max 4 pts)</p>
            <Row l="États prioritaires (TX, FL)" v="+2 pts" c="#3B82F6" />
            <Row l="Grandes villes US" v="+1 pt" c="#3B82F6" />
            <Row l="Ancienneté business" v="+1 pt" c="#3B82F6" />
            <div className="mt-3 pt-3 border-t border-white/[0.04]">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Top villes</p>
              <p className="text-[10px] text-[#8B8BA7] leading-relaxed">
                Houston, Dallas, LA, Miami, Atlanta, Phoenix, San Antonio, San Diego, Orlando, Tampa
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 6: Services                                */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section title="Services & santé" icon={Shield} color="#22C55E">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {health && [
            { k: 'vapi', label: 'VAPI', desc: 'Appels Voice AI' },
            { k: 'openai', label: 'OpenAI', desc: 'GPT-4 Turbo' },
            { k: 'twilio', label: 'Twilio', desc: 'SMS & validation' },
            { k: 'stripe', label: 'Stripe', desc: 'Paiements' },
            { k: 'resend', label: 'Resend', desc: 'Emails' },
            { k: 'database', label: 'Database', desc: 'PostgreSQL / Neon' },
            { k: 'discord', label: 'Discord', desc: 'Alertes' },
            { k: 'apify', label: 'Apify', desc: 'Scraping Maps' },
          ].map(s => {
            const ok = health[s.k] ?? false;
            return (
              <div key={s.k} className={`flex items-center gap-3 p-3 rounded-xl border ${
                ok ? 'bg-[#22C55E]/5 border-[#22C55E]/15' : 'bg-[#EF4444]/5 border-[#EF4444]/15'
              }`}>
                {ok ? <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                     : <XCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#F8F8FF]">{s.label}</p>
                  <p className="text-[9px] text-[#8B8BA7]">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 7: System, DB, Crons                       */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Système" icon={Server} color="#F59E0B">
          <Row l="Backend" v="Render (Express/TS)" />
          <Row l="Frontend" v="Vercel (React 19/Vite)" />
          <Row l="Domaine" v="qwillio.com" />
          <Row l="API" v="qwillio.onrender.com" />
          <Row l="Uptime" v={sysInfo?.uptime ? fmtUptime(sysInfo.uptime) : '—'} c="#22C55E" />
          <Row l="Node.js" v={sysInfo?.nodeVersion ?? '—'} />
          <Row l="Environnement" v={sysInfo?.env ?? '—'} />
          <Row l="Timezone" v={config.timezone} />
          <Row l="Rate limit" v="500 req / 15min" />
        </Section>

        <Section title="Base de données" icon={Database} color="#8B5CF6">
          <div className="flex items-center gap-2 mb-3 p-2 rounded-xl bg-[#22C55E]/5 border border-[#22C55E]/15">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
            <span className="text-xs font-semibold text-[#22C55E]">Connectée</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { l: 'Prospects', v: sysInfo?.prospects ?? '—', c: '#7B5CF0' },
              { l: 'Clients', v: sysInfo?.clients ?? '—', c: '#3B82F6' },
              { l: 'Appels', v: sysInfo?.calls ?? '—', c: '#F59E0B' },
            ].map(s => (
              <div key={s.l} className="bg-[#0D0D15] rounded-lg p-2 text-center">
                <p className="text-base font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
                <p className="text-[8px] text-[#8B8BA7] uppercase">{s.l}</p>
              </div>
            ))}
          </div>
          <Row l="ORM" v="Prisma" />
          <Row l="Modèles" v="45 tables" />
          <Row l="Provider" v="Neon (prod) / PG16 (local)" />
          <Row l="Logs max" v="500 entrées in-memory" />
        </Section>

        <Section title="Cron Jobs (26)" icon={Timer} color="#06B6D4">
          <div className="space-y-0 text-[10px]">
            {[
              { l: 'Prospection', v: '9h Lun-Ven' },
              { l: 'Appels sortants', v: '*/20min 9-17h' },
              { l: 'Follow-ups', v: '*/30min' },
              { l: 'Follow-ups client', v: 'Chaque heure' },
              { l: 'Analytics', v: '23h55' },
              { l: 'Reset quotidien', v: '00h01' },
              { l: 'Trial check', v: '8h' },
              { l: 'Onboarding retry', v: '*/5min' },
              { l: 'Booking rappels', v: '*/h à :30' },
              { l: 'Client analytics', v: '23h50' },
              { l: 'AI optimization', v: 'Dim 0h' },
              { l: 'Phone validation', v: '*/10min' },
              { l: 'Niche learning', v: 'Dim 1h' },
              { l: 'Stale call cleanup', v: '*/15min' },
              { l: 'Agent payments', v: '*/h à :15' },
              { l: 'Agent accounting', v: '1er du mois 2h' },
              { l: 'Agent inventory', v: '*/6h' },
              { l: 'Agent inv. forecast', v: '3h' },
              { l: 'Agent email sync', v: '*/10min' },
              { l: 'Agent email follow', v: '*/h à :30' },
              { l: 'Apify scraping', v: '2h UTC' },
              { l: 'Outbound engine', v: '*/20min 9-17 CT' },
              { l: 'A/B analysis', v: '6h UTC' },
              { l: 'Best-time learning', v: '4h UTC' },
              { l: 'Script learning', v: 'Dim 1h UTC' },
              { l: 'Rescoring', v: 'On-demand' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1 border-b border-white/[0.02] last:border-0">
                <span className="text-[#8B8BA7]">{r.l}</span>
                <span className="text-[#F8F8FF] font-mono">{r.v}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 8: Tarifs + Email + Sécurité               */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Grille tarifaire" icon={DollarSign} color="#22C55E">
          <div className="space-y-2">
            {[
              { plan: 'Starter', monthly: '$197', setup: '$697', calls: '200', overage: '$0.22', color: '#3B82F6' },
              { plan: 'Pro', monthly: '$347', setup: '$997', calls: '500', overage: '$0.18', color: '#7B5CF0' },
              { plan: 'Enterprise', monthly: '$497', setup: '$1,497', calls: '1000', overage: '$0.15', color: '#F59E0B' },
            ].map(p => (
              <div key={p.plan} className="flex items-center gap-3 p-3 rounded-xl bg-[#0D0D15] border border-white/[0.04]">
                <div className="w-1.5 h-10 rounded-full" style={{ background: p.color }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#F8F8FF]">{p.plan}</p>
                  <p className="text-[10px] text-[#8B8BA7]">{p.calls} appels/mois · Surplus: {p.overage}/appel</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#F8F8FF]">{p.monthly}/mo</p>
                  <p className="text-[10px] text-[#8B8BA7]">+ {p.setup} setup</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Email & notifications" icon={Mail} color="#3B82F6">
          <Row l="Provider" v="Resend" />
          <Row l="From" v={config.resendFrom} />
          <Row l="Reply-to" v={config.resendReplyTo} />
          <Row l="SMS Provider" v="Twilio" />
          <Row l="SMS actif" v={config.smsEnabled ? 'Oui' : 'Non'} c={config.smsEnabled ? '#22C55E' : '#EF4444'} />
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Discord Webhooks</p>
            <Row l="Principal" v="Configuré" c="#22C55E" />
            <Row l="Appels" v="Canal dédié" />
            <Row l="Leads" v="Canal dédié" />
            <Row l="Système" v="Canal dédié" />
            <Row l="Alertes" v="Canal dédié" />
          </div>
        </Section>

        <Section title="Sécurité & auth" icon={Lock} color="#EF4444">
          <Row l="JWT expiration" v={config.jwtExpiresIn} />
          <Row l="Refresh token" v="7 jours" />
          <Row l="Bcrypt rounds" v={String(config.bcryptRounds)} />
          <Row l="Google OAuth" v="Activé" c="#22C55E" />
          <Row l="DocuSign" v="Configuré" c="#22C55E" />
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Protection</p>
            <Row l="Rate limiting" v="500 req / 15min" />
            <Row l="CORS" v="Whitelist domains" />
            <Row l="Helmet" v="Security headers" />
            <Row l="Trial abuse" v="Fingerprinting actif" c="#22C55E" />
          </div>
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 9: Env vars                                */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section title="Variables d'environnement (45+)" icon={Key} color="#8B8BA7" defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
          {[
            { cat: 'VAPI', vars: ['VAPI_PRIVATE_KEY', 'VAPI_PUBLIC_KEY', 'VAPI_ASSISTANT_ID', 'VAPI_PHONE_NUMBER_ID', 'VAPI_WEBHOOK_SECRET'] },
            { cat: 'AI', vars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'] },
            { cat: 'Twilio', vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_PHONE_NUMBER'] },
            { cat: 'Stripe', vars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'] },
            { cat: 'Email', vars: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_REPLY_TO'] },
            { cat: 'Discord', vars: ['DISCORD_WEBHOOK_URL', 'DISCORD_WEBHOOK_CALLS', 'DISCORD_WEBHOOK_LEADS', 'DISCORD_WEBHOOK_SYSTEM', 'DISCORD_WEBHOOK_ALERTS'] },
            { cat: 'Auth', vars: ['JWT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_PLACES_API_KEY'] },
            { cat: 'DocuSign', vars: ['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_USER_ID', 'DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_PRIVATE_KEY'] },
            { cat: 'Infra', vars: ['DATABASE_URL', 'NODE_ENV', 'PORT', 'FRONTEND_URL', 'API_BASE_URL', 'TZ', 'SENTRY_DSN'] },
            { cat: 'Prospection', vars: ['APIFY_API_KEY', 'APIFY_ACTOR_ID', 'CALLS_PER_DAY', 'AUTOMATION_START_HOUR', 'AUTOMATION_END_HOUR', 'CALL_INTERVAL_MINUTES', 'MIN_PRIORITY_SCORE'] },
            { cat: 'Admin', vars: ['ADMIN_EMAIL', 'ADMIN_SECRET'] },
            { cat: 'Démo', vars: ['DEMO_LINK_EN', 'DEMO_LINK_FR'] },
          ].map(group => (
            <div key={group.cat} className="mb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-1">{group.cat}</p>
              {group.vars.map(v => (
                <div key={v} className="flex items-center gap-1.5 py-1 border-b border-white/[0.02]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] flex-shrink-0" />
                  <span className="text-[10px] text-[#8B8BA7] font-mono truncate">{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 10: Local Presence                         */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section title="Local presence dialing (20 numéros)" icon={MapPin} color="#14B8A6" defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {[
            { code: '212', city: 'New York' }, { code: '310', city: 'Los Angeles' },
            { code: '312', city: 'Chicago' }, { code: '713', city: 'Houston' },
            { code: '602', city: 'Phoenix' }, { code: '215', city: 'Philadelphia' },
            { code: '210', city: 'San Antonio' }, { code: '619', city: 'San Diego' },
            { code: '214', city: 'Dallas' }, { code: '408', city: 'San Jose' },
            { code: '512', city: 'Austin' }, { code: '617', city: 'Boston' },
            { code: '415', city: 'San Francisco' }, { code: '303', city: 'Denver' },
            { code: '404', city: 'Atlanta' }, { code: '305', city: 'Miami' },
            { code: '702', city: 'Las Vegas' }, { code: '206', city: 'Seattle' },
            { code: '615', city: 'Nashville' }, { code: '504', city: 'New Orleans' },
          ].map(n => (
            <div key={n.code} className="p-2 rounded-lg bg-[#0D0D15] border border-white/[0.04] text-center">
              <p className="text-sm font-bold text-[#14B8A6] font-mono">{n.code}</p>
              <p className="text-[9px] text-[#8B8BA7]">{n.city}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* DANGER ZONE                                        */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="rounded-2xl bg-[#EF4444]/5 border border-[#EF4444]/20 p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
          <h3 className="text-sm font-semibold text-[#EF4444]">Zone dangereuse</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setConfirmPause(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm font-medium hover:bg-[#EF4444]/20 transition-all">
            Arrêter le bot
          </button>
          <button onClick={() => setConfirmResume(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-sm font-medium hover:bg-[#22C55E]/20 transition-all">
            Démarrer le bot
          </button>
        </div>
      </div>

      <ConfirmDialog open={confirmPause} title="Arrêter le bot"
        message="Arrêter immédiatement toutes les opérations du bot ?"
        confirmLabel="Arrêter" onConfirm={pauseAll} onCancel={() => setConfirmPause(false)} />
      <ConfirmDialog open={confirmResume} title="Démarrer le bot"
        message="Relancer le bot et reprendre les opérations ?"
        confirmLabel="Démarrer" danger={false} onConfirm={resumeAll} onCancel={() => setConfirmResume(false)} />
    </div>
  );
}
