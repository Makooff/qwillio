import { env } from '../config/env';
import { formatDate } from '../utils/helpers';
import { brandWrap, brandTitle, brandText, brandButton, brandList, brandSmall } from './email-template';

export type Lang = 'fr' | 'en';

/** Default to French — the Quebec-first launch audience. Callers thread the
 *  real language (client.language / detectLanguage(phone)) where available. */
function L(lang?: Lang): Lang {
  return lang === 'en' ? 'en' : 'fr';
}

/** Highlight block — used for phone numbers, prices, dates (light violet card on white). */
export function brandHighlight(label: string, value: string, valueSize = 24): string {
  return `<div style="margin:16px 0 32px 0;padding:24px 24px;background:rgba(123,92,240,0.08);border:1px solid rgba(123,92,240,0.18);border-radius:12px;text-align:center;">
    <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;color:rgba(92,60,224,0.70);letter-spacing:0.06em;text-transform:uppercase;">${label}</p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:${valueSize}px;font-weight:700;letter-spacing:-0.01em;color:#5C3CE0;font-feature-settings:'tnum';">${value}</p>
  </div>`;
}

export function renderQuoteTemplate(data: {
  contactName: string;
  businessName: string;
  packageType: string;
  setupPrice: number;
  monthlyPrice: number;
  features: string[];
  validUntil: Date;
  paymentLink: string;
  lang?: Lang;
}): string {
  const lang = L(data.lang);
  const name = data.contactName || (lang === 'fr' ? 'bonjour' : 'there');
  if (lang === 'fr') {
    return brandWrap({
      title: 'Votre devis Qwillio',
      preheader: `Devis personnalisé pour ${data.businessName}.`,
      body: [
        brandTitle('Votre devis personnalisé'),
        brandText(`Bonjour ${name}, suite à notre échange, voici votre devis pour <strong>${data.businessName}</strong>.`),
        brandHighlight(`Forfait ${data.packageType.toUpperCase()}`, `${data.monthlyPrice} $/mois`, 28),
        brandText(`Frais d'installation unique : <strong>${data.setupPrice} $</strong>`),
        brandText('Ce qui est inclus :'),
        brandList(data.features),
        brandHighlight('Offre valable jusqu\'au', formatDate(data.validUntil, 'fr'), 18),
        brandButton('Compléter mon inscription', data.paymentLink),
        brandSmall('Installation complétée dans les 48 h suivant le paiement. Répondez à ce courriel pour toute question. — Marie, Qwillio'),
      ].join(''),
    });
  }
  return brandWrap({
    title: 'Your Qwillio quote',
    preheader: `Personalized quote for ${data.businessName}.`,
    body: [
      brandTitle('Your personalized quote'),
      brandText(`Hi ${name}, following our conversation, here is your quote for <strong>${data.businessName}</strong>.`),
      brandHighlight(`${data.packageType.toUpperCase()} package`, `$${data.monthlyPrice}/mo`, 28),
      brandText(`One-time setup fee: <strong>$${data.setupPrice}</strong>`),
      brandText("What's included:"),
      brandList(data.features),
      brandHighlight('Offer valid until', formatDate(data.validUntil, 'en'), 18),
      brandButton('Complete my signup', data.paymentLink),
      brandSmall('Setup completed within 48 hours of payment. Reply to this email if you have questions. — Ashley, Qwillio'),
    ].join(''),
  });
}

