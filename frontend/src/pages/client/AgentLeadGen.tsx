import { useEffect, useState } from 'react';
import { Crosshair, RefreshCw, Send } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, PageHeader, SectionHead, PrimaryBtn, Pill, Stat } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

interface Activity {
  id: string;
  type: string;
  prospectId: string | null;
  channel: string | null;
  step: number;
  status: string;
  content: { businessName?: string; touches?: Array<{ subject: string }> };
  createdAt: string;
}

interface Stats { discovered: number; drafted: number; sent: number; handedOff: number }

export default function AgentLeadGen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const reload = async () => {
    try {
      const [s, a] = await Promise.all([
        api.get('/agent/lead-gen/stats'),
        api.get('/agent/lead-gen/activity'),
      ]);
      setStats(s.data);
      setActivity(a.data ?? []);
    } catch (e: any) {
      addToast(`Erreur: ${e?.response?.data?.error ?? e.message}`, 'error');
    }
  };

  useEffect(() => { void reload(); }, []);

  const discover = async () => {
    setBusy('discover');
    try {
      await api.post('/agent/lead-gen/discover', { count });
      addToast('Leads découverts', 'success');
      await reload();
    } catch (e: any) {
      addToast(`Échec: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const sequence = async (prospectId: string) => {
    setBusy(`seq-${prospectId}`);
    try {
      await api.post(`/agent/lead-gen/sequence/${prospectId}`, { channel: 'email', stepCount: 3 });
      addToast('Séquence générée', 'success');
      await reload();
    } catch (e: any) {
      addToast(`Échec: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />
      <PageHeader title="Lead Gen AI" subtitle="Découverte de prospects + séquences multi-touch personnalisées" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Stat icon={Crosshair} label="Découverts (30j)" value={stats?.discovered ?? 0} />
        <Stat icon={Crosshair} label="Séquences draftées" value={stats?.drafted ?? 0} />
        <Stat icon={Send} label="Envoyés" value={stats?.sent ?? 0} />
        <Stat icon={Crosshair} label="Handoff" value={stats?.handedOff ?? 0} />
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <SectionHead title="Découvrir de nouveaux leads" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Nombre</span>
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={e => setCount(parseInt(e.target.value) || 10)}
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30 tabular-nums"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              />
            </label>
          </div>
          <p className="text-[11px]" style={{ color: pro.textTer }}>
            La cible (niches, villes) se règle dans la config. Modules respect des quotas journaliers.
          </p>
          <div className="flex justify-end">
            <PrimaryBtn onClick={discover} disabled={busy === 'discover'}>
              {busy === 'discover' ? <RefreshCw size={12} className="animate-spin" /> : <Crosshair size={12} />}
              <span className="ml-1.5">Découvrir {count} leads</span>
            </PrimaryBtn>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <SectionHead title="Leads et séquences" />
          {activity.length === 0 ? (
            <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>
              Aucun lead. Lance une découverte pour démarrer.
            </p>
          ) : (
            <ul className="space-y-0">
              {activity.slice(0, 30).map((a, i) => (
                <li key={a.id} className="py-2.5 flex items-center gap-3" style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[12px] font-semibold" style={{ color: pro.text }}>
                        {a.content.businessName ?? `Lead #${a.id.slice(0, 6)}`}
                      </span>
                      <Pill color={a.status === 'completed' || a.status === 'handed_off' ? 'ok' : a.status === 'in_progress' ? 'warn' : 'info'}>
                        {a.status}
                      </Pill>
                      {a.channel && <span className="text-[10.5px]" style={{ color: pro.textTer }}>{a.channel}</span>}
                    </div>
                    {a.content.touches && (
                      <p className="text-[11px]" style={{ color: pro.textSec }}>
                        {a.content.touches.length} touches · step {a.step}
                      </p>
                    )}
                  </div>
                  {a.type === 'lead_discovered' && a.prospectId && (
                    <PrimaryBtn onClick={() => sequence(a.prospectId!)} disabled={busy === `seq-${a.prospectId}`}>
                      {busy === `seq-${a.prospectId}` ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                      <span className="ml-1">Séquence</span>
                    </PrimaryBtn>
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
