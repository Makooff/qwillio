<!-- source: backend/src/services/email-renderers.ts · renderBookingReminderTemplate -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# rappel-rdv

**Quand** : Avant un rendez-vous pris par l’IA
**Code** : `backend/src/services/email-renderers.ts` · `renderBookingReminderTemplate()`

Les `${...}` sont les variables remplies à l'envoi.

---

: dateStr;
if (lang === 'fr') {
const details: string[] = [

---

Service — ${data.serviceType}

---

Notes — ${data.specialRequests}

---

Rappel de votre rendez-vous chez ${data.businessName}.

---

Bonjour ${data.customerName}, petit rappel de votre prochain rendez-vous chez ${data.businessName}.

---

) : '',
data.businessPhone
? brandSmall(

---

)
: brandSmall('Pour reporter, contactez-nous directement.'),
].join(''),
});
}
const details: string[] = [

---

Service — ${data.serviceType}

---

Notes — ${data.specialRequests}

---

Reminder of your appointment at ${data.businessName}.

---

Hi ${data.customerName}, this is a friendly reminder about your upcoming appointment at ${data.businessName}.

---

) : '',
data.businessPhone
? brandSmall(
