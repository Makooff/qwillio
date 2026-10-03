<!-- source: backend/src/services/email-renderers.ts · renderTrialWelcomeTemplate -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# bienvenue-essai

**Quand** : Début des 7 jours d'essai
**Code** : `backend/src/services/email-renderers.ts` · `renderTrialWelcomeTemplate()`

Les `${...}` sont les variables remplies à l'envoi.

---

aux quatre paliers, et que le SMS du closer promettait la meme chose. Un
prospect qui s'inscrit apres avoir lu 30 jours decouvre 7: la promesse est
fausse au moment precis ou il verifie. On derive donc du seul fait dont on
dispose ici — la date de fin — pour qu'une prochaine modification de la
duree ne laisse pas ce texte derriere elle. */
const trialDays = Math.max(
1,
Math.round((data.trialEndDate.getTime() - Date.now()) / 86_400_000),
);
if (lang === 'fr') {
return brandWrap({
lang,
title: 'Votre essai gratuit est actif',
preheader:

---

,
body: [
brandTitle('Votre essai gratuit est actif'),
brandText(

---

),
brandText('Ce qui est inclus dans votre essai :'),
brandList([
'Réceptionniste IA disponible 24 h/24',

---

,
'Réservations et rendez-vous automatiques',
'Tableau de bord de suivi en temps réel',
'Support technique par courriel',
]),
brandHighlight('Fin de l\'essai le', formatDate(data.trialEndDate, 'fr'), 18),
brandText("Prochaines étapes : notre équipe configure votre assistant IA dans les 24 à 48 h et vous envoie le numéro de téléphone IA. Ensuite, il ne reste qu'à tester."),
brandSmall('Une question ? Répondez à ce courriel et Marie vous accompagne. L\'équipe Qwillio'),
].join(''),
});
}
return brandWrap({
lang,
title: 'Your free trial is active',
preheader:

---

,
body: [
brandTitle('Your free trial is active'),
brandText(

---

),
brandText("What's included in your trial:"),
brandList([
'AI receptionist available 24/7',
