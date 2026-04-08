import { AlertTriangle } from 'lucide-react';

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
      <div className="relative bg-[#1A1A27] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${danger ? 'bg-[#EF4444]/10' : 'bg-[#7B5CF0]/10'}`}>
          <AlertTriangle className={`w-5 h-5 ${danger ? 'text-[#EF4444]' : 'text-[#7B5CF0]'}`} />
        </div>
        <h3 className="text-base font-semibold text-[#F8F8FF] mb-2">{title}</h3>
        <p className="text-sm text-[#8B8BA7] mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.06] hover:bg-white/[0.1] text-[#F8F8FF] transition-all"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50
              ${danger
                ? 'bg-[#EF4444] hover:bg-[#DC2626] text-white'
                : 'bg-[#7B5CF0] hover:bg-[#6D4FE0] text-white'}`}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
