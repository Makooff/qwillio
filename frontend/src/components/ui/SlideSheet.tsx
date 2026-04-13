import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from '../../styles/admin-theme';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
  footer?: ReactNode;
}

export default function SlideSheet({ open, onClose, title, subtitle, children, width = 'w-[480px]', footer }: Props) {
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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed right-0 top-0 bottom-0 z-50 ${width} max-w-full flex flex-col shadow-2xl backdrop-blur-xl`}
            style={{ background: t.panelSolid, borderLeft: `1px solid ${t.border}` }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex items-start justify-between p-6" style={{ borderBottom: `1px solid ${t.border}` }}>
              <div>
                <h2 className="text-base font-semibold" style={{ color: t.text }}>{title}</h2>
                {subtitle && <p className="text-xs mt-0.5" style={{ color: t.textSec }}>{subtitle}</p>}
              </div>
              <button onClick={onClose} className="transition-colors p-1 hover:opacity-80" style={{ color: t.textSec }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
            {footer && (
              <div className="p-6 flex gap-3" style={{ borderTop: `1px solid ${t.border}` }}>{footer}</div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
