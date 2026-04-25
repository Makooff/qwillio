import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, SkipForward, Check, X, Clock, PartyPopper, Send,
  ChevronRight, Building2, Mail, MessageSquare, List,
  ArrowLeft, ArrowRight, MapPin, Bot, PhoneOff, User,
} from 'lucide-react';
import api from '../../services/api';
import OrbsLoader from '../../components/OrbsLoader';
import { pro } from '../../styles/pro-theme';
import { Card, Pill } from '../../components/pro/ProBlocks';

interface Prospect {
  id: string; businessName: string; contactName?: string; phone?: string;
  email?: string; city?: string; state?: string; sector?: string; niche?: string;
  status: string; score?: number; priorityScore?: number;
  notes?: string; callAttempts?: number; lastCallDate?: string | null;
  lastContactDate?: string | null;
  address?: string; postalCode?: string;
  callTranscript?: string; callSentiment?: string;
  assignedToUserId?: string | null;
}

type Outcome = 'interested' | 'lost' | 'callback' | 'converted';
type Phase   = 'info' | 'calling' | 'outcome' | 'notes' | 'followup';

const PHASES: Phase[] = ['info', 'calling', 'outcome', 'notes', 'followup'];
const PHASE_LABELS: Record<Phase, string> = {
  info:     'Prospect',
  calling:  'Appel',
  outcome:  'Issue',
  notes:    'Notes',
  followup: 'Follow-up',
};

const OUTCOMES: { v: Outcome; status: string; l: string; icon: any; color: string }[] = [
  { v: 'interested', status: 'interested', l: 'Intéressé',      icon: Check,       color: pro.ok },
  { v: 'lost',       status: 'lost',       l: 'Pas intéressé',  icon: X,           color: pro.bad },
  { v: 'callback',   status: 'contacted',  l: 'Rappeler',       icon: Clock,       color: pro.info },
  { v: 'converted',  status: 'converted',  l: 'Converti',       icon: PartyPopper, color: pro.accent },
];

const FU_PRESETS: { type: 'sms' | 'email' | 'call'; hours: number; l: string }[] = [
  { type: 'sms',   hours: 4,   l: 'SMS dans 4h' },
  { type: 'sms',   hours: 24,  l: 'SMS demain' },
  { type: 'email', hours: 24,  l: 'Email demain' },
  { type: 'call',  hours: 48,  l: 'Rappel 2j' },
  { type: 'call',  hours: 168, l: 'Rappel 1 sem.' },
];

const STATUS_PILL = (s: string) => {
  if (['interested','qualified','converted'].includes(s)) return 'ok';
  if (s === 'contacted') return 'info';
  if (s === 'lost')      return 'bad';
  return 'neutral';
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const fmtElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
};

