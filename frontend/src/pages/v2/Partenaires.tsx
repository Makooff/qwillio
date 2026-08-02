import { ArrowRight, Check } from 'lucide-react';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';

/* Partenaires fiduciaires V2 « Papier & Signal », voir DA/v2-direction.md.
   Copie FR/EN, useSEO, calculs de commission et CTA mailto portés de la V1
   (pages/Partenaires.tsx). Aucun montant n'est recalculé autrement. */

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
    <PublicShell>
      {/* HERO: titre whisper à gauche, promesse à droite */}
      <Section
        aria-label={isFr ? 'Programme partenaire fiduciaire' : 'Accountancy partner program'}
        className="!pt-16 md:!pt-24"
      >
        <Container className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-end">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-6">
              {isFr ? 'Programme partenaire fiduciaire' : 'Accountancy partner program'}
            </Eyebrow>
            <Display>
              {isFr ? (
                <>
                  15&nbsp;% récurrent.
                  <br />
                  <SerifWord>À vie du client.</SerifWord>
                </>
              ) : (
                <>
                  15% recurring.
                  <br />
                  <SerifWord>For the customer's lifetime.</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1}>
            <Lead className="max-w-[440px] pb-3 q2-body-text">
              {isFr
                ? 'Chaque client fiduciaire que vous recommandez à Qwillio vous rapporte 15 % du prix mensuel HT, versés tous les mois tant qu\'il reste abonné. Aucun engagement de volume, aucune exclusivité.'
                : 'Every accountancy customer you refer to Qwillio earns you 15% of the monthly ex-VAT price, paid every month for as long as they stay subscribed. No volume commitment, no exclusivity.'}
            </Lead>
          </RevealV2>
        </Container>
      </Section>

      {/* BÉNÉFICES: blocs alternés, le texte bascule de colonne d'une rangée à l'autre */}
      <Section variant="band" hairline aria-labelledby="benefits-heading">
        <Container>
          <RevealV2 className="mb-12">
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Ce que vous touchez' : 'What you get'}
            </Eyebrow>
            <H2 id="benefits-heading" className="max-w-[640px]">
              {isFr ? 'Ce que vous touchez, sans effort commercial.' : 'What you get, with no sales effort.'}
            </H2>
          </RevealV2>

          <ul role="list" className="border-t border-q2-plate">
            {benefits.map((b, i) => {
              const flipped = i % 2 === 1;
              return (
                <RevealV2 key={b} index={i} as="li" className="border-b border-q2-plate">
                  <div className="grid md:grid-cols-2 gap-4 md:gap-10 py-7 items-baseline">
                    <div
                      className={`flex items-start gap-3 ${flipped ? 'md:col-start-2' : 'md:col-start-1'}`}
                    >
                      <Check size={16} className="shrink-0 mt-1 text-q2-indigo" aria-hidden="true" />
                      <span className="text-[17px] leading-relaxed text-q2-ink font-light tracking-tight">{b}</span>
                    </div>
                  </div>
                </RevealV2>
              );
            })}
          </ul>
        </Container>
      </Section>

      {/* SCÉNARIOS: drenched indigo, rangées hairline, montants en tabular-nums */}
      <Section variant="drenched-indigo" aria-labelledby="scenarios-heading">
        <Container>
          <RevealV2 className="mb-12">
            <Eyebrow tone="indigo" onDark className="mb-4">
              {isFr ? 'Ordres de grandeur' : 'Ballpark'}
            </Eyebrow>
            <H2 id="scenarios-heading" onDark className="max-w-[640px]">
              {isFr ? 'Combien vous pourriez toucher.' : 'How much you could earn.'}
            </H2>
          </RevealV2>

          <ul className="border-t border-q2-graphite-d" role="list">
            {scenarios.map((s, i) => (
              <RevealV2 key={s.title} index={i} as="li" className="border-b border-q2-graphite-d">
                <div className="grid md:grid-cols-[1fr_1.6fr] gap-3 md:gap-10 py-8 md:py-10 items-baseline">
                  <div>
                    <p className="text-white text-lg font-light tracking-tight">{s.title}</p>
                    <p className="mt-1.5 text-[13px] text-q2-fog tabular-nums q2-body-text">{s.math}</p>
                  </div>
                  <p className="text-[clamp(1.2rem,2vw,1.7rem)] font-light tracking-[-0.02em] leading-[1.2] text-q2-mist tabular-nums">
                    {s.detail}
                  </p>
                </div>
              </RevealV2>
            ))}
          </ul>

          <RevealV2 index={3}>
            <p className="mt-8 text-[13px] text-q2-fog max-w-[720px] leading-relaxed q2-body-text">
              {isFr
                ? 'Les montants supposent que les clients restent abonnés 12 mois. La commission est versée tous les mois tant que le client reste actif.'
                : 'Amounts assume customers stay subscribed for 12 months. Commission is paid every month for as long as the customer remains active.'}
            </p>
          </RevealV2>
        </Container>
      </Section>

      {/* PROCESSUS: rangées hairline numérotées */}
      <Section aria-labelledby="steps-heading">
        <Container>
          <RevealV2 className="mb-12">
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Processus' : 'Process'}
            </Eyebrow>
            <H2 id="steps-heading" className="max-w-[640px]">
              {isFr ? 'Comment ça marche.' : 'How it works.'}
            </H2>
          </RevealV2>

          <ol role="list" className="border-t border-q2-plate max-w-[900px]">
            {stepRows.map(([num, text], i) => (
              <RevealV2 key={num} index={i} as="li" className="border-b border-q2-plate">
                <div className="grid grid-cols-[64px_1fr] gap-4 md:gap-8 py-7 items-baseline">
                  <p className="q2-price text-q2-plate select-none tabular-nums" aria-hidden="true">
                    {num}
                  </p>
                  <p className="text-[17px] leading-relaxed text-q2-ink font-light tracking-tight">{text}</p>
                </div>
              </RevealV2>
            ))}
          </ol>
        </Container>
      </Section>

      {/* CTA FINAL: drenched violet, mailto partenaire conservé */}
      <Section
        variant="drenched-violet"
        aria-label={isFr ? 'Devenir partenaire' : 'Become a partner'}
        className="border-t border-q2-graphite-d"
      >
        <Container className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-end">
          <RevealV2>
            <Display as="h2" onDark className="!text-[clamp(2.2rem,4.5vw,3.6rem)] max-w-[640px]">
              {isFr ? (
                <>
                  Prêt à toucher une commission <SerifWord>récurrente&nbsp;?</SerifWord>
                </>
              ) : (
                <>
                  Ready to earn a <SerifWord>recurring commission?</SerifWord>
                </>
              )}
            </Display>
            <p className="mt-7 text-q2-fog text-[15px] leading-relaxed max-w-[540px] q2-body-text">
              {isFr
                ? 'Envoyez-nous un email avec la mention "OK partenaire" et nous vous envoyons dans les 24 heures le contrat, la brochure PDF, votre code partenaire et l\'accès au tableau de bord.'
                : 'Send us an email with "OK partner" and within 24 hours we send you the contract, the PDF brochure, your partner code and the dashboard access.'}
            </p>
          </RevealV2>

          <RevealV2 index={1} className="flex flex-wrap items-center gap-3 lg:justify-end pb-2">
            <PillLink to="mailto:partenaires@qwillio.com?subject=OK%20partenaire" variant="chromatic" size="lg">
              {isFr ? 'Envoyer un email' : 'Send an email'}
              <ArrowRight size={16} aria-hidden="true" />
            </PillLink>
            <PillLink to="/contact" variant="onDark" size="lg">
              {isFr ? 'Prendre 15 min de démo' : 'Book 15 min demo'}
            </PillLink>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
