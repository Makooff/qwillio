# E-mails avec vidéo : suivi après appel et prospection

Deux séquences prêtes à copier, chacune avec la vidéo qui répond à ce que le
prospect a en tête à ce moment-là. Le texte reste court : la vidéo fait le
travail de démonstration, l'e-mail ne fait qu'y amener.

Envoi depuis `support@qwillio.com` (ou ton adresse à toi sur le domaine),
signé de ton prénom. Prix : `backend/src/config/plans.ts` (Solo 99 €/mois,
Starter 249 €, Pro 599 €). Essai 7 jours, carte demandée à l'inscription.

---

## Comment « joindre » une vidéo

**Jamais en pièce jointe.** Un fichier vidéo dans un e-mail fait grimper le
score de spam, dépasse souvent la taille autorisée et ne se lit pas dans la
boîte de réception. La pratique qui marche : une **vignette cliquable** (image
fixe avec un bouton lecture) qui ouvre la vidéo hébergée sur qwillio.com.

Les vidéos sont en ligne, en 4:5, légères (moins d'1,5 Mo, elles démarrent
tout de suite sur un téléphone) :

| Vidéo | Pour qui | FR | EN |
|---|---|---|---|
| s01 · Un appel manqué | tout le monde, commerces, restaurants | `qwillio.com/v/fr/s01-appel-manque.mp4` | `qwillio.com/v/en/s01-missed-call.mp4` |
| s02 · 3 h du matin | cabinets (dentiste, kiné, médecin) | `qwillio.com/v/fr/s02-trois-heures.mp4` | `qwillio.com/v/en/s02-3am.mp4` |
| s05 · Urgence | artisans (plombier, électricien, chauffagiste) | `qwillio.com/v/fr/s05-urgence.mp4` | `qwillio.com/v/en/s05-emergency.mp4` |
| s06 · Elle n'invente rien | l'objection « une IA va dire n'importe quoi » | `qwillio.com/v/fr/s06-invente-rien.mp4` | `qwillio.com/v/en/s06-no-guessing.mp4` |
| s11 · Essayez-la | dernier e-mail, l'appel à l'essai | `qwillio.com/v/fr/s11-essayez.mp4` | `qwillio.com/v/en/s11-try-her.mp4` |

Chaque vidéo a sa vignette au même chemin, en `.jpg` au lieu de `.mp4`
(par exemple `qwillio.com/v/fr/s01-appel-manque.jpg`). Les versions
néerlandaises arrivent dans `qwillio.com/v/nl/` dès que leur rendu est fini.

**Dans Gmail** : place le curseur, *Insérer une photo → Adresse web (URL)*,
colle l'adresse du `.jpg`, puis sélectionne l'image et ajoute le lien
(icône chaîne) vers le `.mp4`. Mets la largeur à 280-320 px.

**En HTML** (Instantly, Lemlist, signature) :

```html
<a href="https://qwillio.com/v/fr/s01-appel-manque.mp4">
  <img src="https://qwillio.com/v/fr/s01-appel-manque.jpg" width="300"
       alt="Voir la vidéo (30 secondes)" style="border-radius:12px;display:block">
</a>
```

**Règle de délivrabilité en prospection à froid** : pas d'image ni de lien
dans le tout premier e-mail. La vidéo arrive à l'e-mail 2, d'abord en simple
lien texte, et en vignette seulement quand la personne a déjà répondu ou
ouvert plusieurs fois. En suivi après un appel, la personne t'attend : la
vignette va dès le premier e-mail.

---

## A. Suivi après un appel de prospection

### A1 · Il a décroché et dit « envoyez-moi quelque chose » (dans l'heure)

**Objet** : `Qwillio · la vidéo promise, {{Prenom}}`

```
Bonjour {{Prenom}},

Merci pour l'échange tout à l'heure. Comme promis, voici en 30 secondes
ce que fait Qwillio quand vous ne pouvez pas décrocher :

[vignette s01, ou s02 pour un cabinet, s05 pour un artisan]

En résumé : elle répond à chaque appel, en français, néerlandais ou
anglais, prend le rendez-vous dans votre agenda et vous envoie le
résumé par SMS. Ce qu'elle ne sait pas, elle ne l'invente pas : elle
note la question et vous la transmet.

Le plus simple pour juger, c'est de l'appeler vous-même : sur
qwillio.com, vous lui parlez depuis votre navigateur, en 30 secondes.

Si ça vous parle, l'essai dure 7 jours, à partir de 99 € par mois ensuite.
Je peux aussi la configurer avec vous en 15 minutes cette semaine :
{{Creneau_1}} ou {{Creneau_2}} ?

{{Prenom_Fondateur}}
Qwillio
```

