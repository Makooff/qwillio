import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, Check, Clock,
  Send, Trash2, AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import QwillioLoader from '../../components/QwillioLoader';
import { pro } from '../../styles/pro-theme';
import { Card, SectionHead, Pill, PrimaryBtn, GhostBtn } from '../../components/pro/ProBlocks';

interface FollowUp {
  id: string; type: string; step: number;
  scheduledAt: string; sentAt: string | null;
  opened: boolean; clicked: boolean; replied: boolean;
}

interface Prospect {
  id: string; businessName: string; contactName?: string; phone?: string;
  email?: string; city?: string; state?: string; sector?: string; niche?: string;
  status: string; score?: number; priorityScore?: number;
  notes?: string; interestLevel?: number; painPoints?: string;
  nextAction?: string; nextActionDate?: string | null;
  assignedToUserId?: string | null;
  callAttempts?: number; lastCallDate?: string | null; lastContactDate?: string | null;
  callDuration?: number; callTranscript?: string; callSentiment?: string;
  needsIdentified?: string;
  followUpSequences?: FollowUp[];
}

const STATUS_OPTIONS = [
  { v: 'new',         l: 'Nouveau',    c: 'neutral' },
  { v: 'contacted',   l: 'Contacté',   c: 'info'    },
  { v: 'interested',  l: 'Intéressé',  c: 'ok'      },
  { v: 'qualified',   l: 'Qualifié',   c: 'ok'      },
  { v: 'converted',   l: 'Converti',   c: 'ok'      },
  { v: 'lost',        l: 'Perdu',      c: 'bad'     },
] as const;

