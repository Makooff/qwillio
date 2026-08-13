import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Save, AlertTriangle, Clock, Phone, Target, Server, ScrollText,
  ChevronRight, Loader2, X, Plus, CheckCircle2, XCircle,
} from '../../components/icons';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { pro } from '../../styles/pro-theme';
import { Card, SectionHead, PageHeader, PrimaryBtn, GhostBtn } from '../../components/pro/ProBlocks';
import TabLogs from '../../components/admin/TabLogs';

/**
 * Admin settings, in the shape of the client account page: one column, sections
 * that open one at a time.
 *
 * Only settings the backend actually stores are here. The previous version put
 * `activeDays`, `retryDelay` and `maxRetries` on screen as editable fields —
 * they marked the page dirty, and `POST /admin/bot-config` dropped all three on
 * the floor. It also carried walls of hardcoded read-only rows (scoring table,
 * pricing grid, cron schedules, 45 env var names with permanently green dots)
 * that reported nothing real.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface Config {
  startHour: number;
  endHour: number;
  callsPerDay: number;
  callIntervalSeconds: number;
  maxCallDuration: number;
  vapiSilenceTimeout: number;
  prospectionQuotaPerDay: number;
  minPriorityScore: number;
  targetCities: string[];
  targetNiches: string[];
  apifyTargetCities: string[];
}

/** Exactly the keys `POST /admin/bot-config` persists — nothing else. */
const DEFAULT: Config = {
  startHour: 9, endHour: 18, callsPerDay: 50, callIntervalSeconds: 1200,
  maxCallDuration: 600, vapiSilenceTimeout: 10,
  prospectionQuotaPerDay: 30, minPriorityScore: 10,
  targetCities: [], targetNiches: [], apifyTargetCities: [],
};

const NICHES = [
  { id: 'home_services', label: 'Services à domicile' },
  { id: 'dental', label: 'Dentaire' },
  { id: 'medical', label: 'Médical' },
  { id: 'law', label: 'Juridique' },
  { id: 'salon', label: 'Salon' },
  { id: 'garage', label: 'Garage auto' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'hotel', label: 'Hôtel' },
];