### A2 · Pas joignable, message laissé (le jour même)

**Objet** : `{{Nom_Entreprise}} · votre téléphone, quand vous êtes occupé`

```
Bonjour {{Prenom}},

Je viens d'essayer de vous joindre, sans succès, ce qui tombe assez bien
puisque c'est exactement le sujet : les appels qu'on ne peut pas prendre.

Qwillio est une réceptionniste IA qui décroche à votre place, prend les
rendez-vous et vous envoie un résumé par SMS. 30 secondes pour voir :

[vignette s01, ou s02 / s05 selon le métier]

Je vous rappelle {{Jour}} vers {{Heure}}, sauf si vous préférez répondre
à cet e-mail.

{{Prenom_Fondateur}}
Qwillio
```

### A3 · Relance J+3 : l'objection avant qu'elle soit dite

**Objet** : `« Et si elle dit n'importe quoi ? »`

```
Bonjour {{Prenom}},

C'est la question qu'on me pose le plus, alors je préfère y répondre
avant vous.

Qwillio ne répond qu'avec ce que vous lui avez appris. Quand on lui pose
une question qu'elle ne connaît pas, elle le dit, note la question et
vous la transmet. Vous répondez une fois, elle s'en souvient pour tous
les appels suivants. La démonstration en 30 secondes :

[vignette s06]

{{Prenom_Fondateur}}
```

### A4 · Relance J+7 : la dernière

**Objet** : `Je ne vous relance plus, {{Prenom}}`

```
Bonjour {{Prenom}},

Dernier message de ma part pour ne pas encombrer votre boîte.

Si un jour les appels manqués redeviennent un sujet, vous pouvez parler
à Qwillio directement sur qwillio.com, sans inscription :

[vignette s11]

Et si ce n'est pas pour vous, une réponse « non merci » me suffit, je
n'insisterai pas.

Bonne continuation,
{{Prenom_Fondateur}}
```

---

## B. Prospection à froid (4 e-mails sur 14 jours)

Arrêt immédiat dès qu'il répond. Personnalisation `{{Metier}}` et
`{{Ville}}` obligatoire : sans elle, les filtres anti-spam classent la
séquence en promotion.

### B1 · J0 · La question (sans lien, sans image)

**Objet** : `{{Prenom}}, vos appels pendant {{Moment_Occupe}}`

`{{Moment_Occupe}}` : « les soins » pour un cabinet, « vos chantiers » pour
un artisan, « le service » pour un restaurant, « une coupe » pour un salon.

```
Bonjour {{Prenom}},

Une question simple, en tant que {{Metier}} à {{Ville}} : que deviennent
les appels qui arrivent pendant {{Moment_Occupe}} ?

Pour la plupart des indépendants, ils tombent sur la messagerie, et une
partie de ces clients appelle quelqu'un d'autre sans laisser de message.

J'ai construit une réceptionniste IA qui décroche à votre place, en
français, néerlandais ou anglais, et prend les rendez-vous dans votre
agenda.

Est-ce que c'est un sujet chez vous, ou vous avez déjà quelqu'un au
téléphone ?

{{Prenom_Fondateur}}
Fondateur, Qwillio
```

### B2 · J3 · La vidéo, en lien texte

**Objet** : `30 secondes, {{Prenom}}`

```
{{Prenom}},

Plutôt que de vous l'expliquer, je vous la montre. 30 secondes, un vrai
appel du début à la fin :

{{Lien_Video}}

(cabinet : s02 · artisan : s05 · commerce, restaurant : s01)

Elle répond, prend le rendez-vous, et vous recevez le résumé par SMS.
Est-ce que ce serait utile chez {{Nom_Entreprise}} ?

{{Prenom_Fondateur}}
```

### B3 · J7 · L'objection

**Objet** : `Et si elle invente une réponse ?`

