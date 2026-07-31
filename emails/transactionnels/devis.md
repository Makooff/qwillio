<!-- source: backend/src/services/email-renderers.ts · renderQuoteTemplate -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# devis

**Quand** : Envoi d'un devis à un prospect
**Code** : `backend/src/services/email-renderers.ts` · `renderQuoteTemplate()`

Les `${...}` sont les variables remplies à l'envoi.

---

Devis personnalisé pour ${data.businessName}.

---

Bonjour ${name}, suite à notre échange, voici votre devis pour ${data.businessName}.

---

Forfait ${data.packageType.toUpperCase()}

---

Sans frais d'installation. Sans engagement.

---

Personalized quote for ${data.businessName}.

---

Hi ${name}, following our conversation, here is your quote for ${data.businessName}.

---

${data.packageType.toUpperCase()} package

---

No setup fee. No commitment.
