import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface SlideSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
}

export default function SlideSheet({ open, onClose, title, subtitle, children, width = 'max-w-lg' }: SlideSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      window.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full ${width}
              bg-[#0D0D15] border-l border-white/[0.08] shadow-2xl overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-white/[0.06] flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-[#F8F8FF]">{title}</h2>
                {subtitle && <p className="text-sm text-[#8B8BA7] mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="ml-4 p-2 rounded-xl text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
