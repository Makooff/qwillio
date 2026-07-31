<!-- source: backend/src/services/email-renderers.ts · renderPasswordResetTemplate -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# reset-mot-de-passe

**Quand** : Demande de réinitialisation
**Code** : `backend/src/services/email-renderers.ts` · `renderPasswordResetTemplate()`

Les `${...}` sont les variables remplies à l'envoi.

---

Bonjour ${name}, nous avons reçu une demande de réinitialisation de votre mot de passe Qwillio. Cliquez ci-dessous pour en choisir un nouveau.

---

Ou collez ce lien dans votre navigateur :
${data.resetUrl}

---

Hi ${name}, we received a request to reset your Qwillio password. Click below to choose a new one.

---

Or paste this link into your browser:
${data.resetUrl}
