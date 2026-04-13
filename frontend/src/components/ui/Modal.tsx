import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
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
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative rounded-2xl w-full ${SIZES[size]} shadow-2xl flex flex-col max-h-[90vh] backdrop-blur-xl`}
        style={{ background: t.panelSolid, border: `1px solid ${t.borderHi}` }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: t.text }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: t.textSec }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="transition-colors p-1 hover:opacity-80" style={{ color: t.textSec }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="p-6 flex gap-3" style={{ borderTop: `1px solid ${t.border}` }}>{footer}</div>
        )}
      </div>
    </div>
  );
}