export function renderFollowUpTemplate(data: {
  contactName: string;
  businessName: string;
  packageName: string;
  monthlyPrice: number;
  setupPrice: number;
  paymentLink: string;
  type: 'day1' | 'day3' | 'day7';
  lang?: Lang;
}): string {
  const lang = L(data.lang);

  if (lang === 'fr') {
    if (data.type === 'day1') {
      return brandWrap({
        title: 'Votre offre est toujours disponible',
        preheader: `Petit suivi de votre proposition Qwillio pour ${data.businessName}.`,
        body: [
          brandTitle('Toujours là pour vous'),
          brandText(`Bonjour ${data.contactName}, je voulais m'assurer que vous aviez bien vu notre proposition pour <strong>${data.businessName}</strong>.`),
          brandHighlight(`Forfait ${data.packageName}`, `${data.monthlyPrice} $/mois`, 28),
          brandText(`Installation unique : ${data.setupPrice} $. Notre IA fait en sorte que vous ne manquiez plus jamais un appel client.`),
          brandButton('Voir mon offre', data.paymentLink),
          brandSmall('— Marie, Qwillio'),
        ].join(''),
      });
    }
    if (data.type === 'day3') {
      return brandWrap({
        title: 'Plus que 4 jours',
        preheader: `Votre offre Qwillio pour ${data.businessName} se termine bientôt.`,
        body: [
          brandTitle('Plus que 4 jours'),
          brandText(`Bonjour ${data.contactName}, votre offre personnalisée pour <strong>${data.businessName}</strong> se termine dans 4 jours.`),
          brandText('Ce que disent nos clients :'),
          brandList([
            '95 % de taux de satisfaction',
            '40 appels manqués récupérés par mois en moyenne',
            'Rentabilité dès le 2e mois',
          ]),
          brandButton('Compléter mon inscription', data.paymentLink),
          brandSmall('— Marie, Qwillio'),
        ].join(''),
      });
    }
    return brandWrap({
      title: 'Dernière chance',
      preheader: `Votre offre Qwillio pour ${data.businessName} expire aujourd'hui.`,
      body: [
        brandTitle('Dernière chance'),
        brandText(`Bonjour ${data.contactName}, c'est aujourd'hui le dernier jour pour profiter de votre offre personnalisée pour <strong>${data.businessName}</strong>.`),
        brandText('Nos clients constatent une hausse moyenne de <strong>25 % des réservations</strong> avec notre réceptionniste IA.'),
        brandHighlight(`Forfait ${data.packageName}`, `${data.monthlyPrice} $/mois`, 28),
        brandText(`Installation unique : ${data.setupPrice} $.`),
        brandButton('Profiter de mon offre', data.paymentLink),
        brandSmall("Cette offre ne sera plus disponible après aujourd'hui. — Marie, Qwillio"),
      ].join(''),
    });
  }

  if (data.type === 'day1') {
    return brandWrap({
      title: 'Your offer is still available',
      preheader: `Quick follow-up on your Qwillio proposal for ${data.businessName}.`,
      body: [
        brandTitle('Still here for you'),
        brandText(`Hi ${data.contactName}, just making sure you saw our proposal for <strong>${data.businessName}</strong>.`),
        brandHighlight(`${data.packageName} package`, `$${data.monthlyPrice}/mo`, 28),
        brandText(`One-time setup: $${data.setupPrice}. Our AI ensures you never miss a customer call again.`),
        brandButton('View my offer', data.paymentLink),
        brandSmall('— Ashley, Qwillio'),
      ].join(''),
    });
  }

  if (data.type === 'day3') {
    return brandWrap({
      title: '4 days left',
      preheader: `Your Qwillio offer for ${data.businessName} closes soon.`,
      body: [
        brandTitle('Only 4 days left'),
        brandText(`Hi ${data.contactName}, your personalized offer for <strong>${data.businessName}</strong> closes in 4 days.`),
        brandText('What our clients say:'),
        brandList([
          '95% customer satisfaction rate',
          '40 missed calls saved per month on average',
          'Positive ROI within the 2nd month',
        ]),
        brandButton('Complete my signup', data.paymentLink),
        brandSmall('— Ashley, Qwillio'),
      ].join(''),
    });
  }

  return brandWrap({
    title: 'Last chance',
    preheader: `Your Qwillio offer for ${data.businessName} expires today.`,
    body: [
      brandTitle('Last chance'),
      brandText(`Hi ${data.contactName}, today is the final day to claim your personalized offer for <strong>${data.businessName}</strong>.`),
      brandText('Our clients see an average <strong>25% increase in bookings</strong> with our AI receptionist.'),
      brandHighlight(`${data.packageName} package`, `$${data.monthlyPrice}/mo`, 28),
      brandText(`One-time setup: $${data.setupPrice}.`),
      brandButton('Claim my offer now', data.paymentLink),
      brandSmall('This offer will no longer be available after today. — Ashley, Qwillio'),
    ].join(''),
  });
}

