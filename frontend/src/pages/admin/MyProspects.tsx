import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { RefreshCw, Search, X, Phone, StickyNote, Loader2 } from '../../components/icons';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, IconBtn, Pill } from '../../components/pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import Pagination from '../../components/ui/Pagination';
import SlideSheet from '../../components/ui/SlideSheet';
import ProspectNotes, {
  OutcomePicker, ProspectNote, prospectStatusColor, prospectStatusLabel,
} from '../../components/admin/ProspectNotes';

/**
 * « Mes prospects »: tout business que le fondateur a déjà appelé au moins une
 * fois, le plus récent en haut. Un prospect y entre au premier appel (bouton
 * téléphone de Leads) ou dès qu'on pose l'issue d'un appel, et il y reste:
 * c'est sa base de suivi, pas une file d'appels.
 */

interface MyProspect {
  id: string;
  businessName: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactName?: string;
  status: string;
  callAttempts: number;
  lastContactDate?: string;
  notes?: string | null;
  lastNote?: { body: string; createdAt: string } | null;
  notesCount?: number;
}

const LIMIT = 30;

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'callback', label: 'À rappeler' },
  { value: 'hot_lead', label: 'Intéressés' },
  { value: 'contacted', label: 'Sans suite' },
  { value: 'rejected', label: 'Pas intéressés' },
  { value: 'converted', label: 'Clients' },
];

function telHref(phone?: string): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^\d+]/g, '');
  return clean.length >= 6 ? `tel:${clean}` : null;
}

function ago(iso?: string): string | null {
  return iso ? formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr }) : null;
}

