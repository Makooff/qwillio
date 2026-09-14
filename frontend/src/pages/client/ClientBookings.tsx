import { useCallback, useEffect, useState } from 'react';
import { Calendar, X } from '../../components/icons';
import api from '../../services/api';
import { invalidateLive } from '../../services/liveData';
import ConfirmDialog from '../../components/client-dashboard/ConfirmDialog';
import { formatPhone } from '../../utils/format';

/**
 * Les rendez-vous à venir, et le bouton pour en annuler un.
 *
 * Il n'existait pas (13/09/2026) : le portail listait les réservations
 * sur une route que plus aucune page n'appelait, et rien ne permettait
 * d'en annuler une. Or c'est la réservation EN BASE que l'agent lit pour
 * reconnaître un appelant et retrouver son rendez-vous ; supprimer
 * l'événement dans Google Agenda ne la touche pas. Un gérant à qui
 * l'agent prend des rendez-vous doit pouvoir en défaire un, et un compte
 * de test doit pouvoir nettoyer ses essais.
 *
 * L'annulation passe par le serveur, qui retire aussi l'événement Google
 * quand il existe et oublie le nom de l'appelant en cache.
 */

interface Booking {
  id: string;
  customerName: string;
  customerPhone: string | null;
  bookingDate: string;
  bookingTime: string | null;
  serviceType: string | null;
  status: string;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  /* Majuscule au jour seulement : « Lundi 14 septembre », jamais
     « Septembre ». Le `capitalize` de Tailwind mettait le mois en majuscule. */
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function ClientBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<Booking | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get('/my-dashboard/bookings?limit=100');
      setBookings(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Les rendez-vous n’ont pas pu être chargés.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cancel = async () => {
    if (!toCancel) return;
    const target = toCancel;
    setToCancel(null);
    setBusy(target.id);
    setProblem(null);
    try {
      await api.post(`/my-dashboard/bookings/${target.id}/cancel`);
      setBookings(list => list.filter(b => b.id !== target.id));
      invalidateLive('/my-dashboard/');
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setProblem(msg || 'L’annulation a échoué. Réessayez.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="max-w-[1320px] space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight text-white/90">Rendez-vous</h1>
        <p className="mt-1 text-[12.5px] text-white/50">
          {loading ? 'Chargement…' : bookings.length === 0 ? 'Aucun rendez-vous à venir.' : `${bookings.length} à venir, pris par votre réceptionniste ou déplacés par vos appelants.`}
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
          <p className="text-sm text-white/60" role="alert">{error}</p>
          <button type="button" onClick={load} className="mt-3 rounded-full bg-white/[0.06] px-4 h-9 text-sm text-white hover:bg-white/[0.1] transition-colors">Réessayer</button>
        </div>
      )}
      {problem && <p className="text-[12.5px] text-red-400" role="alert">{problem}</p>}

      {!loading && !error && bookings.length === 0 && (
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-10 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05]">
            <Calendar size={16} className="text-white/60" aria-hidden="true" />
          </span>
          <p className="text-[13.5px] text-white/70">Rien de prévu pour l’instant.</p>
          <p className="mt-1 text-[12.5px] text-white/45">Les rendez-vous que votre réceptionniste prend au téléphone apparaîtront ici.</p>
        </section>
      )}

      {bookings.length > 0 && (
        <ul className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05]" aria-label="Rendez-vous à venir">
          {bookings.map(b => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-[#F5F5F7] truncate">{b.customerName}</p>
                <p className="text-[12px] text-[#A1A1A8] truncate">
                  {[b.serviceType, b.customerPhone ? formatPhone(b.customerPhone) : null].filter(Boolean).join(' · ') || 'Sans précision'}
                </p>
              </div>
              <div className="text-[13px] text-[#F5F5F7] tabular-nums">
                <span>{dayLabel(b.bookingDate)}</span>
                {b.bookingTime && <span className="text-[#A1A1A8]"> à {b.bookingTime}</span>}
              </div>
              <button
                type="button"
                onClick={() => setToCancel(b)}
                disabled={busy === b.id}
                aria-label={`Annuler le rendez-vous de ${b.customerName}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/[0.1] px-3.5 text-[12.5px] text-white/75 hover:bg-red-500/[0.08] hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-50 active:scale-[0.97]"
              >
                <X size={13} aria-hidden="true" /> {busy === b.id ? 'Annulation…' : 'Annuler'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toCancel !== null}
        title="Annuler ce rendez-vous ?"
        message={toCancel ? `${toCancel.customerName}, ${dayLabel(toCancel.bookingDate)}${toCancel.bookingTime ? ` à ${toCancel.bookingTime}` : ''}. Le créneau est libéré et l’événement retiré de votre agenda. L’appelant n’est pas prévenu.` : ''}
        confirmLabel="Annuler le rendez-vous"
        cancelLabel="Garder"
        variant="danger"
        onConfirm={cancel}
        onCancel={() => setToCancel(null)}
      />
    </main>
  );
}
