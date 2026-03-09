import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, Phone, PhoneForwarded, Clock, FileText, Pause, Play, Settings,
  Volume2, Check, AlertCircle, Shield, Mic, Globe, Zap
} from 'lucide-react';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';

const VOICES = [
  { id: 'sarah', name: 'Sarah', lang: 'EN', desc: 'Professional, warm' },
  { id: 'marie', name: 'Marie', lang: 'FR', desc: 'Douce, professionnelle' },
  { id: 'james', name: 'James', lang: 'EN', desc: 'Confident, clear' },
  { id: 'sophie', name: 'Sophie', lang: 'FR/EN', desc: 'Bilingual, friendly' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ClientReceptionist() {
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [toggling, setToggling] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('sarah');
  const [businessHours, setBusinessHours] = useState<Record<string, { enabled: boolean; from: string; to: string }>>(
    Object.fromEntries(DAYS.map(d => [d, { enabled: d !== 'Saturday' && d !== 'Sunday', from: '09:00', to: '17:00' }]))
  );
  const [alwaysOn, setAlwaysOn] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overview, settings] = await Promise.all([
          api.get('/my-dashboard/overview'),
          api.get('/my-dashboard/settings').catch(() => ({ data: null })),
        ]);
        setData({ ...overview.data, settings: settings.data });
        setTransferNumber(overview.data?.client?.transferNumber || settings.data?.transferNumber || '');
        setPhoneNumber(overview.data?.client?.vapiPhoneNumber || settings.data?.vapiPhoneNumber || '');
        setBusinessName(overview.data?.client?.businessName || settings.data?.businessName || '');
        setIndustry(overview.data?.client?.businessType || settings.data?.businessType || '');
      } catch (err) {
        console.error('Receptionist fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/my-dashboard/settings', {
        transferNumber,
        vapiPhoneNumber: phoneNumber,
        businessName,
        businessType: industry,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save settings error', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const client = data?.client || {};
  const isActive = client.subscriptionStatus === 'active' || client.subscriptionStatus === 'trialing';

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">AI Receptionist</h1>
        <p className="text-sm text-[#86868b]">Configure how your AI handles incoming calls</p>
      </motion.div>

      {/* Status card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-6 mb-6 ${
          isActive
            ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-white'
            : 'border-amber-200 bg-gradient-to-r from-amber-50/50 to-white'
        }`}
      >
        <div className="flex items-center justify-between">
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
                {(phoneNumber || client.vapiPhoneNumber) ? `Answering on ${phoneNumber || client.vapiPhoneNumber}` : 'No phone number assigned'}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Transfer & Phone ── */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <PhoneForwarded size={16} className="text-[#6366f1]" />
            Transfer settings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">AI phone number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">Transfer number (human backup)</label>
              <input
                type="tel"
                value={transferNumber}
                onChange={e => setTransferNumber(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
              />
              <p className="text-[11px] text-[#86868b] mt-1">When AI can't help, it transfers the caller to this number</p>
            </div>
            {!transferNumber && (
              <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 rounded-xl px-3 py-2">
                <AlertCircle size={14} />
                <span>No transfer number — calls needing human help will end</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Quota usage ── */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Phone size={16} className="text-[#6366f1]" />
            Quota usage
          </h3>
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
        </div>

        {/* ── Voice selector ── */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Mic size={16} className="text-[#6366f1]" />
            Voice
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {VOICES.map(v => (
              <button key={v.id} onClick={() => setSelectedVoice(v.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedVoice === v.id
                    ? 'border-[#6366f1] bg-[#6366f1]/5'
                    : 'border-[#d2d2d7]/60 hover:bg-[#f5f5f7]'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  selectedVoice === v.id ? 'bg-[#6366f1] text-white' : 'bg-[#f5f5f7] text-[#86868b]'
                }`}>
                  <Volume2 size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="text-[10px] text-[#86868b]">{v.lang} · {v.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Business hours ── */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Clock size={16} className="text-[#6366f1]" />
            Availability
          </h3>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setAlwaysOn(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${alwaysOn ? 'bg-[#6366f1] text-white' : 'bg-[#f5f5f7] text-[#86868b]'}`}
            >
              24/7
            </button>
            <button onClick={() => setAlwaysOn(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${!alwaysOn ? 'bg-[#6366f1] text-white' : 'bg-[#f5f5f7] text-[#86868b]'}`}
            >
              Custom hours
            </button>
          </div>
          {!alwaysOn && (
            <div className="space-y-2">
              {DAYS.map(day => {
                const h = businessHours[day];
                return (
                  <div key={day} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 w-28">
                      <input type="checkbox" checked={h.enabled}
                        onChange={e => setBusinessHours(prev => ({ ...prev, [day]: { ...prev[day], enabled: e.target.checked } }))}
                        className="rounded border-[#d2d2d7]"
                      />
                      <span className={`text-xs font-medium ${h.enabled ? 'text-[#1d1d1f]' : 'text-[#86868b]'}`}>{day.slice(0, 3)}</span>
                    </label>
                    {h.enabled && (
                      <div className="flex items-center gap-2">
                        <input type="time" value={h.from}
                          onChange={e => setBusinessHours(prev => ({ ...prev, [day]: { ...prev[day], from: e.target.value } }))}
                          className="px-2 py-1 text-xs rounded-lg border border-[#d2d2d7]/60 bg-white"
                        />
                        <span className="text-xs text-[#86868b]">to</span>
                        <input type="time" value={h.to}
                          onChange={e => setBusinessHours(prev => ({ ...prev, [day]: { ...prev[day], to: e.target.value } }))}
                          className="px-2 py-1 text-xs rounded-lg border border-[#d2d2d7]/60 bg-white"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Business info ── */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Settings size={16} className="text-[#6366f1]" />
            Business info
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">Business name</label>
              <input
                type="text"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="Your business name"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">Industry</label>
              <input
                type="text"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. Real Estate, Dental, Legal..."
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">Language</label>
              <div className="px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-[#f5f5f7] text-[#86868b] flex items-center gap-2">
                <Globe size={14} /> {selectedVoice === 'marie' ? 'French' : selectedVoice === 'sophie' ? 'FR/EN' : 'English'}
              </div>
              <p className="text-[11px] text-[#86868b] mt-1">Determined by voice selection above</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-5 py-2.5 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            {saved && (
              <span className="text-sm text-emerald-600 flex items-center gap-1">
                <Check size={14} /> Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
