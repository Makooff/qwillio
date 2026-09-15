import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, List, X, Phone, Users, ArrowUpRight, Clock } from '../../components/icons';
import api from '../../services/api';
import { invalidateLive } from '../../services/liveData';
import ConfirmDialog from '../../components/client-dashboard/ConfirmDialog';
import { formatPhone, formatDateTime } from '../../utils/format';
import { WEEKDAYS_FR, monthGrid, monthRange, monthLabel, isoDay, dayLabel, addMonths, firstOfMonth } from '../../utils/month-grid';

/**
 * Les rendez-vous, en calendrier (15/09/2026).
 *
 * La liste plate d'avant disait « qui, quand », et s'arrêtait là. Un
 * rendez-vous est pourtant la porte vers tout ce que le portail sait de
 * l'appelant: ses appels, son lead, sa mémoire d'appelant, ses autres
 * rendez-vous. La grille du mois porte un compte par jour; un jour choisi
 * ouvre ses rendez-vous dans le panneau; un rendez-vous déplié va chercher
 * ce contexte et mène aux pages Appels et Leads filtrées sur ce numéro.
 *
 * Mouvement: le compte d'un jour grossit au centre de la case au survol
 * (même `layoutId`, Framer fait le trajet), les cartes du panneau entrent en
 * décalé. Rien d'autre ne bouge: un calendrier se lit, il ne danse pas.
 * `useReducedMotion` coupe les trajets.
 */

interface Booking {
  id: string;
  customerName: string;
  customerPhone: string | null;
  bookingDate: string;
  bookingTime: string | null;
  serviceType: string | null;
  status: string;
}

interface CallLite {
  id: string;
  callerName: string | null;
  createdAt: string;
  durationSeconds: number | null;
  summary: string | null;
  isLead: boolean;
  leadScore: number | null;
}

