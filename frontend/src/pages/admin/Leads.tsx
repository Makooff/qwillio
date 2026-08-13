import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw, Search, X, Zap, Star, SlidersHorizontal, Bookmark,
  ClipboardList, Palette, Phone, Loader2, Copy, Check, UserPlus, Trash2,
} from '../../components/icons';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, IconBtn, PrimaryBtn, GhostBtn, Pill } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import Pagination from '../../components/ui/Pagination';
import SlideSheet from '../../components/ui/SlideSheet';
import Modal from '../../components/ui/Modal';

/**
 * Prospection, built for calling by hand.
 *
 * One search box over the leads already collected — instant and free. Scraping
 * for new businesses is a separate, explicit button, because that one costs
 * money on every press.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  businessName: string;
  niche?: string;
  businessType?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  googleRating?: number | string;
  googleReviewsCount?: number;
  score: number;
  priorityScore: number;
  interestLevel?: number;
  status: string;
  callAttempts: number;
  createdAt: string;
  lastContactDate?: string;
  isFavorite?: boolean;
}

interface SavedSearch {
  id: string;
  name: string;
  filters: Record<string, string>;
  lastProspectId?: string | null;
}

interface Brief {
  id: string;
  businessName: string;
  niche?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  contactName?: string;
  google: { rating?: number | string; reviews?: number };
  score: number;
  priorityScore: number;
  interestLevel?: number;
  status: string;
  website_signals: Record<string, unknown> & { scraped?: boolean; techStack?: string[] };
  talkingPoints: string[];
  painPoints: string[];
  notes?: string;
  lastContactDate?: string;
  callAttempts: number;
  hasScript: boolean;
}

interface Script {
  intro: string; painPoint: string; pitch: string; cta: string;
  objectionHandlers: Record<string, string>; rawFull: string;
}

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMIT = 30;

const NICHES = [
  { value: 'financial', label: 'Comptable / Fiduciaire' },
  { value: 'home_services', label: 'Services à domicile' },
  { value: 'dental', label: 'Dentaire' },
  { value: 'medical', label: 'Médical' },
  { value: 'law', label: 'Avocat / Notaire' },
  { value: 'auto', label: 'Garage auto' },
  { value: 'salon', label: 'Coiffure / Beauté' },
  { value: 'real_estate', label: 'Immobilier' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'veterinary', label: 'Vétérinaire' },
];

const SCRAPE_CITIES: Record<string, string[]> = {
  BE: ['Bruxelles', 'Anvers', 'Gand', 'Liège', 'Namur', 'Charleroi', 'Bruges'],
  FR: ['Paris', 'Lyon', 'Marseille', 'Lille', 'Toulouse', 'Bordeaux', 'Nantes'],
};

const SORTS = [
  { value: 'priorityScore:desc', label: 'Score le plus élevé' },
  { value: 'googleRating:desc', label: 'Meilleure note Google' },
  { value: 'googleReviewsCount:desc', label: 'Plus d’avis' },
  { value: 'createdAt:desc', label: 'Ajoutés récemment' },
  { value: 'businessName:asc', label: 'Nom (A→Z)' },
  { value: 'lastContactDate:asc', label: 'Pas appelés depuis longtemps' },
];

const PLAN_OPTIONS = [
  { key: 'solo', label: 'Solo — 99 €/mois' },
  { key: 'starter', label: 'Starter — 249 €/mois' },
  { key: 'pro', label: 'Pro — 599 €/mois' },
  { key: 'enterprise', label: 'Enterprise — 1290 €/mois' },
];

const STATUSES = [
  { value: 'all', label: 'Tous' },
  { value: 'new', label: 'Jamais appelés' },
  { value: 'contacted', label: 'Déjà appelés' },
  { value: 'hot_lead', label: 'Chauds' },
  { value: 'converted', label: 'Convertis' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string): PillColor {
  switch (s?.toLowerCase()) {
    case 'hot_lead': return 'ok';
    case 'converted': return 'accent';
    case 'contacted': return 'info';
    default: return 'neutral';
  }
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    new: 'Nouveau', contacted: 'Appelé', hot_lead: 'Chaud',
    converted: 'Client', rejected: 'Refusé', exhausted: 'Épuisé',
  };
  return map[s?.toLowerCase()] || s || '—';
}

/** Strips anything a dialer would choke on, keeping a leading +. */
function telHref(phone?: string): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^\d+]/g, '');
  return clean.length >= 6 ? `tel:${clean}` : null;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 px-3.5 text-[12px] font-medium rounded-xl transition-colors"
      style={{
        background: active ? pro.text : pro.panel,
        color: active ? '#0B0B0D' : pro.textSec,
        border: `1px solid ${active ? pro.text : pro.border}`,
      }}
    >
      {children}
    </button>
  );
}

