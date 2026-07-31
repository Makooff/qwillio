<!-- source: backend/src/services/email-renderers.ts · renderTrialEndingTemplate -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# essai-bientot-fini

**Quand** : Avant la fin de l'essai
**Code** : `backend/src/services/email-renderers.ts` · `renderTrialEndingTemplate()`

Les `${...}` sont les variables remplies à l'envoi.

---

Votre essai gratuit pour ${data.businessName} se termine le ${formatDate(data.trialEndDate, 'fr')}.

---

Bonjour ${data.contactName}, votre essai gratuit pour ${data.businessName} se termine le ${formatDate(data.trialEndDate, 'fr')}.

---

Forfait ${data.packageType.toUpperCase()}

---

, 28),
brandText('Sans engagement. Annulable à tout moment.'),
brandButton('Continuer avec Qwillio', data.paymentLink),
brandSmall("Sans abonnement, votre réceptionniste IA sera désactivée à la fin de l'essai. — Marie, Qwillio"),
].join(''),
});
}
const dayWord = data.daysLeft > 1 ? 'days' : 'day';
return brandWrap({
title: 'Your trial is ending',
preheader:

---

Hi ${data.contactName}, your free trial for ${data.businessName} ends on ${formatDate(data.trialEndDate, 'en')}.

---

${data.packageType.toUpperCase()} package