interface BookingContext {
  caller: { knownName: string | null; totalCalls: number; lastCallAt: string | null; lastSummary: string | null } | null;
  calls: CallLite[];
  lead: (CallLite & { tags?: string[] }) | null;
  otherBookings: Array<{ id: string; bookingDate: string; bookingTime: string | null; serviceType: string | null; status: string }>;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/** La clé de jour d'un rendez-vous, dans le fuseau du navigateur. */
function bookingDay(b: Booking): string {
  const d = new Date(b.bookingDate);
  return Number.isNaN(d.getTime()) ? '' : isoDay(d);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function ClientBookings({ initialMonth }: { initialMonth?: Date } = {}) {
  const reduced = useReducedMotion();
  const [month, setMonth] = useState<Date>(() => firstOfMonth(initialMonth ?? new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [contexts, setContexts] = useState<Record<string, BookingContext | 'loading' | 'error'>>({});
  const [toCancel, setToCancel] = useState<Booking | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const range = useMemo(() => monthRange(month), [month]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get(`/my-dashboard/bookings?from=${range.from}&to=${range.to}&limit=500`);
      setBookings(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Les rendez-vous n’ont pas pu être chargés.');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => { void load(); }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = bookingDay(b);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.bookingTime ?? '').localeCompare(b.bookingTime ?? ''));
    return map;
  }, [bookings]);

  const cells = useMemo(() => monthGrid(month), [month]);
  const todayIso = isoDay(new Date());

  /* Sans jour choisi, le panneau montre ce qui vient: le reste du mois à
     partir d'aujourd'hui, ou tout le mois s'il est passé ou à venir. */
  const panelDays = useMemo(() => {
    const keys = Array.from(byDay.keys()).sort();
    if (selectedDay) return keys.filter(k => k === selectedDay);
    const inMonthToday = todayIso >= range.from && todayIso <= range.to;
    return inMonthToday ? keys.filter(k => k >= todayIso) : keys;
  }, [byDay, selectedDay, todayIso, range]);

  const openContext = async (b: Booking) => {
    if (expanded === b.id) { setExpanded(null); return; }
    setExpanded(b.id);
    if (contexts[b.id]) return;
    setContexts(prev => ({ ...prev, [b.id]: 'loading' }));
    try {
      const { data } = await api.get(`/my-dashboard/bookings/${b.id}/context`);
      setContexts(prev => ({ ...prev, [b.id]: data as BookingContext }));
    } catch {
      setContexts(prev => ({ ...prev, [b.id]: 'error' }));
    }
  };

  const cancel = async () => {
    if (!toCancel) return;
    const target = toCancel;
    setToCancel(null);
    setBusy(target.id);
    setProblem(null);
    try {
      await api.post(`/my-dashboard/bookings/${target.id}/cancel`);
      setBookings(list => list.filter(b => b.id !== target.id));
      if (expanded === target.id) setExpanded(null);
      invalidateLive('/my-dashboard/');
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setProblem(msg || 'L’annulation a échoué. Réessayez.');
    } finally {
      setBusy(null);
    }
  };

  const goMonth = (n: number) => { setMonth(m => addMonths(m, n)); setSelectedDay(null); setExpanded(null); };
  const goToday = () => { setMonth(firstOfMonth(new Date())); setSelectedDay(todayIso); setExpanded(null); };

  const monthCount = bookings.length;
  const subtitle = loading ? 'Chargement…'
    : monthCount === 0 ? `Aucun rendez-vous en ${monthLabel(month).toLowerCase()}.`
    : `${monthCount} rendez-vous en ${monthLabel(month).toLowerCase()}, pris par votre réceptionniste ou déplacés par vos appelants.`;

  const renderCard = (b: Booking, index: number) => {
    const ctx = contexts[b.id];
    const open = expanded === b.id;
    const digits = (b.customerPhone ?? '').replace(/\D/g, '');
    return (
      <motion.li
        key={b.id}
        layout={!reduced}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: EASE, delay: reduced ? 0 : Math.min(index, 6) * 0.04 }}
        className={`rounded-2xl border ${open ? 'border-[#7349fe]/40 bg-[#7349fe]/[0.06]' : 'border-white/[0.07] bg-white/[0.02]'} transition-colors`}
      >
        <button
          type="button"
          onClick={() => void openContext(b)}
          aria-expanded={open}
          className="flex w-full items-start gap-4 px-4 py-3.5 text-left active:scale-[0.99]"
        >
          <span className="w-12 shrink-0 pt-0.5 text-[15px] font-semibold tabular-nums text-[#F5F5F7]">{b.bookingTime ?? '—'}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-[#F5F5F7]">{b.customerName}</span>
            <span className="block truncate text-[12px] text-[#A1A1A8]">
              {[b.serviceType, b.customerPhone ? formatPhone(b.customerPhone) : null].filter(Boolean).join(' · ') || 'Sans précision'}
            </span>
          </span>
          <ChevronRight size={14} className={`mt-1 shrink-0 text-white/40 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="ctx"
              initial={reduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduced ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="space-y-4 border-t border-white/[0.06] px-4 pb-4 pt-3">
                {ctx === 'loading' || !ctx ? (
                  <p className="text-[12px] text-white/45">Lecture de la fiche…</p>
                ) : ctx === 'error' ? (
                  <p className="text-[12px] text-red-400" role="alert">La fiche n’a pas pu être lue.</p>
                ) : (
                  <>
                    <section aria-label="Cet appelant">
                      <h4 className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45"><Users size={12} aria-hidden="true" /> Cet appelant</h4>
                      {ctx.caller ? (
                        <p className="text-[12.5px] text-white/75">
                          {ctx.caller.knownName ? <span className="text-[#F5F5F7]">{ctx.caller.knownName}</span> : 'Connu'}
                          {' · '}{ctx.caller.totalCalls} appel{ctx.caller.totalCalls > 1 ? 's' : ''}
                          {ctx.caller.lastCallAt ? `, dernier le ${shortDate(ctx.caller.lastCallAt)}` : ''}
                          {ctx.caller.lastSummary ? <span className="block text-white/55">{ctx.caller.lastSummary}</span> : null}
                        </p>
                      ) : (
                        <p className="text-[12.5px] text-white/55">Premier contact, aucune mémoire d’appelant.</p>
                      )}
                    </section>

                    <section aria-label="Lead">
                      <h4 className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45"><Clock size={12} aria-hidden="true" /> Lead</h4>
                      {ctx.lead ? (
                        <p className="text-[12.5px] text-white/75">
                          {ctx.lead.summary || 'Lead qualifié'}{typeof ctx.lead.leadScore === 'number' ? ` · score ${ctx.lead.leadScore}` : ''}
                        </p>
                      ) : (
                        <p className="text-[12.5px] text-white/55">Aucun lead qualifié sur ce numéro.</p>
                      )}
                    </section>

                    <section aria-label="Appels">
                      <h4 className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45"><Phone size={12} aria-hidden="true" /> Appels ({ctx.calls.length})</h4>
                      {ctx.calls.length === 0 ? (
                        <p className="text-[12.5px] text-white/55">Aucun appel enregistré sur ce numéro.</p>
                      ) : (
                        <ul className="space-y-1">
                          {ctx.calls.slice(0, 3).map(c => (
                            <li key={c.id} className="text-[12.5px] text-white/70">
                              <span className="tabular-nums text-white/45">{formatDateTime(c.createdAt)}</span>
                              {c.summary ? <span className="ml-2">{c.summary}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {ctx.otherBookings.length > 0 && (
                      <section aria-label="Autres rendez-vous">
                        <h4 className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45"><Calendar size={12} aria-hidden="true" /> Autres rendez-vous</h4>
                        <ul className="space-y-0.5">
                          {ctx.otherBookings.slice(0, 3).map(o => (
                            <li key={o.id} className="text-[12.5px] text-white/70">
                              {dayLabel(isoDay(new Date(o.bookingDate)))}{o.bookingTime ? ` à ${o.bookingTime}` : ''}{o.serviceType ? ` · ${o.serviceType}` : ''}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {digits && (
                    <>
                      <Link to={`/dashboard/calls?phone=${digits}`} className="inline-flex h-8 items-center gap-1 rounded-full bg-white/[0.06] px-3 text-[12px] text-white hover:bg-white/[0.1] transition-colors">
                        Tous ses appels <ArrowUpRight size={12} aria-hidden="true" />
                      </Link>
                      <Link to={`/dashboard/leads?phone=${digits}`} className="inline-flex h-8 items-center gap-1 rounded-full bg-white/[0.06] px-3 text-[12px] text-white hover:bg-white/[0.1] transition-colors">
                        Voir le lead <ArrowUpRight size={12} aria-hidden="true" />
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setToCancel(b)}
                    disabled={busy === b.id}
                    aria-label={`Annuler le rendez-vous de ${b.customerName}`}
                    className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.1] px-3 text-[12px] text-white/75 hover:bg-red-500/[0.08] hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-50 active:scale-[0.97]"
                  >
                    <X size={12} aria-hidden="true" /> {busy === b.id ? 'Annulation…' : 'Annuler'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.li>
    );
  };

  const renderDayGroup = (iso: string, index: number) => (
    <section key={iso} aria-label={dayLabel(iso)} className="space-y-2">
      <h3 className="flex items-baseline gap-2 text-[13px] font-medium text-[#F5F5F7]">
        {dayLabel(iso)}
        {iso === todayIso && <span className="text-[11px] text-[#7349fe]">Aujourd’hui</span>}
      </h3>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {(byDay.get(iso) ?? []).map((b, i) => renderCard(b, index + i))}
        </AnimatePresence>
      </ul>
    </section>
  );

  return (
    <main className="max-w-[1320px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white/90">Rendez-vous</h1>
          <p className="mt-1 text-[12.5px] text-white/50">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-white/[0.08] bg-white/[0.03]">
            <button type="button" onClick={() => goMonth(-1)} aria-label="Mois précédent" className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:text-white active:scale-[0.97] transition-colors"><ChevronLeft size={15} /></button>
            <span className="min-w-[132px] text-center text-[13px] font-medium text-[#F5F5F7]" aria-live="polite">{monthLabel(month)}</span>
            <button type="button" onClick={() => goMonth(1)} aria-label="Mois suivant" className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:text-white active:scale-[0.97] transition-colors"><ChevronRight size={15} /></button>
          </div>
          <button type="button" onClick={goToday} className="h-9 rounded-full bg-white/[0.06] px-3.5 text-[12.5px] text-white hover:bg-white/[0.1] active:scale-[0.97] transition-colors">Aujourd’hui</button>
          <div role="group" aria-label="Affichage" className="relative flex h-9 items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
            {(['grid', 'list'] as const).map(v => {
              const Icon = v === 'grid' ? Calendar : List;
              const active = view === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={active}
                  aria-label={v === 'grid' ? 'Vue calendrier' : 'Vue liste'}
                  className={`relative z-[1] flex h-7 w-8 items-center justify-center rounded-full transition-colors ${active ? 'text-[#0E0F11]' : 'text-white/60 hover:text-white'}`}
                >
                  {active && <motion.span layoutId={reduced ? undefined : 'view-pill'} className="absolute inset-0 rounded-full bg-white" transition={{ duration: 0.22, ease: EASE }} aria-hidden="true" />}
                  <Icon size={14} className="relative" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
          <p className="text-sm text-white/60" role="alert">{error}</p>
          <button type="button" onClick={load} className="mt-3 h-9 rounded-full bg-white/[0.06] px-4 text-sm text-white hover:bg-white/[0.1] transition-colors">Réessayer</button>
        </div>
      )}
      {problem && <p className="text-[12.5px] text-red-400" role="alert">{problem}</p>}

      <div className={view === 'grid' ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]' : ''}>
        {view === 'grid' ? (
          <section aria-label={`Calendrier, ${monthLabel(month)}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 sm:p-4">
            <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
              {WEEKDAYS_FR.map(d => (
                <div key={d} className="rounded-lg bg-white/[0.04] py-1 text-center text-[11px] uppercase tracking-wider text-white/50">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="grid">
              {cells.map(cell => {
                const count = byDay.get(cell.iso)?.length ?? 0;
                const selected = selectedDay === cell.iso;
                const hovered = hoveredDay === cell.iso && count > 0;
                return (
                  <motion.button
                    key={cell.iso}
                    type="button"
                    role="gridcell"
                    aria-selected={selected}
                    aria-label={`${dayLabel(cell.iso)}${count ? `, ${count} rendez-vous` : ''}`}
                    onClick={() => { setSelectedDay(selected ? null : cell.iso); setExpanded(null); }}
                    onMouseEnter={() => setHoveredDay(cell.iso)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onFocus={() => setHoveredDay(cell.iso)}
                    onBlur={() => setHoveredDay(null)}
                    className={`relative flex h-14 items-start justify-start rounded-2xl p-2 text-left transition-colors sm:h-16
                      ${cell.inMonth ? 'bg-white/[0.04] hover:bg-white/[0.07]' : 'bg-white/[0.015] text-white/30'}
                      ${selected ? 'ring-1 ring-[#7349fe]/60 bg-[#7349fe]/[0.12]' : ''}
                      active:scale-[0.98]`}
                    style={{ borderRadius: 16 }}
                  >
                    <span className={`text-[12.5px] tabular-nums ${cell.isToday ? 'font-semibold text-[#7349fe]' : cell.inMonth ? 'text-white/85' : 'text-white/30'}`}>
                      {cell.day}
                    </span>
                    {count > 0 && (
                      <motion.span
                        layoutId={reduced ? undefined : `count-${cell.iso}`}
                        className="absolute bottom-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-[#7349fe] text-[10px] font-bold text-white"
                        style={{ borderRadius: 999 }}
                        aria-hidden="true"
                      >
                        {count}
                      </motion.span>
                    )}
                    <AnimatePresence>
                      {hovered && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                          <motion.span
                            layoutId={reduced ? undefined : `count-${cell.iso}`}
                            className="flex size-9 items-center justify-center rounded-full bg-[#7349fe] text-[13px] font-bold text-white"
                            style={{ borderRadius: 999 }}
                            transition={{ duration: 0.22, ease: EASE }}
                          >
                            {count}
                          </motion.span>
                        </span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </section>
        ) : (
          <section aria-label={`Liste, ${monthLabel(month)}`} className="space-y-6">
            {!loading && !error && bookings.length === 0 && (
              <EmptyMonth />
            )}
            {Array.from(byDay.keys()).sort().map((iso, i) => renderDayGroup(iso, i * 3))}
          </section>
        )}

        {view === 'grid' && (
          <aside aria-label="Détail" className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-[#F5F5F7]">
                {selectedDay ? dayLabel(selectedDay) : 'À venir'}
              </h2>
              {selectedDay && (
                <button type="button" onClick={() => { setSelectedDay(null); setExpanded(null); }} className="text-[12px] text-white/50 hover:text-white transition-colors">Tout le mois</button>
              )}
            </div>
            {!loading && panelDays.length === 0 && (
              selectedDay
                ? <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-6 text-[13px] text-white/55">Aucun rendez-vous ce jour.</p>
                : <EmptyMonth />
            )}
            <div className="space-y-5">
              {panelDays.map((iso, i) => renderDayGroup(iso, i * 3))}
            </div>
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={toCancel !== null}
        title="Annuler ce rendez-vous ?"
        message={toCancel ? `${toCancel.customerName}, ${dayLabel(bookingDay(toCancel))}${toCancel.bookingTime ? ` à ${toCancel.bookingTime}` : ''}. Le créneau est libéré et l’événement retiré de votre agenda. L’appelant n’est pas prévenu.` : ''}
        confirmLabel="Annuler le rendez-vous"
        cancelLabel="Garder"
        variant="danger"
        onConfirm={cancel}
        onCancel={() => setToCancel(null)}
      />
    </main>
  );
}

function EmptyMonth() {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-10 text-center">
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05]">
        <Calendar size={16} className="text-white/60" aria-hidden="true" />
      </span>
      <p className="text-[13.5px] text-white/70">Rien de prévu pour l’instant.</p>
      <p className="mt-1 text-[12.5px] text-white/45">Les rendez-vous que votre réceptionniste prend au téléphone apparaîtront ici.</p>
    </section>
  );
}
