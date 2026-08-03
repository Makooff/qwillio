import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CornerDownLeft, Search, type LucideIcon } from 'lucide-react';

/* Palette de commandes du produit V2 (registre instrument, DA/references/linear.md).
   Ouverte par Cmd+K / Ctrl+K ou par le bouton de la topbar. Navigation vers
   toutes les routes du dashboard + actions rapides. */

export interface CommandItem {
  id: string;
  label: string;
  to: string;
  group: string;
  icon?: LucideIcon;
  hint?: string;
  keywords?: string;
}

interface PaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* Sous-séquence insensible casse/accents. Retourne null si pas de match,
   sinon un score où le plus bas est le plus pertinent. */
function fuzzyScore(text: string, query: string): number | null {
  if (!query) return 0;
  const haystack = normalize(text);
  const needle = normalize(query);
  let cursor = 0;
  let score = 0;
  let previous = -1;
  for (const char of needle) {
    const index = haystack.indexOf(char, cursor);
    if (index === -1) return null;
    score += index - cursor;
    if (previous !== -1 && index !== previous + 1) score += 2;
    if (index === 0 || haystack[index - 1] === ' ') score -= 3;
    previous = index;
    cursor = index + 1;
  }
  return score;
}

function isMacLike() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function shortcutLabel() {
  return isMacLike() ? '⌘K' : 'Ctrl K';
}

function Panel({ onClose, commands }: { onClose: () => void; commands: CommandItem[] }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  /* Rend le focus au déclencheur (bouton topbar ou élément actif au moment du raccourci) */
  useEffect(() => {
    const opener = document.activeElement;
    openerRef.current = opener instanceof HTMLElement && opener !== document.body ? opener : null;
    inputRef.current?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, []);

  const groups = useMemo(() => {
    const order: string[] = [];
    const buckets = new Map<string, { item: CommandItem; score: number }[]>();
    for (const item of commands) {
      const score = fuzzyScore(`${item.label} ${item.keywords ?? ''} ${item.group}`, query);
      if (score === null) continue;
      if (!buckets.has(item.group)) {
        buckets.set(item.group, []);
        order.push(item.group);
      }
      buckets.get(item.group)!.push({ item, score });
    }
    return order.map((name) => ({
      name,
      items: buckets
        .get(name)!
        .sort((a, b) => a.score - b.score)
        .map((entry) => entry.item),
    }));
  }, [commands, query]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = useCallback(
    (item: CommandItem | undefined) => {
      if (!item) return;
      onClose();
      navigate(item.to);
    },
    [navigate, onClose],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const move = (delta: number) => {
    if (flat.length === 0) return;
    setActive((current) => (current + delta + flat.length) % flat.length);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Tab') {
      /* Focus-trap: la palette n'a qu'une zone focusable, le champ */
      event.preventDefault();
      move(event.shiftKey ? -1 : 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(Math.max(0, flat.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(flat[active]);
    }
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose();
  };

  let index = -1;

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[12vh] font-outfit"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.12, ease: 'linear' }}
      onPointerDown={onPointerDown}
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        initial={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
        transition={{ duration: reduce ? 0 : 0.14, ease: EASE_OUT_EXPO }}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-[560px] bg-q2-carbon border border-q2-graphite-d rounded-xl overflow-hidden"
      >
        <div className="flex items-center gap-3 h-12 px-4 border-b border-q2-graphite-d">
          <Search size={15} className="shrink-0 text-q2-fog" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="q2p-cmd-list"
            aria-autocomplete="list"
            aria-activedescendant={flat[active] ? `q2p-cmd-${flat[active].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="Rechercher une page, lancer une action"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] text-white placeholder:text-q2-fog"
          />
        </div>

        <div ref={listRef} id="q2p-cmd-list" role="listbox" aria-label="Commandes" className="max-h-[336px] overflow-y-auto py-1.5">
          {flat.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-q2-fog">Aucun résultat</p>
          )}
          {groups.map((group) => (
            <div key={group.name} role="group" aria-label={group.name}>
              {/* Le nom du groupe est déjà porté par aria-label, il n'est pas relu */}
              <p aria-hidden="true" className="q2-eyebrow text-q2-fog px-4 pt-2.5 pb-1.5">
                {group.name}
              </p>
              {group.items.map((item) => {
                index += 1;
                const current = index;
                const isActive = current === active;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`q2p-cmd-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive}
                    tabIndex={-1}
                    onMouseMove={() => setActive(current)}
                    onClick={() => run(item)}
                    className={`relative w-full flex items-center gap-3 h-10 px-4 text-left text-[13.5px] transition-colors duration-100 ${
                      isActive ? 'bg-q2-obsidian text-white' : 'text-q2-mist'
                    }`}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-q2-indigo"
                      />
                    )}
                    {Icon && (
                      <Icon size={15} aria-hidden="true" className={isActive ? 'text-q2-lift' : 'text-q2-fog'} />
                    )}
                    <span className="flex-1 min-w-0 truncate">{item.label}</span>
                    {item.hint && <span className="shrink-0 text-[11px] text-q2-fog">{item.hint}</span>}
                    {isActive && <CornerDownLeft size={12} className="shrink-0 text-q2-fog" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 h-9 px-4 border-t border-q2-graphite-d text-[11px] text-q2-fog">
          <span className="flex items-center gap-1.5">
            <span className="q2p-kbd">&#8593;&#8595;</span> naviguer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="q2p-kbd">&#8629;</span> ouvrir
          </span>
          <span className="flex items-center gap-1.5">
            <span className="q2p-kbd">esc</span> fermer
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function CommandPalette({ open, onClose, commands }: PaletteProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>{open && <Panel key="q2p-palette" onClose={onClose} commands={commands} />}</AnimatePresence>,
    document.body,
  );
}
