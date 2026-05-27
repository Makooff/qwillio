import { useEffect, useState } from 'react';
import { CalendarClock, RefreshCw, Sparkles } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, PageHeader, SectionHead, PrimaryBtn, Pill, Stat } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

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
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />
      <PageHeader title="Scheduling AI" subtitle="Recommandations de créneaux, rappels anti no-show" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat icon={CalendarClock} label="Activités 24h" value={dashboard?.last24h ?? 0} />
        <Stat icon={CalendarClock} label="Activités 30j" value={dashboard?.last30d ?? 0} />
        <Stat icon={CalendarClock} label="Recommandations" value={activity.filter(a => a.type === 'slots_recommended').length} />
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <SectionHead title="Recommander des créneaux" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Date</span>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Nombre de créneaux</span>
              <select
                value={slotCount}
                onChange={e => setSlotCount(parseInt(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              >
                {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="flex justify-end">
            <PrimaryBtn onClick={optimize} disabled={optimizing}>
              {optimizing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span className="ml-1.5">{optimizing ? 'Calcul…' : 'Recommander'}</span>
            </PrimaryBtn>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <SectionHead title="Recommandations récentes" />
          {activity.length === 0 ? (
            <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>Aucune recommandation encore.</p>
          ) : (
            <ul className="space-y-3">
              {activity.slice(0, 10).map((a, i) => (
                <li key={a.id} className="py-2.5" style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[12px] font-semibold" style={{ color: pro.text }}>{a.content.date ?? 'aujourd\'hui'}</span>
                    <Pill color="info">{a.status}</Pill>
                  </div>
                  {a.content.slots && (
                    <ul className="space-y-1 mt-1.5">
                      {a.content.slots.slice(0, 5).map((s, idx) => (
                        <li key={idx} className="text-[11.5px]" style={{ color: pro.textSec }}>
                          • {new Date(s.datetime).toLocaleString('fr-FR')} · <span style={{ color: pro.textTer }}>{s.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
