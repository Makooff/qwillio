import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Lock, Check, Bell, Shield, Globe, LogOut, Mail,
  Smartphone, Eye, EyeOff
} from 'lucide-react';
import { useLang } from '../../stores/langStore';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';

export default function ClientAccount() {
  const { t } = useLang();
  const { user, checkAuth, logout } = useAuthStore();

  // Profile
  const [name, setName] = useState(user?.name || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  // Notifications
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifLeads, setNotifLeads] = useState(true);
  const [notifQuota, setNotifQuota] = useState(true);

  const handleUpdateProfile = async () => {
    setProfileSaving(true);
    try {
      await api.put('/my-dashboard/profile', { name });
      setProfileSaved(true);
      checkAuth();
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      console.error('Profile update error', err);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    if (newPw.length < 6) { setPwError('Minimum 6 characters'); return; }
    setPwSaving(true);
    try {
      await api.put('/my-dashboard/password', { currentPassword: currentPw, newPassword: newPw });
      setPwSaved(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwSaved(false), 2000);
    } catch (err: any) {
      setPwError(err.response?.data?.error || 'Error changing password');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-sm text-[#86868b]">Manage your profile and preferences</p>
      </motion.div>

      {/* Profile card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-6"
      >
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <User size={16} className="text-[#6366f1]" />
          Profile
        </h2>
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-xl font-bold">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold">{user?.name}</p>
            <p className="text-sm text-[#86868b]">{user?.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#86868b] mb-1 block">Full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-[#86868b] mb-1 block">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-[#f5f5f7] text-[#86868b]"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleUpdateProfile} disabled={profileSaving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-50 transition-colors"
          >
            {profileSaving ? 'Saving...' : 'Save profile'}
          </button>
          {profileSaved && (
            <span className="text-sm text-emerald-600 flex items-center gap-1">
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </motion.div>

      {/* Security */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Lock size={16} className="text-[#6366f1]" />
          Security
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#86868b] mb-1 block">Current password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
              />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868b]">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">New password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">Confirm new password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
              />
            </div>
          </div>
          {/* Password strength */}
          {newPw && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[#f5f5f7] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  newPw.length >= 12 ? 'bg-emerald-500 w-full' :
                  newPw.length >= 8 ? 'bg-amber-500 w-2/3' :
                  'bg-red-500 w-1/3'
                }`} />
              </div>
              <span className="text-[10px] text-[#86868b]">
                {newPw.length >= 12 ? 'Strong' : newPw.length >= 8 ? 'Fair' : 'Weak'}
              </span>
            </div>
          )}
          {pwError && <p className="text-sm text-red-500">{pwError}</p>}
          <div className="flex items-center gap-3">
            <button onClick={handleChangePassword} disabled={pwSaving || !currentPw || !newPw}
              className="px-5 py-2.5 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-50 transition-colors"
            >
              {pwSaving ? 'Changing...' : 'Change password'}
            </button>
            {pwSaved && (
              <span className="text-sm text-emerald-600 flex items-center gap-1">
                <Check size={14} /> Password changed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Bell size={16} className="text-[#6366f1]" />
          Notifications
        </h2>
        <div className="space-y-3">
          {[
            { label: 'Email notifications', desc: 'Receive email for important events', checked: notifEmail, set: setNotifEmail },
            { label: 'Weekly report', desc: 'Get a weekly summary of your AI performance', checked: notifWeekly, set: setNotifWeekly },
            { label: 'New leads', desc: 'Get notified when a new lead is captured', checked: notifLeads, set: setNotifLeads },
            { label: 'Quota alerts', desc: 'Alert when approaching monthly call limit', checked: notifQuota, set: setNotifQuota },
          ].map((n, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-[#86868b]">{n.desc}</p>
              </div>
              <button onClick={() => n.set(!n.checked)}
                className={`relative w-11 h-6 rounded-full transition-colors ${n.checked ? 'bg-[#6366f1]' : 'bg-[#d2d2d7]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${n.checked ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sessions / Danger */}
      <div className="rounded-2xl border border-red-200 bg-red-50/30 p-6">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-600">
          <Shield size={16} />
          Account actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