const selectCls = 'h-9 px-3 rounded-xl text-[12.5px] outline-none transition-colors';
const selectStyle = { background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` };

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminLeads() {
  const { toasts, add: toast, remove } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [niche, setNiche] = useState('');
  const [minInterest, setMinInterest] = useState('');
  const [status, setStatus] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const [phoneOnly, setPhoneOnly] = useState(true);
  const [sort, setSort] = useState('priorityScore:desc');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [favBusy, setFavBusy] = useState<string | null>(null);

  // Saved searches
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [savingSearch, setSavingSearch] = useState(false);

  // Scraping
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scrapeSector, setScrapeSector] = useState('financial');
  const [scrapeCountry, setScrapeCountry] = useState('BE');
  const [scrapeKeyword, setScrapeKeyword] = useState('');
  const [scraping, setScraping] = useState(false);

  // Panels
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [script, setScript] = useState<Script | null>(null);
  const [scriptFor, setScriptFor] = useState<Lead | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Conversion
  const [convertFor, setConvertFor] = useState<Lead | Brief | null>(null);
  const [convertEmail, setConvertEmail] = useState('');
  const [convertPlan, setConvertPlan] = useState('starter');
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState('');

  const firstRender = useRef(true);

  // Typing filters the leads already in the database — no API cost, no scraping.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const filters = useMemo(() => ({
    search: debounced, niche, minInterest, status, sort,
    favorite: favOnly ? 'true' : '', hasPhone: phoneOnly ? 'true' : '',
  }), [debounced, niche, minInterest, status, sort, favOnly, phoneOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    const [sortBy, sortOrder] = sort.split(':');
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), sortBy, sortOrder });
    if (debounced) params.set('search', debounced);
    if (niche) params.set('niche', niche);
    if (minInterest) params.set('minInterest', minInterest);
    if (status !== 'all') params.set('status', status);
    if (favOnly) params.set('favorite', 'true');
    if (phoneOnly) params.set('hasPhone', 'true');
    try {
      const { data } = await api.get(`/prospects?${params}`);
      setLeads(data?.data ?? []);
      setTotal(data?.pagination?.total ?? 0);
    } catch {
      toast('Impossible de charger les prospects', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, niche, minInterest, status, favOnly, phoneOnly, sort, toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setPage(1);
  }, [debounced, niche, minInterest, status, favOnly, phoneOnly, sort]);

  const loadSaved = useCallback(async () => {
    try {
      const { data } = await api.get('/prospects/saved-searches');
      setSaved(Array.isArray(data) ? data : []);
    } catch { /* saved searches are a convenience, not a requirement */ }
  }, []);
  useEffect(() => { void loadSaved(); }, [loadSaved]);

  // ─── Actions ──────────────────────────────────────────────

  const toggleFavorite = async (lead: Lead) => {
    const next = !lead.isFavorite;
    setFavBusy(lead.id);
    setLeads(ls => ls.map(l => (l.id === lead.id ? { ...l, isFavorite: next } : l)));
    try {
      await api.patch(`/prospects/${lead.id}/favorite`, { favorite: next });
    } catch {
      setLeads(ls => ls.map(l => (l.id === lead.id ? { ...l, isFavorite: !next } : l)));
      toast('Erreur favori', 'error');
    } finally {
      setFavBusy(null);
    }
  };

  /** The dialer opens from the href; this only records that it happened. */
  const markCalled = (lead: Lead) => {
    setLeads(ls => ls.map(l => (l.id === lead.id
      ? { ...l, status: l.status === 'new' ? 'contacted' : l.status, callAttempts: l.callAttempts + 1 }
      : l)));
    api.post(`/prospects/${lead.id}/touch`).catch(() => { /* the call still happened */ });
  };

  const openBrief = async (lead: Lead) => {
    setBriefLoading(true);
    setBrief({ id: lead.id, businessName: lead.businessName } as Brief);
    try {
      const { data } = await api.get(`/prospects/${lead.id}/brief`);
      setBrief(data);
    } catch {
      toast('Impossible de charger la fiche', 'error');
      setBrief(null);
    } finally {
      setBriefLoading(false);
    }
  };

  const openScript = async (lead: Lead) => {
    setScriptFor(lead);
    setScript(null);
    setScriptLoading(true);
    try {
      const { data } = await api.post(`/prospects/${lead.id}/script`);
      setScript(data.script);
    } catch {
      toast('Génération du script impossible', 'error');
      setScriptFor(null);
    } finally {
      setScriptLoading(false);
    }
  };

  const regenerateScript = async () => {
    if (!scriptFor) return;
    setScriptLoading(true);
    try {
      const { data } = await api.post(`/prospects/${scriptFor.id}/script?refresh=true`);
      setScript(data.script);
      toast('Script régénéré');
    } catch {
      toast('Régénération impossible', 'error');
    } finally {
      setScriptLoading(false);
    }
  };

  const copyScript = () => {
    if (!script) return;
    navigator.clipboard.writeText(script.rawFull);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveCurrentSearch = async () => {
    const name = window.prompt('Nom de la recherche ?', debounced || niche || 'Ma recherche');
    if (!name?.trim()) return;
    setSavingSearch(true);
    try {
      await api.post('/prospects/saved-searches', { name: name.trim(), filters });
      toast('Recherche sauvegardée');
      loadSaved();
    } catch {
      toast('Sauvegarde impossible', 'error');
    } finally {
      setSavingSearch(false);
    }
  };

  const applySaved = (s: SavedSearch) => {
    const f = s.filters || {};
    setSearch(f.search || '');
    setNiche(f.niche || '');
    setMinInterest(f.minInterest || '');
    setStatus(f.status || 'all');
    setFavOnly(f.favorite === 'true');
    setPhoneOnly(f.hasPhone === 'true');
    setSort(f.sort || 'priorityScore:desc');
    setPage(1);
    toast(`« ${s.name} » restaurée`);
  };

  const deleteSaved = async (s: SavedSearch) => {
    try {
      await api.delete(`/prospects/saved-searches/${s.id}`);
      setSaved(list => list.filter(x => x.id !== s.id));
    } catch {
      toast('Suppression impossible', 'error');
    }
  };

  const runScrape = async () => {
    setScraping(true);
    try {
      await api.post('/prospecting/trigger/custom-scrape', {
        niches: [scrapeSector],
        cities: SCRAPE_CITIES[scrapeCountry],
        extraQueries: scrapeKeyword.trim() ? [scrapeKeyword.trim()] : [],
      });
      toast('Recherche lancée. Les nouveaux business apparaîtront ici dans une minute.');
      setScrapeOpen(false);
    } catch {
      toast('Le scraping a échoué', 'error');
    } finally {
      setScraping(false);
    }
  };

  const submitConvert = async () => {
    if (!convertFor) return;
    setConvertError('');
    setConverting(true);
    try {
      await api.post(`/prospects/${convertFor.id}/convert`, {
        contactEmail: convertEmail.trim(),
        planType: convertPlan,
      });
      toast(`${convertFor.businessName} est maintenant client`);
      setConvertFor(null);
      setConvertEmail('');
      setBrief(null);
      load();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setConvertError(
        status === 409 ? 'Ce prospect est déjà client.'
          : status === 400 ? 'Une adresse email est nécessaire.'
            : 'La conversion a échoué.',
      );
    } finally {
      setConverting(false);
    }
  };

  const activeFilterCount =
    (niche ? 1 : 0) + (minInterest ? 1 : 0) + (status !== 'all' ? 1 : 0) +
    (favOnly ? 1 : 0) + (!phoneOnly ? 1 : 0);

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-[1100px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Prospection"
        subtitle="Cherchez, appelez, convertissez."
        right={<IconBtn onClick={load} title="Actualiser"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></IconBtn>}
      />

      {/* One box over the leads already collected: instant, and it costs nothing. */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: pro.textTer }} />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nom, ville, téléphone…"
          aria-label="Rechercher un business"
          className="w-full h-14 pl-12 pr-12 rounded-2xl text-[15px] outline-none transition-colors"
          style={{ background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Effacer"
            className="absolute right-4 top-1/2 -translate-y-1/2"
            style={{ color: pro.textTer }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px]" style={{ color: pro.textSec }}>
          {loading ? 'Recherche…' : `${total.toLocaleString('fr-BE')} business`}
        </span>
        <span style={{ color: pro.textTer }}>·</span>
        <button
          onClick={() => setShowFilters(v => !v)}
          className="inline-flex items-center gap-1.5 text-[12.5px] transition-colors"
          style={{ color: showFilters || activeFilterCount ? pro.text : pro.textSec }}
        >
          <SlidersHorizontal size={13} />
          Filtres{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
        <span style={{ color: pro.textTer }}>·</span>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          aria-label="Trier"
          className="text-[12.5px] bg-transparent outline-none cursor-pointer"
          style={{ color: pro.textSec }}
        >
          {SORTS.map(s => <option key={s.value} value={s.value} style={{ background: pro.bg }}>{s.label}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <GhostBtn onClick={saveCurrentSearch} disabled={savingSearch}>
            <Bookmark size={13} /> Sauvegarder
          </GhostBtn>
          <PrimaryBtn onClick={() => setScrapeOpen(true)}>
            <Zap size={13} /> Chercher de nouveaux business
          </PrimaryBtn>
        </div>
      </div>

      {saved.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {saved.map(s => (
            <span key={s.id} className="inline-flex items-center rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${pro.border}`, background: pro.panel }}>
              <button onClick={() => applySaved(s)} className="h-8 pl-3 pr-2 text-[12px]" style={{ color: pro.textSec }}>
                {s.name}
              </button>
              <button onClick={() => deleteSaved(s)} aria-label={`Supprimer ${s.name}`} className="h-8 pr-2.5" style={{ color: pro.textTer }}>
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {showFilters && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 p-4">
            <select value={niche} onChange={e => setNiche(e.target.value)} className={selectCls} style={selectStyle} aria-label="Niche">
              <option value="">Toutes les niches</option>
              {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
            <select value={minInterest} onChange={e => setMinInterest(e.target.value)} className={selectCls} style={selectStyle} aria-label="Intérêt minimum">
              <option value="">Tout intérêt</option>
              <option value="5">Intérêt 5+</option>
              <option value="7">Intérêt 7+</option>
              <option value="8">Intérêt 8+</option>
            </select>
            <div className="flex flex-wrap items-center gap-2">
              {STATUSES.map(s => (
                <Chip key={s.value} active={status === s.value} onClick={() => setStatus(s.value)}>{s.label}</Chip>
              ))}
            </div>
            <Chip active={favOnly} onClick={() => setFavOnly(v => !v)}>★ Favoris</Chip>
            <Chip active={phoneOnly} onClick={() => setPhoneOnly(v => !v)}>Avec numéro</Chip>
          </div>
        </Card>
      )}

      {/* Results */}
      <Card>
        {loading ? (
          <div className="py-20 text-center"><Loader2 size={20} className=" mx-auto" style={{ color: pro.textTer }} /></div>
        ) : leads.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[14px]" style={{ color: pro.textSec }}>Aucun business ne correspond.</p>
            <button onClick={() => setScrapeOpen(true)} className="mt-3 text-[13px]" style={{ color: pro.accent }}>
              Chercher de nouveaux business
            </button>
          </div>
        ) : (
          <ul>
            {leads.map(lead => {
              const href = telHref(lead.phone);
              return (
                <li key={lead.id}
                    className="flex items-center gap-3 px-4 py-3 border-b last:border-0"
                    style={{ borderColor: pro.border }}>
                  <button
                    onClick={() => toggleFavorite(lead)}
                    disabled={favBusy === lead.id}
                    aria-label={lead.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    className="flex-shrink-0"
                  >
                    <Star size={15} fill={lead.isFavorite ? '#FCD34D' : 'none'} style={{ color: lead.isFavorite ? '#FCD34D' : pro.textTer }} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium truncate" style={{ color: pro.text }}>{lead.businessName}</p>
                    <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                      {[lead.city, lead.googleRating ? `★ ${Number(lead.googleRating).toFixed(1)}` : null,
                        lead.googleReviewsCount ? `${lead.googleReviewsCount} avis` : null,
                        lead.lastContactDate ? `appelé ${formatDistanceToNow(new Date(lead.lastContactDate), { addSuffix: true, locale: fr })}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  <Pill color={statusColor(lead.status)}>{statusLabel(lead.status)}</Pill>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Opens the dialer on the founder's own phone. */}
                    {href ? (
                      <a
                        href={href}
                        onClick={() => markCalled(lead)}
                        title={`Appeler ${lead.phone}`}
                        aria-label={`Appeler ${lead.businessName}`}
                        className="h-9 w-9 grid place-items-center rounded-xl transition-colors"
                        style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}
                      >
                        <Phone size={14} />
                      </a>
                    ) : (
                      <span className="h-9 w-9 grid place-items-center rounded-xl opacity-30"
                            title="Pas de numéro"
                            style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.textTer }}>
                        <Phone size={14} />
                      </span>
                    )}
                    <button
                      onClick={() => openBrief(lead)}
                      title="Fiche de prospection"
                      aria-label={`Fiche de ${lead.businessName}`}
                      className="h-9 w-9 grid place-items-center rounded-xl transition-colors"
                      style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}
                    >
                      <ClipboardList size={14} />
                    </button>
                    <button
                      onClick={() => openScript(lead)}
                      title="Script de vente"
                      aria-label={`Script pour ${lead.businessName}`}
                      className="h-9 w-9 grid place-items-center rounded-xl transition-colors"
                      style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}
                    >
                      <Palette size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {total > LIMIT && (
        <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
      )}

      {/* ── Brief ── */}
      <SlideSheet
        open={!!brief}
        onClose={() => setBrief(null)}
        title={brief?.businessName || ''}
        subtitle={brief?.city || undefined}
      >
        {briefLoading ? (
          <div className="py-16 text-center"><Loader2 size={18} className=" mx-auto" style={{ color: pro.textTer }} /></div>
        ) : brief && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {brief.phone && <Pill color="info">{brief.phone}</Pill>}
              {brief.email && <Pill color="neutral">{brief.email}</Pill>}
              {brief.google?.rating && <Pill color="ok">★ {Number(brief.google.rating).toFixed(1)} · {brief.google.reviews ?? 0} avis</Pill>}
              <Pill color={statusColor(brief.status)}>{statusLabel(brief.status)}</Pill>
            </div>

            {brief.website && (
              <a href={brief.website} target="_blank" rel="noreferrer noopener"
                 className="block text-[13px] truncate" style={{ color: pro.accent }}>
                {brief.website}
              </a>
            )}
            {brief.address && <p className="text-[13px]" style={{ color: pro.textSec }}>{brief.address}</p>}

            {brief.talkingPoints?.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: pro.textTer }}>
                  À dire au téléphone
                </p>
                <ul className="space-y-1.5">
                  {brief.talkingPoints.map((t, i) => (
                    <li key={i} className="text-[13px] leading-relaxed" style={{ color: pro.text }}>· {t}</li>
                  ))}
                </ul>
              </div>
            )}

            {brief.website_signals?.techStack && brief.website_signals.techStack.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: pro.textTer }}>
                  Technos détectées
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {brief.website_signals.techStack.map(t => <Pill key={t} color="neutral">{t}</Pill>)}
                </div>
              </div>
            )}

            {brief.notes && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: pro.textTer }}>Notes</p>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: pro.textSec }}>{brief.notes}</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              {telHref(brief.phone) && (
                <a href={telHref(brief.phone)!}
                   className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-medium"
                   style={{ background: pro.accent, color: '#fff' }}>
                  <Phone size={13} /> Appeler
                </a>
              )}
              <GhostBtn onClick={() => { setConvertFor(brief); setConvertEmail(brief.email || ''); setConvertError(''); }}>
                <UserPlus size={13} /> Convertir en client
              </GhostBtn>
            </div>
          </div>
        )}
      </SlideSheet>

      {/* ── Script ── */}
      <SlideSheet
        open={!!scriptFor}
        onClose={() => { setScriptFor(null); setScript(null); }}
        title={scriptFor?.businessName || ''}
        subtitle="Script de vente"
      >
        {scriptLoading ? (
          <div className="py-16 text-center">
            <Loader2 size={18} className=" mx-auto" style={{ color: pro.textTer }} />
            <p className="mt-3 text-[12.5px]" style={{ color: pro.textTer }}>Écriture du script…</p>
          </div>
        ) : script && (
          <div className="space-y-5">
            {([
              ['Accroche', script.intro],
              ['Question qui ouvre', script.painPoint],
              ['Pitch', script.pitch],
              ['Rendez-vous', script.cta],
            ] as const).map(([label, body]) => (
              <div key={label}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: pro.textTer }}>{label}</p>
                <p className="text-[13.5px] leading-relaxed" style={{ color: pro.text }}>{body}</p>
              </div>
            ))}

            {Object.keys(script.objectionHandlers || {}).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: pro.textTer }}>Objections</p>
                <div className="space-y-3">
                  {Object.entries(script.objectionHandlers).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[12px] font-medium" style={{ color: pro.textSec }}>{k.replace(/_/g, ' ')}</p>
                      <p className="text-[13px] leading-relaxed" style={{ color: pro.text }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <PrimaryBtn onClick={copyScript}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copié' : 'Copier'}
              </PrimaryBtn>
              <GhostBtn onClick={regenerateScript}>Régénérer</GhostBtn>
            </div>
          </div>
        )}
      </SlideSheet>

      {/* ── Scrape ── */}
      <Modal
        open={scrapeOpen}
        onClose={() => setScrapeOpen(false)}
        title="Chercher de nouveaux business"
        subtitle="Interroge Google Maps. Facturé à la requête, contrairement à la recherche ci-dessus."
        footer={
          <div className="flex items-center justify-end gap-2">
            <GhostBtn onClick={() => setScrapeOpen(false)}>Annuler</GhostBtn>
            <PrimaryBtn onClick={runScrape} disabled={scraping}>
              {scraping ? <Loader2 size={13} /> : <Zap size={13} />} Lancer
            </PrimaryBtn>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="text-[12px]" style={{ color: pro.textSec }}>Secteur</span>
            <select value={scrapeSector} onChange={e => setScrapeSector(e.target.value)} className={`${selectCls} w-full mt-1`} style={selectStyle}>
              {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px]" style={{ color: pro.textSec }}>Pays</span>
            <select value={scrapeCountry} onChange={e => setScrapeCountry(e.target.value)} className={`${selectCls} w-full mt-1`} style={selectStyle}>
              <option value="BE">Belgique</option>
              <option value="FR">France</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[12px]" style={{ color: pro.textSec }}>Mot-clé (optionnel)</span>
            <input
              value={scrapeKeyword}
              onChange={e => setScrapeKeyword(e.target.value)}
              placeholder="fiduciaire"
              className={`${selectCls} w-full mt-1`}
              style={selectStyle}
            />
          </label>
          <p className="text-[12px]" style={{ color: pro.textTer }}>
            Villes couvertes : {SCRAPE_CITIES[scrapeCountry].join(', ')}.
          </p>
        </div>
      </Modal>

      {/* ── Convert ── */}
      <Modal
        open={!!convertFor}
        onClose={() => setConvertFor(null)}
        title="Convertir en client"
        subtitle={convertFor?.businessName}
        footer={
          <div className="flex items-center justify-end gap-2">
            <GhostBtn onClick={() => setConvertFor(null)}>Annuler</GhostBtn>
            <PrimaryBtn onClick={submitConvert} disabled={converting}>
              {converting && <Loader2 size={13} />} Créer le client
            </PrimaryBtn>
          </div>
        }
      >
        <div className="space-y-3">
          {convertError && (
            <p role="alert" className="rounded-lg px-3 py-2 text-[12.5px]"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
              {convertError}
            </p>
          )}
          <label className="block">
            <span className="text-[12px]" style={{ color: pro.textSec }}>Email du contact *</span>
            <input
              type="email"
              value={convertEmail}
              onChange={e => setConvertEmail(e.target.value)}
              placeholder="contact@exemple.be"
              className={`${selectCls} w-full mt-1`}
              style={selectStyle}
            />
          </label>
          <label className="block">
            <span className="text-[12px]" style={{ color: pro.textSec }}>Forfait</span>
            <select value={convertPlan} onChange={e => setConvertPlan(e.target.value)} className={`${selectCls} w-full mt-1`} style={selectStyle}>
              {PLAN_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