export function renderWelcomeTemplate(data: {
  contactName: string;
  businessName: string;
  planType: string;
  vapiPhoneNumber: string;
  dashboardUrl: string;
  lang?: Lang;
}): string {
  const lang = L(data.lang);
  if (lang === 'fr') {
    return brandWrap({
      title: 'Bienvenue chez Qwillio',
      preheader: `Votre réceptionniste IA pour ${data.businessName} est en ligne.`,
      body: [
        brandTitle('Votre IA est en ligne'),
        brandText(`Bonjour ${data.contactName}, votre réceptionniste IA pour <strong>${data.businessName}</strong> répond maintenant aux appels 24 h/24.`),
        brandButton('Ouvrir mon tableau de bord', data.dashboardUrl),
        brandHighlight('Votre numéro IA', data.vapiPhoneNumber, 22),
        brandText('Prochaine étape sur votre tableau de bord :'),
        brandList([
          `<strong>Testez-la.</strong> Appelez le ${data.vapiPhoneNumber} et écoutez votre IA en action.`,
          `<strong>Personnalisez-la.</strong> Ouvrez le tableau de bord pour définir vos horaires, votre FAQ et vos tarifs.`,
          `<strong>Redirigez vos appels.</strong> Transférez votre ligne principale vers le ${data.vapiPhoneNumber} quand vous êtes prêt.`,
        ]),
        brandSmall('Conseil — durant les 7 premiers jours, gardez votre système téléphonique actuel en parallèle pour une transition en douceur.'),
      ].join(''),
    });
  }
  return brandWrap({
    title: 'Welcome to Qwillio',
    preheader: `Your AI receptionist for ${data.businessName} is live.`,
    body: [
      brandTitle('Your AI is live'),
      brandText(`Hi ${data.contactName}, your AI receptionist for <strong>${data.businessName}</strong> is now answering calls 24/7.`),
      brandButton('Open my dashboard', data.dashboardUrl),
      brandHighlight('Your AI phone number', data.vapiPhoneNumber, 22),
      brandText('Next step on your dashboard:'),
      brandList([
        `<strong>Test it.</strong> Call ${data.vapiPhoneNumber} and hear your AI in action.`,
        `<strong>Customize it.</strong> Open the dashboard to set hours, FAQ and pricing.`,
        `<strong>Forward your calls.</strong> Redirect your main line to ${data.vapiPhoneNumber} when you're ready.`,
      ]),
      brandSmall('Tip — during the first 7 days, keep your current phone system running in parallel for a smooth transition.'),
    ].join(''),
  });
}

