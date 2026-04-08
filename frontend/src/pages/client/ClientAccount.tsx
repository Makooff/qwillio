import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Check, Bell, Shield, LogOut, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';

const inputCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0D0D15] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

export default function ClientAccount() {
  const { user, checkAuth, logout } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

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
    if (newPw !== confirmPw) { setPwError('Les mots de passe ne correspondent pas'); return; }
    if (newPw.length < 6) { setPwError('Minimum 6 caractères'); return; }
    setPwSaving(true);
    try {
      await api.put('/my-dashboard/password', { currentPassword: currentPw, newPassword: newPw });
      setPwSaved(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwSaved(false), 2000);
    } catch (err: any) {
      setPwError(err.response?.data?.error || 'Erreur lors du changement de mot de passe');
    } finally {
      setPwSaving(false);
    }
  };

  const initials = (user?.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-[#F8F8FF] tracking-tight">Compte</h1>
        <p className="text-sm text-[#8B8BA7]">Gérez votre profil et vos préférences</p>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/[0.06] bg-[#12121A] p-6 mb-4"
      >
        <h2 className="text-sm font-semibold text-[#F8F8FF] mb-4 flex items-center gap-2">
          <User size={16} className="text-[#7B5CF0]" />
          Profil
        </h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-xl bg-[#7B5CF0]/20 flex items-center justify-center text-[#7B5CF0] text-xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-base font-semibold text-[#F8F8FF]">{user?.name}</p>
            <p className="text-sm text-[#8B8BA7]">{user?.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Nom complet</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Email</label>
            <input type="email" value={user?.email || ''} disabled className={inputCls} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleUpdateProfile} disabled={profileSaving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#7B5CF0] rounded-xl hover:bg-[#6a4ee0] disabled:opacity-50 transition-colors"
          >
            {profileSaving ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
          {profileSaved && (
            <span className="text-sm text-emerald-400 flex items-center gap-1">
              <Check size={14} /> Sauvegardé
            </span>
          )}
        </div>
      </motion.div>

      {/* Security */}
      <div className="rounded-xl border border-white/[0.06] bg-[#12121A] p-6 mb-4">
        <h2 className="text-sm font-semibold text-[#F8F8FF] mb-4 flex items-center gap-2">
          <Lock size={16} className="text-[#7B5CF0]" />
          Sécurité
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Mot de passe actuel</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                className={inputCls + ' pr-10'}
              />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8BA7] hover:text-[#F8F8FF]">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#8B8BA7] mb-1.5 block">Nouveau mot de passe</label>
              <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[#8B8BA7] mb-1.5 block">Confirmer</label>
              <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={inputCls} />
            </div>
          </div>
          {newPw && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  newPw.length >= 12 ? 'bg-emerald-400 w-full' :
                  newPw.length >= 8 ? 'bg-amber-400 w-2/3' :
                  'bg-red-400 w-1/3'
                }`} />
              </div>
              <span className="text-[10px] text-[#8B8BA7]">
                {newPw.length >= 12 ? 'Fort' : newPw.length >= 8 ? 'Moyen' : 'Faible'}
              </span>
            </div>
          )}
          {pwError && <p className="text-sm text-red-400">{pwError}</p>}
          <div className="flex items-center gap-3">
            <button onClick={handleChangePassword} disabled={pwSaving || !currentPw || !newPw}
              className="px-5 py-2.5 text-sm font-medium text-white bg-[#7B5CF0] rounded-xl hover:bg-[#6a4ee0] disabled:opacity-50 transition-colors"
            >
              {pwSaving ? 'Changement...' : 'Changer le mot de passe'}
            </button>
            {pwSaved && (
              <span className="text-sm text-emerald-400 flex items-center gap-1">
                <Check size={14} /> Mot de passe changé
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-white/[0.06] bg-[#12121A] p-6 mb-4">
        <h2 className="text-sm font-semibold text-[#F8F8FF] mb-4 flex items-center gap-2">
          <Bell size={16} className="text-[#7B5CF0]" />
          Notifications
        </h2>
        <div className="space-y-3">
          {[
            { label: 'Notifications email', desc: 'Recevez des emails pour les événements importants', checked: notifEmail, set: setNotifEmail },
            { label: 'Rapport hebdomadaire', desc: 'Résumé hebdomadaire des performances IA', checked: notifWeekly, set: setNotifWeekly },
            { label: 'Nouveaux leads', desc: 'Notification lors de la capture d\'un lead', checked: notifLeads, set: setNotifLeads },
            { label: 'Alertes quota', desc: 'Alerte quand vous approchez de la limite mensuelle', checked: notifQuota, set: setNotifQuota },
          ].map((n, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div>
                <p className="text-sm font-medium text-[#F8F8FF]">{n.label}</p>
                <p className="text-xs text-[#8B8BA7]">{n.desc}</p>
              </div>
              <button onClick={() => n.set(!n.checked)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${n.checked ? 'bg-[#7B5CF0]' : 'bg-white/[0.10]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${n.checked ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Danger */}
      <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-6">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-400">
          <Shield size={16} />
          Actions du compte
        </h2>
        <button onClick={logout}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl hover:bg-red-400/20 transition-colors"
        >
          <LogOut size={14} />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