```
{{Prenom}},

C'est la crainte la plus logique avec une IA au téléphone, alors voici
comment c'est réglé : elle ne répond qu'avec ce que vous lui avez appris.
Une question qu'elle ne connaît pas, elle la note et vous la transmet.

La démonstration : {{Lien_Video_s06}}

L'essai dure 7 jours, la mise en route prend un quart d'heure.

{{Prenom_Fondateur}}
```

### B4 · J14 · Le dernier

**Objet** : `Je ferme le dossier, {{Prenom}}`

```
{{Prenom}},

Je n'ai pas eu de nouvelles, donc je suppose que le moment n'est pas le
bon, et je ne vous relancerai plus.

Si un jour vous voulez l'entendre, elle répond directement sur
qwillio.com, depuis votre navigateur : {{Lien_Video_s11}}

Bonne continuation,
{{Prenom_Fondateur}}
```

---

## Versions néerlandaise et anglaise des deux e-mails clés

### A1 · NL · Na een gesprek (binnen het uur)

**Onderwerp** : `Qwillio · de beloofde video, {{Prenom}}`

```
Goedendag {{Prenom}},

Bedankt voor het gesprek daarnet. Zoals beloofd: in 30 seconden wat
Qwillio doet wanneer u niet kunt opnemen.

[vignette nl/s01, nl/s02 of nl/s05]

Ze beantwoordt elke oproep, in het Nederlands, Frans of Engels, zet de
afspraak in uw agenda en stuurt u een samenvatting per sms. Wat ze niet
weet, verzint ze niet: ze noteert de vraag en geeft ze aan u door.

Het eenvoudigst is haar zelf te bellen: op qwillio.com spreekt u met haar
via uw browser, in 30 seconden.

De proefperiode duurt 7 dagen, daarna vanaf 99 euro per maand. Zullen we
haar samen instellen, een kwartier deze week: {{Creneau_1}} of
{{Creneau_2}}?

{{Prenom_Fondateur}}
Qwillio
```

### A1 · EN · After a call (within the hour)

**Subject** : `Qwillio · the video I promised, {{Prenom}}`

```
Hi {{Prenom}},

Thanks for the chat earlier. As promised, here is what Qwillio does when
you can't pick up, in 30 seconds:

[thumbnail en/s01, en/s02 or en/s05]

She answers every call, in English, French or Dutch, books the
appointment straight into your calendar and texts you a summary. What she
doesn't know, she doesn't make up: she notes the question and passes it
on to you.

The easiest way to judge is to call her yourself: on qwillio.com you can
talk to her from your browser in 30 seconds.

The trial lasts 7 days, then from 99 euros a month. Happy to set it up
with you in 15 minutes this week: {{Creneau_1}} or {{Creneau_2}}?

{{Prenom_Fondateur}}
Qwillio
```

### B1 · NL · Koude e-mail, dag 0 (zonder link)

**Onderwerp** : `{{Prenom}}, uw oproepen tijdens {{Moment_Occupe}}`

```
Goedendag {{Prenom}},

Een eenvoudige vraag, als {{Metier}} in {{Ville}}: wat gebeurt er met de
oproepen die binnenkomen tijdens {{Moment_Occupe}}?

Bij de meeste zelfstandigen gaan ze naar de voicemail, en een deel van die
klanten belt iemand anders zonder een bericht in te spreken.

Ik heb een AI-receptioniste gebouwd die voor u opneemt, in het Nederlands,
Frans of Engels, en de afspraken in uw agenda zet.

Is dat bij u een onderwerp, of neemt er al iemand op?

{{Prenom_Fondateur}}
Oprichter, Qwillio
```

### B1 · EN · Cold email, day 0 (no link)

**Subject** : `{{Prenom}}, your calls during {{Moment_Occupe}}`

```
Hi {{Prenom}},

A simple question, as a {{Metier}} in {{Ville}}: what happens to the calls
that come in during {{Moment_Occupe}}?

For most independents they go to voicemail, and some of those customers
call someone else without leaving a message.

I built an AI receptionist that answers for you, in English, French or
Dutch, and books appointments straight into your calendar.

Is that something you deal with, or do you already have someone on the
phone?

{{Prenom_Fondateur}}
Founder, Qwillio
```