export function renderTrialWelcomeTemplate(data: {
  contactName: string;
  businessName: string;
  packageType: string;
  trialEndDate: Date;
  trialCallsQuota: number;
  lang?: Lang;
}): string {
  const lang = L(data.lang);
  if (lang === 'fr') {
    return brandWrap({
      title: 'Votre essai gratuit est actif',
      preheader: `30 jours pour tester Qwillio pour ${data.businessName}.`,
      body: [
        brandTitle('Votre essai gratuit est actif'),
        brandText(`Bonjour ${data.contactName}, votre <strong>essai gratuit de 30 jours</strong> pour <strong>${data.businessName}</strong> vient d'être activé. Sans engagement, sans carte de crédit.`),
        brandText('Ce qui est inclus dans votre essai :'),
        brandList([
          'Réceptionniste IA disponible 24 h/24',
          `${data.trialCallsQuota} appels durant la période d'essai`,
          'Réservations et rendez-vous automatiques',
          'Tableau de bord de suivi en temps réel',
          'Support technique par courriel',
        ]),
        brandHighlight('Fin de l\'essai le', formatDate(data.trialEndDate, 'fr'), 18),
        brandText("Prochaines étapes : notre équipe configure votre assistant IA dans les 24 à 48 h et vous envoie le numéro de téléphone IA. Ensuite, il ne reste qu'à tester."),
        brandSmall('Une question ? Répondez à ce courriel et Marie vous accompagne. — L\'équipe Qwillio'),
      ].join(''),
    });
  }
  return brandWrap({
    title: 'Your free trial is active',
    preheader: `30 days to test Qwillio for ${data.businessName}.`,
    body: [
      brandTitle('Your free trial is active'),
      brandText(`Hi ${data.contactName}, your <strong>30-day free trial</strong> for <strong>${data.businessName}</strong> has just been activated. No commitment, no card required.`),
      brandText("What's included in your trial:"),
      brandList([
        'AI receptionist available 24/7',
        `${data.trialCallsQuota} calls during the trial period`,
        'Automatic booking & reservations',
        'Real-time tracking dashboard',
        'Email technical support',
      ]),
      brandHighlight('Trial ends on', formatDate(data.trialEndDate, 'en'), 18),
      brandText('Next steps: our team will set up your AI assistant in the next 24–48 hours and email you the AI phone number. From there, just test and enjoy.'),
      brandSmall('Questions? Reply to this email and Ashley will jump in. — The Qwillio Team'),
    ].join(''),
  });
}

export function renderTrialEndingTemplate(data: {
  contactName: string;
  businessName: string;
  packageType: string;
  daysLeft: number;
  trialEndDate: Date;
  paymentLink: string;
  monthlyPrice: number;
  lang?: Lang;
}): string {
  const lang = L(data.lang);
  if (lang === 'fr') {
    const dayWord = data.daysLeft > 1 ? 'jours' : 'jour';
    return brandWrap({
      title: 'Votre essai se termine',
      preheader: `Votre essai gratuit pour ${data.businessName} se termine le ${formatDate(data.trialEndDate, 'fr')}.`,
      body: [
        brandTitle(`Plus que ${data.daysLeft} ${dayWord}`),
        brandText(`Bonjour ${data.contactName}, votre essai gratuit pour <strong>${data.businessName}</strong> se termine le <strong>${formatDate(data.trialEndDate, 'fr')}</strong>.`),
        brandText('Votre réceptionniste IA travaille déjà pour vous. Gardez-la active après l\'essai :'),
        brandHighlight(`Forfait ${data.packageType.toUpperCase()}`, `${data.monthlyPrice} $/mois`, 28),
        brandText('Sans engagement. Annulable à tout moment.'),
        brandButton('Continuer avec Qwillio', data.paymentLink),
        brandSmall("Sans abonnement, votre réceptionniste IA sera désactivée à la fin de l'essai. — Marie, Qwillio"),
      ].join(''),
    });
  }
  const dayWord = data.daysLeft > 1 ? 'days' : 'day';
  return brandWrap({
    title: 'Your trial is ending',
    preheader: `Your free trial for ${data.businessName} ends ${formatDate(data.trialEndDate, 'en')}.`,
    body: [
      brandTitle(`Only ${data.daysLeft} ${dayWord} left`),
      brandText(`Hi ${data.contactName}, your free trial for <strong>${data.businessName}</strong> ends on <strong>${formatDate(data.trialEndDate, 'en')}</strong>.`),
      brandText('Your AI receptionist has already been working for you. Keep it on after the trial:'),
      brandHighlight(`${data.packageType.toUpperCase()} package`, `$${data.monthlyPrice}/mo`, 28),
      brandText('No commitment. Cancel anytime.'),
      brandButton('Continue with Qwillio', data.paymentLink),
      brandSmall("Without a subscription, your AI receptionist will be deactivated at the end of the trial. — Ashley, Qwillio"),
    ].join(''),
  });
}

