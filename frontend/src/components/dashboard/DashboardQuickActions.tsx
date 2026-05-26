import { RefreshCw, PhoneCall, Megaphone, Target } from 'lucide-react';
import { pro } from '../../styles/pro-theme';
import { Card, SectionHead } from '../pro/ProBlocks';

interface Props {
  busy: string | null;
  onAction: (label: string, endpoint: string) => void;
}

export function DashboardQuickActions({ busy, onAction }: Props) {
  const actions = [
    { label: 'Lancer scraping prospects', endpoint: 'admin/trigger-scraping', icon: Target, color: pro.info },
    { label: 'Déclencher un appel', endpoint: 'admin/trigger-call', icon: PhoneCall, color: pro.accent },
    { label: 'Traiter les suivis', endpoint: 'admin/trigger-followups', icon: Megaphone, color: pro.ok },
  ];

  return (
    <Card>
      <div className="p-4">
        <SectionHead title="Prochaines actions" />
        <div className="grid grid-cols-1 gap-2">
          {actions.map(({ label, endpoint, icon: Icon, color }) => (
            <button
              key={label}
              onClick={() => onAction(label, endpoint)}
              disabled={busy === label}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors disabled:opacity-50 hover:brightness-110 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.97]"
              style={{
                background: `${color}12`,
                border: `1px solid ${color}28`,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}18` }}
              >
                {busy === label
                  ? <RefreshCw size={13} className="animate-spin" style={{ color }} />
                  : <Icon size={14} style={{ color }} />
                }
              </div>
              <span className="text-[13px] font-medium" style={{ color }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
