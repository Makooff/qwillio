import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import {
  Save, AlertTriangle, Clock, Phone, Settings, Server, Database,
  CheckCircle2, XCircle, Loader2, Globe, Brain, Mail, DollarSign,
  Shield, Cpu, Users, Target, Zap, Hash,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

interface Config {
  startHour: number;
  endHour: number;
  callsPerDay: number;
  callIntervalSeconds: number;
  activeDays: number[];
  maxCallDuration: number;
  retryDelay: number;
  maxRetries: number;
}

const DEFAULT: Config = {
  startHour: 9, endHour: 18, callsPerDay: 50,
  callIntervalSeconds: 120, activeDays: [1, 2, 3, 4, 5],
  maxCallDuration: 600, retryDelay: 3600, maxRetries: 3,
};

function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
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

  const inputCls = "w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50 tabular-nums";
  const cardCls = "rounded-2xl bg-[#12121A] border border-white/[0.06] p-5";
  const headCls = (color: string) => `text-[10px] font-bold uppercase tracking-[0.15em] text-[${color}] mb-4 flex items-center gap-1.5`;
  const rowCls = "flex justify-between py-2 border-b border-white/[0.03] last:border-0";

  const Row = ({ l, v, c }: { l: string; v: string | number; c?: string }) => (
    <div className={rowCls}>
      <span className="text-[11px] text-[#8B8BA7]">{l}</span>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: c ?? '#F8F8FF' }}>{v}</span>
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1400px]">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Paramètres</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Configuration complète du système</p>
        </div>
        <button onClick={save} disabled={saving || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7B5CF0] hover:bg-[#6D4FE0] text-white text-sm font-semibold transition-all disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* ── SECTION 1: Planning + Appels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Planning */}
        <div className={cardCls}>
          <h3 className={headCls('#7B5CF0')}>
            <Clock className="w-3.5 h-3.5" /> Planning des appels
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-[10px] text-[#8B8BA7] mb-1 block">Heure début</label>
              <input type="number" min={0} max={23} value={config.startHour}
                onChange={e => setConfig(p => ({ ...p, startHour: Number(e.target.value) }))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[#8B8BA7] mb-1 block">Heure fin</label>
              <input type="number" min={0} max={23} value={config.endHour}
                onChange={e => setConfig(p => ({ ...p, endHour: Number(e.target.value) }))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[#8B8BA7] mb-1 block">Appels / jour</label>
              <input type="number" min={1} max={500} value={config.callsPerDay}
                onChange={e => setConfig(p => ({ ...p, callsPerDay: Number(e.target.value) }))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[#8B8BA7] mb-1 block">Intervalle (sec)</label>
              <input type="number" min={30} value={config.callIntervalSeconds}
                onChange={e => setConfig(p => ({ ...p, callIntervalSeconds: Number(e.target.value) }))}
                className={inputCls} />
            </div>
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
        </div>

        {/* Appels */}
        <div className={cardCls}>
          <h3 className={headCls('#3B82F6')}>
            <Phone className="w-3.5 h-3.5" /> Paramètres appels
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[10px] text-[#8B8BA7] mb-1 block">Durée max (sec)</label>
              <input type="number" min={60} value={config.maxCallDuration}
                onChange={e => setConfig(p => ({ ...p, maxCallDuration: Number(e.target.value) }))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[#8B8BA7] mb-1 block">Délai re-tentative (sec)</label>
              <input type="number" min={300} value={config.retryDelay}
                onChange={e => setConfig(p => ({ ...p, retryDelay: Number(e.target.value) }))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[#8B8BA7] mb-1 block">Tentatives max</label>
              <input type="number" min={1} max={10} value={config.maxRetries}
                onChange={e => setConfig(p => ({ ...p, maxRetries: Number(e.target.value) }))}
                className={inputCls} />
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Prospection</p>
            <Row l="Voix anglais" v="Ashley" />
            <Row l="Voix français" v="Marie" />
            <Row l="Variantes par niche" v="2 scripts A/B" />
            <Row l="Seuil lead chaud" v="Score ≥ 8/10" c="#22C55E" />
            <Row l="Seuil lead qualifié" v="Score ≥ 6/10" c="#F59E0B" />
            <Row l="Seuil confiance IA" v="75%" />
            <Row l="Local presence" v={`${prospecting?.localPresenceNumbers ?? 0} numéros`} />
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Services + Système + DB ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Services */}
        <div className={cardCls}>
          <h3 className={headCls('#22C55E')}>
            <Shield className="w-3.5 h-3.5" /> Services
          </h3>
          <div className="space-y-0">
            {health && [
              { k: 'vapi', label: 'VAPI', desc: 'Appels Voice AI', icon: Phone },
              { k: 'openai', label: 'OpenAI', desc: 'GPT-4 Turbo', icon: Brain },
              { k: 'twilio', label: 'Twilio', desc: 'SMS & validation tél.', icon: Hash },
              { k: 'stripe', label: 'Stripe', desc: 'Paiements', icon: DollarSign },
              { k: 'resend', label: 'Resend', desc: 'Emails (hello@qwillio.com)', icon: Mail },
              { k: 'database', label: 'Base de données', desc: 'PostgreSQL / Neon', icon: Database },
              { k: 'discord', label: 'Discord', desc: 'Alertes leads chauds', icon: Zap },
              { k: 'apify', label: 'Apify', desc: 'Scraping Google Maps', icon: Globe },
            ].map(s => {
              const ok = health[s.k] ?? false;
              return (
                <div key={s.k} className="flex items-center gap-3 py-2.5 border-b border-white/[0.03] last:border-0">
                  {ok ? <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                       : <XCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#F8F8FF]">{s.label}</p>
                    <p className="text-[10px] text-[#8B8BA7]">{s.desc}</p>
                  </div>
                  <span className={`text-[10px] font-semibold ${ok ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {ok ? 'OK' : 'OFF'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Système */}
        <div className={cardCls}>
          <h3 className={headCls('#F59E0B')}>
            <Server className="w-3.5 h-3.5" /> Système & Infrastructure
          </h3>
          <Row l="Backend" v="Render (Express/TypeScript)" />
          <Row l="Frontend" v="Vercel (React 19/Vite)" />
          <Row l="Domaine" v="qwillio.com" />
          <Row l="API" v="qwillio.onrender.com" />
          <Row l="Uptime" v={sysInfo?.uptime ? fmtUptime(sysInfo.uptime) : '—'} c="#22C55E" />
          <Row l="Node.js" v={sysInfo?.nodeVersion ?? '—'} />
          <Row l="Environnement" v={sysInfo?.env ?? '—'} />

          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Cron Jobs (16 total)</p>
            {[
              { l: 'Scraping Apify', v: 'Tous les jours 2h' },
              { l: 'Appels sortants', v: '*/20min Lun-Ven' },
              { l: 'Follow-ups', v: '*/30min' },
              { l: 'Analyse A/B', v: 'Tous les jours 6h' },
              { l: 'Best-time', v: 'Tous les jours 4h' },
              { l: 'Script learning', v: 'Dimanche 1h' },
              { l: 'Rescore', v: 'Tous les jours 3h' },
              { l: 'Keep-alive', v: '*/10min' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1 border-b border-white/[0.02] last:border-0">
                <span className="text-[10px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[10px] text-[#F8F8FF] font-mono">{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Base de données + IA */}
        <div className={cardCls}>
          <h3 className={headCls('#8B5CF6')}>
            <Database className="w-3.5 h-3.5" /> Base de données
          </h3>

          <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-[#22C55E]/5 border border-[#22C55E]/15">
            <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
            <span className="text-xs font-semibold text-[#22C55E]">Connectée</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { l: 'Prospects', v: sysInfo?.prospects ?? '—', c: '#7B5CF0' },
              { l: 'Clients', v: sysInfo?.clients ?? '—', c: '#3B82F6' },
              { l: 'Appels', v: sysInfo?.calls ?? '—', c: '#F59E0B' },
            ].map(s => (
              <div key={s.l} className="bg-[#0D0D15] rounded-lg p-2.5 text-center">
                <p className="text-base font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
                <p className="text-[8px] text-[#8B8BA7] uppercase">{s.l}</p>
              </div>
            ))}
          </div>

          <Row l="ORM" v="Prisma" />
          <Row l="Modèles" v="45 tables" />
          <Row l="Provider" v="Neon (prod) / PG16 (local)" />

          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Intelligence artificielle</p>
            <Row l="Mutations totales" v={aiStats?.totalMutations ?? 0} c="#7B5CF0" />
            <Row l="Tests A/B actifs" v={aiStats?.activeTests ?? 0} c="#22C55E" />
            <Row l="Décisions IA" v={aiStats?.totalDecisions ?? 0} c="#3B82F6" />
            <Row l="Ce mois" v={aiStats?.mutationsThisMonth ?? 0} c="#F59E0B" />
            <Row l="Reverts" v={aiStats?.reverts ?? 0} c="#EF4444" />
            <Row l="Confiance moy." v={`${(aiStats?.avgConfidenceScore ?? 0).toFixed(0)}%`} />
            <Row l="Moteurs" v="Claude + GPT-4" />
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Grille tarifaire + Env vars ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tarifs */}
        <div className={cardCls}>
          <h3 className={headCls('#22C55E')}>
            <DollarSign className="w-3.5 h-3.5" /> Grille tarifaire
          </h3>
          <div className="space-y-2">
            {[
              { plan: 'Starter', monthly: '$197', setup: '$697', calls: '200', color: '#3B82F6' },
              { plan: 'Pro', monthly: '$347', setup: '$997', calls: '500', color: '#7B5CF0' },
              { plan: 'Enterprise', monthly: '$497', setup: '$1,497', calls: '1000', color: '#F59E0B' },
            ].map(p => (
              <div key={p.plan} className="flex items-center gap-3 p-3 rounded-xl bg-[#0D0D15] border border-white/[0.04]">
                <div className="w-1.5 h-10 rounded-full" style={{ background: p.color }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#F8F8FF]">{p.plan}</p>
                  <p className="text-[10px] text-[#8B8BA7]">{p.calls} appels/mois</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#F8F8FF]">{p.monthly}/mo</p>
                  <p className="text-[10px] text-[#8B8BA7]">+ {p.setup} setup</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Variables d'environnement */}
        <div className={cardCls}>
          <h3 className={headCls('#8B8BA7')}>
            <Settings className="w-3.5 h-3.5" /> Variables d'environnement
          </h3>
          <div className="grid grid-cols-2 gap-x-4">
            {[
              'VAPI_PRIVATE_KEY', 'VAPI_ASSISTANT_ID', 'VAPI_PHONE_NUMBER_ID',
              'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'TWILIO_ACCOUNT_SID',
              'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'RESEND_API_KEY',
              'STRIPE_SECRET_KEY', 'DISCORD_WEBHOOK_URL', 'APIFY_API_TOKEN',
              'DATABASE_URL', 'JWT_SECRET',
            ].map(v => (
              <div key={v} className="flex items-center gap-1.5 py-1.5 border-b border-white/[0.02]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] flex-shrink-0" />
                <span className="text-[10px] text-[#8B8BA7] font-mono truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── DANGER ZONE ── */}
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
