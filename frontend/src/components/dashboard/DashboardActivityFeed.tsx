import { Activity, Phone, Zap, Users, Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { pro } from '../../styles/pro-theme';
import { Card, SectionHead } from '../pro/ProBlocks';
import type { ActivityItem } from '../../hooks/useDashboardData';

function activityIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('call') || t.includes('appel')) return Phone;
  if (t.includes('lead')) return Zap;
  if (t.includes('client')) return Users;
  if (t.includes('bot')) return Bot;
  return Activity;
}

function fmtRelative(iso?: string) {
  if (!iso) return '';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
}

interface Props {
  activity: ActivityItem[];
  className?: string;
}

export function DashboardActivityFeed({ activity, className }: Props) {
  return (
    <Card className={className}>
      <div className="p-4">
        <SectionHead title="Activité récente" />
        {activity.length === 0 ? (
          <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>
            Aucune activité récente
          </p>
        ) : (
          <ul className="space-y-0">
            {activity.slice(0, 8).map((a, i) => {
              const Icon = activityIcon(a.type);
              const ts = a.createdAt ?? a.timestamp;
              return (
                <li
                  key={a.id ?? i}
                  className="flex items-start gap-3 py-2.5"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: pro.panelHi }}
                  >
                    <Icon size={12} style={{ color: pro.textSec }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] leading-snug truncate" style={{ color: pro.text }}>
                      {a.message ?? a.description ?? a.type}
                    </p>
                    {ts && (
                      <p className="text-[10.5px] mt-0.5" style={{ color: pro.textTer }}>
                        {fmtRelative(ts)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
