import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Check, Bell, LogOut, Eye, EyeOff, ChevronRight,
  CreditCard, Bot, HelpCircle, Sparkles, Shield, Globe,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';

const C = {
  bg:       '#0A0A0C',
  panel:    'rgba(255,255,255,0.03)',
  border:   'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.12)',
  text:     '#F5F5F7',
  textSec:  '#A1A1A8',
  textTer:  '#6B6B75',
  accent:   '#7B5CF0',
  ok:       '#22C55E',
  bad:      '#EF4444',
};

const inputCls =
  'w-full px-3.5 py-2.5 text-[13px] rounded-xl border bg-white/[0.03] text-[#F5F5F7] placeholder-[#6B6B75] focus:outline-none transition-all disabled:opacity-50';

// ── Building blocks ─────────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-2xl border overflow-hidden ${className}`} style={{ background: C.panel, borderColor: C.border }}>
    {children}
  </div>
);

const SectionHead: React.FC<{ title: string }> = ({ title }) => (
  <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-3 px-1" style={{ color: C.textSec }}>{title}</h2>
);

const Row: React.FC<{
  icon: any; label: string; hint?: string; badge?: React.ReactNode;
  onClick?: () => void; to?: string; danger?: boolean;
}> = ({ icon: Icon, label, hint, badge, onClick, to, danger }) => {
  const inner = (
    <div className={`flex items-center gap-3.5 px-4 h-[58px] group transition-colors
      ${danger ? 'hover:bg-red-500/[0.05]' : 'hover:bg-white/[0.02]'}`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
           style={{ background: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)' }}>
        <Icon size={14} style={{ color: danger ? C.bad : C.text }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate" style={{ color: danger ? C.bad : C.text }}>{label}</p>
        {hint && <p className="text-[11.5px] truncate" style={{ color: C.textTer }}>{hint}</p>}
      </div>
      {badge}
      {(onClick || to) && <ChevronRight size={14} style={{ color: C.textTer }} className="opacity-60 group-hover:opacity-100 transition-opacity" />}
    </div>
  );
  if (to) return <Link to={to} className="block">{inner}</Link>;
  return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>;
};

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button onClick={() => onChange(!checked)} type="button"
    className="relative w-[38px] h-[22px] rounded-full flex-shrink-0 transition-colors"
    style={{ background: checked ? C.ok : 'rgba(255,255,255,0.10)' }}>
    <span className="absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform"
      style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
  </button>
);

// ── Main page ───────────────────────────────────────────────────────────
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

  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen(o => (o === k ? null : k));

  const handleUpdateProfile = async () => {
    setProfileSaving(true);
    try {
      await api.put('/my-dashboard/profile', { name });
      setProfileSaved(true);
      checkAuth();
      setTimeout(() => setProfileSaved(false), 2000);
    } catch { /* silent */ }
    finally { setProfileSaving(false); }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (newPw !== confirmPw) { setPwError('Les mots de passe ne correspondent pas'); return; }
    if (newPw.length < 6)    { setPwError('Minimum 6 caractères'); return; }
    setPwSaving(true);
    try {
      await api.put('/my-dashboard/password', { currentPassword: currentPw, newPassword: newPw });
      setPwSaved(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwSaved(false), 2000);
    } catch (err: any) {
      setPwError(err?.response?.data?.error || 'Erreur lors du changement');
    } finally { setPwSaving(false); }
  };

  const initials = (user?.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const planType  = ((user as any)?.planType ?? 'pro').toString();
  const planLabel = ({ starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' } as Record<string, string>)[planType] ?? 'Pro';

  return (
    <div className="max-w-[720px] space-y-6">

      {/* ─── Header ─── */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: C.text }}>Paramètres du compte</h1>
        <p className="text-[12.5px] mt-0.5" style={{ color: C.textSec }}>Profil, sécurité, notifications, abonnement.</p>
      </motion.div>

      {/* ─── Identity ─── */}
      <Card>
        <div className="p-5 flex items-center gap-4">
          <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #252529 0%, #141417 100%)', border: `1px solid ${C.border}` }}>
            <span className="text-[20px] font-semibold" style={{ color: C.text }}>{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold truncate" style={{ color: C.text }}>{user?.name ?? 'Utilisateur'}</p>
            <p className="text-[12.5px] truncate" style={{ color: C.textSec }}>{user?.email}</p>
          </div>
          <span className="text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', color: C.text }}>
            {planLabel}
          </span>
        </div>
      </Card>

      {/* ─── Compte ─── */}
      <section>
        <SectionHead title="Compte" />
        <Card>
          <Row icon={User} label="Informations personnelles" hint="Nom affiché, email"
               onClick={() => toggle('profile')} />
          <AnimatePresence initial={false}>
            {open === 'profile' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Nom complet</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      className={inputCls + ' mt-1.5'}
                      style={{ borderColor: C.border }}
                      onFocus={e => e.currentTarget.style.borderColor = C.borderHi}
                      onBlur={e => e.currentTarget.style.borderColor = C.border} />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Email</label>
                    <input type="email" value={user?.email || ''} disabled
                      className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button onClick={handleUpdateProfile} disabled={profileSaving}
                      className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-50 transition-colors"
                      style={{ background: C.text, color: '#0B0B0D' }}>
                      {profileSaving ? 'Enregistrement…' : 'Sauvegarder'}
                    </button>
                    {profileSaved && <span className="text-[12px] flex items-center gap-1" style={{ color: C.ok }}><Check size={13} /> Sauvegardé</span>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={Lock} label="Sécurité" hint="Mot de passe, authentification"
               onClick={() => toggle('security')} />
          <AnimatePresence initial={false}>
            {open === 'security' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Mot de passe actuel</label>
                    <div className="relative mt-1.5">
                      <input type={showPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                        className={inputCls + ' pr-10'} style={{ borderColor: C.border }} />
                      <button onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: C.textSec }}>
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Nouveau</label>
                      <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                        className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Confirmer</label>
                      <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                        className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                    </div>
                  </div>
                  {pwError && <p className="text-[12px]" style={{ color: C.bad }}>{pwError}</p>}
                  <div className="flex items-center gap-3 pt-2">
                    <button onClick={handleChangePassword} disabled={pwSaving || !currentPw || !newPw}
                      className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-50 transition-colors"
                      style={{ background: C.text, color: '#0B0B0D' }}>
                      {pwSaving ? 'Changement…' : 'Changer le mot de passe'}
                    </button>
                    {pwSaved && <span className="text-[12px] flex items-center gap-1" style={{ color: C.ok }}><Check size={13} /> Changé</span>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={Bell} label="Notifications" hint="Emails, rapport, alertes"
               onClick={() => toggle('notif')} />
          <AnimatePresence initial={false}>
            {open === 'notif' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="p-5">
                  {[
                    { label: 'Notifications email', desc: 'Événements importants', checked: notifEmail,  set: setNotifEmail  },
                    { label: 'Rapport hebdomadaire', desc: 'Résumé chaque lundi',   checked: notifWeekly, set: setNotifWeekly },
                    { label: 'Nouveaux leads',       desc: 'Alerte à chaque capture', checked: notifLeads,  set: setNotifLeads  },
                    { label: 'Alertes quota',        desc: 'Seuil 80% et 100%',      checked: notifQuota,  set: setNotifQuota  },
                  ].map((n, i, arr) => (
                    <div key={i} className="flex items-center justify-between py-2.5"
                         style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : undefined }}>
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: C.text }}>{n.label}</p>
                        <p className="text-[11.5px]" style={{ color: C.textTer }}>{n.desc}</p>
                      </div>
                      <Toggle checked={n.checked} onChange={n.set} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </section>

      {/* ─── Qwillio ─── */}
      <section>
        <SectionHead title="Qwillio" />
        <Card>
          <Row icon={Bot} label="Réceptionniste IA"
               hint="Voix, scripts, transferts d'appel"
               to="/dashboard/receptionist" />
          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={Sparkles} label="Plan & usage"
               hint={`Plan ${planLabel}`}
               badge={<span className="text-[11px]" style={{ color: C.textSec }}>Gérer</span>}
               to="/dashboard/billing" />
          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={CreditCard} label="Moyens de paiement"
               hint="Carte, facturation, factures"
               to="/dashboard/billing" />
          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={Globe} label="Renvoi d'appel"
               hint="iPhone ou Android — guide pas à pas"
               to="/dashboard/setup/call-forwarding" />
        </Card>
      </section>

      {/* ─── Préférences ─── */}
      <section>
        <SectionHead title="Préférences" />
        <Card>
          <Row icon={Shield} label="Confidentialité"
               hint="Exporter mes données, consentements"
               onClick={() => alert('Bientôt disponible')} />
          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={HelpCircle} label="Support & aide"
               hint="Centre d'aide, contact"
               to="/dashboard/support" />
        </Card>
      </section>

      {/* ─── Déconnexion ─── */}
      <section>
        <Card>
          <Row icon={LogOut} label="Se déconnecter" danger onClick={logout} />
        </Card>
      </section>

      <p className="text-center text-[10.5px] pt-2" style={{ color: C.textTer }}>
        Qwillio · {user?.email}
      </p>
    </div>
  );
}
