import { useEffect, useState } from 'react';
import { CalendarClock, RefreshCw, Sparkles } from '../../../components/icons';
import api from '../../../services/api';
import {
  Card,
  PageActions,
  SectionHead,
  Stat,
  PrimaryBtn,
  GhostBtn,
  Pill,
  Field,
  Input,
  Select,
  EmptyState,
} from '../../../components/v2/app/Blocks';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';

interface SchedActivity {
  id: string;
  type: string;
  bookingId: string | null;
  status: string;
  content: { slots?: Array<{ datetime: string; reason: string }>; date?: string };
  createdAt: string;
}

interface Dashboard { last24h: number; last30d: number }

export default function AgentScheduling() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [activity, setActivity] = useState<SchedActivity[]>([]);
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slotCount, setSlotCount] = useState(3);
  const [optimizing, setOptimizing] = useState(false);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const reload = async () => {
    try {
      const [d, a] = await Promise.all([
        api.get('/agent/scheduling/dashboard'),
        api.get('/agent/scheduling/activity'),
      ]);
      setDashboard(d.data);
      setActivity(a.data ?? []);
    } catch (e: any) {
      addToast(`Erreur: ${e?.response?.data?.error ?? e.message}`, 'error');
    }
  };

  useEffect(() => { void reload(); }, []);

  const optimize = async () => {
    setOptimizing(true);
    try {
      await api.post('/agent/scheduling/optimize', { date, slotCount });
      addToast('Créneaux générés', 'success');
      await reload();
    } catch (e: any) {
      addToast(`Échec: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Recommandations de créneaux, rappels anti no-show">
        <GhostBtn onClick={() => void reload()}>
          <RefreshCw size={13} aria-hidden="true" />
          Actualiser
        </GhostBtn>
      </PageActions>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat icon={CalendarClock} label="Activités 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={CalendarClock} label="Activités 30j" value={dashboard?.last30d ?? 0} />
        <Stat
          icon={Sparkles}
          label="Recommandations"
          value={activity.filter(a => a.type === 'slots_recommended').length}
        />
      </div>

      <Card>
        <SectionHead title="Recommander des créneaux" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <Field label="Nombre de créneaux">
            <Select value={slotCount} onChange={e => setSlotCount(parseInt(e.target.value))}>
              {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end mt-4">
          <PrimaryBtn onClick={optimize} disabled={optimizing}>
            {optimizing
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <Sparkles size={13} aria-hidden="true" />}
            {optimizing ? 'Calcul…' : 'Recommander'}
          </PrimaryBtn>
        </div>
      </Card>

      <Card pad={false}>
        <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
          <SectionHead
            className="mb-0"
            title="Recommandations récentes"
            action={<span className="text-[11px] text-q2-fog tabular-nums">{activity.length}</span>}
          />
        </div>
        {activity.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Aucune recommandation encore."
            description="Choisissez une date pour obtenir des créneaux."
          />
        ) : (
          <ul>
            {activity.slice(0, 10).map((a, i) => (
              <li key={a.id} className={`px-4 py-3 ${i === 0 ? '' : 'border-t border-q2-graphite-d'}`}>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[13.5px] font-medium text-white tabular-nums">
                    {a.content.date ?? 'aujourd\'hui'}
                  </span>
                  <Pill tone="info">{a.status}</Pill>
                </div>
                {a.content.slots && (
                  <ul className="space-y-1">
                    {a.content.slots.slice(0, 5).map((s, idx) => (
                      <li key={idx} className="text-[12.5px] text-q2-mist tabular-nums">
                        {new Date(s.datetime).toLocaleString('fr-FR')}
                        <span className="text-q2-fog"> · {s.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
