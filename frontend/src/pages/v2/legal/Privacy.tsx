import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useSEO } from '../../../hooks/useSEO';
import { useLang } from '../../../stores/langStore';
import { SerifWord } from '../../../components/v2/Primitives';
import LegalShell, {
  LEGAL_LINK,
  LegalCloser,
  LegalList,
  LegalP,
  LegalSection,
  LegalTable,
  type LegalSectionRef,
} from '../../../components/v2/LegalShell';

/* Politique de confidentialité V2 « Papier & Signal ».
   Contenu FR/EN porté à l'identique depuis pages/legal/Privacy.tsx. */

export default function Privacy() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: 'Privacy Policy',
    description:
      'Qwillio privacy policy: how we collect, use, and protect your data in compliance with GDPR and CCPA.',
    canonical: 'https://qwillio.com/privacy',
    noindex: true,
  });

  const sections: LegalSectionRef[] = useMemo(
    () => [
      { id: 'introduction', label: isFr ? 'Introduction' : 'Introduction' },
      { id: 'data-collected', label: isFr ? '1. Données collectées' : '1. Data we collect' },
      {
        id: 'data-use',
        label: isFr ? '2. Utilisation des données' : '2. How we use data',
      },
      { id: 'sub-processors', label: isFr ? '3. Sous-traitants' : '3. Sub-processors' },
      {
        id: 'data-retention',
        label: isFr ? '4. Conservation' : '4. Data retention',
      },
      {
        id: 'international',
        label: isFr ? '5. Transferts internationaux' : '5. International transfers',
      },
      {
        id: 'outbound-calling',
        label: isFr ? '6. Démarchage téléphonique' : '6. Outbound calling',
      },
      { id: 'rights', label: isFr ? '7. Vos droits' : '7. Your rights' },
      { id: 'cookies', label: isFr ? '8. Cookies' : '8. Cookies' },
      { id: 'changes', label: isFr ? '9. Modifications' : '9. Changes' },
      { id: 'contact', label: isFr ? '10. Contact' : '10. Contact' },
    ],
    [isFr],
  );

  const subProcessors = [
    { name: 'Vapi', purpose: isFr ? 'Orchestration vocale IA' : 'AI voice orchestration', region: 'USA' },
    { name: 'Twilio', purpose: isFr ? 'Téléphonie et SMS' : 'Telephony and SMS', region: 'USA' },
    { name: 'ElevenLabs', purpose: isFr ? 'Synthèse vocale' : 'Voice synthesis', region: 'USA / EU' },
    { name: 'OpenAI', purpose: isFr ? 'Modèles de langage' : 'Language models', region: 'USA' },
    { name: 'Stripe', purpose: isFr ? 'Paiements' : 'Payments', region: 'USA / EU' },
    { name: 'Resend', purpose: isFr ? 'E-mails transactionnels' : 'Transactional emails', region: 'USA' },
    { name: 'Neon', purpose: isFr ? 'Base de données' : 'Database', region: 'USA / EU' },
    { name: 'Vercel', purpose: isFr ? 'Hébergement frontend' : 'Frontend hosting', region: 'USA / EU' },
    { name: 'Render', purpose: isFr ? 'Hébergement backend' : 'Backend hosting', region: 'USA' },
  ];

  const rights = isFr
    ? [
        { name: 'Accès', desc: 'Obtenir une copie de vos données personnelles.' },
        { name: 'Rectification', desc: 'Corriger des données inexactes.' },
        { name: 'Effacement', desc: 'Demander la suppression de vos données.' },
        { name: 'Portabilité', desc: 'Recevoir vos données dans un format structuré.' },
        { name: 'Opposition', desc: 'Vous opposer à certains traitements.' },
        {
          name: 'Refus de vente (CCPA)',
          desc: "Nous ne vendons pas vos données. Si cela devait changer, vous pourrez vous désinscrire.",
        },
      ]
    : [
        { name: 'Access', desc: 'Obtain a copy of your personal data.' },
        { name: 'Rectification', desc: 'Correct inaccurate data.' },
        { name: 'Erasure', desc: 'Request deletion of your data.' },
        { name: 'Portability', desc: 'Receive your data in a structured format.' },
        { name: 'Objection', desc: 'Object to certain processing activities.' },
        {
          name: 'Opt-out of sale (CCPA)',
          desc: 'We do not sell your data. If this changes, you can opt out.',
        },
      ];

  const asideExtra = (
    <>
      <p className="q2-eyebrow text-q2-faint mb-3">{isFr ? 'Voir aussi' : 'See also'}</p>
      <Link
        to="/gdpr"
        className="flex items-center gap-1.5 text-sm text-q2-body hover:text-q2-ink transition-colors duration-150"
      >
        {isFr ? 'Vos droits RGPD' : 'Your GDPR rights'}
        <ArrowUpRight size={13} aria-hidden="true" />
      </Link>
      <Link
        to="/terms"
        className="flex items-center gap-1.5 text-sm text-q2-body hover:text-q2-ink transition-colors duration-150 mt-2"
      >
        {isFr ? "Conditions d'utilisation" : 'Terms of service'}
        <ArrowUpRight size={13} aria-hidden="true" />
      </Link>
    </>
  );

  return (
    <LegalShell
      eyebrow={isFr ? 'Politique' : 'Policy'}
      title={
        isFr ? (
          <>
            Politique de <SerifWord>confidentialité.</SerifWord>
          </>
        ) : (
          <>
            Privacy <SerifWord>policy.</SerifWord>
          </>
        )
      }
      lead={
        isFr
          ? "Comment nous collectons, utilisons et protégeons vos données. Sans détour."
          : 'How we collect, use, and protect your data. Plainly stated.'
      }
      updatedISO="2026-03-01"
      updatedLabel={isFr ? '1er mars 2026' : 'March 1, 2026'}
      meta={isFr ? 'Conforme RGPD et CCPA' : 'GDPR and CCPA compliant'}
      sections={sections}
      asideExtra={asideExtra}
    >
      <LegalSection id="introduction" title={isFr ? 'Introduction' : 'Introduction'}>
        <LegalP>
          {isFr
            ? "Qwillio LLC (« Qwillio », « nous ») s'engage à protéger votre vie privée. Cette politique explique comment nous collectons, utilisons et protégeons vos données personnelles conformément au RGPD (UE) et au CCPA (Californie)."
            : 'Qwillio LLC ("Qwillio", "we", "us") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal data in compliance with the GDPR (EU) and CCPA (California).'}
        </LegalP>
        <LegalP>
          {isFr ? 'Contact : ' : 'Contact: '}
          <a href="mailto:hello@qwillio.com" className={LEGAL_LINK}>
            hello@qwillio.com
          </a>
        </LegalP>
      </LegalSection>

      <LegalSection id="data-collected" title={isFr ? 'Données collectées' : 'Data we collect'}>
        <LegalList
          items={
            isFr
              ? [
                  'Identité : nom, adresse e-mail, numéro de téléphone.',
                  'Paiement : informations de carte (traitées par Stripe, jamais stockées chez nous).',
                  "Enregistrements d'appels et transcriptions.",
                  "Données techniques : empreinte d'appareil, adresse IP, type de navigateur.",
                  "Données d'utilisation : journaux d'interaction, préférences.",
                ]
              : [
                  'Identity: name, email address, phone number.',
                  'Payment: card information (processed by Stripe, never stored by us).',
                  'Call recordings and transcripts.',
                  'Technical data: device fingerprint, IP address, browser type.',
                  'Usage data: interaction logs, preferences.',
                ]
          }
        />
      </LegalSection>

      <LegalSection
        id="data-use"
        title={isFr ? 'Comment nous utilisons vos données' : 'How we use your data'}
      >
        <LegalList
          items={
            isFr
              ? [
                  "Fournir et améliorer nos services d'agent vocal IA.",
                  'Traiter les paiements et gérer les abonnements.',
                  'Communiquer avec vous (e-mails transactionnels et support).',
                  'Détecter et prévenir la fraude.',
                  'Respecter nos obligations légales.',
                ]
              : [
                  'Provide and improve our AI voice agent services.',
                  'Process payments and manage subscriptions.',
                  'Communicate with you (transactional emails and support).',
                  'Detect and prevent fraud.',
                  'Comply with legal obligations.',
                ]
          }
        />
      </LegalSection>

      <LegalSection id="sub-processors" title={isFr ? 'Sous-traitants' : 'Sub-processors'}>
        <LegalP className="mb-6">
          {isFr
            ? 'Nous partageons des données avec les sous-traitants suivants, chacun lié par des clauses contractuelles de protection des données.'
            : 'We share data with the following sub-processors, each bound by data protection agreements.'}
        </LegalP>
        <LegalTable
          caption={isFr ? 'Sous-traitants de Qwillio' : 'Qwillio sub-processors'}
          head={[
            isFr ? 'Sous-traitant' : 'Sub-processor',
            isFr ? 'Fonction' : 'Purpose',
            isFr ? 'Localisation' : 'Location',
          ]}
          rows={subProcessors.map((sp) => [sp.name, sp.purpose, sp.region])}
        />
      </LegalSection>

      <LegalSection id="data-retention" title={isFr ? 'Conservation des données' : 'Data retention'}>
        <LegalList
          items={
            isFr
              ? [
                  "Enregistrements d'appels et transcriptions : 90 jours après la création.",
                  "Données de compte : durée de l'abonnement + 30 jours après résiliation.",
                  'Signaux de fraude : conservés indéfiniment sous forme hachée.',
                  'Journaux de facturation : 7 ans (obligation légale).',
                ]
              : [
                  'Call recordings and transcripts: 90 days after creation.',
                  'Account data: subscription duration + 30 days after cancellation.',
                  'Fraud signals: retained indefinitely in hashed form.',
                  'Billing logs: 7 years (legal requirement).',
                ]
          }
        />
      </LegalSection>

      <LegalSection
        id="international"
        title={isFr ? 'Transferts internationaux' : 'International transfers'}
      >
        <LegalP>
          {isFr
            ? "Les données personnelles de l'UE et de l'EEE transférées vers les États-Unis sont protégées par les Clauses Contractuelles Types (CCT) approuvées par la Commission européenne. Nous mettons également en œuvre des mesures techniques supplémentaires, y compris le chiffrement au repos et en transit."
            : 'Personal data from the EU and EEA transferred to the United States is protected by Standard Contractual Clauses (SCCs) approved by the European Commission. We also implement supplementary technical measures, including encryption at rest and in transit.'}
        </LegalP>
      </LegalSection>

      <LegalSection
        id="outbound-calling"
        title={isFr ? 'Démarchage téléphonique' : 'Outbound calling disclosure'}
      >
        <LegalP>
          {isFr
            ? "Qwillio peut effectuer des appels sortants vers des lignes fixes professionnelles pour le compte de nos clients, en conformité avec le TCPA (Telephone Consumer Protection Act). Nous ne contactons jamais de numéros de téléphone mobiles ou personnels sans consentement préalable exprimé par écrit. Tous les appels sortants respectent les listes DNC (Do Not Call) fédérales et des États."
            : 'Qwillio may place outbound calls to business landlines on behalf of our clients in compliance with the TCPA (Telephone Consumer Protection Act). We never contact mobile or personal phone numbers without prior express written consent. All outbound calls comply with federal and state Do Not Call (DNC) lists.'}
        </LegalP>
      </LegalSection>

      <LegalSection id="rights" title={isFr ? 'Vos droits' : 'Your rights'}>
        <LegalP className="mb-6">
          {isFr
            ? 'Selon votre juridiction, vous disposez des droits suivants.'
            : 'Depending on your jurisdiction, you have the following rights.'}
        </LegalP>
        <dl className="border-t border-q2-plate">
          {rights.map((right) => (
            <div
              key={right.name}
              className="grid sm:grid-cols-[180px_1fr] gap-x-4 gap-y-1 py-3 border-b border-q2-plate"
            >
              <dt className="font-medium text-q2-ink">{right.name}</dt>
              <dd className="text-q2-body">{right.desc}</dd>
            </div>
          ))}
        </dl>
        <LegalP className="mt-6">
          {isFr ? 'Pour exercer vos droits, contactez-nous à ' : 'To exercise your rights, contact us at '}
          <a href="mailto:hello@qwillio.com" className={LEGAL_LINK}>
            hello@qwillio.com
          </a>
          . {isFr ? 'Voir aussi notre page ' : 'See also our '}
          <Link to="/gdpr" className={LEGAL_LINK}>
            {isFr ? 'Droits RGPD' : 'GDPR Rights'}
          </Link>
          .
        </LegalP>
      </LegalSection>

      <LegalSection id="cookies" title={isFr ? 'Cookies' : 'Cookies'}>
        <LegalP>
          {isFr
            ? "Nous utilisons uniquement des cookies essentiels nécessaires au fonctionnement du service (session, préférence de langue). Nous n'utilisons pas de cookies de suivi ni d'analyse tiers."
            : 'We use only essential cookies necessary for the service to function (session, language preference). We do not use tracking cookies or third party analytics.'}
        </LegalP>
      </LegalSection>

      <LegalSection id="changes" title={isFr ? 'Modifications' : 'Changes to this policy'}>
        <LegalP>
          {isFr
            ? "Nous pouvons mettre à jour cette politique périodiquement. En cas de changement significatif, nous vous en informerons par e-mail au moins 30 jours avant l'entrée en vigueur."
            : 'We may update this policy periodically. For material changes, we will notify you by email at least 30 days before the changes take effect.'}
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