export default function MyProspects() {
  const { toasts, add: toast, remove } = useToast();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<MyProspect[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<MyProspect | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => { setPage(1); }, [debounced, filter]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), limit: String(LIMIT), contacted: 'true',
      sortBy: 'lastContactDate', sortOrder: 'desc',
    });
    if (debounced) params.set('search', debounced);
    if (filter !== 'all') params.set('status', filter);
    try {
      const { data } = await api.get(`/prospects?${params}`);
      setRows(data?.data ?? []);
      setTotal(data?.pagination?.total ?? 0);
    } catch (err: any) {
      // Le message du serveur dit la cause; le générique ne la disait jamais.
      toast(err?.response?.data?.error || 'Impossible de charger vos prospects', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, filter, toast]);

  useEffect(() => { void load(); }, [load]);

  const patchRow = useCallback((id: string, patch: Partial<MyProspect>) => {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
    setOpen(o => (o && o.id === id ? { ...o, ...patch } : o));
  }, []);

  /** Le composeur s'ouvre par le lien; ceci ne fait que noter l'appel. */
  const markCalled = (p: MyProspect) => {
    patchRow(p.id, { callAttempts: p.callAttempts + 1, lastContactDate: new Date().toISOString() });
    api.post(`/prospects/${p.id}/touch`).catch(() => { /* l'appel a eu lieu quand même */ });
  };

  const onNotesChange = useCallback((count: number, last: ProspectNote | null) => {
    if (!open) return;
    patchRow(open.id, { notesCount: count, lastNote: last ? { body: last.body, createdAt: last.createdAt } : null });
  }, [open, patchRow]);

  const subtitle = useMemo(() => {
    if (loading && !total) return 'Les business que vous avez déjà appelés.';
    return `${total} prospect${total > 1 ? 's' : ''} appelé${total > 1 ? 's' : ''}`;
  }, [loading, total]);

  return (
    <div className="space-y-5 max-w-[1100px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Mes prospects"
        subtitle={subtitle}
        right={<IconBtn onClick={load} title="Actualiser"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></IconBtn>}
      />

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: pro.textTer }} />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nom, ville, téléphone…"
          aria-label="Rechercher dans mes prospects"
          className="w-full h-12 pl-12 pr-12 rounded-2xl text-[14px] outline-none transition-colors"
          style={{ background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` }}
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Effacer"
                  className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: pro.textTer }}>
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className="h-8 px-3.5 text-[12px] font-medium rounded-xl transition-colors"
              style={{
                background: active ? pro.text : pro.panel,
                color: active ? '#0B0B0D' : pro.textSec,
                border: `1px solid ${active ? pro.text : pro.border}`,
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <Card>
        {loading ? (
          <div className="py-20 text-center"><Loader2 size={20} className="mx-auto" style={{ color: pro.textTer }} /></div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center px-6">
            <p className="text-[14px]" style={{ color: pro.textSec }}>
              {debounced || filter !== 'all' ? 'Aucun prospect ne correspond.' : "Vous n'avez encore appelé personne."}
            </p>
            {!debounced && filter === 'all' && (
              <p className="mt-2 text-[12.5px]" style={{ color: pro.textTer }}>
                Chaque business appelé depuis{' '}
                <Link to="/admin/leads" style={{ color: pro.accentHi }}>Leads</Link>{' '}
                arrive ici automatiquement.
              </p>
            )}
          </div>
        ) : (
          <ul>
            {rows.map(p => {
              const href = telHref(p.phone);
              const preview = p.lastNote?.body || p.notes || '';
              return (
                <li key={p.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-0"
                    style={{ borderColor: pro.border }}>
                  <button type="button" onClick={() => setOpen(p)}
                          className="flex-1 min-w-0 text-left" aria-label={`Ouvrir ${p.businessName}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-[13.5px] font-medium truncate" style={{ color: pro.text }}>{p.businessName}</p>
                      <Pill color={prospectStatusColor(p.status)}>{prospectStatusLabel(p.status)}</Pill>
                    </div>
                    <p className="text-[11.5px] truncate mt-0.5" style={{ color: pro.textTer }}>
                      {[p.city, p.phone,
                        p.lastContactDate ? `appelé ${ago(p.lastContactDate)}` : null,
                        p.callAttempts > 1 ? `${p.callAttempts} appels` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {preview ? (
                      <p className="text-[12.5px] mt-1.5 line-clamp-2 flex gap-1.5" style={{ color: pro.textSec }}>
                        <StickyNote size={13} className="flex-shrink-0 mt-0.5" style={{ color: pro.textTer }} />
                        <span>{preview}</span>
                      </p>
                    ) : (
                      <p className="text-[12px] mt-1.5" style={{ color: pro.textTer }}>Pas encore de note</p>
                    )}
                  </button>

                  {href ? (
                    <a href={href} onClick={() => markCalled(p)}
                       title={`Appeler ${p.phone}`} aria-label={`Appeler ${p.businessName}`}
                       className="h-9 w-9 flex-shrink-0 grid place-items-center rounded-xl transition-colors"
                       style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}>
                      <Phone size={14} />
                    </a>
                  ) : (
                    <span className="h-9 w-9 flex-shrink-0 grid place-items-center rounded-xl opacity-30" title="Pas de numéro"
                          style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.textTer }}>
                      <Phone size={14} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {total > LIMIT && <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />}

      <SlideSheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.businessName || ''}
        subtitle={[open?.city, open?.lastContactDate ? `appelé ${ago(open.lastContactDate)}` : null].filter(Boolean).join(' · ') || undefined}
      >
        {open && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {open.phone && <Pill color="info">{open.phone}</Pill>}
              {open.email && <Pill color="neutral">{open.email}</Pill>}
              {open.contactName && <Pill color="neutral">{open.contactName}</Pill>}
            </div>
            {open.website && (
              <a href={open.website} target="_blank" rel="noreferrer noopener"
                 className="block text-[13px] truncate" style={{ color: pro.accentHi }}>
                {open.website}
              </a>
            )}
            {telHref(open.phone) && (
              <a href={telHref(open.phone)!} onClick={() => markCalled(open)}
                 className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-medium"
                 style={{ color: pro.accentHi, border: `1px solid ${pro.accentHi}` }}>
                <Phone size={13} /> Appeler
              </a>
            )}

            <OutcomePicker
              prospectId={open.id}
              status={open.status}
              onChange={status => { patchRow(open.id, { status }); toast('Issue enregistrée'); }}
              onError={msg => toast(msg, 'error')}
            />

            <ProspectNotes
              prospectId={open.id}
              legacyNotes={open.notes}
              onCountChange={onNotesChange}
              onError={msg => toast(msg, 'error')}
            />
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
