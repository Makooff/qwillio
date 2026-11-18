import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, SectionHead, IconBtn, GhostBtn, PrimaryBtn, Pill } from '../../components/pro/ProBlocks';
import { RefreshCw, Phone, Mail, MessageSquare, X, ChevronDown, Loader2, Search } from '../../components/icons';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import OutreachSheet, { type OutreachChannel } from '../../components/admin/OutreachSheet';

/**
 * « À appeler » : les prospects choisis depuis la recherche, et ce que chaque
 * appel a donné.
 *
 * La page fait deux choses. Elle sert de file de travail (appeler, écrire,
 * noter), et elle rend ce qui en sort : quelle heure décroche, quel refus
 * revient, quel métier répond. Sans la seconde moitié, les notes ne servent
 * qu'à celui qui les relit ; avec elle, elles disent quoi changer.
 */

type Outcome = 'no_answer' | 'voicemail' | 'callback' | 'refused' | 'interested' | 'meeting' | 'wrong_number' | 'do_not_call';
type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

interface Log { id?: string; outcome: Outcome; objection: string | null; note: string | null; callbackAt: string | null; createdAt: string }
interface Row {
  id: string; businessName: string; niche?: string | null; city?: string | null; phone?: string | null; email?: string | null;
  status: string; notes?: string | null; callAttempts: number; nextActionDate?: string | null;
  lastLog: Log | null; logCount: number;
}
interface Bucket { key: string; calls: number; reached: number; meetings: number }
interface Stats {
  days: number; calls: number; reached: number; meetings: number;
  reachRate: number | null; meetingRate: number | null;
  byOutcome: Array<{ key: string; count: number }>;
  byObjection: Array<{ key: string; count: number }>;
  byWindow: Bucket[];
  byNiche: Bucket[];
}

const OUTCOMES: Array<{ key: Outcome; label: string; color: PillColor }> = [
  { key: 'no_answer', label: 'Pas de réponse', color: 'neutral' },
  { key: 'voicemail', label: 'Répondeur', color: 'neutral' },
  { key: 'callback', label: 'À rappeler', color: 'info' },
  { key: 'interested', label: 'Intéressé', color: 'ok' },
  { key: 'meeting', label: 'Rendez-vous', color: 'accent' },
  { key: 'refused', label: 'Refus', color: 'warn' },
  { key: 'wrong_number', label: 'Mauvais numéro', color: 'neutral' },
  { key: 'do_not_call', label: 'Ne plus appeler', color: 'bad' },
];
const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map(o => [o.key, o.label])) as Record<string, string>;
const OUTCOME_COLOR = Object.fromEntries(OUTCOMES.map(o => [o.key, o.color])) as Record<string, PillColor>;

const OBJECTIONS: Array<{ key: string; label: string }> = [
  { key: 'already_handled', label: 'Gère déjà ses appels' },
  { key: 'anti_ai', label: 'Contre l’IA' },
  { key: 'too_expensive', label: 'Trop cher' },
  { key: 'no_time', label: 'Pas le temps' },
  { key: 'not_interested', label: 'Pas intéressé' },
  { key: 'other', label: 'Autre' },
];
const OBJECTION_LABEL = Object.fromEntries(OBJECTIONS.map(o => [o.key, o.label])) as Record<string, string>;

const WINDOW_LABEL: Record<string, string> = {
  '07-09': '7 h à 9 h', '09-12': '9 h à 12 h', '12-14': '12 h à 14 h', '14-17': '14 h à 17 h', '17-19': '17 h à 19 h', autre: 'Autre heure',
};
const NICHE_LABEL: Record<string, string> = {
  home_services: 'Services à domicile', auto: 'Garage auto', dental: 'Dentaire', medical: 'Médical', salon: 'Coiffure et beauté',
  real_estate: 'Immobilier', financial: 'Comptable', law: 'Avocat, notaire', veterinary: 'Vétérinaire', restaurant: 'Restaurant', inconnu: 'Non classé',
};

const pct = (value: number | null) => (value === null ? '—' : `${(value * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`);

