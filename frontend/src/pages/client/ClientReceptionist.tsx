import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Phone, PhoneForwarded, Clock, Pause, Play, Settings,
  Volume2, Check, AlertCircle, Mic, Globe, Zap, MessageSquare,
  User, Sparkles, Timer, BellRing, Save, Copy, ChevronRight,
  Plus, Trash2, RotateCcw, Square, Activity, Calendar,
  ShieldAlert, Radio, FileText, BarChart2, Power
} from 'lucide-react';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';

/* ─────────────── Constants ─────────────── */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const VOICES = [
  { id: 'sarah',  name: 'Sarah',  lang: 'EN',    desc: 'Professional, warm',       flag: '🇺🇸' },
  { id: 'marie',  name: 'Marie',  lang: 'FR',    desc: 'Douce, professionnelle',   flag: '🇫🇷' },
  { id: 'james',  name: 'James',  lang: 'EN',    desc: 'Confident, clear',         flag: '🇬🇧' },
  { id: 'sophie', name: 'Sophie', lang: 'FR/EN', desc: 'Bilingual, friendly',      flag: '🇫🇷' },
];

const NICHES = ['dental', 'medical', 'law', 'salon', 'restaurant', 'garage', 'hotel'];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'Europe/Paris', 'Europe/London',
  'Asia/Tokyo', 'Australia/Sydney',
];

const TABS = [
  { id: 'identity',    label: 'Identity',       icon: User },
  { id: 'voice',       label: 'Voice Settings', icon: Mic },
  { id: 'business',    label: 'Business Config',icon: Settings },
  { id: 'callhandling',label: 'Call Handling',  icon: Phone },
  { id: 'hours',       label: 'Business Hours', icon: Clock },
  { id: 'transfer',    label: 'Human Transfer', icon: PhoneForwarded },
  { id: 'forwarding',  label: 'Call Forwarding',icon: Radio },
  { id: 'script',      label: 'Script Preview', icon: FileText },
  { id: 'status',      label: 'Status & Controls', icon: Activity },
];

/* ─────────────── Reusable primitives ─────────────── */

