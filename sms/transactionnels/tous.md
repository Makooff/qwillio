<!-- source: backend/src/services/sms-templates.ts · smsTemplates -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# SMS transactionnels

**Code** : `backend/src/services/sms-templates.ts`

Un SMS coûte à l'envoi et se lit en trois secondes. Chaque message dit qui appelle,
pourquoi, et ce qu'il y a à faire. Les `${...}` sont remplis à l'envoi.

```ts
export const smsTemplates = {
  /** Standard follow-up after a qualified call (admin test "welcome"). */
  welcome: (d: { firstName: string; agentName: string; registrationLink: string; lang: Lang }) =>
    d.lang === 'fr'
      ? `Bonjour ${d.firstName}, ${d.agentName} de Qwillio. Démarrez votre essai gratuit de 30 jours : ${d.registrationLink}. Sans engagement. ${STOP.fr}`
      : `Hi ${d.firstName}, it's ${d.agentName} from Qwillio. Start your free 30-day trial: ${d.registrationLink}. No commitment. ${STOP.en}`,

  /** Bot dropped to voicemail — leave a written follow-up. */
  voicemail: (d: { niche: string; registrationLink: string; lang: Lang }) =>
    d.lang === 'fr'
      ? `Bonjour, je vous ai laissé un message au sujet de Qwillio — réceptionniste IA pour les entreprises ${d.niche}. Essai gratuit de 30 jours : ${d.registrationLink}. ${STOP.fr}`
      : `Hi, I left you a voicemail about Qwillio — AI receptionist for ${d.niche} businesses. Start your free 30-day trial: ${d.registrationLink}. ${STOP.en}`,

  /** Outcome "interested" / "qualified" on a live call. */
  interested: (d: { firstName: string; agentName: string; registrationLink: string; lang: Lang }) =>
    d.lang === 'fr'
      ? `Bonjour ${d.firstName}, merci d'avoir discuté avec ${d.agentName} de Qwillio. Démarrez votre essai gratuit de 30 jours : ${d.registrationLink}. Sans engagement, annulable à tout moment. ${STOP.fr}`
      : `Hi ${d.firstName}, thanks for chatting with ${d.agentName} from Qwillio. Start your free 30-day trial: ${d.registrationLink}. No commitment, cancel anytime. ${STOP.en}`,

  /** Outcome "callback_later". */
  callback: (d: { firstName: string; agentName: string; lang: Lang }) =>
    d.lang === 'fr'
      ? `Bonjour ${d.firstName}, ${d.agentName} de Qwillio. Désolée de ne pas avoir pu vous joindre aujourd'hui — on se reparle bientôt. En savoir plus : qwillio.com. ${STOP.fr}`
      : `Hi ${d.firstName}, ${d.agentName} from Qwillio here. Sorry we couldn't connect today — we'll follow up soon. Learn more: qwillio.com. ${STOP.en}`,

  /** Outcome "voicemail" or "no-answer". */
  noanswer: (d: { firstName: string; agentName: string; businessName: string; lang: Lang }) =>
    d.lang === 'fr'
      ? `Bonjour ${d.firstName}, ${d.agentName} de Qwillio a tenté de vous joindre au sujet de ${d.businessName}. On aide les entreprises à ne jamais manquer un appel. En savoir plus : qwillio.com. ${STOP.fr}`
      : `Hi ${d.firstName}, ${d.agentName} from Qwillio tried to reach you about ${d.businessName}. We help businesses never miss a call. Learn more: qwillio.com. ${STOP.en}`,

  /** Email bounced — fallback to SMS asking for a correct address. */
  emailBounce: (d: { firstName: string; agentName: string; businessName: string; lang: Lang }) =>
    d.lang === 'fr'
      ? `Bonjour ${d.firstName}, ${d.agentName} de Qwillio. J'ai essayé d'envoyer la démo pour ${d.businessName} mais le courriel a rebondi. Pourriez-vous me répondre avec la bonne adresse ? Merci.`
      : `Hi ${d.firstName}, ${d.agentName} from Qwillio. I tried sending the demo for ${d.businessName} but the email bounced. Could you reply with your correct email? Thanks.`,

  /** Email sent but never opened — fallback nudge. */
  emailNoOpen: (d: { firstName: string; agentName: string; businessName: string; lang: Lang }) =>
    d.lang === 'fr'
      ? `Bonjour ${d.firstName}, ${d.agentName} de Qwillio. J'ai envoyé une démo pour ${d.businessName} hier — elle est peut-être tombée dans les indésirables. Répondez avec votre courriel et je la renvoie. Merci.`
      : `Hi ${d.firstName}, ${d.agentName} from Qwillio. I sent a demo for ${d.businessName} yesterday — looks like it may have hit spam. Reply with your email and I'll resend. Thanks.`,

  /** callAttempts >= 3 with no contact — final outreach. */
  exhausted: (d: { firstName: string; agentName: string; businessName: string; lang: Lang }) =>
    d.lang === 'fr'
      ? `Bonjour ${d.firstName}, ${d.agentName} de Qwillio. J'ai tenté de vous joindre quelques fois au sujet de ${d.businessName}. Sans souci — si vous voulez voir comment l'IA évite de manquer des appels, voici une vidéo de 2 min : qwillio.com/demo.`
      : `Hi ${d.firstName}, ${d.agentName} from Qwillio. Tried reaching you about ${d.businessName} a couple times. No worries — if you're curious how AI helps you never miss a call, here's a 2-min video: qwillio.com/demo.`,

  /** Booking just confirmed — sent to the customer. Raw fields, localized here. */
  bookingConfirm: (d: {
    firstName: string;
    businessName: string;
    date: string | Date;
    time: string | null;
    service: string | null;
    lang: Lang;
  }) => {
    const dateStr = bookingDate(d.date, d.lang);
    if (d.lang === 'fr') {
      const when = d.time ? ` à ${d.time}` : '';
      const svc = d.service ? ` (${d.service})` : '';
      return `Bonjour ${d.firstName}, votre rendez-vous chez ${d.businessName} est confirmé pour le ${dateStr}${when}${svc}. Pour reporter ou annuler, contactez directement ${d.businessName}.`;
    }
    const when = d.time ? ` at ${d.time}` : '';
    const svc = d.service ? ` (${d.service})` : '';
    return `Hi ${d.firstName}, your appointment at ${d.businessName} is confirmed for ${dateStr}${when}${svc}. To reschedule or cancel, contact ${d.businessName} directly.`;
  },

  /**
   * Weekly receptionist digest, sent to the CLIENT (not a prospect). The
   * findings themselves go by email: the SMS exists so the client knows there
   * is something to read without opening their inbox first.
   */
  weeklyInsights: (d: { businessName: string; count: number; link: string; lang: Lang }) =>
    d.lang === 'fr'
      ? `Qwillio : le point de la semaine sur ${d.businessName}. ${d.count} point${d.count > 1 ? 's' : ''} à corriger, le détail est dans votre courriel. Réglez-le dans le chat : ${d.link}. ${STOP.fr}`
      : `Qwillio: this week's check on ${d.businessName}. ${d.count} thing${d.count > 1 ? 's' : ''} to fix, details are in your inbox. Sort it in the chat: ${d.link}. ${STOP.en}`,

  /** 24h reminder before booking. Raw fields, localized here. */
  bookingReminder: (d: {
    firstName: string;
    businessName: string;
    time: string | null;
    service: string | null;
    lang: Lang;
  }) => {
    if (d.lang === 'fr') {
      const when = d.time ? ` à ${d.time}` : ' demain';
      const svc = d.service ? ` pour votre ${d.service}` : '';
      return `Rappel : Bonjour ${d.firstName}, votre rendez-vous chez ${d.businessName} est${when}${svc}. À bientôt.`;
    }
    const when = d.time ? ` at ${d.time}` : ' tomorrow';
    const svc = d.service ? ` for your ${d.service}` : '';
    return `Reminder: Hi ${d.firstName}, your appointment at ${d.businessName} is${when}${svc}. See you soon.`;
  },
};

export type SmsTemplateKey = keyof typeof smsTemplates;
```
