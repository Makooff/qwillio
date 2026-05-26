import { Bot, Play, Pause, RefreshCw } from 'lucide-react';
import { pro, proShadow } from '../../styles/pro-theme';
import { Card } from '../pro/ProBlocks';
import type { BotStatus } from '../../hooks/useDashboardData';

interface Props {
  status: BotStatus | null;
  busy: boolean;
  onToggle: () => void;
}

export function DashboardHero({ status, busy, onToggle }: Props) {
  const active = status?.isActive ?? false;
  const quota = status?.callsQuota ?? 50;
  const calls = status?.callsToday ?? 0;
  const pct = quota > 0 ? Math.min(100, Math.round((calls / quota) * 100)) : 0;
  const barColor = pct > 90 ? pro.bad : pct > 70 ? pro.warn : pro.accent;

  return (
    <Card glow={active}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div
            className="relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: active ? `${pro.ok}1A` : pro.panelHi,
              border: `1px solid ${active ? `${pro.ok}48` : pro.border}`,
            }}
          >
            {active && (
              <span
                className="absolute inset-0 rounded-2xl animate-ping"
                style={{ background: `${pro.ok}14` }}
              />
            )}
            <Bot size={22} style={{ color: active ? pro.ok : pro.textSec }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: active ? pro.ok : pro.textTer,
                    boxShadow: active ? `0 0 8px ${pro.okGlow}` : undefined,
                  }}
                />
                <span className="text-base font-bold tracking-tight" style={{ color: pro.text }}>
                  {active ? 'Bot actif' : 'Bot inactif'}
                </span>
              </div>

              <span className="text-[12px]" style={{ color: pro.textSec }}>
                <span className="font-semibold tabular-nums" style={{ color: pro.text }}>{calls}</span>
                {' '}appels aujourd'hui
              </span>
              <span className="text-[12px]" style={{ color: pro.textSec }}>
                <span className="font-semibold tabular-nums" style={{ color: pro.text }}>
                  {status?.eligibleProspects ?? 0}
                </span>
                {' '}prospects éligibles
              </span>
              <span className="text-[12px]" style={{ color: pro.textSec }}>
                quota restant{' '}
                <span className="font-semibold tabular-nums" style={{ color: barColor }}>
                  {Math.max(0, quota - calls)}
                </span>
              </span>
            </div>

            <div
              className="h-2 rounded-full overflow-hidden mb-1.5"
              style={{ background: pro.panelHi }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Quota d'appels"
            >
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
            <p className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>
              {calls} / {quota} appels utilisés ({pct}%)
            </p>
          </div>

          <button
            onClick={onToggle}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-[12.5px] font-semibold transition-colors disabled:opacity-40 flex-shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.97]"
            style={{
              background: active ? `${pro.bad}1A` : pro.accentGrad,
              color: active ? pro.bad : '#fff',
              border: active ? `1px solid ${pro.bad}48` : 'none',
              boxShadow: active ? undefined : proShadow.btn,
            }}
          >
            {busy
              ? <RefreshCw size={12} className="animate-spin" />
              : active
                ? <><Pause size={12} /> Arrêter</>
                : <><Play size={12} /> Démarrer</>
            }
          </button>
        </div>
      </div>
    </Card>
  );
}
