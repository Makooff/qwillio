import { useEffect, useState, useCallback } from 'react';
import { Pause, Play, Loader2 } from 'lucide-react';
import api from '../services/api';

/**
 * Compact AI status pill for the client top bar.
 * Shows the current subscription status with a dot indicator and a
 * one-click pause / resume toggle. Syncs with the rest of the
 * dashboard via the `ai-status-change` window event so any page that
 * reads the status refreshes when the pill flips.
 */
type Status = 'active' | 'trialing' | 'paused' | 'canceled' | 'past_due' | 'unknown';

export default function AiStatusPill() {
  const [status, setStatus] = useState<Status>('unknown');
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/my-dashboard/overview');
      setStatus((data?.client?.subscriptionStatus ?? 'unknown') as Status);
    } catch {
      setStatus('unknown');
    }
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('ai-status-change', handler);
    return () => window.removeEventListener('ai-status-change', handler);
  }, [load]);

  const isActive = status === 'active' || status === 'trialing';
  const isPaused = status === 'paused';

  const toggle = async () => {
    if (!isActive && !isPaused) return;
    setToggling(true);
    try {
      await api.post(`/my-dashboard/${isActive ? 'pause' : 'resume'}`);
      // After the API call, re-read so we pick up the real post-toggle status.
      const next: Status = isActive ? 'paused' : 'active';
      setStatus(next);
      window.dispatchEvent(new CustomEvent('ai-status-change', { detail: { status: next } }));
    } catch {
      /* silent */
    } finally {
      setToggling(false);
    }
  };

  if (status === 'unknown') return null;

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      title={isActive ? 'Mettre en pause' : 'Réactiver'}
      className="flex items-center gap-2 h-8 px-3 rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors disabled:opacity-60"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isActive ? 'bg-emerald-400' : isPaused ? 'bg-amber-400' : 'bg-red-400'
        } ${isActive ? 'animate-pulse' : ''}`}
      />
      <span className="text-[11px] font-medium tracking-tight text-[#E5E5EA] leading-none">
        {isActive ? 'IA active' : isPaused ? 'En pause' : (status === 'canceled' ? 'Annulée' : status === 'past_due' ? 'Impayé' : 'IA')}
      </span>
      {toggling
        ? <Loader2 className="w-3 h-3 animate-spin text-[#8B8BA7]" />
        : isActive
          ? <Pause className="w-3 h-3 text-[#8B8BA7]" />
          : <Play className="w-3 h-3 text-[#8B8BA7]" />
      }
    </button>
  );
}
