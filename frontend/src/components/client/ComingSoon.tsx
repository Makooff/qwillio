import { Link } from 'react-router-dom';
import { Clock, ArrowLeft } from 'lucide-react';

/**
 * Placeholder shown for agent modules that are not functional yet. Keeps the
 * suite visible as a roadmap without presenting non-working demo screens to a
 * paying client as if they were live.
 */
export default function ComingSoon({ module }: { module: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div
        className="max-w-md w-full rounded-2xl p-8 text-center"
        style={{ background: 'oklch(11% 0.013 265)', border: '1px solid oklch(20% 0.02 265)' }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'oklch(67% 0.26 158 / 0.12)' }}
        >
          <Clock size={22} style={{ color: 'oklch(67% 0.26 158)' }} aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold mb-2" style={{ color: 'oklch(95% 0.004 265)' }}>
          {module} — bientôt disponible
        </h1>
        <p className="text-[13px] leading-relaxed mb-6" style={{ color: 'oklch(65% 0.007 265)' }}>
          Ce module de la suite agent arrive prochainement. Votre réceptionniste IA, elle, est déjà
          active et répond à vos appels 24 h/24.
        </p>
        <Link
          to="/dashboard/agent"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
          style={{ color: 'oklch(63% 0.21 158)' }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Retour à la suite agent
        </Link>
      </div>
    </div>
  );
}
