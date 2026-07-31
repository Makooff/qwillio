<!-- source: backend/src/services/email-renderers.ts · renderCallback3MonthsTemplate -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# rappel-3-mois

**Quand** : Rappel d'un prospect tiède
**Code** : `backend/src/services/email-renderers.ts` · `renderCallback3MonthsTemplate()`

Les `${...}` sont les variables remplies à l'envoi.

---

mailto:${env.RESEND_REPLY_TO}?subject=Suivi%20${encodeURIComponent(data.businessName)}

---

Petit suivi pour ${data.businessName} — quelques nouveautés depuis notre dernier échange.

---

Bonjour ${data.contactName}, on s'est parlé il y a 3 mois au sujet d'une réceptionniste IA pour ${data.businessName}. Votre situation a-t-elle changé ?

---

mailto:${env.RESEND_REPLY_TO}?subject=Follow-up%20${encodeURIComponent(data.businessName)}

---

Quick check-in for ${data.businessName} — a few new things since we last spoke.

---

Hi ${data.contactName}, we spoke 3 months ago about an AI receptionist for ${data.businessName}. Has your situation changed?
