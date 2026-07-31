<!-- source: backend/src/services/email-renderers.ts · renderRescheduleTemplate -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# replanification

**Quand** : Rendez-vous déplacé
**Code** : `backend/src/services/email-renderers.ts` · `renderRescheduleTemplate()`

Les `${...}` sont les variables remplies à l'envoi.

---

On vous a manqué chez ${data.businessName} — trouvons un nouveau moment.

---

Bonjour ${data.customerName}, nous avons remarqué que vous n'avez pas pu vous présenter à votre rendez-vous du ${dateStr}. Aucun souci — ça arrive.

---

Ou appelez-nous au ${data.businessPhone} quand vous voulez — notre réceptionniste IA est disponible 24 h/24.

---

We missed you at ${data.businessName} — let's find a new time.

---

Hi ${data.customerName}, we noticed you weren't able to make your appointment on ${dateStr}. No worries — things happen.

---

We'd love to reschedule at a time that works better for you.

---

Or call us at ${data.businessPhone} anytime — our AI receptionist is available 24/7.
