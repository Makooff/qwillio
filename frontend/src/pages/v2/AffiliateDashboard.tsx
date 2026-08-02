import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, Users, Wallet, Clock, ArrowLeft, type LucideIcon } from 'lucide-react';
import api from '../../services/api';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display } from '../../components/v2/Primitives';
import { PillButton } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import CardV2 from '../../components/v2/CardV2';

/* Espace affilié V2 « Papier & Signal », voir DA/v2-direction.md.
   Contrat API, états et copie portés tels quels de la V1 (pages/AffiliateDashboard.tsx).
   Seul ajout: le chrome PublicShell, absent de la V1. */

interface Summary {
  code: string;
  commissionPct: number;
  status: string;
  payoutEmail: string | null;
  totals: { referrals: number; pendingEur: number; paidEur: number; lifetimeEur: number };
  referrals: { clientId: string; businessName: string; planType: string; subscriptionStatus: string; since: string }[];
  commissions: { id: string; amountEur: number; invoiceAmountEur: number; status: string; createdAt: string; paidAt: string | null }[];
}

const money = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

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
      // 404 simply means "signed in, but not enrolled yet", an offer rather than an error.
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
      <PublicShell>
        <Section className="!pt-16 md:!pt-24">
          <Container>
            <div className="max-w-[900px] animate-pulse space-y-4" aria-hidden="true">
              <div className="h-9 w-56 rounded-full bg-q2-band" />
              <div className="h-28 rounded-[20px] bg-q2-band" />
              <div className="h-40 rounded-[20px] bg-q2-band" />
            </div>
            <p className="sr-only" role="status">
              {isFr ? 'Chargement de votre espace affilié.' : 'Loading your affiliate dashboard.'}
            </p>
          </Container>
        </Section>
      </PublicShell>
    );
  }

  const totals: { icon: LucideIcon; label: string; value: string }[] = summary
    ? [
        { icon: Users, label: isFr ? 'Filleuls' : 'Referrals', value: String(summary.totals.referrals) },
        { icon: Clock, label: isFr ? 'En attente' : 'Pending', value: money(summary.totals.pendingEur) },
        { icon: Wallet, label: isFr ? 'Versé' : 'Paid out', value: money(summary.totals.paidEur) },
      ]
    : [];

  return (
    <PublicShell>
      <Section aria-label={isFr ? 'Espace affilié' : 'Affiliate dashboard'} className="!pt-16 md:!pt-24">
        <Container>
          <div className="max-w-[900px]">
            <RevealV2>
              <Link
                to="/affiliate"
                className="mb-8 inline-flex items-center gap-1.5 text-sm text-q2-body hover:text-q2-ink transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-md"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                {isFr ? 'Le programme' : 'The programme'}
              </Link>

              <Eyebrow tone="indigo" className="mb-4">
                {isFr ? 'Affiliation' : 'Affiliate'}
              </Eyebrow>
              <Display className="!text-[clamp(2.2rem,4.5vw,3.4rem)]">
                {isFr ? 'Espace affilié' : 'Affiliate dashboard'}
              </Display>
            </RevealV2>

            {error && (
              <p
                role="alert"
                className="mt-8 rounded-xl border border-q2-plate bg-q2-band px-4 py-3 text-sm text-q2-ink"
              >
                {error}
              </p>
            )}

            {!summary ? (
              <RevealV2 index={1} className="mt-10">
                <CardV2 variant="band">
                  <p className="mb-7 max-w-[520px] text-[15px] leading-relaxed text-q2-body q2-body-text">
                    {isFr
                      ? "Vous n'êtes pas encore inscrit au programme. Rejoignez-le pour obtenir votre lien de parrainage et suivre vos commissions."
                      : 'You are not enrolled yet. Join to get your referral link and follow your commissions.'}
                  </p>
                  <PillButton
                    type="button"
                    onClick={enroll}
                    disabled={enrolling}
                    size="lg"
                    className="disabled:opacity-50"
                  >
                    {enrolling ? (isFr ? 'Inscription…' : 'Enrolling…') : isFr ? 'Rejoindre le programme' : 'Join the programme'}
                  </PillButton>
                </CardV2>
              </RevealV2>
            ) : (
              <>
                {/* Lien de parrainage */}
                <RevealV2 index={1} className="mt-10">
                  <CardV2 variant="band">
                    <Eyebrow tone="neutral" className="mb-3">
                      {isFr ? 'Votre lien' : 'Your link'}
                    </Eyebrow>
                    <div className="flex flex-wrap items-center gap-3">
                      <code className="flex-1 min-w-[240px] truncate rounded-xl border border-q2-plate bg-q2-canvas px-4 py-3 text-sm text-q2-ink">
                        {link}
                      </code>
                      <PillButton type="button" onClick={copy}>
                        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                        {copied ? (isFr ? 'Copié' : 'Copied') : isFr ? 'Copier' : 'Copy'}
                      </PillButton>
                    </div>
                    <p className="mt-4 text-[13px] text-q2-faint q2-body-text">
                      {isFr
                        ? `Commission de ${Math.round(summary.commissionPct * 100)} % sur chaque facture payée par vos filleuls.`
                        : `${Math.round(summary.commissionPct * 100)}% of every invoice your referrals pay.`}
                    </p>
                  </CardV2>
                </RevealV2>

                {/* Totaux: rangées hairline, jamais une grille de tuiles métriques */}
                <RevealV2 index={2} className="mt-12">
                  <Eyebrow tone="neutral" className="mb-4">
                    {isFr ? 'Vos totaux' : 'Your totals'}
                  </Eyebrow>
                  <dl className="border-t border-q2-plate">
                    {totals.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-baseline justify-between gap-6 border-b border-q2-plate py-5"
                      >
                        <dt className="flex items-center gap-2.5 text-[15px] text-q2-graphite">
                          <row.icon size={14} className="shrink-0 text-q2-indigo" aria-hidden="true" />
                          {row.label}
                        </dt>
                        <dd className="text-2xl font-light tracking-tight tabular-nums text-q2-ink">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </RevealV2>

                {/* Filleuls: table sobre, hairline */}
                <RevealV2 index={3} className="mt-12">
                  <Eyebrow tone="neutral" className="mb-4">
                    {isFr ? 'Vos filleuls' : 'Your referrals'}
                  </Eyebrow>
                  {summary.referrals.length === 0 ? (
                    <p className="border-t border-q2-plate pt-5 text-[15px] text-q2-body q2-body-text">
                      {isFr
                        ? "Aucun filleul pour l'instant. Partagez votre lien pour démarrer."
                        : 'No referrals yet. Share your link to get started.'}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left border-collapse">
                        <caption className="sr-only">{isFr ? 'Vos filleuls' : 'Your referrals'}</caption>
                        <thead>
                          <tr className="border-y border-q2-plate">
                            <th scope="col" className="q2-eyebrow text-q2-faint py-3 pr-4">
                              {isFr ? 'Entreprise' : 'Business'}
                            </th>
                            <th scope="col" className="q2-eyebrow text-q2-faint py-3 pr-4">
                              {isFr ? 'Depuis le' : 'Since'}
                            </th>
                            <th scope="col" className="q2-eyebrow text-q2-faint py-3 text-right">
                              {isFr ? 'Formule' : 'Plan'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.referrals.map((r) => (
                            <tr key={r.clientId} className="border-b border-q2-plate">
                              <td className="py-4 pr-4 text-[15px] text-q2-ink">{r.businessName}</td>
                              <td className="py-4 pr-4 text-[14px] tabular-nums text-q2-body">
                                {new Date(r.since).toLocaleDateString(isFr ? 'fr-BE' : 'en-GB')}
                              </td>
                              <td className="py-4 text-right">
                                <span className="inline-flex items-center rounded-full border border-q2-plate bg-q2-band px-3 py-1 text-[12px] font-medium capitalize text-q2-graphite">
                                  {r.planType}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </RevealV2>
              </>
            )}
          </div>
        </Container>
      </Section>
    </PublicShell>
  );
}