export function renderTrialExpiredTemplate(data: {
  contactName: string;
  businessName: string;
  packageType: string;
  paymentLink: string;
  monthlyPrice: number;
  lang?: Lang;
}): string {
  const lang = L(data.lang);
  if (lang === 'fr') {
    return brandWrap({
      title: 'Votre essai gratuit est terminé',
      preheader: `Réactivez votre réceptionniste IA pour ${data.businessName} en 2 minutes.`,
      body: [
        brandTitle('Votre essai est terminé'),
        brandText(`Bonjour ${data.contactName}, votre essai gratuit pour <strong>${data.businessName}</strong> vient de se terminer. Votre réceptionniste IA est maintenant en pause — les appels entrants ne sont plus traités.`),
        brandText('Abonnez-vous pour la réactiver en deux minutes :'),
        brandHighlight(`Forfait ${data.packageType.toUpperCase()}`, `${data.monthlyPrice} $/mois`, 28),
        brandButton('Réactiver mon assistant IA', data.paymentLink),
        brandSmall('Votre configuration est conservée 30 jours, puis supprimée définitivement. — Marie, Qwillio'),
      ].join(''),
    });
  }
  return brandWrap({
    title: 'Your free trial has ended',
    preheader: `Reactivate your AI receptionist for ${data.businessName} in 2 minutes.`,
    body: [
      brandTitle('Your trial has ended'),
      brandText(`Hi ${data.contactName}, your free trial for <strong>${data.businessName}</strong> has just ended. Your AI receptionist is now paused — incoming calls are no longer handled.`),
      brandText('Subscribe to bring it back in two minutes:'),
      brandHighlight(`${data.packageType.toUpperCase()} package`, `$${data.monthlyPrice}/mo`, 28),
      brandButton('Reactivate my AI assistant', data.paymentLink),
      brandSmall('Your configuration is saved for 30 days, then permanently deleted. — Ashley, Qwillio'),
    ].join(''),
  });
}

export function renderCallback3MonthsTemplate(data: {
  contactName: string;
  businessName: string;
  lang?: Lang;
}): string {
  const lang = L(data.lang);
  if (lang === 'fr') {
    const replyMail = `mailto:${env.RESEND_REPLY_TO}?subject=Suivi%20${encodeURIComponent(data.businessName)}`;
    return brandWrap({
      title: 'Des nouvelles de Qwillio',
      preheader: `Petit suivi pour ${data.businessName} — quelques nouveautés depuis notre dernier échange.`,
      body: [
        brandTitle('Des nouvelles de Qwillio'),
        brandText(`Bonjour ${data.contactName}, on s'est parlé il y a 3 mois au sujet d'une réceptionniste IA pour <strong>${data.businessName}</strong>. Votre situation a-t-elle changé ?`),
        brandText('Quelques nouveautés depuis :'),
        brandList([
          'Système de rappels SMS automatiques',
          'Intégration directe à Google Agenda',
          'Application mobile pour suivre vos appels en temps réel',
        ]),
        brandButton('Oui, ça m\'intéresse', replyMail),
        brandSmall("Sinon, aucun souci — écrivez-nous quand vous voulez. — Marie, Qwillio"),
      ].join(''),
    });
  }
  const replyMail = `mailto:${env.RESEND_REPLY_TO}?subject=Follow-up%20${encodeURIComponent(data.businessName)}`;
  return brandWrap({
    title: 'News from Qwillio',
    preheader: `Quick check-in for ${data.businessName} — a few new things since we last spoke.`,
    body: [
      brandTitle('News from Qwillio'),
      brandText(`Hi ${data.contactName}, we spoke 3 months ago about an AI receptionist for <strong>${data.businessName}</strong>. Has your situation changed?`),
      brandText('A few updates since we last spoke:'),
      brandList([
        'Automatic SMS reminder system',
        'Direct Google Calendar integration',
        'Mobile app to track your calls in real time',
      ]),
      brandButton("Yes, I'm interested", replyMail),
      brandSmall("If not, no worries — feel free to reach out anytime. — Ashley, Qwillio"),
    ].join(''),
  });
}

