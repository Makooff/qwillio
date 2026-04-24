import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Phone, SkipForward, Check, X, Clock, PartyPopper, Send,
  ChevronRight, Building2, MapPin, Mail, MessageSquare, List,
  ArrowLeft,
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
  assignedToUserId?: string | null;
}

type Outcome = 'interested' | 'lost' | 'callback' | 'converted';

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
  { type: 'call',  hours: 48,  l: 'Rappel dans 2j' },
  { type: 'call',  hours: 168, l: 'Rappel dans 1 sem.' },
];

export default function CloserSession() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id');

  const [queue, setQueue] = useState<Prospect[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notes, setNotes] = useState('');
  const [fu, setFu] = useState<typeof FU_PRESETS[number] | null>(null);
  const [claimed, setClaimed] = useState(false);

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
  useEffect(() => {
    currentRef.current = current;
    setOutcome(null);
    setNotes(current?.notes || '');
    setFu(null);
    setClaimed(false);
    // Remove ?id= from URL once the session moves past the pinned prospect
    if (initialId && current && current.id !== initialId) {
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [current?.id]);

  const callNow = async () => {
    if (!current) return;
    // Claim atomically so the bot never double-calls while she's on the phone
    try { await api.post(`/closer/prospects/${current.id}/claim`); setClaimed(true); }
    catch { /* non-blocking — the tel: link still opens */ }
    if (current.phone) window.location.href = `tel:${current.phone}`;
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
      // Relâcher si on avait claim avant (pour ne pas bloquer le bot à tort)
      await api.post(`/closer/prospects/${current.id}/release`).catch(() => {});
    }
    advance();
  };

  const advance = () => {
    const next = idx + 1;
    if (next >= queue.length) {
      // Refetch at end of queue
      loadQueue();
      return;
    }
    setIdx(next);
  };

  const remaining = useMemo(() => Math.max(0, queue.length - idx), [queue.length, idx]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={120} fullscreen={false} />
    </div>
  );

  if (!current) return (
    <div className="max-w-[720px] mx-auto">
      <Card>
        <div className="p-12 text-center">
          <PartyPopper className="w-10 h-10 mx-auto mb-3" style={{ color: pro.ok }} />
          <p className="text-[14px] font-medium" style={{ color: pro.text }}>Tout est traité</p>
          <p className="text-[12.5px] mt-1" style={{ color: pro.textTer }}>
            {todayCount} appel{todayCount > 1 ? 's' : ''} aujourd'hui · à plus tard
          </p>
          <div className="flex items-center justify-center gap-2 mt-5">
            <button
              onClick={() => loadQueue()}
              className="px-4 h-9 text-[12.5px] font-medium rounded-xl"
              style={{ background: pro.text, color: '#0B0B0D' }}
            >
              Recharger la liste
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

  const isMine = !!current.assignedToUserId;

  return (
    <div className="max-w-[720px] mx-auto space-y-4">
      {/* Progress strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>
            Session d'appels
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

      {/* Prospect card — call-first */}
      <Card>
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-[15px] font-semibold"
                 style={{ background: pro.panelHi, color: pro.text }}>
              {current.businessName?.charAt(0) || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] font-semibold tracking-tight leading-snug break-words" style={{ color: pro.text }}>
                {current.businessName}
              </h1>
              <p className="text-[12px] mt-1 break-words" style={{ color: pro.textSec }}>
                {current.contactName || '—'}{current.city ? ` · ${current.city}` : ''}
                {current.sector ? ` · ${current.sector}` : ''}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[11px] tabular-nums whitespace-nowrap" style={{ color: pro.textTer }}>
                Score {current.score ?? '—'}/22
              </p>
              {isMine && (
                <span className="inline-flex items-center gap-1 mt-1 text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: `${pro.accent}1F`, color: pro.accent }}>
                  À moi
                </span>
              )}
            </div>
          </div>

          {/* Huge call button */}
          <button
            onClick={callNow}
            disabled={!current.phone}
            className="w-full flex items-center justify-between p-4 rounded-2xl disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${pro.accent} 0%, #6541E0 100%)`,
              color: '#fff',
              boxShadow: '0 6px 24px rgba(123,92,240,0.35)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(255,255,255,0.18)' }}>
                <Phone size={19} />
              </div>
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-wider opacity-75">Appeler maintenant</p>
                <p className="text-[17px] font-semibold tabular-nums">
                  {current.phone || 'Pas de numéro'}
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="opacity-75" />
          </button>

          {/* Compact meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {current.email && (
              <a href={`mailto:${current.email}`}
                 className="flex items-center gap-2 px-3 h-9 rounded-lg hover:bg-white/[0.04] transition-colors text-[12px] truncate"
                 style={{ background: pro.panelHi, color: pro.textSec }}>
                <Mail size={12} /> <span className="truncate">{current.email}</span>
              </a>
            )}
            <div className="flex items-center gap-2 px-3 h-9 rounded-lg text-[12px] truncate"
                 style={{ background: pro.panelHi, color: pro.textSec }}>
              <Building2 size={12} />
              <span className="truncate">
                {current.niche || current.sector || '—'} · {current.callAttempts || 0} tentative{(current.callAttempts || 0) > 1 ? 's' : ''} du bot
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* After-call panel */}
      <Card>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: pro.textSec }}>
              Comment s'est passé l'appel ?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map(o => {
                const sel = outcome === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => setOutcome(o.v)}
                    className="flex items-center gap-2 h-11 px-3 rounded-xl transition-all active:scale-[0.98]"
                    style={{
                      background: sel ? `${o.color}22` : pro.panelHi,
                      border: `1px solid ${sel ? `${o.color}88` : pro.border}`,
                      color: sel ? o.color : pro.text,
                    }}
                  >
                    <o.icon size={15} />
                    <span className="text-[13px] font-medium">{o.l}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
              Note
            </p>
            <div className="relative">
              <MessageSquare size={14} className="absolute left-3 top-3" style={{ color: pro.textTer }} />
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Qu'a dit le prospect ? Besoins, objections, prochaine étape…"
                rows={3}
                className="w-full pl-9 pr-3 py-2.5 text-[13px] rounded-xl bg-transparent outline-none resize-none"
                style={{ color: pro.text, background: pro.panelHi, border: `1px solid ${pro.border}` }}
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
              Follow-up (optionnel)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FU_PRESETS.map((p, i) => {
                const sel = fu === p;
                return (
                  <button
                    key={i}
                    onClick={() => setFu(sel ? null : p)}
                    className="px-3 h-8 text-[12px] font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors"
                    style={{
                      background: sel ? pro.accent : pro.panelHi,
                      color: sel ? '#fff' : pro.text,
                      border: `1px solid ${sel ? pro.accent : pro.border}`,
                    }}
                  >
                    <Send size={11} /> {p.l}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={saveAndNext}
              disabled={!outcome || saving}
              className="flex-1 h-11 inline-flex items-center justify-center gap-2 font-medium rounded-xl disabled:opacity-40 transition-colors"
              style={{ background: pro.text, color: '#0B0B0D' }}
            >
              <Check size={14} />
              {saving ? 'Enregistrement…' : 'Enregistrer & suivant'}
              <ChevronRight size={14} />
            </button>
            <button
              onClick={skip}
              disabled={saving}
              title="Passer ce prospect"
              className="px-4 h-11 inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium rounded-xl disabled:opacity-40"
              style={{ background: pro.panel, color: pro.textSec, border: `1px solid ${pro.border}` }}
            >
              <SkipForward size={14} /> Passer
            </button>
          </div>
        </div>
      </Card>

      {/* Statut actuel + lien retour */}
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <Pill color={
            current.status === 'interested' || current.status === 'qualified' || current.status === 'converted' ? 'ok' :
            current.status === 'contacted' ? 'info' :
            current.status === 'lost' ? 'bad' : 'neutral'
          }>{current.status}</Pill>
          {current.lastCallDate && (
            <span className="text-[11px]" style={{ color: pro.textTer }}>
              <MapPin size={10} className="inline -mt-0.5 mr-0.5" />
              bot {new Date(current.lastCallDate).toLocaleDateString('fr-FR', { day:'numeric', month:'short' })}
            </span>
          )}
        </div>
        <Link to="/closer/prospects" className="text-[11px] inline-flex items-center gap-1"
              style={{ color: pro.textSec }}>
          <ArrowLeft size={11} /> Tous les prospects
        </Link>
      </div>
    </div>
  );
}
