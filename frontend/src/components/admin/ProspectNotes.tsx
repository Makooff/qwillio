import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Edit2, Trash2, Loader2, Check, X } from '../icons';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { PrimaryBtn, GhostBtn } from '../pro/ProBlocks';

/**
 * Notes datees d'un prospect, et l'issue du dernier appel. Partage par la page
 * Leads (fiche de prospection) et par « Mes prospects », pour que les deux
 * ecrans lisent et ecrivent la meme chose.
 */

export interface ProspectNote {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export const NOTE_MAX_CHARS = 5000;

/** Ce que le fondateur peut dire d'un appel. Liste fermee cote serveur aussi. */
export const OUTCOMES = [
  { value: 'callback', label: 'À rappeler' },
  { value: 'hot_lead', label: 'Intéressé' },
  { value: 'contacted', label: 'Sans suite' },
  { value: 'rejected', label: 'Pas intéressé' },
] as const;

export type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

export function prospectStatusLabel(s?: string): string {
  const map: Record<string, string> = {
    new: 'Nouveau', contacted: 'Appelé', callback: 'À rappeler', hot_lead: 'Intéressé',
    converted: 'Client', rejected: 'Pas intéressé', exhausted: 'Épuisé',
  };
  return (s && map[s.toLowerCase()]) || s || '—';
}

export function prospectStatusColor(s?: string): PillColor {
  switch (s?.toLowerCase()) {
    case 'hot_lead': return 'ok';
    case 'callback': return 'warn';
    case 'converted': return 'accent';
    case 'contacted': return 'info';
    case 'rejected': return 'bad';
    default: return 'neutral';
  }
}

const label = 'text-[11px] font-semibold uppercase tracking-[0.08em] mb-2';

// ─── Issue de l'appel ─────────────────────────────────────────────────────────

export function OutcomePicker({
  prospectId, status, onChange, onError,
}: {
  prospectId: string;
  status?: string;
  onChange: (status: string) => void;
  onError?: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const converted = status === 'converted';

  const pick = async (value: string) => {
    if (busy || value === status) return;
    setBusy(value);
    try {
      const { data } = await api.patch(`/prospects/${prospectId}/outcome`, { outcome: value });
      onChange(data.status);
    } catch {
      onError?.("Impossible d'enregistrer l'issue de l'appel");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <p className={label} style={{ color: pro.textTer }}>Issue de l'appel</p>
      {converted ? (
        <p className="text-[13px]" style={{ color: pro.textSec }}>Ce prospect est devenu client.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {OUTCOMES.map(o => {
            const active = status === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                disabled={!!busy}
                aria-pressed={active}
                className="h-8 px-3 text-[12px] font-medium rounded-xl transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
                style={{
                  background: active ? pro.text : pro.panel,
                  color: active ? '#0B0B0D' : pro.textSec,
                  border: `1px solid ${active ? pro.text : pro.border}`,
                }}
              >
                {busy === o.value && <Loader2 size={12} />}
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export default function ProspectNotes({
  prospectId, legacyNotes, onCountChange, onError,
}: {
  prospectId: string;
  /** L'ancien champ texte `prospects.notes`, affiché en lecture s'il existe. */
  legacyNotes?: string | null;
  onCountChange?: (count: number, last: ProspectNote | null) => void;
  onError?: (msg: string) => void;
}) {
  const [notes, setNotes] = useState<ProspectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const publish = useCallback((list: ProspectNote[]) => {
    setNotes(list);
    onCountChange?.(list.length, list[0] ?? null);
  }, [onCountChange]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotes([]);
    api.get(`/prospects/${prospectId}/notes`)
      .then(({ data }) => { if (alive) setNotes(data?.data ?? []); })
      .catch(() => { if (alive) onError?.('Impossible de charger les notes'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // onError volontairement hors dépendances: une nouvelle fonction à chaque
    // rendu du parent rechargerait les notes en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId]);

  const add = async () => {
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/prospects/${prospectId}/notes`, { body });
      publish([data, ...notes]);
      setDraft('');
    } catch {
      onError?.("La note n'a pas été enregistrée");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    try {
      const { data } = await api.patch(`/prospects/notes/${id}`, { body });
      publish(notes.map(n => (n.id === id ? data : n)));
      setEditing(null);
    } catch {
      onError?.("La modification n'a pas été enregistrée");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Supprimer cette note ?')) return;
    const before = notes;
    publish(notes.filter(n => n.id !== id));
    try {
      await api.delete(`/prospects/notes/${id}`);
    } catch {
      publish(before);
      onError?.("La note n'a pas été supprimée");
    }
  };

  const textareaCls = 'w-full rounded-xl px-3 py-2.5 text-[13px] leading-relaxed outline-none resize-y transition-colors';
  const textareaStyle = { background: pro.panelHi, color: pro.text, border: `1px solid ${pro.border}` };

  return (
    <div>
      <p className={label} style={{ color: pro.textTer }}>Notes</p>

      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void add(); } }}
        placeholder="Ce qu'il a dit, à qui parler, quand rappeler…"
        rows={3}
        maxLength={NOTE_MAX_CHARS}
        className={textareaCls}
        style={textareaStyle}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px]" style={{ color: pro.textTer }}>Ctrl + Entrée pour enregistrer</span>
        <PrimaryBtn size="sm" onClick={add} disabled={!draft.trim() || saving}>
          {saving ? <Loader2 size={12} /> : null} Ajouter la note
        </PrimaryBtn>
      </div>

      <div className="mt-4 space-y-2.5">
        {loading ? (
          <div className="py-4 text-center"><Loader2 size={16} className="mx-auto" style={{ color: pro.textTer }} /></div>
        ) : notes.length === 0 && !legacyNotes ? (
          <p className="text-[12.5px]" style={{ color: pro.textTer }}>Aucune note pour l'instant.</p>
        ) : (
          notes.map(n => (
            <div key={n.id} className="rounded-xl px-3 py-2.5" style={{ background: pro.panelHi, border: `1px solid ${pro.border}` }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px]" style={{ color: pro.textTer }}>
                  {format(new Date(n.createdAt), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                  {n.updatedAt && new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime() > 1000 ? ' (modifiée)' : ''}
                </span>
                {editing !== n.id && (
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => { setEditing(n.id); setEditDraft(n.body); }}
                            aria-label="Modifier la note" className="p-1 rounded-md hover:bg-white/[0.06] transition-colors"
                            style={{ color: pro.textTer }}>
                      <Edit2 size={13} />
                    </button>
                    <button type="button" onClick={() => remove(n.id)}
                            aria-label="Supprimer la note" className="p-1 rounded-md hover:bg-white/[0.06] transition-colors"
                            style={{ color: pro.textTer }}>
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </div>
              {editing === n.id ? (
                <div>
                  <textarea value={editDraft} onChange={e => setEditDraft(e.target.value)} rows={3}
                            maxLength={NOTE_MAX_CHARS} className={textareaCls} style={textareaStyle} autoFocus />
                  <div className="flex items-center gap-2 mt-2">
                    <PrimaryBtn size="sm" onClick={() => saveEdit(n.id)} disabled={!editDraft.trim()}>
                      <Check size={12} /> Enregistrer
                    </PrimaryBtn>
                    <GhostBtn size="sm" onClick={() => setEditing(null)}><X size={12} /> Annuler</GhostBtn>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: pro.text }}>{n.body}</p>
              )}
            </div>
          ))
        )}

        {legacyNotes && (
          <div className="rounded-xl px-3 py-2.5" style={{ border: `1px dashed ${pro.border}` }}>
            <p className="text-[11px] mb-1" style={{ color: pro.textTer }}>Note importée</p>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: pro.textSec }}>{legacyNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
