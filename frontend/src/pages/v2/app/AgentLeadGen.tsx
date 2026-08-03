import { useEffect, useState } from 'react';
import { Crosshair, RefreshCw, Send } from 'lucide-react';
import api from '../../../services/api';
import {
  Card,
  PageActions,
  SectionHead,
  Stat,
  Row,
  PrimaryBtn,
  GhostBtn,
  Pill,
  Field,
  Input,
  EmptyState,
} from '../../../components/v2/app/Blocks';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';

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
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Découverte de prospects + séquences multi-touch personnalisées">
        <GhostBtn onClick={() => void reload()}>
          <RefreshCw size={13} aria-hidden="true" />
          Actualiser
        </GhostBtn>
      </PageActions>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Crosshair} label="Découverts (30j)" value={stats?.discovered ?? 0} />
        <Stat icon={Crosshair} label="Séquences draftées" value={stats?.drafted ?? 0} />
        <Stat icon={Send} label="Envoyés" value={stats?.sent ?? 0} />
        <Stat icon={Crosshair} label="Handoff" tone="ok" value={stats?.handedOff ?? 0} />
      </div>

      <Card>
        <SectionHead title="Découvrir de nouveaux leads" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field
            label="Nombre"
            hint="La cible (niches, villes) se règle dans la config. Modules respect des quotas journaliers."
          >
            <Input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={e => setCount(parseInt(e.target.value) || 10)}
              className="tabular-nums"
            />
          </Field>
        </div>
        <div className="flex justify-end mt-4">
          <PrimaryBtn onClick={discover} disabled={busy === 'discover'}>
            {busy === 'discover'
              ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              : <Crosshair size={13} aria-hidden="true" />}
            Découvrir {count} leads
          </PrimaryBtn>
        </div>
      </Card>

      <Card pad={false}>
        <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
          <SectionHead
            className="mb-0"
            title="Leads et séquences"
            action={<span className="text-[11px] text-q2-fog tabular-nums">{activity.length}</span>}
          />
        </div>
        {activity.length === 0 ? (
          <EmptyState
            icon={Crosshair}
            title="Aucun lead."
            description="Lance une découverte pour démarrer."
          />
        ) : (
          <ul>
            {activity.slice(0, 30).map((a, i) => (
              <li key={a.id}>
                <Row
                  first={i === 0}
                  label={a.content.businessName ?? `Lead #${a.id.slice(0, 6)}`}
                  hint={a.content.touches ? `${a.content.touches.length} touches · step ${a.step}` : a.channel ?? undefined}
                  right={
                    <>
                      <Pill tone={a.status === 'completed' || a.status === 'handed_off' ? 'ok' : a.status === 'in_progress' ? 'warn' : 'info'}>
                        {a.status}
                      </Pill>
                      {a.type === 'lead_discovered' && a.prospectId && (
                        <GhostBtn onClick={() => sequence(a.prospectId!)} disabled={busy === `seq-${a.prospectId}`}>
                          {busy === `seq-${a.prospectId}`
                            ? <RefreshCw size={12} className="animate-spin" aria-hidden="true" />
                            : <Send size={12} aria-hidden="true" />}
                          Séquence
                        </GhostBtn>
                      )}
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
