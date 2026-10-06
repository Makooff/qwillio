import { ReactNode, useEffect, useId, useRef } from 'react';
import { X } from '../icons';
import { t } from '../../styles/admin-theme';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export default function Modal({ open, onClose, title, subtitle, children, size = 'md', footer }: Props) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const focusables = panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className={`relative rounded-2xl w-full ${SIZES[size]} shadow-2xl flex flex-col max-h-[90vh] backdrop-blur-xl`}
        style={{ background: t.panelSolid, border: `1px solid ${t.borderHi}` }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div>
            <h2 id={`${id}-title`} className="text-base font-semibold" style={{ color: t.text }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: t.textSec }}>{subtitle}</p>}
          </div>
          <button
            ref={closeButton}
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="transition-colors p-1 hover:opacity-80"
            style={{ color: t.textSec }}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {/* Footer: flex-wrap pour que deux libellés longs à 200 % de zoom
            s'empilent au lieu de déborder du panneau. */}
        {footer && (
          <div className="p-6 flex flex-wrap gap-3" style={{ borderTop: `1px solid ${t.border}` }}>{footer}</div>
        )}
      </div>
    </div>
  );
}
