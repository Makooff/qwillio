import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useSEO } from '../../../hooks/useSEO';
import { useLang } from '../../../stores/langStore';
import { SerifWord } from '../../../components/v2/Primitives';
import LegalShell, {
  LEGAL_LINK,
  LegalCloser,
  LegalP,
  LegalSection,
  LegalTable,
  type LegalSectionRef,
} from '../../../components/v2/LegalShell';

/* Droits RGPD V2 « Papier & Signal ».
   Contenu FR/EN porté à l'identique depuis pages/legal/Gdpr.tsx. */

interface DataRight {
  article: string;
  title: string;
  desc: string;
}

interface DataCategory {
  category: string;
  examples: string;
  retention: string;
}

interface LegalBasis {
  activity: string;
  basis: string;
}

export default function Gdpr() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: 'GDPR Rights',
    description: 'Your GDPR data rights with Qwillio: access, rectification, erasure, portability and more.',
    canonical: 'https://qwillio.com/gdpr',
    noindex: true,
  });

  const sections: LegalSectionRef[] = useMemo(
    () => [
      { id: 'overview', label: isFr ? 'Aperçu' : 'Overview' },
      { id: 'your-rights', label: isFr ? 'Vos 7 droits' : 'Your 7 rights' },
      { id: 'how-to-exercise', label: isFr ? 'Comment exercer' : 'How to exercise' },
      { id: 'response-time', label: isFr ? 'Délai de réponse' : 'Response time' },
      { id: 'data-categories', label: isFr ? 'Catégories de données' : 'Data categories' },
      { id: 'cookies', label: isFr ? 'Cookies' : 'Cookies' },
      { id: 'legal-basis', label: isFr ? 'Base légale' : 'Legal basis' },
      { id: 'related', label: isFr ? 'Documents liés' : 'Related documents' },
    ],
    [isFr],
  );

  const rights: DataRight[] = isFr
    ? [
        {
          article: 'Art. 15',
          title: "Droit d'accès",
          desc: "Vous pouvez demander une copie de toutes les données personnelles que nous détenons à votre sujet, y compris les enregistrements d'appels, les transcriptions et les données de compte.",
        },
        {
          article: 'Art. 16',
          title: 'Droit de rectification',
          desc: 'Si vos données sont inexactes ou incomplètes, vous pouvez demander leur correction.',
        },
        {
          article: 'Art. 17',
          title: "Droit à l'effacement",
          desc: 'Vous pouvez demander la suppression de vos données personnelles. Nous les supprimerons sauf obligation légale de conservation.',
        },
        {
          article: 'Art. 18',
          title: 'Droit à la limitation du traitement',
          desc: 'Vous pouvez demander que nous limitions le traitement de vos données dans certaines circonstances.',
        },
        {
          article: 'Art. 20',
          title: 'Droit à la portabilité',
          desc: 'Vous pouvez recevoir vos données dans un format structuré, couramment utilisé et lisible par machine (JSON, CSV).',
        },
        {
          article: 'Art. 21',
          title: "Droit d'opposition",
          desc: "Vous pouvez vous opposer au traitement de vos données fondé sur notre intérêt légitime, y compris le profilage.",
        },
        {
          article: 'Art. 22',
          title: 'Décision automatisée',
          desc: "Vous avez le droit de ne pas faire l'objet d'une décision fondée exclusivement sur un traitement automatisé qui produit des effets juridiques.",
        },
      ]
    : [
        {
          article: 'Art. 15',
          title: 'Right of access',
          desc: 'You can request a copy of all personal data we hold about you, including call recordings, transcripts, and account data.',
        },
        {
          article: 'Art. 16',
          title: 'Right to rectification',
          desc: 'If your data is inaccurate or incomplete, you can request correction.',
        },
        {
          article: 'Art. 17',
          title: 'Right to erasure',
          desc: 'You can request deletion of your personal data. We will delete it unless we are legally required to retain it.',
        },
        {
          article: 'Art. 18',
          title: 'Right to restriction',
          desc: 'You can request that we restrict the processing of your data in certain circumstances.',
        },
        {
          article: 'Art. 20',
          title: 'Right to portability',
          desc: 'You can receive your data in a structured, commonly used, machine readable format (JSON, CSV).',
        },
        {
          article: 'Art. 21',
          title: 'Right to object',
          desc: 'You can object to processing of your data based on our legitimate interest, including profiling.',
        },
        {
          article: 'Art. 22',
          title: 'Automated decision making',
          desc: 'You have the right not to be subject to a decision based solely on automated processing that produces legal effects.',
        },
      ];

  const dataCategories: DataCategory[] = isFr
    ? [
        {
          category: 'Données de compte',
          examples: 'Nom, e-mail, téléphone',
          retention: "Durée de l'abonnement + 30 jours",
        },
        {
          category: "Enregistrements d'appels",
          examples: 'Audio des appels traités',
          retention: '90 jours',
        },
        {
          category: 'Transcriptions',
          examples: 'Texte des conversations',
          retention: '90 jours',
        },
        {
          category: 'Données de paiement',
          examples: 'Identifiants Stripe (pas de numéros de carte)',
          retention: '7 ans (obligation légale)',
        },
        {
          category: 'Données techniques',
          examples: "Adresse IP, empreinte d'appareil",
          retention: '90 jours (IP), indéfini hachée (fraude)',
        },
      ]
    : [
        {
          category: 'Account data',
          examples: 'Name, email, phone',
          retention: 'Subscription duration + 30 days',
        },
        {
          category: 'Call recordings',
          examples: 'Audio of processed calls',
          retention: '90 days',
        },
        {
          category: 'Transcripts',
          examples: 'Conversation text',
          retention: '90 days',
        },
        {
          category: 'Payment data',
          examples: 'Stripe identifiers (no card numbers)',
          retention: '7 years (legal requirement)',
        },
        {
          category: 'Technical data',
          examples: 'IP address, device fingerprint',
          retention: '90 days (IP), indefinite hashed (fraud)',
        },
      ];

  const legalBases: LegalBasis[] = isFr
    ? [
        { activity: 'Fourniture du service', basis: 'Exécution du contrat (Art. 6(1)(b))' },
        { activity: 'Facturation et paiements', basis: 'Exécution du contrat (Art. 6(1)(b))' },
        { activity: 'Détection de fraude', basis: 'Intérêt légitime (Art. 6(1)(f))' },
        { activity: 'E-mails transactionnels', basis: 'Exécution du contrat (Art. 6(1)(b))' },
        { activity: 'Conservation légale (factures)', basis: 'Obligation légale (Art. 6(1)(c))' },
        { activity: 'Amélioration du service', basis: 'Intérêt légitime (Art. 6(1)(f))' },
      ]
    : [
        { activity: 'Service delivery', basis: 'Contract performance (Art. 6(1)(b))' },
        { activity: 'Billing and payments', basis: 'Contract performance (Art. 6(1)(b))' },
        { activity: 'Fraud detection', basis: 'Legitimate interest (Art. 6(1)(f))' },
        { activity: 'Transactional emails', basis: 'Contract performance (Art. 6(1)(b))' },
        { activity: 'Legal retention (invoices)', basis: 'Legal obligation (Art. 6(1)(c))' },
        { activity: 'Service improvement', basis: 'Legitimate interest (Art. 6(1)(f))' },
      ];

  const asideExtra = (
    <>
      <p className="q2-eyebrow text-q2-faint mb-3">{isFr ? 'Action rapide' : 'Quick action'}</p>
      <a
        href="mailto:hello@qwillio.com?subject=GDPR%20Request"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-q2-ink hover:text-q2-body transition-colors duration-150"
      >
        {isFr ? 'Envoyer une demande' : 'Send a request'}
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
    </>
  );

  return (
    <LegalShell
      eyebrow={isFr ? 'Règlement RGPD' : 'GDPR regulation'}
      title={
        isFr ? (
          <>
            Vos droits <SerifWord>RGPD,</SerifWord> en clair.
          </>
        ) : (
          <>
            Your GDPR <SerifWord>rights,</SerifWord> plainly.
          </>
        )
      }
      lead={
        isFr
          ? "Le Règlement Général sur la Protection des Données vous donne un contrôle total sur vos données personnelles. Voici vos droits expliqués simplement."
          : 'The General Data Protection Regulation gives you full control over your personal data. Here are your rights explained in plain language.'
      }
      updatedISO="2026-03-01"
      updatedLabel={isFr ? '1er mars 2026' : 'March 1, 2026'}
      meta={
        isFr ? 'Conforme au Règlement (UE) 2016/679' : 'Compliant with Regulation (EU) 2016/679'
      }
      sections={sections}
      asideExtra={asideExtra}
    >
      <LegalSection id="overview" title={isFr ? 'Aperçu' : 'Overview'}>
        <LegalP>
          {isFr
            ? "Si vous résidez dans l'Union européenne ou dans l'Espace économique européen, le RGPD vous accorde un ensemble de droits sur vos données personnelles. Qwillio est responsable du traitement de vos données et s'engage à respecter chacun de ces droits sans frais ni délai injustifié."
            : 'If you reside in the European Union or the European Economic Area, the GDPR grants you a set of rights over your personal data. Qwillio is the data controller and commits to honoring each of these rights without charge or undue delay.'}
        </LegalP>
        <LegalP>
          {isFr
            ? 'Cette page résume vos droits, la façon de les exercer, et la base légale de chaque traitement que nous effectuons.'
            : 'This page summarizes your rights, how to exercise them, and the legal basis for each processing activity we perform.'}
        </LegalP>
      </LegalSection>

      <LegalSection id="your-rights" title={isFr ? 'Vos 7 droits' : 'Your 7 rights'}>
        <ol className="border-t border-q2-plate" role="list">
          {rights.map((right, i) => (
            <li
              key={right.article}
              className="grid grid-cols-[40px_1fr] gap-x-5 gap-y-1 py-6 border-b border-q2-plate"
            >
              <span
                className="text-2xl font-light tracking-tight text-q2-faint tabular-nums leading-none pt-1"
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                  <h3 className="text-[17px] font-medium tracking-tight text-q2-ink">
                    {right.title}
                  </h3>
                  <span className="q2-eyebrow text-q2-faint">{right.article}</span>
                </div>
                <p className="text-q2-body">{right.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </LegalSection>

      <LegalSection
        id="how-to-exercise"
        title={isFr ? 'Comment exercer vos droits' : 'How to exercise your rights'}
      >
        <LegalP className="mb-5">
          {isFr ? 'Envoyez un e-mail à ' : 'Send an email to '}
          <a href="mailto:hello@qwillio.com" className={LEGAL_LINK}>
            hello@qwillio.com
          </a>
          {isFr ? " avec l'objet suivant :" : ' with the following subject:'}
        </LegalP>
        <div className="rounded-[20px] bg-q2-band p-6 mb-5">
          <p className="q2-eyebrow text-q2-indigo mb-2">{isFr ? 'Modèle' : 'Template'}</p>
          <code className="font-mono text-sm text-q2-ink block">
            {isFr ? 'RGPD : [Votre droit]' : 'GDPR Request: [Right]'}
          </code>
        </div>
        <p className="text-[15px] text-q2-body">
          {isFr
            ? "Exemple : « RGPD : Droit d'accès » ou « RGPD : Droit à l'effacement »."
            : 'Example: "GDPR Request: Right of Access" or "GDPR Request: Right to Erasure".'}
        </p>
      </LegalSection>

      <LegalSection id="response-time" title={isFr ? 'Délai de réponse' : 'Response time'}>
        <LegalP>
          {isFr
            ? "Nous répondrons à votre demande dans un délai de 30 jours calendaires. Si la demande est complexe, ce délai peut être prolongé de 60 jours supplémentaires, auquel cas nous vous en informerons dans le délai initial de 30 jours."
            : 'We will respond to your request within 30 calendar days. If the request is complex, this period may be extended by an additional 60 days, in which case we will inform you within the initial 30 day period.'}
        </LegalP>
      </LegalSection>

      <LegalSection
        id="data-categories"
        title={isFr ? 'Catégories de données et conservation' : 'Data categories and retention'}
      >
        <LegalTable
          caption={
            isFr ? 'Catégories de données et conservation' : 'Data categories and retention'
          }
          head={[
            isFr ? 'Catégorie' : 'Category',
            isFr ? 'Exemples' : 'Examples',
            isFr ? 'Conservation' : 'Retention',
          ]}
          rows={dataCategories.map((cat) => [cat.category, cat.examples, cat.retention])}
        />
      </LegalSection>

      <LegalSection id="cookies" title={isFr ? 'Cookies' : 'Cookies'}>
        <LegalP>
          {isFr
            ? "Qwillio utilise uniquement des cookies essentiels nécessaires au fonctionnement du service. Nous n'utilisons aucun cookie de suivi, d'analyse ou publicitaire. Aucun bandeau de cookies n'est nécessaire car nous ne collectons que des cookies strictement nécessaires."
            : 'Qwillio uses only essential cookies necessary for the service to function. We do not use any tracking, analytics, or advertising cookies. No cookie banner is needed because we only use strictly necessary cookies.'}
        </LegalP>
      </LegalSection>

      <LegalSection
        id="legal-basis"
        title={isFr ? 'Base légale par activité' : 'Legal basis per activity'}
      >
        <LegalTable
          caption={isFr ? 'Base légale par activité' : 'Legal basis per activity'}
          head={[isFr ? 'Activité' : 'Activity', isFr ? 'Base légale' : 'Legal basis']}
          rows={legalBases.map((item) => [item.activity, item.basis])}
        />
      </LegalSection>

      <LegalSection id="related" title={isFr ? 'Documents liés' : 'Related documents'} last>
        <LegalP>
          {isFr ? 'Pour plus de détails, consultez notre ' : 'For more details, see our '}
          <Link to="/privacy" className={LEGAL_LINK}>
            {isFr ? 'politique de confidentialité complète' : 'full privacy policy'}
          </Link>
          {isFr ? ' ou nos ' : ' or our '}
          <Link to="/terms" className={LEGAL_LINK}>
            {isFr ? "conditions d'utilisation" : 'terms of service'}
          </Link>
          .
        </LegalP>
      </LegalSection>

      <LegalCloser>
        {isFr ? 'Une demande à formuler ? Écrivez-nous à ' : 'Need to submit a request? Write to '}
        <a href="mailto:hello@qwillio.com" className={LEGAL_LINK}>
          hello@qwillio.com
        </a>
        .
      </LegalCloser>
    </LegalShell>
  );
}
