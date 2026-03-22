import { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, FileText, TrendingUp, MessageSquare, Filter, Calendar } from 'lucide-react';

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

const TYPE_CONFIG: Record<ActivityType, { label: string; icon: React.ElementType; bg: string; text: string; iconColor: string }> = {
  call:        { label: 'Call',        icon: Phone,         bg: 'bg-blue-50',    text: 'text-blue-700',    iconColor: 'text-blue-500' },
  email:       { label: 'Email',       icon: Mail,          bg: 'bg-indigo-50',  text: 'text-indigo-700',  iconColor: 'text-indigo-500' },
  note:        { label: 'Note',        icon: FileText,      bg: 'bg-amber-50',   text: 'text-amber-700',   iconColor: 'text-amber-500' },
  deal_update: { label: 'Deal Update', icon: TrendingUp,    bg: 'bg-emerald-50', text: 'text-emerald-700', iconColor: 'text-emerald-500' },
  sms:         { label: 'SMS',         icon: MessageSquare, bg: 'bg-purple-50',  text: 'text-purple-700',  iconColor: 'text-purple-500' },
};

const DEMO_ACTIVITIES: Activity[] = [
  { id: '1',  type: 'call',        contactName: 'Sarah Mitchell',  description: 'Inbound call — discussed AI receptionist setup. Very interested, ready to sign.', timestamp: '10:32 AM', date: 'Mar 22', month: 'March' },
  { id: '2',  type: 'deal_update', contactName: 'Derek Fontaine',  description: 'Deal moved from Appointment → Client. Contract signed for $3,500/yr.', timestamp: '9:15 AM',  date: 'Mar 22', month: 'March' },
  { id: '3',  type: 'email',       contactName: 'James Kowalski',  description: 'Sent follow-up proposal email with pricing breakdown and onboarding timeline.', timestamp: '8:50 AM',  date: 'Mar 22', month: 'March' },
  { id: '4',  type: 'sms',         contactName: 'Priya Nair',      description: 'SMS sent: "Hi Priya, just confirming our demo call tomorrow at 2 PM. Let me know if you need to reschedule."', timestamp: '6:04 PM',  date: 'Mar 21', month: 'March' },
  { id: '5',  type: 'call',        contactName: 'Ryan Castillo',   description: 'Outbound call — 12 min. Ryan asked about integrations. Sent Zapier docs after.', timestamp: '3:22 PM',  date: 'Mar 21', month: 'March' },
  { id: '6',  type: 'note',        contactName: 'Linda Park',      description: 'Note added: Linda prefers morning appointments. Budget is ~$2,400/yr. Decision maker is confirmed.', timestamp: '2:10 PM',  date: 'Mar 21', month: 'March' },
  { id: '7',  type: 'email',       contactName: 'Marcus Williams', description: 'Cold outreach email sent. Subject: "Cut missed calls by 80% — AI dispatcher for plumbers."', timestamp: '11:30 AM', date: 'Mar 21', month: 'March' },
  { id: '8',  type: 'deal_update', contactName: 'Linda Park',      description: 'Deal created: Accounting Scheduler — $2,400, 55% probability, close date Apr 15.', timestamp: '9:00 AM',  date: 'Mar 21', month: 'March' },
  { id: '9',  type: 'call',        contactName: 'Amara Osei',      description: 'Inbound call — 8 min. New lead from Facebook ad. Interested in gym membership chatbot.', timestamp: '4:45 PM',  date: 'Mar 20', month: 'March' },
  { id: '10', type: 'sms',         contactName: 'Ryan Castillo',   description: 'SMS received from Ryan: "Yes, I\'m ready to move forward. Can we sign this week?"', timestamp: '3:10 PM',  date: 'Mar 20', month: 'March' },
  { id: '11', type: 'note',        contactName: 'James Kowalski',  description: 'Note: Decision pending final approval from AutoMax GM. Follow up Friday.', timestamp: '1:55 PM',  date: 'Mar 20', month: 'March' },
  { id: '12', type: 'email',       contactName: 'Eva Brennan',     description: 'Welcome email sent post-signup. Introduced onboarding coordinator and next steps.', timestamp: '10:20 AM', date: 'Mar 20', month: 'March' },
  { id: '13', type: 'deal_update', contactName: 'Tom Harrington',  description: 'Deal marked Lost. Tom chose a competitor. Budget constraints cited.', timestamp: '9:40 AM',  date: 'Mar 20', month: 'March' },
  { id: '14', type: 'call',        contactName: 'Kim Nguyen',      description: 'Discovery call — 22 min. Excellent fit. Scheduling live demo next week.', timestamp: '2:30 PM',  date: 'Mar 19', month: 'March' },
  { id: '15', type: 'note',        contactName: 'Greg Torres',     description: 'Note: Greg runs 3 landscaping crews. Would benefit from automated scheduling. Send case study.', timestamp: '11:05 AM', date: 'Mar 19', month: 'March' },
  { id: '16', type: 'email',       contactName: 'Sandra Lee',      description: 'Proposal email sent: HVAC Appointment Setter at $2,600/yr. Includes 30-day free trial.', timestamp: '10:00 AM', date: 'Mar 19', month: 'March' },
  { id: '17', type: 'sms',         contactName: 'Derek Fontaine',  description: 'SMS: "Your AI receptionist is live! Expect a training call from our team today."', timestamp: '8:30 AM',  date: 'Mar 19', month: 'March' },
  { id: '18', type: 'call',        contactName: 'Sandra Lee',      description: 'Inbound inquiry call — Sandra runs a busy HVAC company. Very high lead volume, open to automation.', timestamp: '3:50 PM',  date: 'Mar 18', month: 'March' },
];

