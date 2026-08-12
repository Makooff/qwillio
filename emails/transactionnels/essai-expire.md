<!-- source: backend/src/services/email-renderers.ts · renderTrialExpiredTemplate -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# essai-expire

**Quand** : Essai terminé sans conversion
**Code** : `backend/src/services/email-renderers.ts` · `renderTrialExpiredTemplate()`

Les `${...}` sont les variables remplies à l'envoi.

---

Réactivez votre réceptionniste IA pour ${data.businessName} en 2 minutes.

---

Bonjour ${data.contactName}, votre essai gratuit pour ${data.businessName} vient de se terminer. Votre réceptionniste IA est maintenant en pause — les appels entrants ne sont plus traités.

---

Forfait ${data.packageType.toUpperCase()}

---

, 28),
brandButton('Réactiver mon assistant IA', data.paymentLink),
brandSmall('Votre configuration est conservée 30 jours, puis supprimée définitivement. — Marie, Qwillio'),
].join(''),
});
}
return brandWrap({
lang,
title: 'Your free trial has ended',
preheader:

---

,
body: [
brandTitle('Your trial has ended'),
brandText(

---

),
brandText('Subscribe to bring it back in two minutes:'),
brandHighlight(