const inputCls = 'h-9 px-3 rounded-xl text-[13px] outline-none transition-colors w-full';
const inputStyle = { background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` };

function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

// ─── Primitives (module scope: declaring them inside the component remounted
// every input on each keystroke, which is what kept stealing focus) ───────────

function Row({
  icon: Icon, label, hint, open, onClick,
}: {
  icon: typeof Clock; label: string; hint?: string; open: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="w-full flex items-center gap-3 px-4 h-[58px] text-left transition-colors"
    >
      <span className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', color: pro.text }}>
        <Icon size={15} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium truncate" style={{ color: pro.text }}>{label}</span>
        {hint && <span className="block text-[11.5px] truncate" style={{ color: pro.textTer }}>{hint}</span>}
      </span>
      <ChevronRight
        size={15}
        className="transition-transform flex-shrink-0"
        style={{ color: pro.textTer, transform: open ? 'rotate(90deg)' : 'none' }}
      />
    </button>
  );
}

function Panel({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-5 pt-1">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NumField({
  label, value, onChange, min, max, unit,
}: {
  label: string; value: number; onChange: (n: number) => void;
  min?: number; max?: number; unit?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12px]" style={{ color: pro.textSec }}>
        {label}{unit ? ` (${unit})` : ''}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className={`${inputCls} mt-1`}
        style={inputStyle}
      />
    </label>
  );
}

function TagList({
  label, values, onAdd, onRemove, placeholder,
}: {
  label: string; values: string[]; placeholder: string;
  onAdd: (v: string) => void; onRemove: (v: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft('');
  };
  return (
    <div>
      <span className="text-[12px]" style={{ color: pro.textSec }}>{label}</span>
      <div className="flex gap-2 mt-1">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          placeholder={placeholder}
          className={inputCls}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={commit}
          aria-label={`Ajouter à ${label}`}
          className="h-9 w-9 rounded-xl grid place-items-center flex-shrink-0"
          style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}
        >
          <Plus size={14} />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map(v => (
            <span key={v} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-lg text-[12px]"
                  style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.textSec }}>
              {v}
              <button type="button" onClick={() => onRemove(v)} aria-label={`Retirer ${v}`} style={{ color: pro.textTer }}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusLine({ label, ok }: { label: string; ok: boolean | string }) {
  const isOk = ok === true || ok === 'optional';
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: pro.border }}>
      <span className="text-[13px]" style={{ color: pro.textSec }}>{label}</span>
      {isOk
        ? <CheckCircle2 size={14} style={{ color: pro.ok }} />
        : <XCircle size={14} style={{ color: pro.bad }} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SectionKey = 'calls' | 'prospection' | 'system' | 'logs' | 'danger';

export default function AdminSettings() {
  const [config, setConfig] = useState<Config>(DEFAULT);
  const [savedConfig, setSavedConfig] = useState<Config>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<SectionKey | null>('calls');
  const [health, setHealth] = useState<Record<string, boolean | string> | null>(null);
  const [sysInfo, setSysInfo] = useState<Record<string, unknown> | null>(null);
  const [confirmPause, setConfirmPause] = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);
  const { toasts, add: toast, remove } = useToast();

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const load = useCallback(async () => {
    try {
      const [cfg, h, sys] = await Promise.all([
        api.get('/admin/bot-config').catch(() => ({ data: null })),
        api.get('/bot/health').catch(() => ({ data: {} })),
        api.get('/admin/system').catch(() => ({ data: null })),
      ]);
      // Keep only the keys we can save, so nothing on screen is a dead control.
      const merged: Config = { ...DEFAULT };
      if (cfg.data) {
        for (const k of Object.keys(DEFAULT) as (keyof Config)[]) {
          if (cfg.data[k] !== undefined) (merged as any)[k] = cfg.data[k];
        }
      }
      setConfig(merged);
      setSavedConfig(merged);
      setHealth(h.data);
      setSysInfo(sys.data);
    } catch { /* the page still works with defaults */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/admin/bot-config', config);
      setSavedConfig(config);
      toast('Configuration sauvegardée');
    } catch {
      toast('Erreur sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig(c => ({ ...c, [k]: v }));

  const toggleNiche = (id: string) =>
    setConfig(c => ({
      ...c,
      targetNiches: c.targetNiches.includes(id)
        ? c.targetNiches.filter(x => x !== id)
        : [...c.targetNiches, id],
    }));

  const pauseAll = async () => {
    try { await api.post('/bot/stop'); toast('Bot arrêté'); }
    catch { toast('Erreur', 'error'); }
    finally { setConfirmPause(false); }
  };

  const resumeAll = async () => {
    try { await api.post('/bot/start'); toast('Bot démarré'); }
    catch { toast('Erreur', 'error'); }
    finally { setConfirmResume(false); }
  };

  const toggle = (k: SectionKey) => setOpen(o => (o === k ? null : k));

  if (loading) {
    return (
      <div className="max-w-[720px] py-20 text-center">
        <Loader2 size={20} className=" mx-auto" style={{ color: pro.textTer }} />
      </div>
    );
  }

  const uptime = typeof sysInfo?.uptime === 'number' ? fmtUptime(sysInfo.uptime as number) : '—';

  return (
    <div className="max-w-[720px] space-y-6">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Paramètres"
        subtitle="Ce que le bot fait, et quand."
        right={
          <div className="flex items-center gap-2">
            {isDirty && <span className="text-[12px]" style={{ color: pro.warn }}>Non sauvegardé</span>}
            <PrimaryBtn onClick={save} disabled={saving || !isDirty}>
              {saving ? <Loader2 size={13} /> : <Save size={13} />} Sauvegarder
            </PrimaryBtn>
          </div>
        }
      />

      <div>
        <SectionHead title="Bot" />
        <Card>
          <Row icon={Clock} label="Horaires d’appel" open={open === 'calls'} onClick={() => toggle('calls')}
               hint={`${config.startHour}h – ${config.endHour}h · ${config.callsPerDay} appels/jour`} />
          <Panel open={open === 'calls'}>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Heure de début" value={config.startHour} min={0} max={23} onChange={v => set('startHour', v)} />
              <NumField label="Heure de fin" value={config.endHour} min={0} max={23} onChange={v => set('endHour', v)} />
              <NumField label="Appels par jour" value={config.callsPerDay} min={1} max={500} onChange={v => set('callsPerDay', v)} />
              <NumField label="Intervalle" unit="s" value={config.callIntervalSeconds} min={60} onChange={v => set('callIntervalSeconds', v)} />
              <NumField label="Durée max d’appel" unit="s" value={config.maxCallDuration} min={60} onChange={v => set('maxCallDuration', v)} />
              <NumField label="Silence avant raccroché" unit="s" value={config.vapiSilenceTimeout} min={5} onChange={v => set('vapiSilenceTimeout', v)} />
            </div>
          </Panel>

          <div style={{ borderTop: `1px solid ${pro.border}` }}>
            <Row icon={Target} label="Prospection" open={open === 'prospection'} onClick={() => toggle('prospection')}
                 hint={`${config.prospectionQuotaPerDay}/jour · score ≥ ${config.minPriorityScore} · ${config.targetNiches.length} niches`} />
            <Panel open={open === 'prospection'}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Quota par jour" value={config.prospectionQuotaPerDay} min={1} onChange={v => set('prospectionQuotaPerDay', v)} />
                  <NumField label="Score minimum" value={config.minPriorityScore} min={0} onChange={v => set('minPriorityScore', v)} />
                </div>

                <div>
                  <span className="text-[12px]" style={{ color: pro.textSec }}>Niches ciblées</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {NICHES.map(n => {
                      const active = config.targetNiches.includes(n.id);
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => toggleNiche(n.id)}
                          aria-pressed={active}
                          className="h-8 px-3 rounded-xl text-[12px] font-medium transition-colors"
                          style={{
                            background: active ? pro.text : pro.panel,
                            color: active ? '#0B0B0D' : pro.textSec,
                            border: `1px solid ${active ? pro.text : pro.border}`,
                          }}
                        >
                          {n.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <TagList
                  label="Villes de prospection"
                  placeholder="Bruxelles"
                  values={config.targetCities}
                  onAdd={v => set('targetCities', [...config.targetCities, v])}
                  onRemove={v => set('targetCities', config.targetCities.filter(x => x !== v))}
                />
                <TagList
                  label="Villes Apify (Google Maps)"
                  placeholder="Namur"
                  values={config.apifyTargetCities}
                  onAdd={v => set('apifyTargetCities', [...config.apifyTargetCities, v])}
                  onRemove={v => set('apifyTargetCities', config.apifyTargetCities.filter(x => x !== v))}
                />
              </div>
            </Panel>
          </div>
        </Card>
      </div>

      <div>
        <SectionHead title="Serveur" />
        <Card>
          <Row icon={Server} label="État des services" open={open === 'system'} onClick={() => toggle('system')}
               hint={`Uptime ${uptime}`} />
          <Panel open={open === 'system'}>
            {health && Object.keys(health).length > 0 ? (
              <div>
                {Object.entries(health).map(([k, v]) => <StatusLine key={k} label={k} ok={v} />)}
              </div>
            ) : (
              <p className="text-[13px]" style={{ color: pro.textTer }}>État indisponible.</p>
            )}
            {sysInfo && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-[12.5px]" style={{ color: pro.textSec }}>
                <span>Node {String(sysInfo.nodeVersion ?? '—')}</span>
                <span>Env {String(sysInfo.env ?? '—')}</span>
                <span>{String(sysInfo.prospects ?? '—')} prospects</span>
                <span>{String(sysInfo.clients ?? '—')} clients</span>
              </div>
            )}
          </Panel>

          <div style={{ borderTop: `1px solid ${pro.border}` }}>
            <Row icon={ScrollText} label="Journaux" open={open === 'logs'} onClick={() => toggle('logs')}
                 hint="Erreurs et activité du serveur" />
            <Panel open={open === 'logs'}>
              <TabLogs active={open === 'logs'} />
            </Panel>
          </div>
        </Card>
      </div>

      <div>
        <SectionHead title="Zone dangereuse" />
        <Card>
          <Row icon={AlertTriangle} label="Arrêter ou relancer le bot" open={open === 'danger'} onClick={() => toggle('danger')}
               hint="Coupe tous les appels sortants" />
          <Panel open={open === 'danger'}>
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: pro.textSec }}>
              L’arrêt coupe immédiatement la boucle d’appels sortants. Les appels entrants
              de vos clients ne sont pas concernés.
            </p>
            <div className="flex items-center gap-2">
              <GhostBtn onClick={() => setConfirmPause(true)}><Phone size={13} /> Arrêter le bot</GhostBtn>
              <GhostBtn onClick={() => setConfirmResume(true)}>Démarrer le bot</GhostBtn>
            </div>
          </Panel>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmPause}
        onCancel={() => setConfirmPause(false)}
        onConfirm={pauseAll}
        title="Arrêter le bot ?"
        message="Tous les appels sortants s’arrêtent immédiatement."
        confirmLabel="Arrêter"
        danger
      />
      <ConfirmDialog
        open={confirmResume}
        onCancel={() => setConfirmResume(false)}
        onConfirm={resumeAll}
        title="Démarrer le bot ?"
        message="La boucle d’appels sortants reprend selon les horaires configurés."
        confirmLabel="Démarrer"
        danger={false}
      />
    </div>
  );
}
