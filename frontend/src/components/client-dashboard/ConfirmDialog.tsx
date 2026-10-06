import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from '../icons';
import { t } from '../../styles/admin-theme';
import Button from '../ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'default', onConfirm, onCancel,
}: ConfirmDialogProps) {
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
      if (event.key === 'Escape') { event.preventDefault(); cancelRef.current(); }
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} className="relative rounded-2xl max-w-sm w-full mx-4 p-6 max-h-[calc(100dvh-32px)] overflow-y-auto" style={{ background: t.panelSolid, border: `1px solid ${t.borderHi}`, boxShadow: t.shadowFloat }}>
        <button type="button" aria-label="Fermer" onClick={onCancel} className="absolute top-3 right-3 p-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: t.textSec }}>
          <X size={18} />
        </button>
        <div className="flex items-start gap-3 mb-4">
          {variant === 'danger' && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in oklab, ${t.danger} 12%, transparent)` }}>
              <AlertTriangle size={20} style={{ color: t.danger }} />
            </div>
          )}
          <div>
            <h3 id={`${id}-title`} className="text-base font-semibold pr-6" style={{ color: t.text }}>{title}</h3>
            <p id={`${id}-message`} className="text-sm leading-relaxed mt-2" style={{ color: t.textSec }}>{message}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 mt-6">
          <Button
            ref={cancelButton} variant="ghost" onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>, document.body
  );
}
