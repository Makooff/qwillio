import { useEffect, useId, useRef } from 'react';
import { AlertTriangle } from '../icons';
import { t } from '../../styles/admin-theme';
import { ds } from '../../styles/design-system';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/* Mêmes garanties clavier que client-dashboard/ConfirmDialog (rôle dialog,
   piège à focus, Echap, focus initial sur l'action non destructive, focus
   restitué au déclencheur, verrouillage du défilement restitué) — la version
   « shell » n'avait aucune de ces protections. */
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmer', danger = true, loading = false,
  onConfirm, onCancel,
}: Props) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => { cancelRef.current = onCancel; }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelButton.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); cancelRef.current(); return; }
      if (event.key !== 'Tab') return;
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        className="relative rounded-2xl p-6 w-full max-w-sm shadow-2xl backdrop-blur-xl max-h-[calc(100dvh-32px)] overflow-y-auto"
        style={{ background: t.panelSolid, border: `1px solid ${t.borderHi}` }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: danger ? `${t.danger}18` : t.elevated }}>
          <AlertTriangle className="w-5 h-5" aria-hidden="true" style={{ color: danger ? t.danger : t.textSec }} />
        </div>
        <h3 id={`${id}-title`} className="text-base font-semibold mb-2" style={{ color: t.text }}>{title}</h3>
        <p id={`${id}-message`} className="text-sm mb-6" style={{ color: t.textSec }}>{message}</p>
        {/* flex-wrap: à 200 % de zoom les deux libellés s'empilent. */}
        <div className="flex flex-wrap gap-3">
          <button
            ref={cancelButton}
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-white/[0.08]"
            style={{ ...ds.btnGhost, padding: '9px 16px' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading || undefined}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={danger
              ? ds.btnDanger
              : { ...ds.btnSubtle, color: t.text }
            }
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
