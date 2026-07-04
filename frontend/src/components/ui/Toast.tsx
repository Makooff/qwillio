import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { Toast as ToastType } from '../../hooks/useToast';
import { t } from '../../styles/admin-theme';

const ICONS = {
  success: <CheckCircle className="w-4 h-4" style={{ color: t.success }} />,
  error: <XCircle className="w-4 h-4" style={{ color: t.danger }} />,
  warning: <AlertCircle className="w-4 h-4" style={{ color: t.warning }} />,
  info: <Info className="w-4 h-4" style={{ color: t.info }} />,
};

const BARS: Record<string, string> = {
  success: t.success,
  error: t.danger,
  warning: t.warning,
  info: t.info,
};

interface Props {
  toasts: ToastType[];
  remove: (id: string) => void;
}

export default function ToastContainer({ toasts, remove }: Props) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 min-w-[280px] max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="relative overflow-hidden rounded-xl shadow-2xl flex items-start gap-3 p-3.5 animate-fade-in backdrop-blur-xl"
          style={{ background: t.panelSolid, border: `1px solid ${t.borderHi}` }}
        >
          <div className="mt-0.5 flex-shrink-0">{ICONS[toast.type]}</div>
          <p className="flex-1 text-sm leading-snug" style={{ color: t.text }}>{toast.message}</p>
          <button onClick={() => remove(toast.id)} className="mt-0.5 hover:opacity-80 transition-opacity" style={{ color: t.textSec }}>
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="absolute bottom-0 left-0 h-0.5 w-full opacity-60" style={{ background: BARS[toast.type] }} />
        </div>
      ))}
    </div>
  );
}
