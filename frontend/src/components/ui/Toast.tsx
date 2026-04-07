import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { Toast as ToastType } from '../../hooks/useToast';

const ICONS = {
  success: <CheckCircle className="w-4 h-4 text-[#22C55E]" />,
  error: <XCircle className="w-4 h-4 text-[#EF4444]" />,
  warning: <AlertCircle className="w-4 h-4 text-[#F59E0B]" />,
  info: <Info className="w-4 h-4 text-[#7B5CF0]" />,
};

const BARS = {
  success: 'bg-[#22C55E]',
  error: 'bg-[#EF4444]',
  warning: 'bg-[#F59E0B]',
  info: 'bg-[#7B5CF0]',
};

interface Props {
  toasts: ToastType[];
  remove: (id: string) => void;
}

export default function ToastContainer({ toasts, remove }: Props) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 min-w-[280px] max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className="relative overflow-hidden rounded-xl bg-[#1E1E2E] border border-white/[0.08] shadow-2xl flex items-start gap-3 p-3.5 animate-fade-in"
        >
          <div className="mt-0.5 flex-shrink-0">{ICONS[t.type]}</div>
          <p className="flex-1 text-sm text-[#F8F8FF] leading-snug">{t.message}</p>
          <button onClick={() => remove(t.id)} className="text-[#8B8BA7] hover:text-white mt-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
          <div className={`absolute bottom-0 left-0 h-0.5 w-full ${BARS[t.type]} opacity-60`} />
        </div>
      ))}
    </div>
  );
}