export function renderBookingReminderTemplate(data: {
  to: string;
  customerName: string;
  businessName: string;
  bookingDate: Date;
  bookingTime: string;
  serviceType: string;
  specialRequests: string | null;
  businessPhone: string;
  lang?: Lang;
}): string {
  const lang = L(data.lang);
  const dateStr = data.bookingDate.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const whenValue = data.bookingTime ? `${dateStr} · ${data.bookingTime}` : dateStr;

  if (lang === 'fr') {
    const details: string[] = [
      `<strong>Où</strong> — ${data.businessName}`,
      `<strong>Service</strong> — ${data.serviceType}`,
    ];
    if (data.specialRequests) details.push(`<strong>Notes</strong> — ${data.specialRequests}`);
    return brandWrap({
      title: 'Rappel de rendez-vous',
      preheader: `Rappel de votre rendez-vous chez ${data.businessName}.`,
      body: [
        brandTitle('Rappel de rendez-vous'),
        brandText(`Bonjour ${data.customerName}, petit rappel de votre prochain rendez-vous chez <strong>${data.businessName}</strong>.`),
        brandHighlight('Votre rendez-vous', whenValue, 18),
        brandList(details),
        data.businessPhone ? brandButton('Appeler pour reporter', `tel:${data.businessPhone}`) : '',
        data.businessPhone
          ? brandSmall(`Besoin de reporter ou d'annuler ? Appelez le <strong>${data.businessPhone}</strong>.`)
          : brandSmall('Pour reporter, contactez-nous directement.'),
      ].join(''),
    });
  }

  const details: string[] = [
    `<strong>Where</strong> — ${data.businessName}`,
    `<strong>Service</strong> — ${data.serviceType}`,
  ];
  if (data.specialRequests) details.push(`<strong>Notes</strong> — ${data.specialRequests}`);
  return brandWrap({
    title: 'Appointment reminder',
    preheader: `Reminder of your appointment at ${data.businessName}.`,
    body: [
      brandTitle('Appointment reminder'),
      brandText(`Hi ${data.customerName}, this is a friendly reminder about your upcoming appointment at <strong>${data.businessName}</strong>.`),
      brandHighlight('Your appointment', whenValue, 18),
      brandList(details),
      data.businessPhone ? brandButton('Call to reschedule', `tel:${data.businessPhone}`) : '',
      data.businessPhone
        ? brandSmall(`Need to reschedule or cancel? Call <strong>${data.businessPhone}</strong>.`)
        : brandSmall('If you need to reschedule, please contact us directly.'),
    ].join(''),
  });
}

export function renderRescheduleTemplate(data: {
  to: string;
  customerName: string;
  businessName: string;
  originalDate: Date;
  businessPhone: string;
  lang?: Lang;
}): string {
  const lang = L(data.lang);
  const dateStr = data.originalDate.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (lang === 'fr') {
    return brandWrap({
      title: 'Reprenons rendez-vous',
      preheader: `On vous a manqué chez ${data.businessName} — trouvons un nouveau moment.`,
      body: [
        brandTitle('On vous a manqué'),
        brandText(`Bonjour ${data.customerName}, nous avons remarqué que vous n'avez pas pu vous présenter à votre rendez-vous du <strong>${dateStr}</strong>. Aucun souci — ça arrive.`),
        brandText('Nous serions ravis de reprendre rendez-vous à un moment qui vous convient mieux.'),
        brandButton('Appeler pour reporter', `tel:${data.businessPhone}`),
        brandSmall(`Ou appelez-nous au <strong>${data.businessPhone}</strong> quand vous voulez — notre réceptionniste IA est disponible 24 h/24.`),
      ].join(''),
    });
  }
  return brandWrap({
    title: "Let's reschedule",
    preheader: `We missed you at ${data.businessName} — let's find a new time.`,
    body: [
      brandTitle('We missed you'),
      brandText(`Hi ${data.customerName}, we noticed you weren't able to make your appointment on <strong>${dateStr}</strong>. No worries — things happen.`),
      brandText(`We'd love to reschedule at a time that works better for you.`),
      brandButton('Call to reschedule', `tel:${data.businessPhone}`),
      brandSmall(`Or call us at <strong>${data.businessPhone}</strong> anytime — our AI receptionist is available 24/7.`),
    ].join(''),
  });
}
