import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Phone, PhoneForwarded, Clock, Pause, Play, Settings,
  Volume2, Check, AlertCircle, Mic, Globe, Zap, MessageSquare,
  User, Sparkles, Timer, Mail, BellRing, ChevronDown, Save
} from 'lucide-react';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';

/* ── Constants ── */
const VOICES = [
  { id: 'sarah', name: 'Sarah', lang: 'EN', desc: 'Professional, warm', flag: '🇺🇸' },
  { id: 'marie', name: 'Marie', lang: 'FR', desc: 'Douce, professionnelle', flag: '🇫🇷' },
  { id: 'james', name: 'James', lang: 'EN', desc: 'Confident, clear', flag: '🇬🇧' },
  { id: 'sophie', name: 'Sophie', lang: 'FR/EN', desc: 'Bilingual, friendly', flag: '🇫🇷🇬🇧' },
];

const TONES = [
  { id: 'professional', label: 'Professional', desc: 'Formal and business-like', icon: '💼' },
  { id: 'friendly', label: 'Friendly', desc: 'Warm and approachable', icon: '😊' },
  { id: 'casual', label: 'Casual', desc: 'Relaxed and natural', icon: '🤙' },
  { id: 'empathetic', label: 'Empathetic', desc: 'Understanding and caring', icon: '💛' },
];

const INDUSTRIES = [
  'Real Estate', 'Dental / Medical', 'Legal', 'Restaurant', 'Salon / Spa',
  'Insurance', 'Automotive', 'Home Services', 'Fitness', 'E-commerce', 'Other',
];

const LANGUAGES = [
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'fr-en', label: 'Bilingual FR/EN', flag: '🇫🇷🇬🇧' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MAX_DURATIONS = [
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 900, label: '15 min' },
  { value: 0, label: 'No limit' },
];

