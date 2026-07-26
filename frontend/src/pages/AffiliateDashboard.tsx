import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, Users, Wallet, Clock, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { useLang } from '../stores/langStore';
import { useSEO } from '../hooks/useSEO';

interface Summary {
  code: string;
  commissionPct: number;
  status: string;
  payoutEmail: string | null;
  totals: { referrals: number; pendingEur: number; paidEur: number; lifetimeEur: number };
  referrals: { clientId: string; businessName: string; planType: string; subscriptionStatus: string; since: string }[];
  commissions: { id: string; amountEur: number; invoiceAmountEur: number; status: string; createdAt: string; paidAt: string | null }[];
}

const money = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

export default function AffiliateDashboard() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: isFr ? 'Espace affilié' : 'Affiliate dashboard',
    description: isFr ? 'Vos filleuls et vos commissions Qwillio.' : 'Your Qwillio referrals and commissions.',
  });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/affiliate/me');
      setSummary(data);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      // 404 simply means "signed in, but not enrolled yet" — an offer, not an error.
      if (status !== 404) {
        setError(isFr ? 'Impossible de charger votre espace affilié.' : 'Could not load your affiliate dashboard.');
      }
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [isFr]);

  useEffect(() => { void load(); }, [load]);

  const enroll = async () => {
    setEnrolling(true);
    setError(null);
    try {
      await api.post('/affiliate/enroll', {});
      await load();
    } catch {
      setError(isFr ? "L'inscription au programme a échoué." : 'Enrolling failed.');
    } finally {
      setEnrolling(false);
    }
  };

  const link = summary ? `https://qwillio.com/?ref=${summary.code}` : '';

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf8] px-6 py-24">
        <div className="mx-auto max-w-[900px] animate-pulse space-y-4">
          <div className="h-8 w-56 rounded-lg bg-[#1d1d1f]/10" />
          <div className="h-28 rounded-2xl bg-[#1d1d1f]/[0.06]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] px-6 py-20 text-[#1d1d1f]">
      <div className="mx-auto max-w-[900px]">
        <Link to="/affiliate" className="mb-8 inline-flex items-center gap-1.5 text-sm text-[#86868b] transition-colors hover:text-[#1d1d1f]">
          <ArrowLeft size={14} aria-hidden="true" />
          {isFr ? 'Le programme' : 'The programme'}
        </Link>

        <h1 className="mb-2 text-[clamp(1.9rem,4vw,2.8rem)] font-semibold tracking-[-0.035em]">
          {isFr ? 'Espace affilié' : 'Affiliate dashboard'}
        </h1>

        {error && (
          <p role="alert" className="mb-6 rounded-xl border border-[#cd6afb]/30 bg-[#cd6afb]/10 px-4 py-3 text-sm">
            {error}
          </p>
        )}

        {!summary ? (
          <div className="rounded-[1.5rem] border border-[#1d1d1f]/10 bg-white p-8">
            <p className="mb-6 max-w-[520px] text-[15px] leading-relaxed text-[#525257]">
              {isFr
                ? "Vous n'êtes pas encore inscrit au programme. Rejoignez-le pour obtenir votre lien de parrainage et suivre vos commissions."
                : 'You are not enrolled yet. Join to get your referral link and follow your commissions.'}
            </p>
            <button
              type="button"
              onClick={enroll}
              disabled={enrolling}
              className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white transition-colors duration-300 hover:bg-[#7a5fff] disabled:opacity-50"
            >
              {enrolling ? (isFr ? 'Inscription…' : 'Enrolling…') : (isFr ? 'Rejoindre le programme' : 'Join the programme')}
            </button>
          </div>
        ) : (
          <>
            {/* Referral link */}
            <div className="mb-5 rounded-[1.5rem] border border-[#1d1d1f]/10 bg-white p-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#86868b]">
                {isFr ? 'Votre lien' : 'Your link'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <code className="flex-1 truncate rounded-xl bg-[#1d1d1f]/[0.04] px-4 py-3 text-sm">{link}</code>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#7a5fff]"
                >
                  {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copied ? (isFr ? 'Copié' : 'Copied') : (isFr ? 'Copier' : 'Copy')}
                </button>
              </div>
              <p className="mt-3 text-[13px] text-[#86868b]">
                {isFr
                  ? `Commission de ${Math.round(summary.commissionPct * 100)} % sur chaque facture payée par vos filleuls.`
                  : `${Math.round(summary.commissionPct * 100)}% of every invoice your referrals pay.`}
              </p>
            </div>

            {/* Totals */}
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Users, label: isFr ? 'Filleuls' : 'Referrals', value: String(summary.totals.referrals) },
                { icon: Clock, label: isFr ? 'En attente' : 'Pending', value: money(summary.totals.pendingEur) },
                { icon: Wallet, label: isFr ? 'Versé' : 'Paid out', value: money(summary.totals.paidEur) },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-[#1d1d1f]/10 bg-white p-5">
                  <card.icon size={15} className="mb-3 text-[#7a5fff]" aria-hidden="true" />
                  <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
                  <p className="text-[13px] text-[#86868b]">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Referrals */}
            <div className="rounded-[1.5rem] border border-[#1d1d1f]/10 bg-white p-6">
              <h2 className="mb-4 text-[15px] font-semibold">{isFr ? 'Vos filleuls' : 'Your referrals'}</h2>
              {summary.referrals.length === 0 ? (
                <p className="text-[14px] text-[#86868b]">
                  {isFr
                    ? "Aucun filleul pour l'instant. Partagez votre lien pour démarrer."
                    : 'No referrals yet. Share your link to get started.'}
                </p>
              ) : (
                <ul className="divide-y divide-[#1d1d1f]/[0.07]">
                  {summary.referrals.map((r) => (
                    <li key={r.clientId} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium">{r.businessName}</p>
                        <p className="text-[12px] text-[#86868b]">
                          {isFr ? 'Depuis le' : 'Since'} {new Date(r.since).toLocaleDateString(isFr ? 'fr-BE' : 'en-GB')}
                        </p>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-[#1d1d1f]/[0.05] px-3 py-1 text-[11px] font-medium capitalize">
                        {r.planType}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
