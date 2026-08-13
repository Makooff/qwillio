import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from '../../../components/icons';
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
        id: 'google-user-data',
        label: isFr ? '4. Données Google' : '4. Google user data',
      },
      {
        id: 'data-retention',
        label: isFr ? '5. Conservation' : '5. Data retention',
      },
      {
        id: 'international',
        label: isFr ? '6. Transferts internationaux' : '6. International transfers',
      },
      {
        id: 'outbound-calling',
        label: isFr ? '7. Démarchage téléphonique' : '7. Outbound calling',
      },
      { id: 'rights', label: isFr ? '8. Vos droits' : '8. Your rights' },
      { id: 'cookies', label: isFr ? '9. Cookies' : '9. Cookies' },
      { id: 'changes', label: isFr ? '10. Modifications' : '10. Changes' },
      { id: 'contact', label: isFr ? '11. Contact' : '11. Contact' },
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
      <p className="q2-eyebrow text-q2-body mb-3">{isFr ? 'Voir aussi' : 'See also'}</p>
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

      {/* Exigée par Google pour la validation OAuth, et pas seulement pour la
          forme: la politique doit dire QUELLES données Google sont lues, POUR
          QUOI, avec QUI elles sont partagées, et rappeler l'usage limité
          (« Limited Use »). Sans cette section, la demande est refusée sans
          même être instruite. */}
      <LegalSection
        id="google-user-data"
        title={isFr ? 'Données Google (Google Calendar)' : 'Google user data (Google Calendar)'}
      >
        <LegalP className="mb-6">
          {isFr
            ? "Si vous connectez votre Google Calendar, Qwillio y accède pour deux gestes, et deux seulement : lire vos disponibilités afin que la réceptionniste ne propose jamais un créneau déjà pris, et créer l'événement correspondant au rendez-vous qu'un appelant vient de prendre."
            : 'If you connect your Google Calendar, Qwillio accesses it for two actions, and two only: reading your availability so the receptionist never offers a slot that is already taken, and creating the event for an appointment a caller has just booked.'}
        </LegalP>

        <LegalTable
          caption={isFr ? 'Autorisations demandées' : 'Requested scopes'}
          head={[
            isFr ? 'Autorisation' : 'Scope',
            isFr ? 'Ce qu’elle permet' : 'What it allows',
            isFr ? 'Pourquoi elle est nécessaire' : 'Why it is needed',
          ]}
          rows={[
            [
              'calendar.readonly',
              isFr ? 'Lire les événements de votre agenda' : 'Read the events in your calendar',
              isFr
                ? 'Connaître les créneaux occupés avant de proposer une heure à un appelant.'
                : 'Know which slots are busy before offering a time to a caller.',
            ],
            [
              'calendar.events',
              isFr ? 'Créer et modifier des événements' : 'Create and update events',
              isFr
                ? 'Inscrire le rendez-vous pris pendant l’appel, puis le déplacer ou l’annuler si l’appelant rappelle.'
                : 'Write the appointment booked during the call, then move or cancel it if the caller calls back.',
            ],
          ]}
        />

        <LegalList
          items={[
            isFr
              ? 'Ce que nous conservons : un jeton de rafraîchissement chiffré et l’identifiant des événements que nous avons créés. Le contenu de vos autres événements n’est ni copié ni stocké.'
              : 'What we keep: an encrypted refresh token and the ids of the events we created. The contents of your other events are never copied or stored.',
            isFr
              ? 'Ce que nous ne faisons jamais : vendre, louer ou transmettre des données Google à un tiers, les utiliser à des fins publicitaires, ou les employer pour entraîner un modèle d’intelligence artificielle.'
              : 'What we never do: sell, rent or pass Google data to a third party, use it for advertising, or use it to train any artificial intelligence model.',
            isFr
              ? 'Qui y accède : personne. Aucun employé ne lit vos données d’agenda, sauf accord écrit de votre part pour résoudre un incident que vous avez signalé, ou obligation légale.'
              : 'Who reads it: nobody. No employee reads your calendar data, except with your written consent to resolve an incident you reported, or where the law requires it.',
            isFr
              ? 'Comment couper : le bouton « Déconnecter » révoque le jeton et efface immédiatement ce que nous en gardons. Vous pouvez aussi retirer l’accès depuis votre compte Google.'
              : 'How to stop: the “Disconnect” button revokes the token and immediately erases what we hold. You can also remove access from your Google account.',
          ]}
        />

        <LegalP className="mt-6">
          {isFr
            ? 'L’usage que Qwillio fait des données reçues des API Google respecte la Google API Services User Data Policy, y compris ses exigences d’usage limité (Limited Use).'
            : 'Qwillio’s use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.'}
        </LegalP>
      </LegalSection>

      <LegalSection id="data-retention" title={isFr ? 'Conservation des données' : 'Data retention'}>
        <LegalList
          items={
            /* La durée des enregistrements n'est plus une valeur fixe: chaque
               client la règle dans ses Paramètres, entre 30 jours et 5 ans, et
               une purge quotidienne l'applique réellement. Annoncer « 90 jours »
               tout court serait désormais faux dans les deux sens. */
            isFr
              ? [
                  "Enregistrements d'appels et transcriptions : 90 jours par défaut, réglable par chaque client entre 30 jours et 5 ans dans ses Paramètres. Une purge automatique quotidienne applique la durée choisie, y compris chez notre fournisseur de téléphonie.",
                  "Données de compte : durée de l'abonnement + 30 jours après résiliation.",
                  'Signaux de fraude : conservés indéfiniment sous forme hachée.',
                  'Journaux de facturation : 7 ans (obligation légale).',
                  "Preuves de consentement à être appelé : 3 ans, y compris après révocation, parce que la loi nous impose de pouvoir les produire.",
                ]
              : [
                  'Call recordings and transcripts: 90 days by default, adjustable by each client between 30 days and 5 years in their Settings. A daily automatic purge enforces the chosen duration, including at our telephony provider.',
                  'Account data: subscription duration + 30 days after cancellation.',
                  'Fraud signals: retained indefinitely in hashed form.',
                  'Billing logs: 7 years (legal requirement).',
                  'Proof of consent to be called: 3 years, including after revocation, because the law requires us to be able to produce it.',
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
        {/* Cette section ne parlait que du TCPA et des listes DNC américaines,
            à des lecteurs français et belges, sur une page en français. Elle
            promettait donc une conformité au mauvais droit. Depuis le
            11/08/2026 (loi n° 2025-594), la France est passée à l'opt-in et
            Bloctel a cessé d'exister; la Belgique reste en opt-out. Le texte
            décrit désormais ce que le produit fait réellement, par pays. */}
        <LegalP>
          {isFr
            ? "France : depuis le 11 août 2026, nous n'appelons un numéro que si nous détenons la preuve d'un consentement préalable, libre, spécifique, éclairé et révocable. Cette preuve est conservée avec sa date, sa source et le libellé exact accepté. Les appels respectent les jours et horaires légaux : du lundi au vendredi, de 10 h à 13 h et de 14 h à 20 h, hors jours fériés, et quatre sollicitations par mois au maximum."
            : 'France: since 11 August 2026, we only call a number when we hold proof of prior consent that was freely given, specific, informed and revocable. That proof is retained with its date, its source and the exact wording accepted. Calls respect the legal days and hours: Monday to Friday, 10am to 1pm and 2pm to 8pm, excluding public holidays, and at most four solicitations per month.'}
        </LegalP>
        <LegalP className="mt-4">
          {isFr
            ? "Belgique : le démarchage y reste autorisé sauf opposition, et nous respectons la liste « Ne m'appelez plus ! ». Dans les deux pays, un refus exprimé pendant l'appel est détecté, enregistré et définitif : le numéro n'est plus jamais rappelé, et tout consentement antérieur est révoqué. Vous pouvez aussi nous écrire à hello@qwillio.com pour être retiré de nos listes."
            : 'Belgium: outbound calling remains permitted unless opted out, and we honour the "Ne m\'appelez plus!" list. In both countries, a refusal expressed during the call is detected, recorded and final: the number is never called again, and any earlier consent is revoked. You may also email hello@qwillio.com to be removed from our lists.'}
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