function telHref(phone?: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^\d+]/g, '');
  return clean.length >= 6 ? `tel:${clean}` : null;
}

/**
 * Une ligne de classement : le libellé et le chiffre sur une ligne, le trait
 * dessous. Empilés plutôt que côte à côte : à 390 px, trois colonnes écrasaient
 * le libellé et ne laissaient au trait que quelques pixels.
 */
function Bar({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] truncate" style={{ color: pro.textSec }}>{label}</span>
        <span className="text-[12px] tabular-nums whitespace-nowrap" style={{ color: pro.text }}>{right}</span>
      </div>
      <div className="h-1.5 mt-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: pro.accentHi }} />
      </div>
    </div>
  );
}

const iconBtn = 'h-9 w-9 grid place-items-center rounded-xl transition-colors hover:bg-white/[0.06]';
const iconBtnStyle = { background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text } as const;
const fieldStyle = { background: 'rgba(255,255,255,0.04)', border: `1px solid ${pro.border}`, color: pro.text } as const;

export default function AdminCallList() {
  const navigate = useNavigate();
  const { toasts, add: toast, remove } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // La fiche ouverte, et ce qu'on est en train d'y consigner.
  const [openId, setOpenId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [objection, setObjection] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Log[]>([]);

  const [outreach, setOutreach] = useState<{ row: Row; channel: OutreachChannel } | null>(null);

  const loadStats = useCallback(() => {
    api.get('/prospects/call-list/stats?days=30').then(({ data }) => setStats(data)).catch(() => setStats(null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { data } = await api.get('/prospects/call-list');
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
    loadStats();
  }, [loadStats]);

  useEffect(() => { load(); }, [load]);

  const open = (row: Row) => {
    if (openId === row.id) { setOpenId(null); return; }
    setOpenId(row.id);
    setOutcome(null);
    setObjection(null);
    setNote('');
    setCallbackAt('');
    setHistory([]);
    api.get(`/prospects/${row.id}/call-logs`)
      .then(({ data }) => setHistory(Array.isArray(data?.data) ? data.data : []))
      .catch(() => { /* l'historique est un confort : la saisie reste possible sans lui */ });
  };

  /** Le téléphone compose depuis le lien ; on ouvre la fiche pour que l'issue se note au retour. */
  const onDial = (row: Row) => { if (openId !== row.id) open(row); };

  const removeFromList = async (row: Row) => {
    setRows(rs => rs.filter(r => r.id !== row.id));
    try {
      await api.post(`/prospects/${row.id}/call-list`, { inList: false });
    } catch {
      toast('La fiche n’a pas pu être retirée.', 'error');
      load();
    }
  };

  const save = async (row: Row) => {
    if (!outcome || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/prospects/${row.id}/call-logs`, {
        outcome,
        objection: outcome === 'refused' ? objection : null,
        note: note.trim() || null,
        callbackAt: outcome === 'callback' && callbackAt ? new Date(callbackAt).toISOString() : null,
      });
      toast(`${OUTCOME_LABEL[outcome]} · ${row.businessName}`);
      if (data?.removedFromList) {
        setRows(rs => rs.filter(r => r.id !== row.id));
        setOpenId(null);
      } else {
        setRows(rs => rs.map(r => (r.id === row.id
          ? { ...r, lastLog: data.log, logCount: r.logCount + 1, callAttempts: r.callAttempts + 1, nextActionDate: data.log.callbackAt }
          : r)));
        setHistory(h => [data.log, ...h]);
        setOutcome(null);
        setObjection(null);
        setNote('');
        setCallbackAt('');
      }
      loadStats();
    } catch (e: any) {
      toast(e?.response?.data?.error === 'invalid_callback' ? 'La date de rappel n’est pas lisible.' : 'L’appel n’a pas pu être consigné.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* Un objet STABLE : la feuille d'envoi se réinitialise quand sa cible change,
     et une cible recréée à chaque rendu effacerait la saisie en cours. */
  const outreachTarget = useMemo(() => (outreach ? {
    id: outreach.row.id,
    businessName: outreach.row.businessName,
    email: outreach.row.email ?? undefined,
    phone: outreach.row.phone ?? undefined,
    city: outreach.row.city ?? undefined,
  } : null), [outreach]);

  const maxWindow = Math.max(0, ...(stats?.byWindow ?? []).map(w => w.calls));
  const maxObjection = Math.max(0, ...(stats?.byObjection ?? []).map(o => o.count));
  const maxNiche = Math.max(0, ...(stats?.byNiche ?? []).map(n => n.calls));

  return (
    <div className="space-y-6 max-w-[1100px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="À appeler"
        subtitle="Vos prospects choisis, et ce que chaque appel a donné."
        right={
          <div className="flex items-center gap-2">
            <GhostBtn size="sm" onClick={() => navigate('/admin/leads')}><Search size={12} /> Chercher des prospects</GhostBtn>
            <IconBtn onClick={load} title="Actualiser"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></IconBtn>
          </div>
        }
      />

      {/* ── La file ── */}
      <section>
        <SectionHead title={rows.length ? `${rows.length} à appeler` : 'La liste'} />
        <Card>
          {loading ? (
            <div className="py-16 grid place-items-center"><Loader2 size={18} className="animate-spin" style={{ color: pro.textTer }} /></div>
          ) : failed ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[13.5px]" style={{ color: pro.text }}>La liste n’a pas pu être chargée.</p>
              <div className="mt-4 inline-block"><GhostBtn size="sm" onClick={load}>Réessayer</GhostBtn></div>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[14px] font-medium" style={{ color: pro.text }}>Aucun prospect dans la liste.</p>
              <p className="text-[12.5px] mt-1.5 max-w-[26rem] mx-auto leading-relaxed" style={{ color: pro.textSec }}>
                Dans la recherche, le bouton « + » d’une ligne l’ajoute ici. Préparez quarante fiches d’une même commune avant une séance.
              </p>
              <div className="mt-5 inline-block"><PrimaryBtn size="sm" onClick={() => navigate('/admin/leads')}><Search size={12} /> Chercher des prospects</PrimaryBtn></div>
            </div>
          ) : (
            <ul>
              {rows.map(row => {
                const href = telHref(row.phone);
                const isOpen = openId === row.id;
                const due = row.nextActionDate ? new Date(row.nextActionDate) : null;
                return (
                  <li key={row.id} className="border-b last:border-0" style={{ borderColor: pro.border }}>
                    {/* En étroit, le nom prend sa ligne et les boutons passent dessous : un nom coupé à dix lettres ne dit pas qui on appelle. */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2.5 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => open(row)}
                        aria-expanded={isOpen}
                        className="basis-full sm:basis-0 sm:flex-1 min-w-0 text-left flex items-center gap-3"
                      >
                        <ChevronDown
                          size={14}
                          className="flex-shrink-0 transition-transform duration-150 ease-out"
                          style={{ color: pro.textTer, transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                        />
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-medium truncate" style={{ color: pro.text }}>{row.businessName}</span>
                          <span className="block text-[11.5px] truncate" style={{ color: pro.textTer }}>
                            {[
                              row.city,
                              row.phone,
                              row.logCount ? `${row.logCount} appel${row.logCount > 1 ? 's' : ''}` : 'jamais appelé',
                              due ? `rappeler ${format(due, "EEEE d MMM 'à' HH'h'mm", { locale: fr })}` : null,
                            ].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>

                      {row.lastLog && (
                        <span className="hidden sm:inline-flex">
                          <Pill color={OUTCOME_COLOR[row.lastLog.outcome] ?? 'neutral'}>{OUTCOME_LABEL[row.lastLog.outcome] ?? row.lastLog.outcome}</Pill>
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto pl-[26px] sm:pl-0">
                        {href ? (
                          <a href={href} onClick={() => onDial(row)} title={`Appeler ${row.phone}`} aria-label={`Appeler ${row.businessName}`}
                             className={iconBtn} style={{ ...iconBtnStyle, borderColor: pro.accentBrd, color: pro.accentHi }}>
                            <Phone size={14} />
                          </a>
                        ) : (
                          <span className={`${iconBtn} opacity-30`} title="Pas de numéro" style={iconBtnStyle}><Phone size={14} /></span>
                        )}
                        <button type="button" onClick={() => setOutreach({ row, channel: 'email' })} title="Écrire un mail"
                                aria-label={`Écrire un mail à ${row.businessName}`} className={iconBtn} style={{ ...iconBtnStyle, opacity: row.email ? 1 : 0.45 }}>
                          <Mail size={14} />
                        </button>
                        <button type="button" onClick={() => setOutreach({ row, channel: 'sms' })} title="Envoyer un SMS"
                                aria-label={`Envoyer un SMS à ${row.businessName}`} className={iconBtn} style={iconBtnStyle}>
                          <MessageSquare size={14} />
                        </button>
                        <button type="button" onClick={() => removeFromList(row)} title="Retirer de la liste"
                                aria-label={`Retirer ${row.businessName} de la liste`} className={iconBtn} style={{ ...iconBtnStyle, color: pro.textTer }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="px-4 pb-5 pt-1 sm:pl-11 space-y-4">
                        <div>
                          <p className="text-[11.5px] mb-2" style={{ color: pro.textSec }}>Qu’a donné l’appel ?</p>
                          <div className="flex flex-wrap gap-1.5">
                            {OUTCOMES.map(o => {
                              const selected = outcome === o.key;
                              return (
                                <button
                                  key={o.key}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => setOutcome(selected ? null : o.key)}
                                  className="h-8 px-3 rounded-lg text-[12.5px] transition-colors"
                                  style={{
                                    background: selected ? pro.accentDim : 'rgba(255,255,255,0.04)',
                                    color: selected ? pro.accentHi : pro.textSec,
                                    border: `1px solid ${selected ? pro.accentBrd : pro.border}`,
                                  }}
                                >
                                  {o.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {outcome === 'refused' && (
                          <div>
                            <p className="text-[11.5px] mb-2" style={{ color: pro.textSec }}>Pour quelle raison ?</p>
                            <div className="flex flex-wrap gap-1.5">
                              {OBJECTIONS.map(o => {
                                const selected = objection === o.key;
                                return (
                                  <button
                                    key={o.key}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => setObjection(selected ? null : o.key)}
                                    className="h-8 px-3 rounded-lg text-[12.5px] transition-colors"
                                    style={{
                                      background: selected ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
                                      color: selected ? pro.text : pro.textSec,
                                      border: `1px solid ${selected ? pro.borderHi : pro.border}`,
                                    }}
                                  >
                                    {o.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {outcome === 'callback' && (
                          <div>
                            <label htmlFor={`callback-${row.id}`} className="block text-[11.5px] mb-1.5" style={{ color: pro.textSec }}>Quand rappeler</label>
                            <input
                              id={`callback-${row.id}`}
                              type="datetime-local"
                              value={callbackAt}
                              onChange={e => setCallbackAt(e.target.value)}
                              className="h-10 px-3 rounded-xl text-[13.5px] outline-none"
                              style={{ ...fieldStyle, colorScheme: 'dark' }}
                            />
                          </div>
                        )}

                        {outcome === 'do_not_call' && (
                          <p className="text-[12.5px] leading-relaxed" style={{ color: pro.textSec }}>
                            Cette fiche ne sera plus jamais appelée ni écrite, y compris par les envois automatiques.
                          </p>
                        )}

                        <div>
                          <label htmlFor={`note-${row.id}`} className="block text-[11.5px] mb-1.5" style={{ color: pro.textSec }}>
                            Note <span style={{ color: pro.textTer }}>(ses mots, ce qui a accroché, ce qui a bloqué)</span>
                          </label>
                          <textarea
                            id={`note-${row.id}`}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2.5 rounded-xl text-[13.5px] leading-relaxed outline-none resize-y"
                            style={fieldStyle}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => save(row)}
                          disabled={!outcome || saving}
                          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-[12.5px] font-medium transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
                          style={{ background: pro.accent, color: '#fff' }}
                        >
                          {saving && <Loader2 size={13} className="animate-spin" />}
                          {outcome ? 'Consigner l’appel' : 'Choisissez une issue'}
                        </button>

                        {history.length > 0 && (
                          <div className="pt-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: pro.textTer }}>Historique</p>
                            <ul className="space-y-2.5">
                              {history.map((h, i) => (
                                <li key={h.id ?? i} className="text-[12.5px] leading-relaxed">
                                  <span style={{ color: pro.text }}>{OUTCOME_LABEL[h.outcome] ?? h.outcome}</span>
                                  {h.objection && <span style={{ color: pro.textSec }}> · {OBJECTION_LABEL[h.objection] ?? h.objection}</span>}
                                  <span style={{ color: pro.textTer }}> · {formatDistanceToNow(new Date(h.createdAt), { addSuffix: true, locale: fr })}</span>
                                  {h.note && <span className="block whitespace-pre-wrap" style={{ color: pro.textSec }}>{h.note}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* ── Ce qui marche ── */}
      <section>
        <SectionHead title="Ce qui marche, sur 30 jours" />
        <Card>
          {!stats || stats.calls === 0 ? (
            <p className="px-5 py-8 text-[13px] leading-relaxed" style={{ color: pro.textSec }}>
              Rien à lire pour l’instant. Chaque appel consigné alimente cette partie : l’heure qui décroche, le refus qui revient, le métier qui répond.
            </p>
          ) : (
            <div className="p-5 space-y-6">
              <p className="text-[14px] leading-relaxed" style={{ color: pro.text }}>
                <strong className="font-semibold tabular-nums">{stats.calls}</strong> appel{stats.calls > 1 ? 's' : ''},{' '}
                <strong className="font-semibold tabular-nums">{pct(stats.reachRate)}</strong> décrochés,{' '}
                <strong className="font-semibold tabular-nums">{stats.meetings}</strong> rendez-vous
                <span style={{ color: pro.textSec }}> soit {pct(stats.meetingRate)} des appels.</span>
                {stats.calls < 200 && (
                  <span className="block text-[12.5px] mt-1" style={{ color: pro.textTer }}>
                    Encore {200 - stats.calls} appels avant de conclure quoi que ce soit sur le script, le prix ou le métier.
                  </span>
                )}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: pro.textTer }}>Par heure d’appel</p>
                  {stats.byWindow.map(w => (
                    <Bar key={w.key} label={WINDOW_LABEL[w.key] ?? w.key} value={w.calls} max={maxWindow}
                         right={w.calls ? `${w.calls} · ${pct(w.reached / w.calls)} décrochés` : '0'} />
                  ))}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: pro.textTer }}>Les refus qui reviennent</p>
                  {stats.byObjection.length === 0 ? (
                    <p className="text-[12.5px]" style={{ color: pro.textSec }}>Aucun refus motivé pour l’instant.</p>
                  ) : stats.byObjection.map(o => (
                    <Bar key={o.key} label={OBJECTION_LABEL[o.key] ?? o.key} value={o.count} max={maxObjection} right={String(o.count)} />
                  ))}
                </div>
                <div className="md:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: pro.textTer }}>Par métier</p>
                  {stats.byNiche.map(n => (
                    <Bar key={n.key} label={NICHE_LABEL[n.key] ?? n.key} value={n.calls} max={maxNiche}
                         right={`${n.calls} · ${pct(n.reached / n.calls)} décrochés · ${n.meetings} rendez-vous`} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </section>

      <OutreachSheet
        open={!!outreach}
        onClose={() => setOutreach(null)}
        target={outreachTarget}
        channel={outreach?.channel ?? 'email'}
        onSent={({ channel, to }) => toast(`${channel === 'email' ? 'Mail envoyé' : 'SMS envoyé'} à ${to}`)}
        onError={message => toast(message, 'error')}
      />
    </div>
  );
}
