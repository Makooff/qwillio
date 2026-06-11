# Conformité appels IA — Loi 25 (Québec) + cadre canadien

> Checklist opérationnelle, pas un avis juridique. Faire valider par un avocat
> en droit de la vie privée / télémarketing avant de scaler l'outbound.

Deux contextes distincts, deux régimes :
- **Outbound** (Qwillio appelle des prospects à froid) — le plus risqué.
- **Inbound** (la réceptionniste IA répond aux clients d'un client) — risque porté en partie par le client, mais Qwillio fournit l'outil.

---

## 1. Divulgation IA (obligatoire) — la voix doit se déclarer comme IA

Une personne au téléphone doit savoir qu'elle parle à une IA. À mettre **dès la première phrase**, avant toute collecte.

**Outbound — script Marie (FR), 1re ligne :**
> « Bonjour, je suis Marie, une **assistante virtuelle** de Qwillio. »

**Outbound — script Ashley (EN) :**
> "Hi, I'm Ashley, a **virtual assistant** from Qwillio."

**Inbound — réceptionniste IA du client :**
> « Bonjour, vous êtes au [Entreprise], je suis l'**assistante virtuelle**. »

À éditer dans : [niche-scripts.ts](../backend/src/config/niche-scripts.ts) (firstMessage), [vapi-templates.ts](../backend/src/config/vapi-templates.ts) (systemPrompt + firstMessage), [outbound-engine.service.ts](../backend/src/services/outbound-engine.service.ts) (ASHLEY_SCRIPTS / MARIE_SCRIPTS).

- [ ] Divulgation IA en 1re phrase, FR + EN, tous les scripts outbound
- [ ] Divulgation IA en 1re phrase sur le firstMessage inbound par défaut
- [ ] Si l'appelant demande un humain → transfert ou rappel proposé (déjà supporté : transfer-destination-request)

---

## 2. Consentement à l'enregistrement (les appels sont transcrits)

Vapi transcrit/enregistre. Au Canada, l'enregistrement par une partie à la
conversation est permis, mais la **divulgation** est exigée (et Loi 25 pour la
donnée). Annoncer avant d'enregistrer.

**Ligne à ajouter après la divulgation IA :**
> « Cet appel peut être **enregistré et transcrit** à des fins de qualité. »
> "This call may be **recorded and transcribed** for quality purposes."

- [ ] Mention enregistrement dans la 1re réplique (FR + EN), outbound + inbound
- [ ] Le client (entreprise) est informé que sa réceptionniste enregistre, et le mentionne à ses propres clients (clause dans le contrat client / page setup)
- [ ] Possibilité de désactiver l'enregistrement par client si demandé

---

## 3. Liste d'exclusion / Ne pas appeler (DNC)

Démarchage téléphonique au Canada : LNNTE (Liste nationale de numéros de
télécommunication exclus / National DNCL) + exclusions internes.

- [ ] Scrubbing LNNTE avant tout appel outbound (souscription registre requise)
- [ ] Honorer toute demande « ne me rappelez plus » → flag `doNotCall` permanent sur le prospect
- [ ] STOP au SMS déjà géré (`smsOptedOut`) — vérifier parité côté appel
- [ ] Fenêtres horaires légales respectées (déjà : 9-12/13-17, pas le dimanche) — vérifier les règles CRTC (heures permises, identification de l'appelant)
- [ ] Afficher un numéro de rappel valide (local-presence OK, mais joignable)

---

## 4. Loi 25 — gouvernance des données (prospects + clients)

La Loi 25 s'applique aux renseignements personnels collectés (nom, téléphone,
courriel, transcriptions d'appels).

- [ ] **Responsable de la protection des renseignements personnels** désigné (nom + courriel publics) — par défaut le propriétaire
- [ ] **Politique de confidentialité** à jour, accessible (page /privacy existe — vérifier qu'elle couvre : finalité, durée de conservation, transferts hors Québec, droits d'accès/rectification/suppression, sous-traitants : Vapi, Twilio, OpenAI/Anthropic, Resend, Stripe)
- [ ] **Transferts hors Québec/Canada** (Vapi/OpenAI = US) : évaluation des facteurs de vie privée (ÉFVP) documentée
- [ ] **Durée de conservation** des transcriptions/enregistrements définie + purge auto (il existe déjà une purge bot_log 7 j — étendre aux transcriptions d'appels)
- [ ] **Droit d'accès / suppression** : process pour qu'un prospect demande ses données ou leur effacement (le unsubscribe existe pour l'email — étendre)
- [ ] **Registre des incidents** de confidentialité + procédure de notification (CAI + personnes concernées) en cas de fuite
- [ ] **Consentement** : pour l'outbound à froid, base légale = intérêt légitime B2B + opt-out facile ; documenter

---

## 5. Sécurité des données (appuie la Loi 25)

- [x] `JWT_SECRET` fail-fast en prod (fait — [env-validation.ts](../backend/src/config/env-validation.ts))
- [ ] Webhooks Vapi/Twilio signés vérifiés (`VAPI_WEBHOOK_SECRET`, `TWILIO_VALIDATE_WEBHOOKS=true` en prod)
- [ ] Chiffrement au repos des transcriptions (Neon chiffré au repos — confirmer)
- [ ] Accès aux données restreint par rôle (admin vs client) — déjà via authMiddleware

---

## Priorité avant les premiers appels à froid

1. Divulgation IA + mention enregistrement dans les scripts (sections 1 & 2) — **code, rapide**
2. Scrubbing LNNTE + flag doNotCall (section 3) — **bloquant légal**
3. Politique de confidentialité Loi 25 complète + responsable désigné (section 4)
4. Validation par un avocat

Le reste (ÉFVP, registre incidents, purge transcriptions) peut suivre en parallèle
des premiers pilotes, mais doit exister avant le volume.