const MONTHS = ['All Time', 'March', 'February', 'January'];
const DATES = ['All Dates', 'Mar 22', 'Mar 21', 'Mar 20', 'Mar 19', 'Mar 18'];

export default function CrmActivities() {
  const [typeFilter, setTypeFilter] = useState<ActivityType | ''>('');
  const [monthFilter, setMonthFilter] = useState('All Time');
  const [dateFilter, setDateFilter] = useState('All Dates');

  const filtered = DEMO_ACTIVITIES.filter(a => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (monthFilter !== 'All Time' && a.month !== monthFilter) return false;
    if (dateFilter !== 'All Dates' && a.date !== dateFilter) return false;
    return true;
  });

  // Group by date
  const grouped: Record<string, Activity[]> = {};
  filtered.forEach(a => {
    if (!grouped[a.date]) grouped[a.date] = [];
    grouped[a.date].push(a);
  });

  const typeCounts: Record<string, number> = {};
  DEMO_ACTIVITIES.forEach(a => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Feed</h1>
          <p className="text-sm text-[#86868b]">{DEMO_ACTIVITIES.length} activities logged</p>
        </div>
      </motion.div>

      {/* Type stat pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setTypeFilter('')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            typeFilter === '' ? 'bg-[#6366f1] text-white border-[#6366f1]' : 'bg-white border-[#d2d2d7]/60 text-[#86868b] hover:bg-[#f5f5f7]'
          }`}>
          All ({DEMO_ACTIVITIES.length})
        </button>
        {(Object.keys(TYPE_CONFIG) as ActivityType[]).map(t => {
          const cfg = TYPE_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                typeFilter === t ? `${cfg.bg} ${cfg.text} border-current` : 'bg-white border-[#d2d2d7]/60 text-[#86868b] hover:bg-[#f5f5f7]'
              }`}>
              <Icon size={12} /> {cfg.label} ({typeCounts[t] || 0})
            </button>
          );
        })}
      </div>

      {/* Date range filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#d2d2d7]/60 bg-white">
          <Calendar size={14} className="text-[#86868b]" />
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="text-sm bg-transparent focus:outline-none text-[#1d1d1f]">
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#d2d2d7]/60 bg-white">
          <Filter size={14} className="text-[#86868b]" />
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="text-sm bg-transparent focus:outline-none text-[#1d1d1f]">
            {DATES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <span className="flex items-center px-3 py-2 text-xs text-[#86868b]">{filtered.length} activities</span>
      </div>

      {/* Timeline */}
      {Object.keys(grouped).length === 0 ? (
        <div className="py-16 text-center">
          <Calendar size={36} className="mx-auto text-[#d2d2d7] mb-3" />
          <p className="text-sm text-[#86868b]">No activities match your filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, activities]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[#d2d2d7]/40" />
                <span className="text-xs font-semibold text-[#86868b] px-2">{date}</span>
                <div className="h-px flex-1 bg-[#d2d2d7]/40" />
              </div>

              {/* Activity items */}
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-3 top-0 bottom-0 w-px bg-[#d2d2d7]/40" />

                <div className="space-y-3">
                  {activities.map((activity, idx) => {
                    const cfg = TYPE_CONFIG[activity.type];
                    const Icon = cfg.icon;
                    return (
                      <motion.div key={activity.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                        className="relative flex gap-3 group">
                        {/* Icon dot */}
                        <div className={`absolute -left-6 w-6 h-6 rounded-full ${cfg.bg} border-2 border-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
                          <Icon size={11} className={cfg.iconColor} />
                        </div>

                        {/* Content card */}
                        <div className="flex-1 rounded-2xl border border-[#d2d2d7]/60 bg-white px-4 py-3 hover:shadow-sm hover:border-[#d2d2d7] transition-all">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                {cfg.label.toUpperCase()}
                              </span>
                              <span className="text-sm font-semibold text-[#1d1d1f]">{activity.contactName}</span>
                            </div>
                            <span className="text-[11px] text-[#86868b] flex-shrink-0">{activity.timestamp}</span>
                          </div>
                          <p className="text-[12px] text-[#86868b] leading-relaxed">{activity.description}</p>
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
