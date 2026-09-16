import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, List, X, Phone, Users, ArrowUpRight, Clock, Search } from '../../components/icons';
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
 * La grille montre le CONTENU des jours (heure et nom, deux par case, puis
 * « +N »), pas seulement un compte: c'est ce qui fait qu'on lit sa semaine
 * sans cliquer. La recherche, elle, est SERVEUR et traverse les mois: une
 * recherche locale ne verrait que le mois chargé, et « aucun résultat »
 * voudrait dire « pas en septembre », ce qui est le contraire d'une réponse.
 *
 * Mouvement: les cartes du panneau entrent en décalé, le pilulier de vue
 * glisse. Rien d'autre ne bouge: un calendrier se lit, il ne danse pas.
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [contexts, setContexts] = useState<Record<string, BookingContext | 'loading' | 'error'>>({});
  const [toCancel, setToCancel] = useState<Booking | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  /** `null` = pas de recherche en cours; un tableau = les résultats servis. */
  const [results, setResults] = useState<Booking[] | null>(null);
  const [searching, setSearching] = useState(false);

  const range = useMemo(() => monthRange(month), [month]);
  const term = query.trim();
  const searchMode = term.length >= 2;

  /* Un cache par mois: changer de mois vide l'écran AU CLIC (ou remet le
     mois déjà vu, sans attendre), et la réponse du serveur ne fait que
     confirmer. Sans lui, les rendez-vous du mois précédent restaient affichés
     le temps de la requête, puis disparaissaient: un délai qui ressemblait à
     un bug (retour du 15/09/2026). */
  const cache = useRef(new Map<string, Booking[]>());

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get(`/my-dashboard/bookings?from=${range.from}&to=${range.to}&limit=500`);
      const list: Booking[] = Array.isArray(data?.data) ? data.data : [];
      cache.current.set(range.from, list);
      setBookings(list);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Les rendez-vous n’ont pas pu être chargés.');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => { void load(); }, [load]);

  /* La recherche part du SERVEUR, après une courte pause de frappe. Le jeton
     écarte une réponse arrivée après une frappe plus récente: sans lui, taper
     vite affiche le résultat de l'avant-dernière lettre. */
  const searchToken = useRef(0);
  useEffect(() => {
    if (!searchMode) {
      searchToken.current++;
      setResults(null);
      setSearching(false);
      return;
    }
    const mine = ++searchToken.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/my-dashboard/bookings?q=${encodeURIComponent(term)}&limit=50`);
        if (searchToken.current !== mine) return;
        setResults(Array.isArray(data?.data) ? data.data : []);
      } catch {
        if (searchToken.current === mine) setResults([]);
      } finally {
        if (searchToken.current === mine) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [term, searchMode]);

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = bookingDay(b);
      /* Jamais un rendez-vous hors du mois affiché, quoi que porte l'état. */
      if (!key || key < range.from || key > range.to) continue;
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.bookingTime ?? '').localeCompare(b.bookingTime ?? ''));
    return map;
  }, [bookings, range]);

  /* Les résultats, groupés par jour comme le panneau, du plus récent au plus
     ancien: on cherche d'abord le rendez-vous qui vient, pas celui de l'an
     dernier. */
  const resultDays = useMemo(() => {
    if (!results) return [];
    const map = new Map<string, Booking[]>();
    for (const b of results) {
      const key = bookingDay(b);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.bookingTime ?? '').localeCompare(b.bookingTime ?? ''));
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [results]);

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

  /* Le mois change dans le même rendu que la liste: ce qui est à l'écran est
     toujours celui du mois affiché, jamais celui d'avant. */
  const showMonth = (next: Date) => {
    const key = monthRange(next).from;
    const held = cache.current.get(key);
    setBookings(held ?? []);
    setLoading(!held);
    setMonth(next);
    setExpanded(null);
  };
  const goMonth = (n: number) => { showMonth(addMonths(month, n)); setSelectedDay(null); };
  const goToday = () => { showMonth(firstOfMonth(new Date())); setSelectedDay(todayIso); };

  const monthCount = bookings.length;
  const subtitle = searchMode
    ? searching || !results ? 'Recherche…'
      : results.length === 0 ? `Aucun rendez-vous pour « ${term} », tous mois confondus.`
      : `${results.length} rendez-vous pour « ${term} », tous mois confondus.`
    : loading ? 'Chargement…'
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

  /* La liste du jour vient du mois par défaut, et des résultats quand on
     cherche: un résultat de novembre n'est dans aucun `byDay` de septembre. */
  const renderDayGroup = (iso: string, index: number, list?: Booking[], withYear = false) => (
    <section key={iso} aria-label={dayLabel(iso)} className="space-y-2">
      <h3 className="flex items-baseline gap-2 text-[13px] font-medium text-[#F5F5F7]">
        {dayLabel(iso)}
        {withYear && <span className="text-[12px] text-white/45 tabular-nums">{iso.slice(0, 4)}</span>}
        {iso === todayIso && <span className="text-[11px] text-[#7349fe]">Aujourd’hui</span>}
      </h3>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {(list ?? byDay.get(iso) ?? []).map((b, i) => renderCard(b, index + i))}
        </AnimatePresence>
      </ul>
    </section>
  );

  return (
    <main className="max-w-[1600px] space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight text-white/90">Rendez-vous</h1>
        <p className="mt-1 text-[12.5px] text-white/50" aria-live="polite">{subtitle}</p>
      </header>

      {/* La barre d'outils vit AU-DESSUS du calendrier, pas à côté du titre:
          la recherche porte la largeur de l'agenda (elle prend ce qui reste),
          le mois et la vue se rangent à droite, au-dessus du panneau. */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Client, sujet ou numéro"
              aria-label="Rechercher un rendez-vous par client, sujet ou numéro"
              /* Pas d'anneau mauve au clic: la barre fait toute la largeur, un
                 contour de couleur sur cette longueur tire l'œil hors du
                 calendrier, qui est ce qu'on vient lire. */
              className="h-10 w-full rounded-full border border-white/[0.08] bg-white/[0.03] pl-10 pr-9 text-[13px] text-white placeholder:text-white/35 outline-none focus:border-white/[0.16] focus:bg-white/[0.05] transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-white/45 hover:bg-white/[0.08] hover:text-white active:scale-[0.97] transition-colors"
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>
          {/* Le mois et la vue n'ont plus de sens pendant une recherche, qui
              traverse les mois: des boutons inertes valent moins que rien. */}
          {!searchMode && <>
          <div className="flex items-center rounded-full border border-white/[0.08] bg-white/[0.03]">
            <button type="button" onClick={() => goMonth(-1)} aria-label="Mois précédent" className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:text-white active:scale-[0.97] transition-colors"><ChevronLeft size={15} /></button>
            <span className="min-w-[132px] text-center text-[13px] font-medium text-[#F5F5F7]" aria-live="polite">{monthLabel(month)}</span>
            <button type="button" onClick={() => goMonth(1)} aria-label="Mois suivant" className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:text-white active:scale-[0.97] transition-colors"><ChevronRight size={15} /></button>
          </div>
          <button type="button" onClick={goToday} className="h-10 rounded-full bg-white/[0.06] px-4 text-[12.5px] text-white hover:bg-white/[0.1] active:scale-[0.97] transition-colors">Aujourd’hui</button>
          <div role="group" aria-label="Affichage" className="relative flex h-10 items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
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
                  className={`relative z-[1] flex h-8 w-9 items-center justify-center rounded-full transition-colors ${active ? 'text-[#0E0F11]' : 'text-white/60 hover:text-white'}`}
                >
                  {active && <motion.span layoutId={reduced ? undefined : 'view-pill'} className="absolute inset-0 rounded-full bg-white" transition={{ duration: 0.22, ease: EASE }} aria-hidden="true" />}
                  <Icon size={14} className="relative" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          </>}
      </div>

      {error && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
          <p className="text-sm text-white/60" role="alert">{error}</p>
          <button type="button" onClick={load} className="mt-3 h-9 rounded-full bg-white/[0.06] px-4 text-sm text-white hover:bg-white/[0.1] transition-colors">Réessayer</button>
        </div>
      )}
      {problem && <p className="text-[12.5px] text-red-400" role="alert">{problem}</p>}

      {searchMode ? (
        <section aria-label={`Résultats pour ${term}`} className="space-y-6">
          {searching && !results && <p className="text-[13px] text-white/50">Recherche…</p>}
          {results && results.length === 0 && !searching && (
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-10 text-center">
              <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05]">
                <Search size={16} className="text-white/60" aria-hidden="true" />
              </span>
              {/* Le compte est déjà dit sous le titre: cette carte explique
                  seulement CE QUI a été cherché, elle ne le redit pas. */}
              <p className="text-[13.5px] text-white/70">Rien trouvé.</p>
              <p className="mt-1 text-[12.5px] text-white/45">La recherche lit tous les mois, sur le nom du client, le sujet et le numéro.</p>
            </section>
          )}
          <div className="grid gap-x-6 gap-y-6 lg:grid-cols-2">
            {resultDays.map(([iso, list], i) => (
              <div key={iso}>{renderDayGroup(iso, i * 3, list, iso.slice(0, 4) !== String(new Date().getFullYear()))}</div>
            ))}
          </div>
        </section>
      ) : (
      <div className={view === 'grid' ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]' : ''}>
        {view === 'grid' ? (
          <section aria-label={`Calendrier, ${monthLabel(month)}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 sm:p-4">
            <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
              {WEEKDAYS_FR.map(d => (
                <div key={d} className="rounded-lg bg-white/[0.04] py-1 text-center text-[11px] uppercase tracking-wider text-white/50">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="grid">
              {cells.map(cell => {
                const dayBookings = byDay.get(cell.iso) ?? [];
                const count = dayBookings.length;
                const selected = selectedDay === cell.iso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    role="gridcell"
                    aria-selected={selected}
                    aria-label={`${dayLabel(cell.iso)}${count ? `, ${count} rendez-vous` : ''}`}
                    onClick={() => { setSelectedDay(selected ? null : cell.iso); setExpanded(null); }}
                    className={`relative flex h-24 flex-col items-stretch overflow-hidden rounded-2xl p-2 text-left transition-colors xl:h-28
                      ${cell.inMonth ? 'bg-white/[0.04] hover:bg-white/[0.07]' : 'bg-white/[0.015] text-white/30'}
                      ${selected ? 'ring-1 ring-[#7349fe]/60 bg-[#7349fe]/[0.12]' : ''}
                      active:scale-[0.98]`}
                    style={{ borderRadius: 16 }}
                  >
                    <span className={`px-0.5 text-[12.5px] tabular-nums ${cell.isToday ? 'font-semibold text-[#7349fe]' : cell.inMonth ? 'text-white/85' : 'text-white/30'}`}>
                      {cell.day}
                    </span>
                    {/* Le CONTENU du jour, pas son compte: deux rendez-vous
                        lisibles valent mieux qu'une pastille à ouvrir. */}
                    {count > 0 && (
                      <span className="mt-1 flex min-w-0 flex-col gap-1" aria-hidden="true">
                        {dayBookings.slice(0, 2).map(b => (
                          <span key={b.id} className="flex min-w-0 items-baseline gap-1 rounded-md bg-[#7349fe]/[0.16] px-1.5 py-[3px] text-[10.5px] leading-tight">
                            <span className="shrink-0 font-semibold tabular-nums text-[#b9a6ff]">{b.bookingTime ?? '—'}</span>
                            <span className="truncate text-white/85">{b.customerName}</span>
                          </span>
                        ))}
                        {count > 2 && (
                          <span className="pl-1 text-[10.5px] text-white/45">+{count - 2} autre{count - 2 > 1 ? 's' : ''}</span>
                        )}
                      </span>
                    )}
                  </button>
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
      )}

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
