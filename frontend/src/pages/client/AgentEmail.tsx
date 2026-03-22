import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Chrome, AlertCircle, Calendar, CreditCard,
  Trash2, Info, ToggleLeft, ToggleRight, CheckCircle2,
  Clock, Edit3, Send, Bell, ChevronRight, X, Plus
} from 'lucide-react';

type Tab = 'urgent' | 'appointment' | 'payment' | 'spam' | 'info';

interface Email {
  id: number;
  from: string;
  subject: string;
  preview: string;
  time: string;
  tab: Tab;
  autoReplied: boolean;
}

const TABS: { key: Tab; label: string; icon: React.ElementType; count: number; color: string }[] = [
  { key: 'urgent', label: 'Urgent', icon: AlertCircle, count: 3, color: 'text-red-600 bg-red-50 border-red-200' },
  { key: 'appointment', label: 'Appointment', icon: Calendar, count: 7, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { key: 'payment', label: 'Payment', icon: CreditCard, count: 4, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { key: 'spam', label: 'Spam', icon: Trash2, count: 12, color: 'text-[#86868b] bg-[#f5f5f7] border-[#d2d2d7]' },
  { key: 'info', label: 'Info', icon: Info, count: 9, color: 'text-purple-600 bg-purple-50 border-purple-200' },
];

const EMAILS: Email[] = [
  { id: 1, from: 'sarah.jones@gmail.com', subject: 'Need appointment ASAP — urgent skin issue', preview: 'Hi, I have an urgent situation and need to come in today if possible...', time: '10 min ago', tab: 'urgent', autoReplied: false },
  { id: 2, from: 'mike.chen@company.com', subject: 'RE: Invoice overdue — threatening legal action', preview: 'This is a formal notice that the invoice dated...', time: '1 hr ago', tab: 'urgent', autoReplied: false },
  { id: 3, from: 'lisa.martin@hotmail.com', subject: 'Appointment for next Tuesday?', preview: 'Hello, I would like to book an appointment for a 60-minute massage...', time: '2 hr ago', tab: 'appointment', autoReplied: true },
  { id: 4, from: 'david.hall@email.com', subject: 'Reschedule my Friday session', preview: 'Something came up, can we move Friday to Monday?', time: '3 hr ago', tab: 'appointment', autoReplied: false },
  { id: 5, from: 'payments@stripe.com', subject: 'Payment received — $150.00', preview: 'A payment of $150.00 has been successfully processed for...', time: '4 hr ago', tab: 'payment', autoReplied: true },
  { id: 6, from: 'noreply@win-prizes.com', subject: 'Congratulations! You have won $5,000!', preview: 'Click the link below to claim your prize today...', time: '5 hr ago', tab: 'spam', autoReplied: false },
  { id: 7, from: 'newsletter@industry.com', subject: 'Weekly Industry Digest — March 2026', preview: 'This week in wellness: trends, tips, and more...', time: '8 hr ago', tab: 'info', autoReplied: false },
];

const TEMPLATES = [
  { id: 1, name: 'Appointment Confirmation', category: 'appointment', preview: 'Hi {name}, your appointment on {date} at {time} is confirmed...' },
  { id: 2, name: 'Payment Request', category: 'payment', preview: 'Hi {name}, please find your deposit request of {amount} for...' },
  { id: 3, name: 'Appointment Reminder', category: 'appointment', preview: 'Reminder: You have an appointment tomorrow at {time}...' },
  { id: 4, name: 'Out of Office', category: 'info', preview: 'Thank you for reaching out. I am currently unavailable and will respond...' },
];

export default function AgentEmail() {
  const [activeTab, setActiveTab] = useState<Tab>('urgent');
  const [gmailConnected, setGmailConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestTime, setDigestTime] = useState('08:00');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null);

  const autoReplyRules: Record<Tab, boolean> = {
    urgent: false,
    appointment: true,
    payment: true,
    spam: false,
    info: false,
  };
  const [rules, setRules] = useState(autoReplyRules);

  const visibleEmails = EMAILS.filter(e => e.tab === activeTab);

  const toggleRule = (tab: Tab) => setRules(prev => ({ ...prev, [tab]: !prev[tab] }));

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Email AI</h1>
        <p className="text-sm text-[#86868b]">Intelligent inbox management and auto-reply</p>
      </motion.div>

      {/* Connect Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Chrome size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">Gmail</p>
              <p className="text-xs text-[#86868b]">{gmailConnected ? 'Connected · admin@qwillio.com' : 'Not connected'}</p>
            </div>
          </div>
          <button
            onClick={() => setGmailConnected(c => !c)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              gmailConnected
                ? 'bg-[#f5f5f7] text-[#86868b] hover:bg-red-50 hover:text-red-600 border border-[#d2d2d7]/60'
                : 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
            }`}
          >
            {gmailConnected ? 'Disconnect' : 'Connect Gmail'}
          </button>
        </div>
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Mail size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">Outlook</p>
              <p className="text-xs text-[#86868b]">{outlookConnected ? 'Connected · user@outlook.com' : 'Not connected'}</p>
            </div>
          </div>
          <button
            onClick={() => setOutlookConnected(c => !c)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              outlookConnected
                ? 'bg-[#f5f5f7] text-[#86868b] hover:bg-red-50 hover:text-red-600 border border-[#d2d2d7]/60'
                : 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
            }`}
          >
            {outlookConnected ? 'Disconnect' : 'Connect Outlook'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Inbox View */}
        <div className="lg:col-span-2 rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold">AI Classified Inbox</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#86868b]">Auto-reply</span>
              <button onClick={() => setAutoReplyEnabled(v => !v)}>
                {autoReplyEnabled
                  ? <ToggleRight size={22} className="text-[#6366f1]" />
                  : <ToggleLeft size={22} className="text-[#86868b]" />
                }
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    isActive ? tab.color : 'bg-[#f5f5f7] text-[#86868b] border-[#d2d2d7]/60 hover:bg-[#e8e8ed]'
                  }`}
                >
                  <Icon size={12} />
                  {tab.label}
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isActive ? 'bg-white/60' : 'bg-[#d2d2d7]/40'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Email list */}
          <div className="space-y-1">
            <AnimatePresence mode="wait">
              {visibleEmails.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-center py-10 text-sm text-[#86868b]">
                  No emails in this category
                </motion.div>
              ) : visibleEmails.map((email, i) => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setSelectedEmail(selectedEmail?.id === email.id ? null : email)}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#f5f5f7] cursor-pointer transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0 text-[#6366f1] font-semibold text-sm">
                    {email.from[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{email.from}</p>
                      <span className="text-[10px] text-[#86868b] ml-2 whitespace-nowrap">{email.time}</span>
                    </div>
                    <p className="text-xs font-medium truncate mt-0.5">{email.subject}</p>
                    <p className="text-xs text-[#86868b] truncate mt-0.5">{email.preview}</p>
                  </div>
                  {email.autoReplied && (
                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-1" />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Expanded email */}
          <AnimatePresence>
            {selectedEmail && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7]/60"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold">{selectedEmail.subject}</p>
                  <button onClick={() => setSelectedEmail(null)} className="text-[#86868b] hover:text-[#1d1d1f]">
                    <X size={14} />
                  </button>
                </div>
                <p className="text-sm text-[#86868b] mb-3">{selectedEmail.preview}</p>
                <div className="flex gap-2">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] transition-colors">
                    <Send size={11} /> Send Reply
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-[#1d1d1f] rounded-lg border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors">
                    Mark Reviewed
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          {/* Auto-reply rules */}
          <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5">
            <h3 className="text-sm font-semibold mb-4">Auto-reply Rules</h3>
            <div className="space-y-3">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <div key={tab.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className="text-[#86868b]" />
                      <span className="text-sm">{tab.label}</span>
                    </div>
                    <button onClick={() => toggleRule(tab.key)}>
                      {rules[tab.key]
                        ? <ToggleRight size={20} className="text-[#6366f1]" />
                        : <ToggleLeft size={20} className="text-[#86868b]" />
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Digest */}
          <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Daily Digest</h3>
              <button onClick={() => setDigestEnabled(v => !v)}>
                {digestEnabled
                  ? <ToggleRight size={20} className="text-[#6366f1]" />
                  : <ToggleLeft size={20} className="text-[#86868b]" />
                }
              </button>
            </div>
            <p className="text-xs text-[#86868b] mb-3">Send an AI summary of your inbox each morning</p>
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-[#86868b]" />
              <input
                type="time"
                value={digestTime}
                onChange={e => setDigestTime(e.target.value)}
                className="flex-1 text-sm border border-[#d2d2d7]/60 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Manual Review Queue */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold">Manual Review Queue</h3>
            <p className="text-xs text-[#86868b] mt-0.5">Emails that need your attention</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <AlertCircle size={11} /> 2 pending
          </span>
        </div>
        <div className="space-y-2">
          {EMAILS.filter(e => e.tab === 'urgent' && !e.autoReplied).map(email => (
            <div key={email.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7]/40">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 text-red-600 font-semibold text-sm">
                {email.from[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{email.subject}</p>
                <p className="text-xs text-[#86868b] truncate">{email.from}</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-xs font-medium bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] transition-colors">Reply</button>
                <button className="px-3 py-1.5 text-xs font-medium bg-white text-[#86868b] rounded-lg border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors">Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Template Editor */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold">Reply Templates</h3>
            <p className="text-xs text-[#86868b] mt-0.5">AI uses these to auto-respond</p>
          </div>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d2d2d7]/60 transition-all">
            <Plus size={13} /> New Template
          </button>
        </div>
        <div className="space-y-2">
          {TEMPLATES.map(tmpl => (
            <div key={tmpl.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#f5f5f7] transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0">
                <Edit3 size={14} className="text-[#6366f1]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{tmpl.name}</p>
                <p className="text-xs text-[#86868b] truncate">{tmpl.preview}</p>
              </div>
              <button
                onClick={() => setEditingTemplate(editingTemplate === tmpl.id ? null : tmpl.id)}
                className="text-xs text-[#6366f1] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
        <AnimatePresence>
          {editingTemplate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7]/60"
            >
              <p className="text-xs font-medium mb-2">Editing: {TEMPLATES.find(t => t.id === editingTemplate)?.name}</p>
              <textarea
                className="w-full text-sm border border-[#d2d2d7]/60 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 resize-none bg-white"
                rows={4}
                defaultValue={TEMPLATES.find(t => t.id === editingTemplate)?.preview}
              />
              <div className="flex gap-2 mt-3">
                <button className="px-4 py-2 text-xs font-medium bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] transition-colors">Save</button>
                <button onClick={() => setEditingTemplate(null)} className="px-4 py-2 text-xs font-medium bg-white text-[#86868b] rounded-lg border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors">Cancel</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