function InputField({
  label, hint, ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-xs font-medium text-[#86868b] mb-1.5 block">{label}</label>
      <input
        {...props}
        className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white
          focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40
          transition-all disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
      />
      {hint && <p className="text-[11px] text-[#86868b] mt-1">{hint}</p>}
    </div>
  );
}

function SelectField({
  label, hint, children, ...props
}: { label: string; hint?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="text-xs font-medium text-[#86868b] mb-1.5 block">{label}</label>
      <select
        {...props}
        className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white
          focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40
          transition-all appearance-none cursor-pointer"
      >
        {children}
      </select>
      {hint && <p className="text-[11px] text-[#86868b] mt-1">{hint}</p>}
    </div>
  );
}

function TextAreaField({
  label, hint, ...props
}: { label: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="text-xs font-medium text-[#86868b] mb-1.5 block">{label}</label>
      <textarea
        {...props}
        className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white
          focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40
          transition-all resize-none disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
      />
      {hint && <p className="text-[11px] text-[#86868b] mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-[#1d1d1f] group-hover:text-[#6366f1] transition-colors">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-all duration-200 ${checked ? 'bg-[#6366f1]' : 'bg-[#d2d2d7]'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
}

function SliderField({
  label, value, onChange, min = 0, max = 1, step = 0.01
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <label className="text-xs font-medium text-[#86868b]">{label}</label>
        <span className="text-xs font-mono text-[#6366f1]">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-2 accent-[#6366f1] rounded-full cursor-pointer"
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-[#86868b]">{min}</span>
        <span className="text-[10px] text-[#86868b]">{max}</span>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[#1d1d1f]">
      <Icon size={16} className="text-[#6366f1]" />
      {title}
    </h3>
  );
}

function SaveBar({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="mt-8 flex items-center justify-between bg-white/90 backdrop-blur-lg border border-[#d2d2d7]/60 rounded-2xl px-6 py-4 shadow-sm">
      <p className="text-sm text-[#86868b]">
        {saved ? (
          <span className="text-emerald-600 flex items-center gap-1.5 font-medium">
            <Check size={16} /> Changes saved
          </span>
        ) : 'Make changes above, then save'}
      </p>
      <button
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-50 transition-all shadow-sm"
      >
        {saving ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
        ) : (
          <><Save size={15} />Save changes</>
        )}
      </button>
    </div>
  );
}

/* ─────────────── Tag list helper ─────────────── */

function TagList({
  items, onAdd, onRemove, placeholder
}: { items: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) { onAdd(v); setDraft(''); }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder || 'Type and press Enter'}
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
        />
        <button onClick={add} className="px-3 py-2 rounded-xl bg-[#6366f1] text-white hover:bg-[#4f46e5] transition-all">
          <Plus size={14} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-[#f5f5f7] rounded-lg border border-[#d2d2d7]/60">
            {item}
            <button onClick={() => onRemove(i)} className="text-[#86868b] hover:text-red-500 transition-colors">
              <Trash2 size={11} />
            </button>
          </span>
        ))}
        {items.length === 0 && <p className="text-xs text-[#86868b] italic">No items yet</p>}
      </div>
    </div>
  );
}

/* ─────────────── Main component ─────────────── */

export default function ClientReceptionist() {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState('identity');
  const [data, setData]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [toggling, setToggling]   = useState(false);

  /* ── Tab 1: Identity ── */
  const [aiName, setAiName]           = useState('Ashley');
  const [language, setLanguage]       = useState('en');
  const [selectedVoice, setSelectedVoice] = useState('sarah');
  const [tone, setTone]               = useState('professional');

  /* ── Tab 2: Voice Settings ── */
  const [stability, setStability]         = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [styleSlider, setStyleSlider]     = useState(0.3);
  const [speakerBoost, setSpeakerBoost]   = useState(false);
  const [bgSound, setBgSound]             = useState('none');
  const [fillerInjection, setFillerInjection] = useState(false);
  const [maxCallDuration, setMaxCallDuration] = useState(600);
  const [silenceTimeout, setSilenceTimeout] = useState(30);

  /* ── Tab 3: Business Config ── */
  const [businessName, setBusinessName]   = useState('');
  const [niche, setNiche]                 = useState('dental');
  const [services, setServices]           = useState<string[]>(['Consultations', 'Appointments']);
  const [customInstructions, setCustomInstructions] = useState('');
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([
    { q: 'What are your hours?', a: 'We are open Monday to Friday, 9 AM to 5 PM.' },
    { q: 'Do you accept walk-ins?', a: 'Yes, walk-ins are welcome based on availability.' },
  ]);
  const [faqDraftQ, setFaqDraftQ] = useState('');
  const [faqDraftA, setFaqDraftA] = useState('');

  /* ── Tab 4: Call Handling ── */
  const [inboundNumber, setInboundNumber]   = useState('');
  const [transferNumber, setTransferNumber] = useState('');
  const [backupNumber, setBackupNumber]     = useState('');
  const [afterHoursBehavior, setAfterHoursBehavior] = useState('voicemail');
  const [voicemailGreeting, setVoicemailGreeting] = useState('');

  /* ── Tab 5: Business Hours ── */
  const [alwaysOn, setAlwaysOn]   = useState(false);
  const [timezone, setTimezone]   = useState('America/New_York');
  const [holidays, setHolidays]   = useState<string[]>([]);
  const [businessHours, setBusinessHours] = useState<Record<string, { enabled: boolean; from: string; to: string }>>(
    Object.fromEntries(DAYS.map(d => [d, { enabled: !['Saturday', 'Sunday'].includes(d), from: '09:00', to: '17:00' }]))
  );

  /* ── Tab 6: Human Transfer ── */
  const [transferKeywords, setTransferKeywords]   = useState<string[]>(['speak to someone', 'human', 'agent', 'manager']);
  const [preTransferMsg, setPreTransferMsg]       = useState('Please hold while I transfer you to a team member.');
  const [failedTransferFallback, setFailedTransferFallback] = useState('voicemail');
  const transferLog = [
    { id: 1, time: '2026-03-22 14:32', from: '+1 514 555 0001', status: 'Success', keyword: 'speak to someone' },
    { id: 2, time: '2026-03-22 11:05', from: '+1 438 555 0042', status: 'Failed', keyword: 'manager' },
    { id: 3, time: '2026-03-21 16:20', from: '+1 450 555 0018', status: 'Success', keyword: 'human' },
    { id: 4, time: '2026-03-21 09:48', from: '+1 514 555 0093', status: 'Success', keyword: 'agent' },
    { id: 5, time: '2026-03-20 13:15', from: '+1 438 555 0055', status: 'Failed', keyword: 'speak to someone' },
  ];

  /* ── Tab 7: Call Forwarding ── */
  const [forwardingActive, setForwardingActive]   = useState(true);
  const [forwardingType, setForwardingType]       = useState('immediate');
  const [copied, setCopied]                       = useState(false);
  const carrierCode = '*72+15145550100#';

  /* ── Tab 8: Script Preview ── */
  const activeScript = `Hello! Thank you for calling ${businessName || '[Business Name]'}. My name is ${aiName}, how can I help you today?

I can assist you with scheduling appointments, answering questions about our services, or connecting you with the right team member.

Our services include: ${services.join(', ')}.

[If caller requests human transfer]: ${preTransferMsg}

[After hours]: We are currently closed. Please leave a message and we will get back to you during business hours.`;

  /* ── Tab 9: Status ── */
  const [receptionistStatus, setReceptionistStatus] = useState<'active' | 'paused' | 'offline'>('active');
  const [pauseDuration, setPauseDuration] = useState('1h');

  /* ─── Fetch ─── */
  useEffect(() => {
    (async () => {
      try {
        const [overview, settings] = await Promise.all([
          api.get('/my-dashboard/overview'),
          api.get('/my-dashboard/settings').catch(() => ({ data: null })),
        ]);
        const s = settings.data;
        const c = overview.data?.client;
        setData({ ...overview.data, settings: s });

        setInboundNumber(c?.vapiPhoneNumber || s?.vapiPhoneNumber || '');
        setTransferNumber(c?.transferNumber  || s?.transferNumber  || '');
        setBusinessName(c?.businessName      || s?.businessName    || '');
        setNiche(c?.businessType             || s?.businessType    || 'dental');

        const cfg = s?.vapiConfig || c?.vapiConfig || {};
        if (cfg.voice)              setSelectedVoice(cfg.voice);
        if (cfg.tone)               setTone(cfg.tone);
        if (cfg.language)           setLanguage(cfg.language);
        if (cfg.aiName)             setAiName(cfg.aiName);
        if (cfg.stability !== undefined)     setStability(cfg.stability);
        if (cfg.similarityBoost !== undefined) setSimilarityBoost(cfg.similarityBoost);
        if (cfg.styleSlider !== undefined)   setStyleSlider(cfg.styleSlider);
        if (cfg.speakerBoost !== undefined)  setSpeakerBoost(cfg.speakerBoost);
        if (cfg.bgSound)            setBgSound(cfg.bgSound);
        if (cfg.fillerInjection !== undefined) setFillerInjection(cfg.fillerInjection);
        if (cfg.maxCallDuration !== undefined) setMaxCallDuration(cfg.maxCallDuration);
        if (cfg.silenceTimeout !== undefined)  setSilenceTimeout(cfg.silenceTimeout);
        if (cfg.customInstructions) setCustomInstructions(cfg.customInstructions);
        if (cfg.services)           setServices(cfg.services);
        if (cfg.faqs)               setFaqs(cfg.faqs);
        if (cfg.afterHoursBehavior) setAfterHoursBehavior(cfg.afterHoursBehavior);
        if (cfg.voicemailGreeting)  setVoicemailGreeting(cfg.voicemailGreeting);
        if (cfg.alwaysOn !== undefined) setAlwaysOn(cfg.alwaysOn);
        if (cfg.timezone)           setTimezone(cfg.timezone);
        if (cfg.holidays)           setHolidays(cfg.holidays);
        if (cfg.businessHours)      setBusinessHours(cfg.businessHours);
        if (cfg.transferKeywords)   setTransferKeywords(cfg.transferKeywords);
        if (cfg.preTransferMsg)     setPreTransferMsg(cfg.preTransferMsg);
        if (cfg.failedTransferFallback) setFailedTransferFallback(cfg.failedTransferFallback);
        if (cfg.forwardingActive !== undefined) setForwardingActive(cfg.forwardingActive);
        if (cfg.forwardingType)     setForwardingType(cfg.forwardingType);
        if (c?.subscriptionStatus)  setReceptionistStatus(
          c.subscriptionStatus === 'active' || c.subscriptionStatus === 'trialing' ? 'active' : 'paused'
        );
      } catch (err) {
        console.error('Receptionist fetch error', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ─── Save ─── */
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/my-dashboard/settings', {
        transferNumber,
        vapiPhoneNumber: inboundNumber,
        businessName,
        businessType: niche,
        vapiConfig: {
          aiName, language, voice: selectedVoice, tone,
          stability, similarityBoost, styleSlider, speakerBoost,
          bgSound, fillerInjection, maxCallDuration, silenceTimeout,
          services, customInstructions, faqs,
          afterHoursBehavior, voicemailGreeting,
          alwaysOn, timezone, holidays, businessHours,
          transferKeywords, preTransferMsg, failedTransferFallback,
          forwardingActive, forwardingType,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save error', err);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Toggle status ─── */
  const handleToggle = async () => {
    setToggling(true);
    try {
      const action = receptionistStatus === 'active' ? 'pause' : 'resume';
      await api.post(`/my-dashboard/${action}`);
      setReceptionistStatus(action === 'pause' ? 'paused' : 'active');
      setData((prev: any) => ({
        ...prev,
        client: { ...prev?.client, subscriptionStatus: action === 'pause' ? 'paused' : 'active' },
      }));
    } catch (err) {
      console.error('Toggle error', err);
    } finally {
      setToggling(false);
    }
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = receptionistStatus === 'active';

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="max-w-5xl">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">AI Receptionist</h1>
        <p className="text-sm text-[#86868b]">Configure every aspect of how your AI handles calls</p>
      </motion.div>

      {/* ── Status badge ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-4 mb-6 flex items-center justify-between flex-wrap gap-3 ${
          isActive
            ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-white'
            : 'border-amber-200 bg-gradient-to-r from-amber-50/50 to-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            <Bot size={20} className={isActive ? 'text-emerald-600' : 'text-amber-600'} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-sm font-semibold">{isActive ? 'Active & answering' : 'Paused'}</span>
            </div>
            <p className="text-xs text-[#86868b]">{inboundNumber || 'No number assigned'}</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all border ${
            isActive
              ? 'text-amber-700 bg-amber-100 hover:bg-amber-200 border-amber-200'
              : 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border-emerald-200'
          }`}
        >
          {toggling ? '...' : isActive ? <><Pause size={13} />Pause</> : <><Play size={13} />Resume</>}
        </button>
      </motion.div>

      {/* ── Tab bar ── */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max border-b border-[#d2d2d7]/60 pb-0">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? 'border-[#6366f1] text-[#6366f1] bg-[#6366f1]/5'
                    : 'border-transparent text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >

          {/* ── TAB 1: Identity ── */}
          {activeTab === 'identity' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={User} title="AI Identity" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputField
                    label="AI Name"
                    value={aiName}
                    onChange={e => setAiName(e.target.value)}
                    placeholder="Ashley or Marie"
                    hint="The name your AI introduces itself as"
                  />
                  <SelectField
                    label="Language"
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    hint="Primary language for all interactions"
                  >
                    <option value="en">🇺🇸 English</option>
                    <option value="fr">🇫🇷 Français</option>
                    <option value="fr-en">🇫🇷🇬🇧 Bilingual FR/EN</option>
                  </SelectField>
                </div>
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Mic} title="Voice" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {VOICES.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-left ${
                        selectedVoice === v.id
                          ? 'border-[#6366f1] bg-[#6366f1]/5 shadow-sm'
                          : 'border-[#d2d2d7]/60 hover:bg-[#f5f5f7]'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                        selectedVoice === v.id ? 'bg-[#6366f1] text-white' : 'bg-[#f5f5f7]'
                      }`}>
                        {selectedVoice === v.id ? <Volume2 size={16} /> : <span>{v.flag}</span>}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{v.name}</p>
                        <p className="text-[10px] text-[#86868b]">{v.lang}</p>
                        <p className="text-[10px] text-[#86868b]">{v.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl border border-[#6366f1] text-[#6366f1] hover:bg-[#6366f1]/5 transition-all">
                  <Volume2 size={13} />
                  Preview selected voice
                </button>
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Sparkles} title="Tone" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { id: 'professional', label: 'Professional', desc: 'Formal and business-like', icon: '💼' },
                    { id: 'friendly',     label: 'Friendly',     desc: 'Warm and approachable',    icon: '😊' },
                    { id: 'formal',       label: 'Formal',       desc: 'Strict and precise',       icon: '🎩' },
                    { id: 'casual',       label: 'Casual',       desc: 'Relaxed and natural',      icon: '🤙' },
                    { id: 'empathetic',   label: 'Empathetic',   desc: 'Understanding and caring', icon: '💛' },
                  ].map(tt => (
                    <button
                      key={tt.id}
                      onClick={() => setTone(tt.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        tone === tt.id
                          ? 'border-[#6366f1] bg-[#6366f1]/5 shadow-sm'
                          : 'border-[#d2d2d7]/60 hover:bg-[#f5f5f7]'
                      }`}
                    >
                      <span className="text-xl">{tt.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{tt.label}</p>
                        <p className="text-[10px] text-[#86868b]">{tt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <SaveBar saving={saving} saved={saved} onSave={handleSave} />
            </div>
          )}

          {/* ── TAB 2: Voice Settings ── */}
          {activeTab === 'voice' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Activity} title="ElevenLabs Voice Parameters" />
                <div className="space-y-6">
                  <SliderField label="Stability" value={stability} onChange={setStability} />
                  <SliderField label="Similarity Boost" value={similarityBoost} onChange={setSimilarityBoost} />
                  <SliderField label="Style" value={styleSlider} onChange={setStyleSlider} />
                  <Toggle checked={speakerBoost} onChange={setSpeakerBoost} label="Speaker Boost (enhances presence)" />
                </div>
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Volume2} title="Environment & Behaviour" />
                <div className="space-y-5">
                  <SelectField
                    label="Background Sound"
                    value={bgSound}
                    onChange={e => setBgSound(e.target.value)}
                    hint="Ambient sound played during calls"
                  >
                    <option value="none">None</option>
                    <option value="office">Office</option>
                    <option value="cafe">Café</option>
                  </SelectField>
                  <Toggle checked={fillerInjection} onChange={setFillerInjection} label="Filler word injection (um, uh, let me check…)" />
                </div>
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Timer} title="Timing Limits" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputField
                    label="Max call duration (seconds)"
                    type="number"
                    min={0}
                    value={maxCallDuration}
                    onChange={e => setMaxCallDuration(parseInt(e.target.value) || 0)}
                    hint="0 = no limit"
                  />
                  <InputField
                    label="Silence timeout (seconds)"
                    type="number"
                    min={5}
                    value={silenceTimeout}
                    onChange={e => setSilenceTimeout(parseInt(e.target.value) || 30)}
                    hint="Hang up after N seconds of silence"
                  />
                </div>
              </div>
              <SaveBar saving={saving} saved={saved} onSave={handleSave} />
            </div>
          )}

          {/* ── TAB 3: Business Config ── */}
          {activeTab === 'business' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Settings} title="Business Profile" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputField
                    label="Business Name"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Acme Dental Clinic"
                  />
                  <SelectField
                    label="Niche"
                    value={niche}
                    onChange={e => setNiche(e.target.value)}
                    hint="Used to customise AI responses"
                  >
                    {NICHES.map(n => (
                      <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
                    ))}
                  </SelectField>
                </div>
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Zap} title="Services Offered" />
                <TagList
                  items={services}
                  onAdd={v => setServices(prev => [...prev, v])}
                  onRemove={i => setServices(prev => prev.filter((_, idx) => idx !== i))}
                  placeholder="Add a service (Enter to confirm)"
                />
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={MessageSquare} title="Custom Instructions" />
                <TextAreaField
                  label="System instructions"
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                  rows={5}
                  placeholder="You are a receptionist for a dental clinic. Always be friendly. Schedule appointments and answer questions about pricing..."
                  hint="The core behaviour rules given to your AI"
                />
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={FileText} title="FAQ Knowledge Base" />
                <div className="space-y-3 mb-4">
                  {faqs.map((faq, i) => (
                    <div key={i} className="rounded-xl border border-[#d2d2d7]/60 p-4 bg-[#f5f5f7]/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-semibold text-[#1d1d1f]">Q: {faq.q}</p>
                          <p className="text-xs text-[#86868b]">A: {faq.a}</p>
                        </div>
                        <button onClick={() => setFaqs(prev => prev.filter((_, idx) => idx !== i))} className="text-[#86868b] hover:text-red-500 transition-colors mt-0.5">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {faqs.length === 0 && <p className="text-xs text-[#86868b] italic">No FAQ entries yet</p>}
                </div>
                <div className="rounded-xl border border-dashed border-[#d2d2d7] p-4 space-y-3">
                  <p className="text-xs font-medium text-[#86868b]">Add new FAQ entry</p>
                  <input
                    type="text"
                    placeholder="Question"
                    value={faqDraftQ}
                    onChange={e => setFaqDraftQ(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                  />
                  <input
                    type="text"
                    placeholder="Answer"
                    value={faqDraftA}
                    onChange={e => setFaqDraftA(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                  />
                  <button
                    onClick={() => {
                      if (faqDraftQ.trim() && faqDraftA.trim()) {
                        setFaqs(prev => [...prev, { q: faqDraftQ.trim(), a: faqDraftA.trim() }]);
                        setFaqDraftQ('');
                        setFaqDraftA('');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-[#6366f1] text-white hover:bg-[#4f46e5] transition-all"
                  >
                    <Plus size={13} /> Add entry
                  </button>
                </div>
              </div>
              <SaveBar saving={saving} saved={saved} onSave={handleSave} />
            </div>
          )}

          {/* ── TAB 4: Call Handling ── */}
          {activeTab === 'callhandling' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Phone} title="Phone Numbers" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputField
                    label="Inbound number (read-only)"
                    value={inboundNumber}
                    readOnly
                    disabled
                    hint="The VAPI number assigned to your account"
                  />
                  <InputField
                    label="Transfer number"
                    type="tel"
                    value={transferNumber}
                    onChange={e => setTransferNumber(e.target.value)}
                    placeholder="+1 514 555 0100"
                    hint="Human agent receives transferred calls"
                  />
                  <InputField
                    label="Backup number"
                    type="tel"
                    value={backupNumber}
                    onChange={e => setBackupNumber(e.target.value)}
                    placeholder="+1 514 555 0200"
                    hint="Used if transfer number is unreachable"
                  />
                </div>
                {!transferNumber && (
                  <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 rounded-xl px-3 py-2 mt-3">
                    <AlertCircle size={14} />
                    <span>No transfer number set — calls needing human help will end abruptly</span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={BellRing} title="After-Hours Behaviour" />
                <div className="space-y-5">
                  <SelectField
                    label="What should happen after hours?"
                    value={afterHoursBehavior}
                    onChange={e => setAfterHoursBehavior(e.target.value)}
                  >
                    <option value="voicemail">Leave a voicemail</option>
                    <option value="callback">Schedule a callback</option>
                    <option value="message">Play a message and hang up</option>
                  </SelectField>
                  <TextAreaField
                    label="Voicemail greeting"
                    value={voicemailGreeting}
                    onChange={e => setVoicemailGreeting(e.target.value)}
                    rows={3}
                    placeholder="Hi, you've reached [Business]. We're currently closed. Please leave your name and number after the tone and we'll call you back."
                    hint="Read aloud before the voicemail beep"
                  />
                </div>
              </div>
              <SaveBar saving={saving} saved={saved} onSave={handleSave} />
            </div>
          )}

          {/* ── TAB 5: Business Hours ── */}
          {activeTab === 'hours' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Clock} title="Schedule" />
                <div className="flex items-center gap-3 mb-5">
                  <button
                    onClick={() => setAlwaysOn(true)}
                    className={`px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                      alwaysOn ? 'bg-[#6366f1] text-white shadow-sm' : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed]'
                    }`}
                  >
                    24/7 Override
                  </button>
                  <button
                    onClick={() => setAlwaysOn(false)}
                    className={`px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                      !alwaysOn ? 'bg-[#6366f1] text-white shadow-sm' : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed]'
                    }`}
                  >
                    Custom hours
                  </button>
                </div>

                <AnimatePresence>
                  {!alwaysOn && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2">
                        {DAYS.map(day => {
                          const h = businessHours[day];
                          return (
                            <div key={day} className="flex items-center gap-3">
                              <label className="flex items-center gap-2 w-28">
                                <input
                                  type="checkbox"
                                  checked={h.enabled}
                                  onChange={e => setBusinessHours(prev => ({ ...prev, [day]: { ...prev[day], enabled: e.target.checked } }))}
                                  className="rounded border-[#d2d2d7] text-[#6366f1] focus:ring-[#6366f1]/30"
                                />
                                <span className={`text-xs font-medium ${h.enabled ? 'text-[#1d1d1f]' : 'text-[#86868b]'}`}>
                                  {day.slice(0, 3)}
                                </span>
                              </label>
                              {h.enabled ? (
                                <div className="flex items-center gap-2">
                                  <input type="time" value={h.from}
                                    onChange={e => setBusinessHours(prev => ({ ...prev, [day]: { ...prev[day], from: e.target.value } }))}
                                    className="px-2 py-1 text-xs rounded-lg border border-[#d2d2d7]/60 bg-white focus:ring-1 focus:ring-[#6366f1]/30"
                                  />
                                  <span className="text-xs text-[#86868b]">to</span>
                                  <input type="time" value={h.to}
                                    onChange={e => setBusinessHours(prev => ({ ...prev, [day]: { ...prev[day], to: e.target.value } }))}
                                    className="px-2 py-1 text-xs rounded-lg border border-[#d2d2d7]/60 bg-white focus:ring-1 focus:ring-[#6366f1]/30"
                                  />
                                </div>
                              ) : (
                                <span className="text-xs text-[#86868b] italic">Closed</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Globe} title="Timezone" />
                <SelectField
                  label="Timezone"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  hint="All hours above are interpreted in this timezone"
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </SelectField>
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Calendar} title="Holiday Dates" />
                <p className="text-xs text-[#86868b] mb-3">AI will behave as after-hours on these dates (YYYY-MM-DD format)</p>
                <TagList
                  items={holidays}
                  onAdd={v => setHolidays(prev => [...prev, v])}
                  onRemove={i => setHolidays(prev => prev.filter((_, idx) => idx !== i))}
                  placeholder="2026-12-25"
                />
              </div>
              <SaveBar saving={saving} saved={saved} onSave={handleSave} />
            </div>
          )}

          {/* ── TAB 6: Human Transfer ── */}
          {activeTab === 'transfer' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={PhoneForwarded} title="Transfer Triggers" />
                <p className="text-xs text-[#86868b] mb-3">If a caller says any of these, the AI will initiate a transfer</p>
                <TagList
                  items={transferKeywords}
                  onAdd={v => setTransferKeywords(prev => [...prev, v])}
                  onRemove={i => setTransferKeywords(prev => prev.filter((_, idx) => idx !== i))}
                  placeholder="e.g. speak to someone"
                />
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={MessageSquare} title="Transfer Messages" />
                <div className="space-y-5">
                  <TextAreaField
                    label="Pre-transfer message"
                    value={preTransferMsg}
                    onChange={e => setPreTransferMsg(e.target.value)}
                    rows={3}
                    hint="AI says this while initiating the transfer"
                  />
                  <SelectField
                    label="If transfer fails…"
                    value={failedTransferFallback}
                    onChange={e => setFailedTransferFallback(e.target.value)}
                  >
                    <option value="voicemail">Send to voicemail</option>
                    <option value="message">Play a message and end call</option>
                  </SelectField>
                </div>
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Activity} title="Transfer Attempt Log (last 20)" />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#d2d2d7]/60">
                        <th className="text-left py-2 px-3 font-semibold text-[#86868b]">Time</th>
                        <th className="text-left py-2 px-3 font-semibold text-[#86868b]">From</th>
                        <th className="text-left py-2 px-3 font-semibold text-[#86868b]">Keyword</th>
                        <th className="text-left py-2 px-3 font-semibold text-[#86868b]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferLog.map(row => (
                        <tr key={row.id} className="border-b border-[#d2d2d7]/30 hover:bg-[#f5f5f7]/50 transition-colors">
                          <td className="py-2 px-3 text-[#86868b]">{row.time}</td>
                          <td className="py-2 px-3 font-mono">{row.from}</td>
                          <td className="py-2 px-3">{row.keyword}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              row.status === 'Success'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <SaveBar saving={saving} saved={saved} onSave={handleSave} />
            </div>
          )}

          {/* ── TAB 7: Call Forwarding ── */}
          {activeTab === 'forwarding' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Radio} title="Forwarding Status" />
                <div className="flex items-center gap-4 mb-5">
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
                    forwardingActive
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : 'bg-[#f5f5f7] text-[#86868b] border-[#d2d2d7]/60'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${forwardingActive ? 'bg-emerald-500 animate-pulse' : 'bg-[#86868b]'}`} />
                    {forwardingActive ? 'Active' : 'Inactive'}
                  </span>
                  <Toggle checked={forwardingActive} onChange={setForwardingActive} label="Enable call forwarding" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <SelectField
                    label="Forwarding Type"
                    value={forwardingType}
                    onChange={e => setForwardingType(e.target.value)}
                  >
                    <option value="immediate">Immediate (all calls)</option>
                    <option value="backup">Backup after 15 seconds</option>
                  </SelectField>
                  <div>
                    <label className="text-xs font-medium text-[#86868b] mb-1.5 block">Carrier (auto-detected)</label>
                    <div className="px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-[#f5f5f7] text-[#86868b]">
                      Bell / Rogers / Telus (auto)
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Copy} title="Carrier Setup Code" />
                <p className="text-xs text-[#86868b] mb-3">Dial this code from your phone to activate forwarding with your carrier</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-3 rounded-xl bg-[#1d1d1f] text-emerald-400 font-mono text-sm tracking-widest">
                    {carrierCode}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(carrierCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-all text-xs font-medium"
                  >
                    {copied ? <><Check size={13} className="text-emerald-600" />Copied</> : <><Copy size={13} />Copy</>}
                  </button>
                </div>
                <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs text-[#86868b]">Activation date</p>
                    <p className="text-sm font-medium">2026-03-22</p>
                  </div>
                  <button className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#6366f1] text-white hover:bg-[#4f46e5] transition-all">
                    <Zap size={13} />
                    Test It Now
                  </button>
                </div>
              </div>
              <SaveBar saving={saving} saved={saved} onSave={handleSave} />
            </div>
          )}

          {/* ── TAB 8: Script Preview ── */}
          {activeTab === 'script' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                  <SectionTitle icon={FileText} title="Active Script" />
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20">
                      Variant A
                    </span>
                    <span className="text-xs text-[#86868b]">Last updated: 2026-03-20</span>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={activeScript}
                  rows={12}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-[#d2d2d7]/60 bg-[#f5f5f7] text-[#1d1d1f] font-mono resize-none focus:outline-none"
                />
                <p className="text-[11px] text-[#86868b] mt-2">This script is auto-generated from your Identity, Business Config, and Call Handling settings</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Conversion Rate', value: '34.2%', sub: '+2.1% vs last month', color: 'text-emerald-600' },
                  { label: 'Avg Call Duration', value: '2m 18s', sub: 'target: under 3 min', color: 'text-[#6366f1]' },
                  { label: 'Drop-off (>30s)', value: '11.4%', sub: '-0.8% vs last month', color: 'text-amber-600' },
                ].map(metric => (
                  <div key={metric.label} className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5">
                    <p className="text-xs text-[#86868b] mb-1">{metric.label}</p>
                    <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                    <p className="text-[11px] text-[#86868b] mt-1">{metric.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 9: Status & Controls ── */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={Power} title="Receptionist Status" />
                <div className="flex items-center gap-4 flex-wrap mb-6">
                  {(['active', 'paused', 'offline'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setReceptionistStatus(s)}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        receptionistStatus === s
                          ? s === 'active'   ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : s === 'paused'  ? 'bg-amber-100 border-amber-300 text-amber-700'
                                             : 'bg-[#1d1d1f] border-[#1d1d1f] text-white'
                          : 'bg-white border-[#d2d2d7]/60 text-[#86868b] hover:bg-[#f5f5f7]'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        s === 'active'  ? 'bg-emerald-500' :
                        s === 'paused'  ? 'bg-amber-500' : 'bg-[#86868b]'
                      } ${receptionistStatus === s && s === 'active' ? 'animate-pulse' : ''}`} />
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                {receptionistStatus === 'paused' && (
                  <div className="mb-6">
                    <label className="text-xs font-medium text-[#86868b] mb-2 block">Pause Duration</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { v: '1h',         l: '1 hour' },
                        { v: '4h',         l: '4 hours' },
                        { v: '12h',        l: '12 hours' },
                        { v: '24h',        l: '24 hours' },
                        { v: 'indefinite', l: 'Indefinite' },
                      ].map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setPauseDuration(opt.v)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            pauseDuration === opt.v
                              ? 'bg-[#6366f1] text-white shadow-sm'
                              : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed]'
                          }`}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={BarChart2} title="Call Volume" />
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: 'Today',  value: data?.calls?.today  ?? 7  },
                    { label: 'Week',   value: data?.calls?.week   ?? 43 },
                    { label: 'Month',  value: data?.calls?.month  ?? data?.calls?.quotaUsed ?? 0 },
                  ].map(stat => (
                    <div key={stat.label} className="text-center rounded-xl bg-[#f5f5f7]/50 border border-[#d2d2d7]/40 p-4">
                      <p className="text-2xl font-bold text-[#1d1d1f]">{stat.value}</p>
                      <p className="text-xs text-[#86868b] mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#86868b] border-t border-[#d2d2d7]/40 pt-4">
                  <Clock size={12} />
                  Last call: <span className="font-medium text-[#1d1d1f]">2026-03-22 at 14:32</span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
                <SectionTitle icon={ShieldAlert} title="Quick Controls" />
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleToggle}
                    disabled={toggling}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl border border-[#6366f1] text-[#6366f1] bg-[#6366f1]/5 hover:bg-[#6366f1]/10 transition-all disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    {toggling ? 'Working...' : 'Restart receptionist'}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Emergency stop will immediately halt all call processing. Continue?')) {
                        setReceptionistStatus('offline');
                      }
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                  >
                    <Square size={14} />
                    Emergency stop
                  </button>
                </div>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