export default function CloserSession() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id');

  const [queue, setQueue] = useState<Prospect[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  const [phase, setPhase] = useState<Phase>('info');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notes, setNotes] = useState('');
  const [fu, setFu] = useState<typeof FU_PRESETS[number] | null>(null);
  const [claimed, setClaimed] = useState(false);

  // Call timer
  const [callStartAt, setCallStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Instant send chips
  const [sendingNow, setSendingNow] = useState<'sms' | 'email' | null>(null);
  const [sentNow, setSentNow] = useState<{ sms: boolean; email: boolean }>({ sms: false, email: false });

  const currentRef = useRef<Prospect | null>(null);

  const loadQueue = useCallback(async (pinnedId?: string | null) => {
    setLoading(true);
    try {
      const [res, stats] = await Promise.all([
        api.get('/closer/prospects', {
          params: { scope: 'all', status: 'new,contacted,interested', limit: 50 },
        }),
        api.get('/closer/stats').catch(() => ({ data: { contactedToday: 0 } })),
      ]);
      let items: Prospect[] = res.data.items || [];
      if (pinnedId) {
        const found = items.find(p => p.id === pinnedId);
        if (found) items = [found, ...items.filter(p => p.id !== pinnedId)];
      }
      setQueue(items);
      setIdx(0);
      setTodayCount(stats.data.contactedToday || 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadQueue(initialId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const current = queue[idx] || null;

  // Reset wizard state on prospect change
  useEffect(() => {
    currentRef.current = current;
    setPhase('info');
    setOutcome(null);
    setNotes(current?.notes || '');
    setFu(null);
    setClaimed(false);
    setCallStartAt(null);
    setSentNow({ sms: false, email: false });
    if (initialId && current && current.id !== initialId) {
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [current?.id]);

  // Stopwatch — only ticks while in 'calling' phase
  useEffect(() => {
    if (phase !== 'calling' || !callStartAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [phase, callStartAt]);

  // ── Actions ────────────────────────────────────────────────
  const startCall = async () => {
    if (!current) return;
    try { await api.post(`/closer/prospects/${current.id}/claim`); setClaimed(true); }
    catch { /* non-blocking */ }
    setCallStartAt(Date.now());
    setPhase('calling');
    if (current.phone) window.location.href = `tel:${current.phone}`;
  };

  const endCall = () => {
    setPhase('outcome');
  };

  const sendNow = async (type: 'sms' | 'email') => {
    if (!current || sendingNow) return;
    setSendingNow(type);
    try {
      if (!claimed && !current.assignedToUserId) {
        await api.post(`/closer/prospects/${current.id}/claim`).catch(() => {});
        setClaimed(true);
      }
      const res = await api.post(`/closer/prospects/${current.id}/send-now`, { type });
      if (res.data?.ok) setSentNow(s => ({ ...s, [type]: true }));
      else alert(`Échec envoi ${type}`);
    } catch (e: any) { alert(e?.response?.data?.error || `Échec envoi ${type}`); }
    finally { setSendingNow(null); }
  };

  const saveAndNext = async () => {
    if (!current || !outcome) return;
    setSaving(true);
    try {
      const chosen = OUTCOMES.find(o => o.v === outcome)!;
      await api.put(`/closer/prospects/${current.id}`, {
        status: chosen.status,
        notes: notes || undefined,
      });
      if (fu) {
        await api.post(`/closer/prospects/${current.id}/followup`, {
          type: fu.type, delayHours: fu.hours,
        }).catch(() => {});
      }
      setTodayCount(c => c + 1);
      advance();
    } catch (e: any) { alert(e?.response?.data?.error || 'Échec de l\'enregistrement'); }
    finally { setSaving(false); }
  };

  const skip = async () => {
    if (!current) return;
    if (claimed) {
      await api.post(`/closer/prospects/${current.id}/release`).catch(() => {});
    }
    advance();
  };

  const advance = () => {
    const nextIdx = idx + 1;
    if (nextIdx >= queue.length) { loadQueue(); return; }
    setIdx(nextIdx);
  };

  const goNext = () => {
    if (phase === 'info')     return startCall();
    if (phase === 'calling')  return endCall();
    if (phase === 'outcome' && outcome)  return setPhase('notes');
    if (phase === 'notes')    return setPhase('followup');
    if (phase === 'followup') return saveAndNext();
  };

  const goPrev = () => {
    const i = PHASES.indexOf(phase);
    if (i > 0) setPhase(PHASES[i - 1]);
  };

  const canGoNext = (): boolean => {
    if (phase === 'info')     return !!current?.phone;
    if (phase === 'calling')  return true;
    if (phase === 'outcome')  return !!outcome;
    if (phase === 'notes')    return true;
    if (phase === 'followup') return true;
    return false;
  };

  const remaining = useMemo(() => Math.max(0, queue.length - idx), [queue.length, idx]);
  const phaseIdx = PHASES.indexOf(phase);
  const progress = Math.round(((phaseIdx + 1) / PHASES.length) * 100);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  if (!current) return (
    <div className="max-w-[720px] mx-auto">
      <Card>
        <div className="p-12 text-center">
          <PartyPopper className="w-10 h-10 mx-auto mb-3" style={{ color: pro.ok }} />
          <p className="text-[14px] font-medium" style={{ color: pro.text }}>Tout est traité</p>
          <p className="text-[12.5px] mt-1" style={{ color: pro.textTer }}>
            {todayCount} appel{todayCount > 1 ? 's' : ''} aujourd'hui
          </p>
          <div className="flex items-center justify-center gap-2 mt-5">
            <button onClick={() => loadQueue()}
                    className="px-4 h-9 text-[12.5px] font-medium rounded-xl"
                    style={{ background: pro.text, color: '#0B0B0D' }}>
              Recharger
            </button>
            <Link to="/closer/prospects"
                  className="px-4 h-9 inline-flex items-center text-[12.5px] font-medium rounded-xl"
                  style={{ background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` }}>
              <List size={13} className="mr-1.5" /> Voir tous
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="max-w-[720px] mx-auto space-y-4">
      {/* Top strip — queue progress + phase chips */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>
            Session
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>
            · {remaining} restant{remaining > 1 ? 's' : ''} · {todayCount} aujourd'hui
          </span>
        </div>
        <Link to="/closer/prospects" className="text-[11.5px] inline-flex items-center gap-1"
              style={{ color: pro.textSec }}>
          <List size={12} /> Liste
        </Link>
      </div>

      {/* Phase progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>
            Étape {phaseIdx + 1} / {PHASES.length} · {PHASE_LABELS[phase]}
          </span>
          <span className="text-[11px] truncate max-w-[60%] text-right" style={{ color: pro.textTer }}>
            {current.businessName}
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <motion.div
            className="h-full"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 220, damping: 28 }}
            style={{ background: pro.accent }}
          />
        </div>
      </div>

      {/* Step card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase + ':' + current.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {phase === 'info'     && <InfoStep p={current} onStart={startCall} />}
          {phase === 'calling'  && <CallingStep p={current} startedAt={callStartAt} now={now} onEnd={endCall} />}
          {phase === 'outcome'  && <OutcomeStep selected={outcome} onSelect={setOutcome} />}
          {phase === 'notes'    && <NotesStep notes={notes} onChange={setNotes} />}
          {phase === 'followup' && (
            <FollowupStep
              fu={fu} setFu={setFu}
              sentNow={sentNow} sendingNow={sendingNow} onSendNow={sendNow}
              prospect={current}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer — prev / next */}
      <div className="flex items-center gap-2">
        {phaseIdx > 0 ? (
          <button onClick={goPrev} disabled={saving}
                  className="px-4 h-11 inline-flex items-center gap-1.5 text-[13px] font-medium rounded-xl disabled:opacity-40"
                  style={{ background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` }}>
            <ArrowLeft size={14} /> Précédent
          </button>
        ) : (
          <button onClick={skip} disabled={saving}
                  className="px-4 h-11 inline-flex items-center gap-1.5 text-[13px] font-medium rounded-xl disabled:opacity-40"
                  style={{ background: pro.panel, color: pro.textSec, border: `1px solid ${pro.border}` }}>
            <SkipForward size={14} /> Passer
          </button>
        )}
        <button onClick={goNext} disabled={!canGoNext() || saving}
                className="flex-1 h-11 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-xl disabled:opacity-40"
                style={{ background: pro.text, color: '#0B0B0D' }}>
          {phase === 'info'     && (<><Phone size={14} /> Appeler maintenant</>)}
          {phase === 'calling'  && (<><PhoneOff size={14} /> Fin d'appel</>)}
          {phase === 'outcome'  && (<>Suivant <ArrowRight size={14} /></>)}
          {phase === 'notes'    && (<>Suivant <ArrowRight size={14} /></>)}
          {phase === 'followup' && (<><Check size={14} /> {saving ? 'Enregistrement…' : 'Terminer & suivant'}</>)}
        </button>
      </div>
    </div>
  );
}

/* ─── Step components ─────────────────────────────────────── */

function InfoStep({ p, onStart: _ }: { p: Prospect; onStart: () => void }) {
  const isMine = !!p.assignedToUserId;

  // Local editable copy of contact fields — saved to API on blur.
  const [phone, setPhone]               = useState(p.phone || '');
  const [email, setEmail]               = useState(p.email || '');
  const [contactName, setContactName]   = useState(p.contactName || '');
  const [savingField, setSavingField]   = useState<string | null>(null);
  const [emailError, setEmailError]     = useState<string | null>(null);

  // If the queue updates the prospect (e.g. after a save), pull fresh values.
  useEffect(() => {
    setPhone(p.phone || '');
    setEmail(p.email || '');
    setContactName(p.contactName || '');
    setEmailError(null);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [p.id]);

  const persist = async (field: 'phone' | 'email' | 'contactName', value: string) => {
    const original = (p as any)[field] || '';
    if (value.trim() === original.trim()) return;
    if (field === 'email' && value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      setEmailError('Email invalide');
      return;
    }
    setEmailError(null);
    setSavingField(field);
    try {
      await api.put(`/closer/prospects/${p.id}`, { [field]: value.trim() });
      // Mutate local prospect so downstream phases see the new value.
      (p as any)[field] = value.trim();
    } catch (e: any) {
      const msg = e?.response?.data?.error || `Échec mise à jour ${field}`;
      if (field === 'email') setEmailError(msg); else alert(msg);
    } finally { setSavingField(null); }
  };

  return (
    <Card>
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-[16px] font-semibold"
               style={{ background: pro.panelHi, color: pro.text }}>
            {p.businessName?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[19px] font-semibold tracking-tight leading-snug break-words"
                style={{ color: pro.text }}>
              {p.businessName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <Pill color={STATUS_PILL(p.status) as any}>{p.status}</Pill>
              <span className="text-[11px] tabular-nums whitespace-nowrap" style={{ color: pro.textTer }}>
                Score {p.score ?? '—'}/22
              </span>
              {isMine && (
                <span className="inline-flex items-center text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: `${pro.accent}1F`, color: pro.accent }}>
                  À moi
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <EditableRow icon={Phone} label="Téléphone"
                       value={phone} onChange={setPhone}
                       onCommit={(v) => persist('phone', v)}
                       saving={savingField === 'phone'}
                       placeholder="+1…" tabular accent />
          <EditableRow icon={User} label="Contact"
                       value={contactName} onChange={setContactName}
                       onCommit={(v) => persist('contactName', v)}
                       saving={savingField === 'contactName'}
                       placeholder="Prénom Nom" />
          <div className="sm:col-span-2">
            <EditableRow icon={Mail} label="Email"
                         value={email} onChange={setEmail}
                         onCommit={(v) => persist('email', v)}
                         saving={savingField === 'email'}
                         error={emailError}
                         placeholder="contact@entreprise.com"
                         type="email" />
          </div>
          <InfoRow icon={MapPin} label="Localité"
                   value={[p.city, p.state].filter(Boolean).join(', ') || '—'} />
          <InfoRow icon={Building2} label="Secteur"
                   value={p.niche || p.sector || '—'} />
          <InfoRow icon={Bot} label="Bot"
                   value={`${p.callAttempts ?? 0} tentative${(p.callAttempts ?? 0) > 1 ? 's' : ''}${p.lastCallDate ? ` · ${fmtDate(p.lastCallDate)}` : ''}`} />
        </div>

        {(p.address || p.postalCode) && (
          <div className="text-[12px] leading-relaxed px-3 py-2.5 rounded-xl"
               style={{ background: pro.panelHi, color: pro.textSec }}>
            <span className="font-semibold uppercase tracking-wider text-[10.5px] mr-2"
                  style={{ color: pro.textTer }}>Adresse</span>
            {[p.address, p.postalCode, p.city].filter(Boolean).join(', ')}
          </div>
        )}

        {p.callTranscript && (
          <details className="rounded-xl" style={{ border: `1px solid ${pro.border}` }}>
            <summary className="px-3 py-2.5 text-[12px] font-medium cursor-pointer"
                     style={{ color: pro.textSec }}>
              Voir transcript du dernier appel bot
            </summary>
            <pre className="text-[11.5px] whitespace-pre-wrap font-mono leading-relaxed p-3 max-h-[260px] overflow-auto"
                 style={{ background: pro.bg, color: pro.textSec, borderTop: `1px solid ${pro.border}` }}>
              {p.callTranscript}
            </pre>
          </details>
        )}
      </div>
    </Card>
  );
}

function EditableRow({
  icon: Icon, label, value, onChange, onCommit, saving, error, placeholder, type, tabular, accent,
}: {
  icon: any; label: string; value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  saving?: boolean; error?: string | null;
  placeholder?: string; type?: string; tabular?: boolean; accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 h-12 rounded-lg"
         style={{
           background: pro.panelHi,
           border: `1px solid ${error ? 'rgba(239,68,68,0.55)' : pro.border}`,
         }}>
      <Icon size={13} style={{ color: accent && value ? pro.accent : pro.textTer }} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider leading-none" style={{ color: pro.textTer }}>
          {label}{saving && <span className="ml-1.5" style={{ color: pro.accent }}>· saving…</span>}
          {error && <span className="ml-1.5" style={{ color: pro.bad }}>· {error}</span>}
        </p>
        <input
          type={type || 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={e => onCommit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder={placeholder}
          className={`w-full bg-transparent outline-none text-[13px] truncate leading-tight mt-0.5 ${tabular ? 'tabular-nums' : ''}`}
          style={{ color: pro.text }}
        />
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon, label, value, accent, tabular,
}: { icon: any; label: string; value: string; accent?: boolean; tabular?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 h-10 rounded-lg"
         style={{ background: pro.panelHi }}>
      <Icon size={13} style={{ color: accent ? pro.accent : pro.textTer }} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider leading-none" style={{ color: pro.textTer }}>{label}</p>
        <p className={`text-[12.5px] truncate leading-tight mt-0.5 ${tabular ? 'tabular-nums' : ''}`}
           style={{ color: accent ? pro.text : pro.textSec, fontWeight: accent ? 600 : 500 }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function CallingStep({
  p, startedAt, now, onEnd: _,
}: { p: Prospect; startedAt: number | null; now: number; onEnd: () => void }) {
  const elapsed = startedAt ? now - startedAt : 0;
  return (
    <Card>
      <div className="p-8 flex flex-col items-center text-center">
        {/* Two Qwillio orbs orbiting around a central phone icon — bounded
            box so nothing escapes the card. */}
        <div className="relative mb-6"
             style={{ width: 176, height: 176 }}>
          {/* Faint orbit guides */}
          <span className="absolute inset-0 rounded-full"
                style={{ border: `1px dashed ${pro.borderHi}`, opacity: 0.35 }} />
          <span className="absolute rounded-full"
                style={{
                  inset: 24,
                  border: `1px dashed ${pro.borderHi}`,
                  opacity: 0.25,
                }} />

          {/* Outer orbit — violet orb, clockwise */}
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute left-1/2 -translate-x-1/2"
                 style={{
                   top: -8,
                   width: 22, height: 22, borderRadius: '50%',
                   background: 'radial-gradient(circle at 35% 30%, #DDB0FF 0%, #A855F7 55%, #9333EA 100%)',
                   boxShadow: '0 0 22px rgba(168,85,247,0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
                 }} />
          </motion.div>

          {/* Inner orbit — blue orb, counter-clockwise, faster */}
          <motion.div
            className="absolute"
            style={{ inset: 24 }}
            animate={{ rotate: -360 }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute left-1/2 -translate-x-1/2"
                 style={{
                   top: -7,
                   width: 18, height: 18, borderRadius: '50%',
                   background: 'radial-gradient(circle at 35% 30%, #A5A4FF 0%, #6366F1 55%, #4F46E5 100%)',
                   boxShadow: '0 0 18px rgba(99,102,241,0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
                 }} />
          </motion.div>

          {/* Center phone — gentle breathing pulse, never grows beyond bounds */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="rounded-full flex items-center justify-center"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 76, height: 76,
                background: `linear-gradient(135deg, ${pro.accent} 0%, #6541E0 100%)`,
                boxShadow: `0 6px 24px ${pro.accent}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
              }}
            >
              <Phone size={28} color="#fff" />
            </motion.div>
          </div>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: pro.accent }}>
          Appel en cours
        </p>
        <h2 className="text-[18px] font-semibold tracking-tight mt-1 break-words" style={{ color: pro.text }}>
          {p.businessName}
        </h2>
        <p className="text-[14px] tabular-nums mt-1" style={{ color: pro.textSec }}>
          {p.phone || '—'}
        </p>
        <p className="text-[28px] font-semibold tabular-nums mt-3" style={{ color: pro.text }}>
          {fmtElapsed(elapsed)}
        </p>
        <p className="text-[11.5px] mt-3" style={{ color: pro.textTer }}>
          Quand l'appel est terminé, touchez "Fin d'appel" en bas pour passer à l'issue.
        </p>
      </div>
    </Card>
  );
}

function OutcomeStep({
  selected, onSelect: _,
}: { selected: Outcome | null; onSelect: (o: Outcome) => void }) {
  return (
    <Card>
      <div className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: pro.textSec }}>
          Comment s'est passé l'appel ?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {OUTCOMES.map(o => {
            const sel = selected === o.v;
            return (
              <button key={o.v} type="button"
                      onClick={() => _(o.v)}
                      className="flex items-center gap-2 h-12 px-3 rounded-xl transition-all active:scale-[0.98]"
                      style={{
                        background: sel ? `${o.color}22` : pro.panelHi,
                        border: `1px solid ${sel ? `${o.color}88` : pro.border}`,
                        color: sel ? o.color : pro.text,
                      }}>
                <o.icon size={16} />
                <span className="text-[13px] font-medium">{o.l}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function NotesStep({ notes, onChange }: { notes: string; onChange: (v: string) => void }) {
  return (
    <Card>
      <div className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
          Note de l'appel
        </p>
        <div className="relative">
          <MessageSquare size={14} className="absolute left-3 top-3" style={{ color: pro.textTer }} />
          <textarea
            value={notes}
            onChange={e => onChange(e.target.value)}
            placeholder="Qu'a dit le prospect ? Besoins, objections, prochaine étape…"
            rows={5}
            className="w-full pl-9 pr-3 py-2.5 text-[13px] rounded-xl bg-transparent outline-none resize-y leading-relaxed"
            style={{
              color: pro.text,
              background: pro.panelHi,
              border: `1px solid ${pro.border}`,
              minHeight: 140,
            }}
          />
        </div>
      </div>
    </Card>
  );
}

function FollowupStep({
  fu, setFu, sentNow, sendingNow, onSendNow, prospect,
}: {
  fu: typeof FU_PRESETS[number] | null;
  setFu: (v: typeof FU_PRESETS[number] | null) => void;
  sentNow: { sms: boolean; email: boolean };
  sendingNow: 'sms' | 'email' | null;
  onSendNow: (t: 'sms' | 'email') => void;
  prospect: Prospect;
}) {
  // Inline email capture so the closer can fill it without leaving the step.
  const [emailDraft, setEmailDraft] = useState(prospect.email || '');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError]   = useState<string | null>(null);

  useEffect(() => { setEmailDraft(prospect.email || ''); setEmailError(null); }, [prospect.id, prospect.email]);

  const saveEmail = async () => {
    const v = emailDraft.trim();
    if (!v || v === (prospect.email || '')) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setEmailError('Email invalide'); return; }
    setSavingEmail(true);
    setEmailError(null);
    try {
      await api.put(`/closer/prospects/${prospect.id}`, { email: v });
      (prospect as any).email = v;
    } catch (e: any) {
      setEmailError(e?.response?.data?.error || 'Échec');
    } finally { setSavingEmail(false); }
  };

  return (
    <Card>
      <div className="p-5 space-y-4">
        {!prospect.email && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
              Email du prospect
            </p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={emailDraft}
                onChange={e => setEmailDraft(e.target.value)}
                placeholder="contact@entreprise.com"
                className="flex-1 px-3 h-10 rounded-lg text-[13px] outline-none"
                style={{
                  background: pro.panelHi,
                  color: pro.text,
                  border: `1px solid ${emailError ? 'rgba(239,68,68,0.55)' : pro.border}`,
                }}
              />
              <button onClick={saveEmail} disabled={savingEmail || !emailDraft.trim()}
                      className="px-3 h-10 text-[12.5px] font-medium rounded-lg disabled:opacity-40"
                      style={{ background: pro.accent, color: '#fff' }}>
                {savingEmail ? '…' : 'Enregistrer'}
              </button>
            </div>
            {emailError && <p className="text-[11px] mt-1.5" style={{ color: pro.bad }}>{emailError}</p>}
          </div>
        )}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
            Envoyer un message
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'sms'   as const, l: 'Envoyer SMS',   icon: MessageSquare, disabled: !prospect.phone },
              { type: 'email' as const, l: 'Envoyer email', icon: Mail,          disabled: !prospect.email },
            ].map(b => {
              const isSent    = sentNow[b.type];
              const isSending = sendingNow === b.type;
              return (
                <motion.button
                  key={b.type}
                  onClick={() => onSendNow(b.type)}
                  disabled={isSending || isSent || b.disabled}
                  initial={false}
                  animate={isSent ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className="h-11 inline-flex items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition-colors disabled:opacity-50"
                  style={{
                    background: isSent ? 'rgba(34,197,94,0.14)' : pro.panelHi,
                    color:      isSent ? pro.ok : pro.text,
                    border:     `1px solid ${isSent ? 'rgba(34,197,94,0.55)' : pro.border}`,
                  }}
                >
                  {isSent
                    ? <><Check size={13} /> {b.type === 'sms' ? 'SMS envoyé' : 'Email envoyé'}</>
                    : (isSending
                      ? <><Send size={13} className="animate-pulse" /> Envoi…</>
                      : <><b.icon size={13} /> {b.l}</>)}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
            Ou planifier (optionnel)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FU_PRESETS.map((p, i) => {
              const sel = fu === p;
              return (
                <button key={i}
                        onClick={() => setFu(sel ? null : p)}
                        className="px-3 h-8 text-[12px] font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors"
                        style={{
                          background: sel ? pro.accent : pro.panelHi,
                          color: sel ? '#fff' : pro.text,
                          border: `1px solid ${sel ? pro.accent : pro.border}`,
                        }}>
                  <Send size={11} /> {p.l}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: pro.textTer }}>
          <ChevronRight size={11} />
          Tapez "Terminer" pour enregistrer le statut, le note et le follow-up planifié, puis passer au prospect suivant.
        </div>
      </div>
    </Card>
  );
}