/* ── Component ── */
export default function ClientReceptionist() {
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Phone & Transfer
  const [phoneNumber, setPhoneNumber] = useState('');
  const [transferNumber, setTransferNumber] = useState('');

  // Business info
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [language, setLanguage] = useState('en');

  // Voice & Personality
  const [selectedVoice, setSelectedVoice] = useState('sarah');
  const [tone, setTone] = useState('professional');

  // Greeting & Script
  const [greeting, setGreeting] = useState('');
  const [instructions, setInstructions] = useState('');
  const [afterHoursMsg, setAfterHoursMsg] = useState('');

  // Call handling
  const [maxDuration, setMaxDuration] = useState(300);
  const [collectEmail, setCollectEmail] = useState(true);
  const [collectName, setCollectName] = useState(true);
  const [canBook, setCanBook] = useState(true);

  // Notifications
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyOnMissed, setNotifyOnMissed] = useState(true);
  const [notifyOnLead, setNotifyOnLead] = useState(true);

  // Availability
  const [alwaysOn, setAlwaysOn] = useState(true);
  const [businessHours, setBusinessHours] = useState<Record<string, { enabled: boolean; from: string; to: string }>>(
    Object.fromEntries(DAYS.map(d => [d, { enabled: d !== 'Saturday' && d !== 'Sunday', from: '09:00', to: '17:00' }]))
  );

  /* ── Fetch ── */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overview, settings] = await Promise.all([
          api.get('/my-dashboard/overview'),
          api.get('/my-dashboard/settings').catch(() => ({ data: null })),
        ]);
        const s = settings.data;
        const c = overview.data?.client;
        setData({ ...overview.data, settings: s });

        // Hydrate fields
        setPhoneNumber(c?.vapiPhoneNumber || s?.vapiPhoneNumber || '');
        setTransferNumber(c?.transferNumber || s?.transferNumber || '');
        setBusinessName(c?.businessName || s?.businessName || '');
        setIndustry(c?.businessType || s?.businessType || '');

        // Hydrate vapiConfig
        const cfg = s?.vapiConfig || c?.vapiConfig || {};
        if (cfg.voice) setSelectedVoice(cfg.voice);
        if (cfg.tone) setTone(cfg.tone);
        if (cfg.language) setLanguage(cfg.language);
        if (cfg.greeting) setGreeting(cfg.greeting);
        if (cfg.instructions) setInstructions(cfg.instructions);
        if (cfg.afterHoursMsg) setAfterHoursMsg(cfg.afterHoursMsg);
        if (cfg.maxDuration !== undefined) setMaxDuration(cfg.maxDuration);
        if (cfg.collectEmail !== undefined) setCollectEmail(cfg.collectEmail);
        if (cfg.collectName !== undefined) setCollectName(cfg.collectName);
        if (cfg.canBook !== undefined) setCanBook(cfg.canBook);
        if (cfg.notifyEmail) setNotifyEmail(cfg.notifyEmail);
        if (cfg.notifyOnMissed !== undefined) setNotifyOnMissed(cfg.notifyOnMissed);
        if (cfg.notifyOnLead !== undefined) setNotifyOnLead(cfg.notifyOnLead);
        if (cfg.alwaysOn !== undefined) setAlwaysOn(cfg.alwaysOn);
        if (cfg.businessHours) setBusinessHours(cfg.businessHours);
      } catch (err) {
        console.error('Receptionist fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* ── Toggle active/pause ── */
  const handleToggle = async () => {
    setToggling(true);
    try {
      const action = data?.client?.subscriptionStatus === 'active' ? 'pause' : 'resume';
      await api.post(`/my-dashboard/${action}`);
      setData((prev: any) => ({
        ...prev,
        client: { ...prev.client, subscriptionStatus: action === 'pause' ? 'paused' : 'active' },
      }));
    } catch (err) {
      console.error('Toggle error', err);
    } finally {
      setToggling(false);
    }
  };

  /* ── Save everything ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/my-dashboard/settings', {
        transferNumber,
        vapiPhoneNumber: phoneNumber,
        businessName,
        businessType: industry,
        vapiConfig: {
          voice: selectedVoice,
          tone,
          language,
          greeting,
          instructions,
          afterHoursMsg,
          maxDuration,
          collectEmail,
          collectName,
          canBook,
          notifyEmail,
          notifyOnMissed,
          notifyOnLead,
          alwaysOn,
          businessHours,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save settings error', err);
    } finally {
      setSaving(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const client = data?.client || {};
  const isActive = client.subscriptionStatus === 'active' || client.subscriptionStatus === 'trialing';

  /* ── Reusable card wrapper ── */
  const Card = ({ children, className = '', span = false }: { children: React.ReactNode; className?: string; span?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 ${span ? 'lg:col-span-2' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );

  const SectionTitle = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
      <Icon size={16} className="text-[#6366f1]" />
      {title}
    </h3>
  );

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
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

  return (
    <div>
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">AI Receptionist</h1>
        <p className="text-sm text-[#86868b]">Configure how your AI handles incoming calls</p>
      </motion.div>

      {/* ── Status card ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-6 mb-6 ${
          isActive
            ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-white'
            : 'border-amber-200 bg-gradient-to-r from-amber-50/50 to-white'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isActive ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              <Bot size={28} className={isActive ? 'text-emerald-600' : 'text-amber-600'} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <h3 className="text-lg font-bold">{isActive ? 'Active & answering' : 'Paused'}</h3>
              </div>
              <p className="text-sm text-[#86868b]">
                {phoneNumber ? `Answering on ${phoneNumber}` : 'No phone number assigned'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              isActive
                ? 'text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-200'
                : 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-200'
            }`}
          >
            {toggling ? '...' : isActive ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Resume</>}
          </button>
        </div>
      </motion.div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Phone & Transfer ── */}
        <Card>
          <SectionTitle icon={PhoneForwarded} title="Phone numbers" />
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#86868b] mb-1.5 block">AI phone number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40 transition-all"
              />
              <p className="text-[11px] text-[#86868b] mt-1">The number your AI receptionist answers on</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[#86868b] mb-1.5 block">Transfer number (human backup)</label>
              <input
                type="tel"
                value={transferNumber}
                onChange={e => setTransferNumber(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40 transition-all"
              />
              <p className="text-[11px] text-[#86868b] mt-1">Caller transferred here when AI can't help</p>
            </div>
            {!transferNumber && (
              <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 rounded-xl px-3 py-2">
                <AlertCircle size={14} />
                <span>No transfer number — calls needing human help will end</span>
              </div>
            )}
          </div>
        </Card>

        {/* ── Business info ── */}
        <Card>
          <SectionTitle icon={Settings} title="Business info" />
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#86868b] mb-1.5 block">Business name</label>
              <input
                type="text"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="Your business name"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#86868b] mb-1.5 block">Industry</label>
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40 transition-all appearance-none cursor-pointer"
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#86868b] mb-1.5 block">Language</label>
              <div className="flex gap-2">
                {LANGUAGES.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLanguage(l.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                      language === l.id
                        ? 'border-[#6366f1] bg-[#6366f1]/5 text-[#6366f1]'
                        : 'border-[#d2d2d7]/60 hover:bg-[#f5f5f7] text-[#86868b]'
                    }`}
                  >
                    <span>{l.flag}</span> {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Greeting & Script ── */}
        <Card span>
          <SectionTitle icon={MessageSquare} title="Greeting & Instructions" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-[#86868b] mb-1.5 block">Greeting message</label>
              <textarea
                value={greeting}
                onChange={e => setGreeting(e.target.value)}
                placeholder="Hello! Thank you for calling [Business Name]. How can I help you today?"
                rows={3}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40 transition-all resize-none"
              />
              <p className="text-[11px] text-[#86868b] mt-1">First thing your AI says when answering</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[#86868b] mb-1.5 block">AI instructions</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="You are the receptionist for a dental clinic. Schedule appointments, answer questions about services and pricing..."
                rows={3}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40 transition-all resize-none"
              />
              <p className="text-[11px] text-[#86868b] mt-1">Context and rules for how the AI should behave</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="text-xs font-medium text-[#86868b] mb-1.5 block">After-hours message</label>
            <input
              type="text"
              value={afterHoursMsg}
              onChange={e => setAfterHoursMsg(e.target.value)}
              placeholder="We're currently closed. Our office hours are Monday to Friday, 9 AM to 5 PM."
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40 transition-all"
            />
          </div>
        </Card>

        {/* ── Voice ── */}
        <Card>
          <SectionTitle icon={Mic} title="Voice" />
          <div className="grid grid-cols-2 gap-2">
            {VOICES.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVoice(v.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedVoice === v.id
                    ? 'border-[#6366f1] bg-[#6366f1]/5 shadow-sm'
                    : 'border-[#d2d2d7]/60 hover:bg-[#f5f5f7]'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
                  selectedVoice === v.id ? 'bg-[#6366f1] text-white' : 'bg-[#f5f5f7]'
                }`}>
                  {selectedVoice === v.id ? <Volume2 size={16} /> : <span className="text-sm">{v.flag}</span>}
                </div>
                <div>
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="text-[10px] text-[#86868b]">{v.lang} · {v.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* ── Personality / Tone ── */}
        <Card>
          <SectionTitle icon={Sparkles} title="Personality" />
          <div className="grid grid-cols-2 gap-2">
            {TONES.map(t => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  tone === t.id
                    ? 'border-[#6366f1] bg-[#6366f1]/5 shadow-sm'
                    : 'border-[#d2d2d7]/60 hover:bg-[#f5f5f7]'
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-[10px] text-[#86868b]">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* ── Call handling ── */}
        <Card>
          <SectionTitle icon={Timer} title="Call handling" />
          <div className="space-y-5">
            <div>
              <label className="text-xs font-medium text-[#86868b] mb-2 block">Max call duration</label>
              <div className="flex flex-wrap gap-1.5">
                {MAX_DURATIONS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setMaxDuration(d.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      maxDuration === d.value
                        ? 'bg-[#6366f1] text-white shadow-sm'
                        : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 pt-2 border-t border-[#d2d2d7]/40">
              <Toggle checked={collectName} onChange={setCollectName} label="Collect caller's name" />
              <Toggle checked={collectEmail} onChange={setCollectEmail} label="Collect caller's email" />
              <Toggle checked={canBook} onChange={setCanBook} label="Allow booking appointments" />
            </div>
          </div>
        </Card>

        {/* ── Notifications ── */}
        <Card>
          <SectionTitle icon={BellRing} title="Notifications" />
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#86868b] mb-1.5 block">Notification email</label>
              <input
                type="email"
                value={notifyEmail}
                onChange={e => setNotifyEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]/40 transition-all"
              />
              <p className="text-[11px] text-[#86868b] mt-1">Get notified about important call events</p>
            </div>
            <div className="space-y-3 pt-2 border-t border-[#d2d2d7]/40">
              <Toggle checked={notifyOnMissed} onChange={setNotifyOnMissed} label="Notify on missed calls" />
              <Toggle checked={notifyOnLead} onChange={setNotifyOnLead} label="Notify on new leads" />
            </div>
          </div>
        </Card>

        {/* ── Availability ── */}
        <Card>
          <SectionTitle icon={Clock} title="Availability" />
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setAlwaysOn(true)}
              className={`px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                alwaysOn ? 'bg-[#6366f1] text-white shadow-sm' : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed]'
              }`}
            >
              24/7
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
                className="space-y-2 overflow-hidden"
              >
                {DAYS.map(day => {
                  const h = businessHours[day];
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 w-24">
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
                      {h.enabled && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={h.from}
                            onChange={e => setBusinessHours(prev => ({ ...prev, [day]: { ...prev[day], from: e.target.value } }))}
                            className="px-2 py-1 text-xs rounded-lg border border-[#d2d2d7]/60 bg-white focus:ring-1 focus:ring-[#6366f1]/30"
                          />
                          <span className="text-xs text-[#86868b]">to</span>
                          <input
                            type="time"
                            value={h.to}
                            onChange={e => setBusinessHours(prev => ({ ...prev, [day]: { ...prev[day], to: e.target.value } }))}
                            className="px-2 py-1 text-xs rounded-lg border border-[#d2d2d7]/60 bg-white focus:ring-1 focus:ring-[#6366f1]/30"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* ── Quota usage ── */}
        <Card>
          <SectionTitle icon={Phone} title="Quota usage" />
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold">{data?.calls?.quotaUsed || 0}</span>
            <span className="text-sm text-[#86868b]">/ {data?.calls?.quota || 0} calls this month</span>
          </div>
          <div className="h-3 bg-[#f5f5f7] rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (data?.calls?.quotaPercent || 0) > 90 ? 'bg-red-500' :
                (data?.calls?.quotaPercent || 0) > 70 ? 'bg-amber-500' : 'bg-[#6366f1]'
              }`}
              style={{ width: `${Math.min(data?.calls?.quotaPercent || 0, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[#86868b]">{data?.calls?.quotaPercent || 0}% used</p>
          <div className="mt-5 pt-4 border-t border-[#d2d2d7]/40 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[#86868b]">Plan</p>
              <p className="text-sm font-semibold capitalize">{client.planType || 'Starter'}</p>
            </div>
            <div>
              <p className="text-xs text-[#86868b]">Monthly limit</p>
              <p className="text-sm font-semibold">{data?.calls?.quota || 0} calls</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Sticky save bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="sticky bottom-4 mt-8 flex items-center justify-between bg-white/90 backdrop-blur-lg border border-[#d2d2d7]/60 rounded-2xl px-6 py-4 shadow-lg"
      >
        <p className="text-sm text-[#86868b]">
          {saved ? (
            <span className="text-emerald-600 flex items-center gap-1.5 font-medium">
              <Check size={16} /> All changes saved
            </span>
          ) : (
            'Make changes above, then save'
          )}
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-50 transition-all shadow-sm hover:shadow-md"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={15} />
              Save all changes
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
