# SMS

```
transactionnels/   ce que l'application envoie toute seule
vente/             relances que tu envoies à la main après un appel
```

## Source de vérité

Même règle que pour les emails. Les SMS transactionnels vivent dans
`backend/src/services/sms-templates.ts`. Le fichier `transactionnels/tous.md`
en est un **miroir généré**, pas une source :

```bash
npm run sync:templates    # regénère
npm run check:templates   # échoue si le code a bougé sans le dossier
```

Les SMS de `vente/` n'ont pas d'équivalent en code : ce dossier en est la seule source.

## Les douze messages transactionnels

`en` et `fr` portent la langue. Les dix autres couvrent le cycle d'un prospect
et d'un rendez-vous : `welcome`, `voicemail`, `interested`, `callback`,
`noanswer`, `emailBounce`, `emailNoOpen`, `exhausted`, `bookingConfirm`,
`bookingReminder`.

## Règles

Un SMS coûte à l'envoi et se lit en trois secondes.

- **160 caractères.** Au-delà, c'est deux SMS facturés et une lecture coupée.
- Dire **qui appelle** dès les premiers mots. Un numéro inconnu sans nom se supprime.
- **Une seule action.** Un lien, pas trois.
- Pas d'emojis, pas de majuscules d'insistance, pas de tirets cadratins.
- Les prix viennent de `backend/src/config/plans.ts`.
- L'essai dure **7 jours**, avec **carte à l'inscription**.
- Rien qui ne puisse se prouver, comme partout ailleurs (voir `DA/voix.md`).