const fmt = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function CloserProspectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Follow-up scheduler
  const [fuType, setFuType] = useState<'sms' | 'email' | 'call'>('sms');
  const [fuDelay, setFuDelay] = useState<number>(24);
  const [fuSaving, setFuSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/closer/prospects/${id}`);
      setP(res.data);
      setNotes(res.data.notes || '');
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Erreur de chargement');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    try { setMyUserId(JSON.parse(localStorage.getItem('user') || 'null')?.id || null); } catch {/*empty*/}
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id]);

  const isMine = p?.assignedToUserId && myUserId && p.assignedToUserId === myUserId;
  const canEdit = !!isMine;

  const claim = async () => {
    setSaving(true);
    try { await api.post(`/closer/prospects/${id}/claim`); await load(); }
    catch (e: any) { alert(e?.response?.data?.error || 'Échec'); }
    finally { setSaving(false); }
  };

  const release = async () => {
    if (!confirm('Relâcher ce prospect ? Le bot pourra le rappeler.')) return;
    setSaving(true);
    try { await api.post(`/closer/prospects/${id}/release`); navigate('/closer/prospects'); }
    catch (e: any) { alert(e?.response?.data?.error || 'Échec'); }
    finally { setSaving(false); }
  };

  const saveStatus = async (status: string) => {
    if (!canEdit) return;
    setSaving(true);
    try { await api.put(`/closer/prospects/${id}`, { status }); await load(); }
    catch (e: any) { alert(e?.response?.data?.error || 'Échec'); }
    finally { setSaving(false); }
  };

  const saveNotes = async () => {
    if (!canEdit) return;
    setSaving(true);
    try { await api.put(`/closer/prospects/${id}`, { notes }); await load(); }
    catch (e: any) { alert(e?.response?.data?.error || 'Échec'); }
    finally { setSaving(false); }
  };

  const scheduleFu = async () => {
    setFuSaving(true);
    try {
      await api.post(`/closer/prospects/${id}/followup`, {
        type: fuType, delayHours: fuDelay,
      });
      await load();
    } catch (e: any) { alert(e?.response?.data?.error || 'Échec'); }
    finally { setFuSaving(false); }
  };

  const cancelFu = async (fuId: string) => {
    if (!confirm('Annuler ce follow-up ?')) return;
    try { await api.delete(`/closer/followups/${fuId}`); await load(); }
    catch (e: any) { alert(e?.response?.data?.error || 'Échec'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <QwillioLoader size={120} fullscreen={false} />
    </div>
  );

  if (err || !p) return (
    <div className="max-w-[900px]">
      <Link to="/closer/prospects" className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: pro.textSec }}>
        <ArrowLeft size={12} /> Retour
      </Link>
      <Card className="mt-4">
        <div className="p-12 text-center">
          <AlertCircle className="w-8 h-8 mb-3 mx-auto" style={{ color: pro.bad }} />
          <p className="text-[13px]" style={{ color: pro.textSec }}>{err || 'Prospect introuvable'}</p>
        </div>
      </Card>
    </div>
  );

  const currentStatus = STATUS_OPTIONS.find(s => s.v === p.status);

  return (
    <div className="space-y-5 max-w-[1000px]">
      <Link to="/closer/prospects" className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: pro.textSec }}>
        <ArrowLeft size={12} /> Retour aux prospects
      </Link>

      {/* Header card */}
      <Card>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] font-semibold"
                   style={{ background: pro.panelHi, color: pro.text }}>
                {p.businessName?.charAt(0) || '?'}
              </div>
              <div className="min-w-0">
                <h1 className="text-[18px] font-semibold tracking-tight" style={{ color: pro.text }}>{p.businessName}</h1>
                <p className="text-[12px] mt-0.5" style={{ color: pro.textSec }}>
                  {p.contactName || '—'} {p.city ? `· ${p.city}` : ''} {p.sector ? `· ${p.sector}` : ''}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {currentStatus && <Pill color={currentStatus.c as any}>{currentStatus.l}</Pill>}
                  <span className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>
                    Score {p.score ?? '—'}/22
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isMine ? (
                <PrimaryBtn onClick={claim} disabled={saving}>Prendre</PrimaryBtn>
              ) : (
                <GhostBtn onClick={release} disabled={saving}>Relâcher</GhostBtn>
              )}
            </div>
          </div>

          {/* Quick contacts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5">
            {p.phone && (
              <a href={`tel:${p.phone}`}
                 className="flex items-center gap-2.5 px-3 h-11 rounded-xl hover:bg-white/[0.04] transition-colors"
                 style={{ background: pro.panelHi, color: pro.text }}>
                <Phone size={14} style={{ color: pro.accent }} />
                <span className="text-[13px] tabular-nums truncate">{p.phone}</span>
              </a>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`}
                 className="flex items-center gap-2.5 px-3 h-11 rounded-xl hover:bg-white/[0.04] transition-colors"
                 style={{ background: pro.panelHi, color: pro.text }}>
                <Mail size={14} style={{ color: pro.textSec }} />
                <span className="text-[13px] truncate">{p.email}</span>
              </a>
            )}
            {p.city && (
              <div className="flex items-center gap-2.5 px-3 h-11 rounded-xl"
                   style={{ background: pro.panelHi, color: pro.text }}>
                <MapPin size={14} style={{ color: pro.textSec }} />
                <span className="text-[13px] truncate">{p.city}{p.state ? `, ${p.state}` : ''}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Status pills */}
      <div>
        <SectionHead title="Statut" />
        <Card>
          <div className="flex flex-wrap gap-2 p-4">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.v}
                onClick={() => saveStatus(s.v)}
                disabled={!canEdit || saving}
                className="px-3 h-8 text-[12px] font-medium rounded-lg transition-colors disabled:opacity-40"
                style={{
                  background: p.status === s.v ? pro.accent : pro.panelHi,
                  color: p.status === s.v ? '#fff' : pro.text,
                }}
              >
                {s.l}
              </button>
            ))}
          </div>
          {!canEdit && (
            <p className="px-4 pb-4 text-[11.5px]" style={{ color: pro.textTer }}>
              Prenez ce prospect pour modifier son statut.
            </p>
          )}
        </Card>
      </div>

      {/* Notes */}
      <div>
        <SectionHead title="Notes" />
        <Card>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ajoutez vos notes après l'appel…"
            disabled={!canEdit}
            rows={5}
            className="w-full p-4 text-[13px] bg-transparent outline-none resize-none disabled:opacity-60"
            style={{ color: pro.text }}
          />
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${pro.border}` }}>
            <span className="text-[11px]" style={{ color: pro.textTer }}>{notes.length} caractères</span>
            <PrimaryBtn onClick={saveNotes} disabled={!canEdit || saving} size="sm">
              <Check size={12} /> Enregistrer
            </PrimaryBtn>
          </div>
        </Card>
      </div>

      {/* Follow-up scheduler */}
      {canEdit && (
        <div>
          <SectionHead title="Programmer un follow-up" />
          <Card>
            <div className="p-4 flex flex-wrap items-center gap-3">
              <select value={fuType} onChange={e => setFuType(e.target.value as any)}
                      className="h-9 px-3 text-[12.5px] rounded-lg outline-none"
                      style={{ background: pro.panelHi, color: pro.text, border: `1px solid ${pro.border}` }}>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="call">Rappel téléphone</option>
              </select>
              <select value={fuDelay} onChange={e => setFuDelay(Number(e.target.value))}
                      className="h-9 px-3 text-[12.5px] rounded-lg outline-none"
                      style={{ background: pro.panelHi, color: pro.text, border: `1px solid ${pro.border}` }}>
                <option value={1}>Dans 1 heure</option>
                <option value={4}>Dans 4 heures</option>
                <option value={24}>Demain</option>
                <option value={48}>Dans 2 jours</option>
                <option value={72}>Dans 3 jours</option>
                <option value={168}>Dans 1 semaine</option>
              </select>
              <PrimaryBtn onClick={scheduleFu} disabled={fuSaving} size="sm">
                <Send size={12} /> {fuSaving ? 'Ajout…' : 'Planifier'}
              </PrimaryBtn>
            </div>
          </Card>
        </div>
      )}

      {/* Follow-ups history */}
      <div>
        <SectionHead title="Follow-ups" />
        <Card>
          {(!p.followUpSequences || p.followUpSequences.length === 0) ? (
            <div className="p-8 text-center" style={{ color: pro.textTer }}>
              <p className="text-[12.5px]">Aucun follow-up programmé</p>
            </div>
          ) : (
            p.followUpSequences.map((fu, i) => {
              const sent = !!fu.sentAt;
              return (
                <div key={fu.id}
                     className="flex items-center gap-3 px-4 py-3"
                     style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: pro.panelHi }}>
                    {sent ? <Check size={13} style={{ color: pro.ok }} /> : <Clock size={12} style={{ color: pro.textSec }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium" style={{ color: pro.text }}>
                      {fu.type.toUpperCase()} · étape {fu.step}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: pro.textTer }}>
                      {sent ? `Envoyé ${fmt(fu.sentAt)}` : `Prévu ${fmt(fu.scheduledAt)}`}
                      {fu.opened && ' · ouvert'}
                      {fu.clicked && ' · cliqué'}
                      {fu.replied && ' · répondu'}
                    </p>
                  </div>
                  {!sent && canEdit && (
                    <button onClick={() => cancelFu(fu.id)}
                            className="p-1.5 rounded hover:bg-white/[0.06]"
                            style={{ color: pro.textTer }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* Call history summary (if available) */}
      {(p.callTranscript || p.callSentiment || p.lastCallDate) && (
        <div>
          <SectionHead title="Appel du bot" />
          <Card>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-4 text-[12px]" style={{ color: pro.textSec }}>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={12} /> {p.callAttempts ?? 0} tentative{(p.callAttempts ?? 0) > 1 ? 's' : ''}
                </span>
                {p.lastCallDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={12} /> {fmt(p.lastCallDate)}
                  </span>
                )}
                {p.callSentiment && <Pill color={p.callSentiment === 'positive' ? 'ok' : p.callSentiment === 'negative' ? 'bad' : 'neutral'}>{p.callSentiment}</Pill>}
              </div>
              {p.callTranscript && (
                <pre className="text-[11.5px] whitespace-pre-wrap font-mono leading-relaxed mt-3 p-3 rounded-xl max-h-[300px] overflow-auto"
                     style={{ background: pro.bg, color: pro.textSec, border: `1px solid ${pro.border}` }}>
                  {p.callTranscript}
                </pre>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
