import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../../styles/admin-theme';

interface Props {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, limit, onChange }: Props) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }

  return (
    <div className="flex items-center justify-between pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
      <p className="text-xs" style={{ color: t.textSec }}>
        {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} sur {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-30 transition-all"
          style={{ color: t.textSec }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-xs" style={{ color: t.textSec }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                p === page
                  ? 'bg-white/[0.10]'
                  : 'hover:bg-white/[0.06]'
              }`}
              style={{ color: p === page ? t.text : t.textSec }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-30 transition-all"
          style={{ color: t.textSec }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
