import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Save, RefreshCw, AlertTriangle, Clock, Phone } from 'lucide-react';
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
  callIntervalSeconds: 120, activeDays: [1,2,3,4,5],
  maxCallDuration: 600, retryDelay: 3600, maxRetries: 3,
};

export default function AdminSettings() {
  const [config, setConfig] = useState<Config>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);
  const { toasts, add: toast, remove } = useToast();

  useEffect(() => {
    setLoading(true);
    api.get('/admin/bot-config')
      .then(r => { if (r.data) setConfig(prev => ({ ...prev, ...r.data })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/admin/bot-config', config);
      toast('Configuration sauvegardée', 'success');
    } catch { toast('Erreur sauvegarde', 'error'); }
    finally { setSaving(false); }
  };

  const pauseAll = async () => {
    try {
      await api.post('/bot/stop');
      toast('Tous les appels suspendus', 'success');
    } catch { toast('Erreur suspension', 'error'); }
    finally { setConfirmPause(false); }
  };

  const resumeAll = async () => {
    try {
      await api.post('/bot/start');
      toast('Appels repris', 'success');
    } catch { toast('Erreur reprise', 'error'); }
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

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="text-xs text-[#8B8BA7] mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[#8B8BA7] mt-1">{hint}</p>}
    </div>
  );

  const inputCls = "w-full px-3 py-2.5 rounded-xl bg-[#0D0D15] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50";

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Paramètres admin</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Configuration du bot et des appels</p>
        </div>
        <button onClick={save} disabled={saving || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7B5CF0] hover:bg-[#6D4FE0] text-white text-sm font-medium transition-all disabled:opacity-50">
          <Save className="w-4 h-4" />{saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Schedule */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="w-4 h-4 text-[#7B5CF0]" />
          <h3 className="text-sm font-semibold text-[#F8F8FF]">Planning des appels</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Heure début" hint="Heure de début des appels (0-23)">
            <input type="number" min={0} max={23} value={config.startHour}
              onChange={e => setConfig(p => ({ ...p, startHour: Number(e.target.value) }))}
              className={inputCls} />
          </Field>
          <Field label="Heure fin" hint="Heure d'arrêt des appels (0-23)">
            <input type="number" min={0} max={23} value={config.endHour}
              onChange={e => setConfig(p => ({ ...p, endHour: Number(e.target.value) }))}
              className={inputCls} />
          </Field>
          <Field label="Appels par jour">
            <input type="number" min={1} max={500} value={config.callsPerDay}
              onChange={e => setConfig(p => ({ ...p, callsPerDay: Number(e.target.value) }))}
              className={inputCls} />
          </Field>
          <Field label="Intervalle entre appels (secondes)">
            <input type="number" min={30} value={config.callIntervalSeconds}
              onChange={e => setConfig(p => ({ ...p, callIntervalSeconds: Number(e.target.value) }))}
              className={inputCls} />
          </Field>
          <Field label="Durée max par appel (secondes)">
            <input type="number" min={60} value={config.maxCallDuration}
              onChange={e => setConfig(p => ({ ...p, maxCallDuration: Number(e.target.value) }))}
              className={inputCls} />
          </Field>
          <Field label="Délai avant re-tentative (secondes)">
            <input type="number" min={300} value={config.retryDelay}
              onChange={e => setConfig(p => ({ ...p, retryDelay: Number(e.target.value) }))}
              className={inputCls} />
          </Field>
        </div>

        <div className="mt-5">
          <label className="text-xs text-[#8B8BA7] mb-3 block">Jours actifs</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, i) => {
              const dayNum = i + 1;
              const active = config.activeDays.includes(dayNum);
              return (
                <button key={dayNum} onClick={() => toggleDay(dayNum)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    active ? 'bg-[#7B5CF0]/10 border-[#7B5CF0]/30 text-[#7B5CF0]' : 'bg-[#0D0D15] border-white/[0.06] text-[#8B8BA7] hover:border-white/[0.15]'
                  }`}>
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Retry Config */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-5">
          <Phone className="w-4 h-4 text-[#7B5CF0]" />
          <h3 className="text-sm font-semibold text-[#F8F8FF]">Paramètres appels</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Nombre max de tentatives par prospect">
            <input type="number" min={1} max={10} value={config.maxRetries}
              onChange={e => setConfig(p => ({ ...p, maxRetries: Number(e.target.value) }))}
              className={inputCls} />
          </Field>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl bg-[#EF4444]/5 border border-[#EF4444]/20 p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
          <h3 className="text-sm font-semibold text-[#EF4444]">Zone dangereuse</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setConfirmPause(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm font-medium hover:bg-[#EF4444]/20 transition-all">
            Suspendre tous les appels
          </button>
          <button onClick={() => setConfirmResume(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-sm font-medium hover:bg-[#22C55E]/20 transition-all">
            Reprendre tous les appels
          </button>
        </div>
      </div>

      <ConfirmDialog open={confirmPause} title="Suspendre tous les appels"
        message="Arrêter immédiatement le bot et suspendre toutes les campagnes d'appels en cours ?"
        confirmLabel="Suspendre" onConfirm={pauseAll} onCancel={() => setConfirmPause(false)} />
      <ConfirmDialog open={confirmResume} title="Reprendre les appels"
        message="Relancer le bot et reprendre les campagnes d'appels ?"
        confirmLabel="Reprendre" danger={false} onConfirm={resumeAll} onCancel={() => setConfirmResume(false)} />
    </div>
  );
}
