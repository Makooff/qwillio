import { useMemo } from 'react';
import { useSEO } from '../../../hooks/useSEO';
import { useLang } from '../../../stores/langStore';
import { SerifWord } from '../../../components/v2/Primitives';
import LegalShell, {
  LEGAL_LINK,
  LegalCloser,
  LegalH3,
  LegalList,
  LegalNote,
  LegalP,
  LegalSection,
  LegalTable,
  type LegalSectionRef,
} from '../../../components/v2/LegalShell';

/* Conditions générales V2 « Papier & Signal ».
   Seules conditions du site (la copie V1 a été supprimée le 16/08/2026),
   y compris la divulgation FTC de renouvellement automatique. */

export default function Terms() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: 'Terms of Service',
    description:
      'Qwillio terms of service: usage terms for the AI receptionist and business automation platform.',
    canonical: 'https://qwillio.com/terms',
    noindex: true,
  });

  const sections: LegalSectionRef[] = useMemo(
    () => [
      { id: 'acceptance', label: isFr ? '1. Acceptation' : '1. Acceptance' },
      { id: 'free-trial', label: isFr ? '2. Essai gratuit' : '2. Free Trial' },
      { id: 'pricing', label: isFr ? '3. Tarification' : '3. Pricing' },
      { id: 'billing', label: isFr ? '4. Facturation' : '4. Billing' },
      { id: 'cancellation', label: isFr ? '5. Annulation' : '5. Cancellation' },
      { id: 'ai-disclosure', label: isFr ? '6. Divulgation IA' : '6. AI Disclosure' },
      {
        id: 'acceptable-use',
        label: isFr ? '7. Utilisation acceptable' : '7. Acceptable Use',
      },
      {
        id: 'liability',
        label: isFr ? '8. Limitation de responsabilité' : '8. Limitation of Liability',
      },
      { id: 'governing-law', label: isFr ? '9. Droit applicable' : '9. Governing Law' },
      { id: 'changes', label: isFr ? '10. Modifications' : '10. Changes' },
      { id: 'contact', label: isFr ? '11. Contact' : '11. Contact' },
    ],
    [isFr],
  );

  const corePlans = [
    { plan: 'Solo', price: '99 €/mo', minutes: '250', overage: '0,45 € / min' },
    { plan: 'Starter', price: '249 €/mo', minutes: '750', overage: '0,39 € / min' },
    { plan: 'Pro', price: '599 €/mo', minutes: '2,000', overage: '0,35 € / min' },
    { plan: 'Enterprise', price: '1,290 €/mo', minutes: '5,000', overage: '0,30 € / min' },
  ];

  const addOns: { addon: string; price: string }[] = [
    { addon: 'Email AI', price: '+$197/mo' },
    { addon: 'Payments AI', price: '+$97/mo' },
    { addon: 'Accounting AI', price: '+$297/mo' },
    { addon: 'Inventory AI', price: '+$197/mo' },
    {
      addon: `Agent Bundle (${isFr ? 'tous les modules' : 'all add-ons'})`,
      price: '+$597/mo',
    },
  ];

  return (
    <LegalShell
      eyebrow={isFr ? 'Document juridique' : 'Legal document'}
      title={
        isFr ? (
          <>
            Conditions <SerifWord>générales</SerifWord> d'utilisation.
          </>
        ) : (
          <>
            Terms of <SerifWord>service.</SerifWord>
          </>
        )
      }
      updatedISO="2026-03-01"
      updatedLabel={isFr ? '1er mars 2026' : 'March 1, 2026'}
      meta={isFr ? 'Lecture : 6 min' : '6 min read'}
      sections={sections}
    >
      <LegalNote
        label={isFr ? 'Important' : 'Important'}
        ariaLabel={isFr ? 'Renouvellement automatique' : 'Automatic renewal notice'}
      >
        <p>
          <strong className="font-medium text-q2-ink">
            {isFr ? 'Renouvellement automatique. ' : 'Automatic renewal. '}
          </strong>
          {isFr
            ? "Votre abonnement Qwillio se renouvelle automatiquement à la fin de chaque période de facturation au tarif en vigueur, sauf annulation avant la date de renouvellement. L'essai gratuit de 7 jours se convertit automatiquement en abonnement payant à son terme. Vous pouvez annuler à tout moment depuis votre tableau de bord."
            : 'Your Qwillio subscription automatically renews at the end of each billing period at the then-current rate unless you cancel before the renewal date. The 7 day free trial automatically converts to a paid subscription at the end of the trial period. You may cancel at any time from your dashboard.'}
        </p>
      </LegalNote>

      <LegalSection id="acceptance" title={isFr ? 'Acceptation' : 'Acceptance'}>
        <LegalP>
          {isFr
            ? "En accédant ou en utilisant les services de Qwillio LLC (« Qwillio »), vous acceptez d'être lié par les présentes conditions. Si vous n'êtes pas d'accord, veuillez ne pas utiliser nos services."
            : 'By accessing or using the services of Qwillio LLC ("Qwillio"), you agree to be bound by these terms. If you do not agree, please do not use our services.'}
        </LegalP>
      </LegalSection>

      <LegalSection id="free-trial" title={isFr ? 'Essai gratuit' : 'Free trial'}>
        <LegalList
          items={
            isFr
              ? [
                  'Durée : 7 jours.',
                  "Carte de crédit requise à l'inscription.",
                  "Se renouvelle automatiquement en abonnement payant à la fin de la période d'essai.",
                  'Limité à un essai par personne physique et par entreprise.',
                  'Nous nous réservons le droit de révoquer les essais abusifs et de facturer au tarif standard.',
                ]
              : [
                  'Duration: 7 days.',
                  'Credit card required at signup.',
                  'Automatically renews into a paid subscription at the end of the trial period.',
                  'Limited to one trial per natural person and per business.',
                  'We reserve the right to revoke abusive trials and charge at the standard rate.',
                ]
          }
        />
      </LegalSection>

      <LegalSection id="pricing" title={isFr ? 'Tarification' : 'Pricing'}>
        <LegalP>
          {isFr
            ? "Tous les prix sont en USD, facturés mensuellement. Aucun frais d'installation."
            : 'All prices are in USD, billed monthly. No setup fees.'}
        </LegalP>

        <LegalH3>{isFr ? 'Forfaits principaux' : 'Core plans'}</LegalH3>
        <LegalTable
          caption={isFr ? 'Forfaits principaux Qwillio' : 'Qwillio core plans'}
          head={[
            isFr ? 'Forfait' : 'Plan',
            isFr ? 'Prix mensuel' : 'Monthly price',
            isFr ? 'Minutes incluses' : 'Included minutes',
            isFr ? 'Dépassement' : 'Overage',
          ]}
          rows={corePlans.map((p) => [
            p.plan,
            <span className="tabular-nums">{p.price}</span>,
            <span className="tabular-nums">{p.minutes}</span>,
            <span className="tabular-nums">{p.overage}</span>,
          ])}
        />

        <LegalH3>{isFr ? 'Modules complémentaires' : 'Agent add-ons'}</LegalH3>
        <LegalTable
          caption={isFr ? 'Modules complémentaires Qwillio' : 'Qwillio agent add-ons'}
          head={[isFr ? 'Module' : 'Add-on', isFr ? 'Prix mensuel' : 'Monthly price']}
          rows={addOns.map((a) => [a.addon, <span className="tabular-nums">{a.price}</span>])}
        />
      </LegalSection>

      <LegalSection id="billing" title={isFr ? 'Facturation' : 'Billing'}>
        <LegalList
          items={
            isFr
              ? [
                  'Facturation mensuelle via Stripe.',
                  "En cas d'échec de paiement, nous effectuons 3 tentatives de relance.",
                  "Après 3 échecs, votre compte est suspendu jusqu'à régularisation.",
                  "Les dépassements d'appels sont facturés au cycle suivant.",
                ]
              : [
                  'Monthly billing via Stripe.',
                  'On payment failure, we retry 3 times.',
                  'After 3 failures, your account is suspended until payment is resolved.',
                  'Call overages are billed on the next billing cycle.',
                ]
          }
        />
      </LegalSection>

      <LegalSection id="cancellation" title={isFr ? 'Annulation' : 'Cancellation'}>
        <LegalList
          items={
            isFr
              ? [
                  'Vous pouvez annuler à tout moment depuis votre tableau de bord.',
                  "L'annulation prend effet à la fin de la période de facturation en cours.",
                  "Aucun remboursement au prorata n'est effectué.",
                  'Vos données sont conservées 30 jours après résiliation, puis supprimées.',
                ]
              : [
                  'You may cancel at any time from your dashboard.',
                  'Cancellation takes effect at the end of the current billing period.',
                  'No prorated refunds are issued.',
                  'Your data is retained for 30 days after cancellation, then deleted.',
                ]
          }
        />
      </LegalSection>

      <LegalSection id="ai-disclosure" title={isFr ? 'Divulgation IA' : 'AI disclosure'}>
        <LegalP>
          {isFr
            ? "Qwillio utilise l'intelligence artificielle pour traiter les appels, générer des réponses et effectuer des actions au nom de votre entreprise. Les appelants sont informés qu'ils interagissent avec un assistant IA. Bien que nous nous efforcions d'assurer l'exactitude, les réponses générées par l'IA peuvent contenir des erreurs. Vous êtes responsable de la supervision des actions de l'agent."
            : "Qwillio uses artificial intelligence to process calls, generate responses, and perform actions on behalf of your business. Callers are informed that they are interacting with an AI assistant. While we strive for accuracy, AI generated responses may contain errors. You are responsible for overseeing the agent's actions."}
        </LegalP>
      </LegalSection>

      <LegalSection id="acceptable-use" title={isFr ? 'Utilisation acceptable' : 'Acceptable use'}>
        <LegalP>{isFr ? 'Vous vous engagez à ne pas :' : 'You agree not to:'}</LegalP>
        <LegalList
          items={
            isFr
              ? [
                  'Utiliser le service à des fins illégales ou frauduleuses.',
                  "Abuser du système d'essai gratuit (comptes multiples, identités fictives).",
                  "Tenter de contourner les limites d'appels ou les mesures de sécurité.",
                  'Revendre ou redistribuer le service sans autorisation.',
                ]
              : [
                  'Use the service for illegal or fraudulent purposes.',
                  'Abuse the free trial system (multiple accounts, fictitious identities).',
                  'Attempt to bypass call limits or security measures.',
                  'Resell or redistribute the service without authorization.',
                ]
          }
        />
      </LegalSection>

      <LegalSection
        id="liability"
        title={isFr ? 'Limitation de responsabilité' : 'Limitation of liability'}
      >
        <LegalP>
          {isFr
            ? "Dans toute la mesure permise par la loi, la responsabilité totale de Qwillio est limitée au montant des frais que vous avez payés au cours des 3 derniers mois précédant la réclamation. Qwillio ne sera en aucun cas responsable de dommages indirects, accessoires, spéciaux ou consécutifs."
            : "To the maximum extent permitted by law, Qwillio's total liability is limited to the amount of fees you paid during the 3 months preceding the claim. Qwillio shall not be liable for any indirect, incidental, special, or consequential damages."}
        </LegalP>
      </LegalSection>

      <LegalSection id="governing-law" title={isFr ? 'Droit applicable' : 'Governing law'}>
        <LegalP>
          {isFr
            ? "Pour les clients américains : ces conditions sont régies par les lois de l'État du Delaware, États-Unis. Pour les clients de l'UE : ces conditions sont régies par le droit belge, et tout litige sera soumis aux tribunaux de Bruxelles."
            : 'For US customers: these terms are governed by the laws of the State of Delaware, United States. For EU customers: these terms are governed by Belgian law, and any disputes shall be submitted to the courts of Brussels.'}
        </LegalP>
      </LegalSection>

      <LegalSection id="changes" title={isFr ? 'Modifications' : 'Changes'}>
        <LegalP>
          {isFr
            ? "Nous pouvons modifier ces conditions avec un préavis de 30 jours par e-mail. Votre utilisation continue après notification vaut acceptation des nouvelles conditions."
            : "We may modify these terms with 30 days' notice by email. Your continued use after notification constitutes acceptance of the updated terms."}
        </LegalP>
      </LegalSection>

      <LegalSection id="contact" title={isFr ? 'Contact' : 'Contact'} last>
        <address className="not-italic">
          <p className="font-medium text-q2-ink">Qwillio LLC</p>
          <p className="text-q2-body">
            {isFr ? 'E-mail : ' : 'Email: '}
            <a href="mailto:hello@qwillio.com" className={LEGAL_LINK}>
              hello@qwillio.com
            </a>
          </p>
        </address>
      </LegalSection>

      <LegalCloser>
        {isFr ? 'Des questions ? Écrivez-nous à ' : 'Questions? Write to '}
        <a href="mailto:hello@qwillio.com" className={LEGAL_LINK}>
          hello@qwillio.com
        </a>
        .
      </LegalCloser>
    </LegalShell>
  );
}
