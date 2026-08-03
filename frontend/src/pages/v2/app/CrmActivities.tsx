import { useEffect, useState } from 'react';
import { Calendar, FileText, Mail, MessageSquare, Phone, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import api from '../../../services/api';
import { Card, EmptyState, PageActions, Pill, Row, SectionHead } from '../../../components/v2/app/Blocks';

/* Activity Feed, registre produit V2 (DA/v2-direction.md, addendum).
   Logique de données identique à la V1: GET /crm/activities (limit, type). */

type ActivityType = 'call' | 'email' | 'note' | 'deal_update' | 'sms';
type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

interface Activity {
  id: string;
  type: ActivityType;
  contactName: string;
  description: string;
  timestamp: string;
  date: string;
  month: string;
}

interface RawActivity {
  id: string;
  type?: string;
  contactName?: string;
  description?: string;
  createdAt: string;
  contact?: { name?: string };
}

const TYPE_CONFIG: Record<ActivityType, { label: string; icon: LucideIcon; tone: Tone }> = {
  call: { label: 'Call', icon: Phone, tone: 'info' },
  email: { label: 'Email', icon: Mail, tone: 'accent' },
  note: { label: 'Note', icon: FileText, tone: 'warn' },
  deal_update: { label: 'Deal Update', icon: TrendingUp, tone: 'ok' },
  sms: { label: 'SMS', icon: MessageSquare, tone: 'neutral' },
};

export default function CrmActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<ActivityType | ''>('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const params: Record<string, string> = { limit: '50' };
        if (typeFilter) params.type = typeFilter;
        const { data } = await api.get('/crm/activities', { params });
        const mapped = (data.activities || []).map((a: RawActivity): Activity => {
          const d = new Date(a.createdAt);
          return {
            id: a.id,
            type: (a.type || 'note') as ActivityType,
            contactName: a.contactName || a.contact?.name || 'Unknown',
            description: a.description || '',
            timestamp: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            month: d.toLocaleDateString('en-US', { month: 'long' }),
          };
        });
        setActivities(mapped);
      } catch {
        /* activités indisponibles: la liste courante est conservée */
      } finally {
        setLoading(false);
      }
    })();
  }, [typeFilter]);

  const grouped: Record<string, Activity[]> = {};
  activities.forEach((a) => {
    if (!grouped[a.date]) grouped[a.date] = [];
    grouped[a.date].push(a);
  });

  const typeCounts: Record<string, number> = {};
  activities.forEach((a) => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });

  const filters: { key: ActivityType | ''; label: string; icon?: LucideIcon; count: number }[] = [
    { key: '', label: 'All', count: activities.length },
    ...(Object.keys(TYPE_CONFIG) as ActivityType[]).map((t) => ({
      key: t,
      label: TYPE_CONFIG[t].label,
      icon: TYPE_CONFIG[t].icon,
      count: typeCounts[t] || 0,
    })),
  ];

  return (
    <div>
      <PageActions subtitle={`${activities.length} activities logged`} />

      <div
        role="group"
        aria-label="Filter by activity type"
        className="inline-flex flex-wrap items-center gap-1 rounded-full bg-q2-obsidian border border-q2-graphite-d p-1 mb-5"
      >
        {filters.map((f) => {
          const Icon = f.icon;
          const active = typeFilter === f.key;
          return (
            <button
              key={f.key || 'all'}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              aria-pressed={active}
              className={`h-7 pl-3 pr-2.5 rounded-full text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
                active ? 'bg-q2-indigo text-white' : 'text-q2-fog hover:text-q2-mist'
              }`}
            >
              {Icon && <Icon size={12} aria-hidden="true" />}
              {f.label}
              <span className={`tabular-nums text-[11.5px] ${active ? 'text-white/70' : 'text-q2-mist'}`}>
                ({f.count})
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <Card pad={false}>
          <div role="status" aria-busy="true" aria-label="Loading activities" className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-q2-obsidian animate-pulse" />
                <div className="h-3 w-52 rounded bg-q2-obsidian animate-pulse" />
                <div className="h-3 w-16 rounded bg-q2-obsidian animate-pulse ml-auto" />
              </div>
            ))}
          </div>
        </Card>
      ) : Object.keys(grouped).length === 0 ? (
        <Card pad={false}>
          <EmptyState icon={Calendar} title="No activities yet" />
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <section key={date}>
              <SectionHead title={date} />
              <Card pad={false}>
                {items.map((activity, idx) => {
                  const cfg = TYPE_CONFIG[activity.type] || TYPE_CONFIG.note;
                  return (
                    <Row
                      key={activity.id}
                      first={idx === 0}
                      icon={cfg.icon}
                      label={activity.contactName}
                      hint={activity.description}
                      right={
                        <>
                          <Pill tone={cfg.tone}>{cfg.label.toUpperCase()}</Pill>
                          <span className="text-[11.5px] text-q2-fog tabular-nums whitespace-nowrap">{activity.timestamp}</span>
                        </>
                      }
                    />
                  );
                })}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
