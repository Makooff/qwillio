import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, FileText, TrendingUp, MessageSquare, Calendar, Loader2 } from '../../components/icons';
import api from '../../services/api';

type ActivityType = 'call' | 'email' | 'note' | 'deal_update' | 'sms';

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

const TYPE_CONFIG: Record<ActivityType, { label: string; icon: React.ElementType; bg: string; text: string; iconColor: string }> = {
  call:        { label: 'Appel',       icon: Phone,         bg: 'bg-primary-50',    text: 'text-primary-700',    iconColor: 'text-primary-500' },
  email:       { label: 'Email',       icon: Mail,          bg: 'bg-primary-50',  text: 'text-primary-700',  iconColor: 'text-[#7349fe]' },
  note:        { label: 'Note',        icon: FileText,      bg: 'bg-amber-50',   text: 'text-amber-700',   iconColor: 'text-amber-500' },
  deal_update: { label: 'Affaire',     icon: TrendingUp,    bg: 'bg-emerald-50', text: 'text-emerald-700', iconColor: 'text-emerald-500' },
  sms:         { label: 'SMS',         icon: MessageSquare, bg: 'bg-violet-300',  text: 'text-violet-700',  iconColor: 'text-violet-500' },
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
            contactName: a.contactName || a.contact?.name || 'Contact inconnu',
            description: a.description || '',
            timestamp: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            date: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            month: d.toLocaleDateString('fr-FR', { month: 'long' }),
          };
        });
        setActivities(mapped);
      } catch {
        // keep current
      } finally {
        setLoading(false);
      }
    })();
  }, [typeFilter]);

  // Group by date
  const grouped: Record<string, Activity[]> = {};
  activities.forEach(a => {
    if (!grouped[a.date]) grouped[a.date] = [];
    grouped[a.date].push(a);
  });

  const typeCounts: Record<string, number> = {};
  activities.forEach(a => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F5F5F7]">Activité</h1>
          <p className="text-sm text-[#A1A1A8]">{activities.length} activité{activities.length > 1 ? 's' : ''} enregistrée{activities.length > 1 ? 's' : ''}</p>
        </div>
      </motion.div>

      {/* Type stat pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTypeFilter('')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
            typeFilter === '' ? 'bg-[#7349fe] text-white border-[#7349fe]' : 'bg-white/[0.04] border-white/[0.07] text-[#A1A1A8] hover:bg-white/[0.08]'
          }`}
        >
          Tout ({activities.length})
        </button>
        {(Object.keys(TYPE_CONFIG) as ActivityType[]).map(t => {
          const cfg = TYPE_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                typeFilter === t ? `${cfg.bg} ${cfg.text} border-current` : 'bg-white/[0.04] border-white/[0.07] text-[#A1A1A8] hover:bg-white/[0.08]'
              }`}
            >
              <Icon size={12} /> {cfg.label} ({typeCounts[t] || 0})
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={24} className="mx-auto text-[#7349fe] animate-spin mb-3" />
          <p className="text-sm text-[#A1A1A8]">Chargement de l’activité…</p>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="py-16 text-center">
          <Calendar size={36} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-[#A1A1A8]">Aucune activité pour l’instant</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-xs font-semibold text-[#A1A1A8] px-2">{date}</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>

              {/* Activity items */}
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-3 top-0 bottom-0 w-px bg-white/[0.08]" />

                <div className="space-y-3">
                  {items.map((activity, idx) => {
                    const cfg = TYPE_CONFIG[activity.type] || TYPE_CONFIG.note;
                    const Icon = cfg.icon;
                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="relative flex gap-3 group"
                      >
                        {/* Icon dot */}
                        <div className={`absolute -left-6 w-6 h-6 rounded-full ${cfg.bg} border-2 border-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
                          <Icon size={11} className={cfg.iconColor} />
                        </div>

                        {/* Content card */}
                        <div className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 hover:bg-white/[0.05] hover:border-white/[0.12] transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                {cfg.label.toUpperCase()}
                              </span>
                              <span className="text-sm font-semibold text-[#F5F5F7]">{activity.contactName}</span>
                            </div>
                            <span className="text-[11px] text-[#A1A1A8] flex-shrink-0">{activity.timestamp}</span>
                          </div>
                          <p className="text-[12px] text-[#A1A1A8] leading-relaxed">{activity.description}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
