import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import { useSEO } from '../hooks/useSEO';
import Reveal from '../components/ui/Reveal';
import Card3D from '../components/ui/Card3D';

export default function Partenaires() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: isFr
      ? 'Programme partenaire fiduciaire · Qwillio'
      : 'Accountancy partner program · Qwillio',
    description: isFr
      ? 'Fiduciaires belges et françaises : touchez 15 % de commission récurrente sur chaque client Qwillio recommandé, tant qu\'il reste abonné. Contrat 1 page, sans exclusivité, sans engagement de volume.'
      : 'Belgian and French accountancy firms: earn a recurring 15% commission on every Qwillio customer you refer, for as long as they stay subscribed. One-page contract, no exclusivity, no volume commitment.',
    canonical: 'https://qwillio.com/partenaires-fiduciaires',
  });

  const benefits = isFr
    ? [
        '15 % de commission récurrente sur le prix mensuel HT.',
        'Versée mensuellement, tant que le client reste abonné.',
        'Sans plafond, sans exclusivité, sans engagement de volume.',
        'Contrat 1 page, résiliable au mois par les deux parties.',
        'Nous prenons en charge onboarding, support et facturation client.',
        'Tableau de bord partenaire mis à jour en temps réel.',
      ]
    : [
        'Recurring 15% commission on the monthly ex-VAT price.',
        'Paid monthly, for as long as the customer stays subscribed.',
        'No cap, no exclusivity, no volume commitment.',
        'One-page contract, cancellable monthly by either party.',
        'We handle onboarding, support and customer billing.',
        'Real-time partner dashboard.',
      ];

  const stepRows = isFr
    ? [
        ['1', 'Vous signez le contrat 1 page. 5 minutes.'],
        ['2', 'Vous recevez un code partenaire + brochure client PDF + email prêt à envoyer.'],
        ['3', 'Vos clients souscrivent avec votre code à l\'inscription.'],
        ['4', 'Le tracking est automatique. Commission versée le mois suivant.'],
      ]
    : [
        ['1', 'You sign the one-page contract. 5 minutes.'],
        ['2', 'You get a partner code, a client PDF brochure and a ready-to-send email.'],
        ['3', 'Your clients sign up with your code at registration.'],
        ['4', 'Tracking is automatic. Commission paid the following month.'],
      ];

  const solo = 149;
  const starter = 470; // EUR approx
  const commission = (price: number) => Math.round(price * 0.15);

  const scenarios = isFr
    ? [
        {
          title: '10 clients Solo',
          detail: `${10 * commission(solo)} € / mois soit ${10 * commission(solo) * 12} € / an`,
          math: `10 × ${solo} € × 15 %`,
        },
        {
          title: '10 clients Starter',
          detail: `${10 * commission(starter)} € / mois soit ${10 * commission(starter) * 12} € / an`,
          math: `10 × ~${starter} € × 15 %`,
        },
        {
          title: 'Mix 5 Solo + 5 Starter',
          detail: `${5 * commission(solo) + 5 * commission(starter)} € / mois soit ${(5 * commission(solo) + 5 * commission(starter)) * 12} € / an`,
          math: `5 × ${solo} € + 5 × ~${starter} €, tous à 15 %`,
        },
      ]
    : [
        {
          title: '10 Solo clients',
          detail: `${10 * commission(solo)} EUR / month, ${10 * commission(solo) * 12} EUR / year`,
          math: `10 × ${solo} EUR × 15%`,
        },
        {
          title: '10 Starter clients',
          detail: `${10 * commission(starter)} EUR / month, ${10 * commission(starter) * 12} EUR / year`,
          math: `10 × ~${starter} EUR × 15%`,
        },
        {
          title: 'Mix 5 Solo + 5 Starter',
          detail: `${5 * commission(solo) + 5 * commission(starter)} EUR / month, ${(5 * commission(solo) + 5 * commission(starter)) * 12} EUR / year`,
          math: `5 × ${solo} EUR + 5 × ~${starter} EUR, all at 15%`,
        },
      ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main aria-labelledby="partenaires-heading">
        {/* HERO */}
        <section className="pt-32 md:pt-40 pb-14 md:pb-20 px-6">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
            <Reveal>
              <div>
                <span
                  className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-4"
                  style={{ color: '#6366f1' }}
                >
                  {isFr ? 'Programme partenaire fiduciaire' : 'Accountancy partner program'}
                </span>
                <h1
                  id="partenaires-heading"
                  className="text-[clamp(2.6rem,5.6vw,4.8rem)] font-semibold tracking-[-0.04em] leading-[1.0]"
                >
                  {isFr ? (
                    <>
                      15 % récurrent.<br />
                      <span className="font-serif italic" style={{ color: '#6366f1' }}>À vie du client.</span>
                    </>
                  ) : (
                    <>
                      15% recurring.<br />
                      <span className="font-serif italic" style={{ color: '#6366f1' }}>For the customer's lifetime.</span>
                    </>
                  )}
                </h1>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="text-[#525257] text-[15px] leading-relaxed max-w-[420px]">
                {isFr
                  ? 'Chaque client fiduciaire que vous recommandez à Qwillio vous rapporte 15 % du prix mensuel HT, versés tous les mois tant qu\'il reste abonné. Aucun engagement de volume, aucune exclusivité.'
                  : 'Every accountancy customer you refer to Qwillio earns you 15% of the monthly ex-VAT price, paid every month for as long as they stay subscribed. No volume commitment, no exclusivity.'}
              </p>
            </Reveal>
          </div>
        </section>

        {/* BENEFITS */}
        <section
          aria-labelledby="benefits-heading"
          className="px-6 pb-16 md:pb-24 border-t border-[#1d1d1f]/8 pt-14 md:pt-20"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
              <h2
                id="benefits-heading"
                className="text-[clamp(1.7rem,3vw,2.4rem)] font-semibold tracking-[-0.025em] mb-8 max-w-[640px]"
              >
                {isFr
                  ? 'Ce que vous touchez, sans effort commercial.'
                  : 'What you get, with no sales effort.'}
              </h2>
            </Reveal>
            <ul role="list" className="grid sm:grid-cols-2 gap-4">
              {benefits.map((b, i) => (
                <Reveal key={i} delay={0.04 * i}>
                  <li className="flex items-start gap-3 rounded-2xl p-4 border border-[#1d1d1f]/10 bg-[#fafaf8]">
                    <Check size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#6366f1' }} aria-hidden="true" />
                    <span className="text-[15px] text-[#1d1d1f] leading-relaxed">{b}</span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* SCENARIOS */}
        <section
          aria-labelledby="scenarios-heading"
          className="px-6 pb-16 md:pb-24 border-t border-[#1d1d1f]/8 pt-14 md:pt-20"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
              <h2
                id="scenarios-heading"
                className="text-[clamp(1.7rem,3vw,2.4rem)] font-semibold tracking-[-0.025em] mb-8 max-w-[640px]"
              >
                {isFr
                  ? 'Combien vous pourriez toucher.'
                  : 'How much you could earn.'}
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-4">
              {scenarios.map((s, i) => (
                <Reveal key={i} delay={0.06 * i}>
                  <article className="rounded-3xl p-6 border border-[#1d1d1f]/10 bg-[#fafaf8] h-full">
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-3"
                      style={{ color: '#a855f7' }}
                    >
                      {s.title}
                    </p>
                    <p className="text-[clamp(1.2rem,2vw,1.6rem)] font-semibold tracking-[-0.02em] leading-[1.2] text-[#1d1d1f]">
                      {s.detail}
                    </p>
                    <p className="mt-3 text-[13px] text-[#6e6e73]">{s.math}</p>
                  </article>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.24}>
              <p className="mt-5 text-[13px] text-[#6e6e73] max-w-[720px]">
                {isFr
                  ? 'Les montants supposent que les clients restent abonnés 12 mois. La commission est versée tous les mois tant que le client reste actif.'
                  : 'Amounts assume customers stay subscribed for 12 months. Commission is paid every month for as long as the customer remains active.'}
              </p>
            </Reveal>
          </div>
        </section>

        {/* STEPS */}
        <section
          aria-labelledby="steps-heading"
          className="px-6 pb-16 md:pb-24 border-t border-[#1d1d1f]/8 pt-14 md:pt-20 bg-[#fafaf8]"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
              <h2
                id="steps-heading"
                className="text-[clamp(1.7rem,3vw,2.4rem)] font-semibold tracking-[-0.025em] mb-10 max-w-[640px]"
              >
                {isFr ? 'Comment ça marche.' : 'How it works.'}
              </h2>
            </Reveal>
            <ol role="list" className="grid gap-3 md:grid-cols-2 max-w-[900px]">
              {stepRows.map(([num, text], i) => (
                <Reveal key={num} delay={0.06 * i}>
                  <li className="flex items-start gap-4 rounded-2xl p-5 border border-[#1d1d1f]/10 bg-white">
                    <span
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold tabular-nums"
                      style={{ background: 'rgba(99,102,241,0.10)', color: '#6366f1' }}
                    >
                      {num}
                    </span>
                    <span className="text-[15px] text-[#1d1d1f] leading-relaxed">{text}</span>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section
          aria-label={isFr ? 'Devenir partenaire' : 'Become a partner'}
          className="px-6 pb-24 md:pb-32 pt-16 md:pt-24"
        >
          <div className="max-w-[820px] mx-auto">
            <Reveal>
              <Card3D intensity={3}>
                <div
                  className="rounded-3xl p-8 md:p-12 text-white overflow-hidden relative"
                  style={{ background: 'linear-gradient(155deg, #1d1d1f 0%, #2a2356 55%, #6366f1 115%)' }}
                >
                  <div
                    aria-hidden="true"
                    className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-30 blur-3xl"
                    style={{ background: '#a855f7' }}
                  />
                  <h3 className="relative text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.025em] mb-4 max-w-[560px]">
                    {isFr
                      ? 'Prêt à toucher une commission récurrente ?'
                      : 'Ready to earn a recurring commission?'}
                  </h3>
                  <p className="relative text-white/75 text-[15px] leading-relaxed mb-6 max-w-[540px]">
                    {isFr
                      ? 'Envoyez-nous un email avec la mention "OK partenaire" et nous vous envoyons dans les 24 heures le contrat, la brochure PDF, votre code partenaire et l\'accès au tableau de bord.'
                      : 'Send us an email with "OK partner" and within 24 hours we send you the contract, the PDF brochure, your partner code and the dashboard access.'}
                  </p>
                  <div className="relative flex flex-wrap items-center gap-3">
                    <a
                      href="mailto:partenaires@qwillio.com?subject=OK%20partenaire"
                      className="inline-flex items-center gap-2 bg-white text-[#1d1d1f] text-sm font-medium px-5 py-3 rounded-full hover:bg-[#a5b4fc] transition-colors active:scale-[0.97]"
                    >
                      {isFr ? 'Envoyer un email' : 'Send an email'}
                      <ArrowRight size={15} aria-hidden="true" />
                    </a>
                    <Link
                      to="/contact"
                      className="inline-flex items-center gap-2 border border-white/30 text-white text-sm font-medium px-5 py-3 rounded-full hover:bg-white/10 transition-colors active:scale-[0.97]"
                    >
                      {isFr ? 'Prendre 15 min de démo' : 'Book 15 min demo'}
                    </Link>
                  </div>
                </div>
              </Card3D>
            </Reveal>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
