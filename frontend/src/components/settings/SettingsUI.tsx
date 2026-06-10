import type { ReactNode, KeyboardEvent } from 'react';
import { Save, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

/* Shared form UI primitives for the Settings page(s). */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Shared input styles ────────────────────────────────────────────────────
export const inputCls = [
  'w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none transition-colors',
  'bg-white/[0.04] border border-white/[0.08]',
  'focus:border-[oklch(56%_0.22_264)/50] placeholder-white/25',
].join(' ');

export const selectCls = inputCls + ' appearance-none cursor-pointer';

// ── Sub-components ─────────────────────────────────────────────────────────

export function SaveIcon({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <><RotateCcw className="w-4 h-4 animate-spin" aria-hidden="true" /> Sauvegarde…</>;
  if (status === 'saved') return <><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Sauvegardé</>;
  if (status === 'error') return <><AlertCircle className="w-4 h-4" aria-hidden="true" /> Erreur</>;
  return <><Save className="w-4 h-4" aria-hidden="true" /> Sauvegarder</>;
}

export function ConfigSection({
  icon, title, children, saveStatus, onSave, accent = 'indigo',
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  saveStatus: SaveStatus;
  onSave: () => void;
  accent?: 'indigo' | 'violet';
}) {
  const btnBg = accent === 'violet'
    ? 'bg-[oklch(67%_0.26_299)] hover:bg-[oklch(63%_0.24_299)]'
    : 'bg-[oklch(56%_0.22_264)] hover:bg-[oklch(52%_0.22_264)]';
  const iconColor = accent === 'violet' ? 'text-[oklch(67%_0.26_299)]' : 'text-[oklch(74%_0.18_264)]';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0 ${iconColor}`}>
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors disabled:opacity-50 ${btnBg}`}
        >
          <SaveIcon status={saveStatus} />
        </button>
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-white/50 mb-2">{label}</label>
      {children}
    </div>
  );
}

export function TagInput({
  tags, inputValue, onInputChange, onAdd, onRemove, placeholder, icon,
}: {
  tags: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
  placeholder: string;
  icon: ReactNode;
}) {
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); onAdd(); }
  };
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" aria-hidden="true">{icon}</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            className={inputCls + ' pl-9'}
          />
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 bg-white/[0.05] hover:bg-white/[0.08] transition-colors"
        >
          Ajouter
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: 'oklch(56% 0.22 264 / 0.15)', color: 'oklch(74% 0.18 264)' }}
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="leading-none font-bold hover:opacity-70 transition-opacity"
                aria-label={`Retirer ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
