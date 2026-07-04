import { AlertTriangle } from 'lucide-react';
import { t } from '../../styles/admin-theme';

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

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmer', danger = true, loading = false,
  onConfirm, onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative rounded-2xl p-6 w-full max-w-sm shadow-2xl backdrop-blur-xl"
        style={{ background: t.panelSolid, border: `1px solid ${t.borderHi}` }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: danger ? `${t.danger}18` : t.elevated }}>
          <AlertTriangle className="w-5 h-5" style={{ color: danger ? t.danger : t.textSec }} />
        </div>
        <h3 className="text-base font-semibold mb-2" style={{ color: t.text }}>{title}</h3>
        <p className="text-sm mb-6" style={{ color: t.textSec }}>{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.06] hover:bg-white/[0.1] transition-all"
            style={{ color: t.text }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={danger
              ? { background: t.danger, color: '#fff' }
              : { background: 'rgba(255,255,255,0.10)', color: t.text }
            }
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
