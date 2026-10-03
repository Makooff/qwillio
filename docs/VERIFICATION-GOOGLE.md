# Vérification Google OAuth — dossier de soumission

> État : à soumettre. Rédigé le 3 octobre 2026.
> Ce document contient **tout ce qu'il faut coller** dans la Google Cloud
> Console. Il n'y a rien à inventer : chaque affirmation est vérifiée dans le
> code, avec le fichier et la ligne.

---

## 1. Ce que la vérification coûte, et ce qu'elle rapporte

| | Réponse |
|---|---|
| Coût | **0 €** |
| Audit de sécurité tiers | **Non requis** (voir §2) |
| Délai annoncé | ~10 jours |
| Délai réel constaté | 2 à 6 semaines |
| Ce qu'elle débloque | Retirer le plafond de **100 utilisateurs à vie** |

**Le plafond est le vrai enjeu.** Une app non vérifiée qui demande un scope
sensible voit chaque utilisateur passer par un écran d'avertissement rouge
(« Google n'a pas vérifié cette application ») et compte contre une limite de
**100 autorisations pour la vie du projet**. Elle ne se réinitialise pas, ne se
contourne pas en créant un second client ID, et ne se remet pas à zéro en
redéployant. Tant qu'elle n'est pas vérifiée, le 101e client est bloqué net.

**Ce qui n'est PAS requis ici.** L'audit de sécurité tiers (CASA Tier 2,
plusieurs milliers d'euros, 4 à 8 semaines de plus) ne concerne que les scopes
**restreints** : Gmail complet, Drive complet. Qwillio n'en demande aucun.

---

## 2. Les scopes demandés, et pourquoi chacun

### Aujourd'hui (`backend/src/services/google-calendar.service.ts:9-12`)

```js
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];
```

Les deux sont **sensibles** (pas restreints). C'est ce qui évite l'audit CASA.

### Recommandation : remplacer `calendar.readonly` par `calendar.freebusy`

Le service ne lit **jamais** le contenu de l'agenda. Il interroge l'endpoint
`freeBusy` (`google-calendar.service.ts:189`) pour connaître les créneaux
occupés et proposer un rendez-vous libre :

```js
const response = await fetch(`${this.baseUrl}/freeBusy`, { method: 'POST', ... });
```

`freeBusy` ne renvoie que des intervalles occupés, **jamais** les titres,
invités ou descriptions des événements. Le scope `calendar.freebusy` couvre
exactement ce besoin.

**Pourquoi le faire.** Google rejette les apps qui demandent plus large que
nécessaire (« request the narrowest scope »). Demander `calendar.readonly`
alors qu'on ne lit que les créneaux occupés, c'est le motif de rejet le plus
facile à éviter. Passer à `calendar.freebusy` :

- supprime l'accès au **contenu** de l'agenda du client ;
- simplifie la justification (une permission qui lit moins se défend mieux) ;
- ne change **rien** au comportement, puisque le code n'appelle que `freeBusy`.

> `calendar.freebusy` est classé scope **sensible** lui aussi : la vérification
> reste nécessaire, mais le dossier est plus solide.

---

## 3. Texte à coller : justification des scopes

Google demande, pour chaque scope, une phrase expliquant l'usage. Voici le
texte prêt à copier.

### `https://www.googleapis.com/auth/calendar.freebusy`

> Qwillio est un standard téléphonique IA pour petites entreprises. Quand un
> client appelle un commerce équipé de Qwillio et demande un rendez-vous, notre
> assistant consulte les créneaux **occupés** de l'agenda du commerçant afin de
> ne proposer qu'une heure réellement libre. Nous appelons l'endpoint
> `freeBusy` et ne recevons que des intervalles occupés : nous ne lisons jamais
> le titre, les invités, la description ni le lieu d'un rendez-vous existant.
> Sans cette permission, l'assistant proposerait des créneaux déjà pris et
> créerait des doubles réservations.

### `https://www.googleapis.com/auth/calendar.events`

> Une fois le rendez-vous confirmé au téléphone, Qwillio crée l'événement
> correspondant dans l'agenda du commerçant : intitulé du rendez-vous (nom du
> client et prestation), heure de début et de fin, et coordonnées laissées par
> l'appelant (téléphone, courriel, demandes particulières). L'événement est
> créé à la demande explicite du commerçant, qui a activé la synchronisation
> depuis son espace Qwillio. Nous créons et modifions uniquement les événements
> issus des réservations prises par notre assistant ; nous ne lisons ni ne
> modifions le reste de l'agenda, et nous n'accédons jamais aux réglages, au
> partage ou aux permissions du calendrier.

**À ne pas écrire** : rien sur des fonctions « à venir ». Google vérifie les
scopes sur ce qui existe. Chaque scope déclaré doit être démontrable dans la
vidéo (§5).

---

## 4. À vérifier avant de soumettre (checklist console)

Ces éléments se remplissent dans **Google Cloud Console → API et services →
Écran de consentement OAuth**.

| Champ | Valeur | État |
|---|---|---|
| Nom de l'application | `Qwillio` | à confirmer |
| Domaine principal | `https://qwillio.com` | ✅ répond 200 |
| Politique de confidentialité | `https://qwillio.com/privacy` | ✅ 7 222 car., FR, RGPD |
| Conditions d'utilisation | `https://qwillio.com/terms` | ✅ 4 303 car. |
| Adresse e-mail d'assistance | à renseigner | ⚠️ vérifier qu'elle est lue |
| Logo de l'application | `qwillio-logo-512.svg` | ⚠️ doit faire ≤ 1 Mo, 120×120 px min |
| Origines JavaScript autorisées | `https://qwillio.com`, `http://localhost:4188` | ⚠️ localhost à ajouter |
| URIs de redirection | callback OAuth du backend | ⚠️ à confirmer |

### Le point qui fait rejeter : le lien légal dans l'application

Google exige que la politique de confidentialité soit **atteignable depuis
l'interface qui demande l'accès** — pas seulement depuis le site public.

Constat vérifié : `frontend/src/components/v2/FooterV2.tsx:42` pose le lien
`/privacy` dans le pied de page **public**. Les pages du portail connecté
(`frontend/src/pages/v2/app/`, `frontend/src/pages/client/`) n'en contenaient
**aucun**. Un relecteur qui ouvre l'écran d'intégration Google Calendar ne peut
pas atteindre la politique : c'est un motif de rejet classique.

**Corrigé côté V1** (le portail réellement en production) : le lien
« Confidentialité » vit dans la barre latérale, avec « Aide » et
« Documentation » (`frontend/src/components/layout/DashboardShell.tsx`).

⚠️ **Reste à corriger côté V2.** Le portail V2
(`frontend/src/components/v2/app/AppShell.tsx`, `pages/v2/app/Integrations.tsx`)
n'est **pas branché** : aucune de ses 25 pages n'est routée dans `App.tsx`.
S'il est branché un jour, il devra recevoir le même lien — l'écran
`Integrations.tsx` est précisément celui où l'utilisateur autorise son compte
Google. Ne pas le brancher en production avant d'avoir ajouté ce lien.

---

## 5. Vidéo de démonstration (~3 min)

Google exige une vidéo non répertoriée montrant **chaque** scope en action, avec
le nom de l'app et l'écran de consentement visibles. Voici le déroulé.

### Préparation

- Écran en **1920×1080**, navigateur en fenêtre (pas plein écran), barre d'URL
  visible : Google veut voir le domaine.
- Enregistrer en **une seule prise**, sans coupure.
- Parler en anglais, ou sous-titrer. Le relecteur est anglophone.
- Utiliser un agenda Google **avec un rendez-vous existant** (pour prouver que
  les créneaux occupés sont bien respectés).

### Déroulé

| Temps | Écran | Ce qu'on montre | Ce qu'on dit |
|---|---|---|---|
| 0:00–0:20 | `https://qwillio.com` | La page d'accueil, la barre d'URL lisible | « Qwillio is an AI phone receptionist for small businesses. It answers calls and books appointments into the business owner's Google Calendar. » |
| 0:20–0:50 | Espace client → **Intégrations** | Le bouton « Connecter Google Calendar » | « The business owner connects their own calendar. This is the only place calendar access is requested. » |
| 0:50–1:20 | **Écran de consentement Google** | Nom de l'app « Qwillio », l'origine, la liste exacte des permissions | « Here is the consent screen: Qwillio requests two permissions, free/busy and calendar events. The URL bar shows qwillio.com. » |
| 1:20–1:45 | **freebusy** | Un rendez-vous existant à 10 h dans l'agenda. Sur l'espace client, on demande un rendez-vous : **10 h n'est pas proposé** | « The calendar already has a 10 AM appointment. Because Qwillio only reads free/busy, it knows that slot is taken and does not offer it. » |
| 1:45–2:20 | **calendar.events** | Un appel simulé (ou réel) réserve 14 h → on ouvre Google Calendar → l'événement y est, avec le nom et le téléphone | « A booking is confirmed on the call. Qwillio creates the event: title, start, end, and the caller's contact details. » |
| 2:20–2:35 | Google Calendar | Cliquer l'événement créé | « Note the event shows the phone number and the booking source. » |
| 2:35–2:55 | Espace client → **Déconnexion** | Révoquer l'accès | « The business can disconnect at any time, which revokes Qwillio's access. » |
| 2:55–3:00 | `https://qwillio.com/privacy` | Faire défiler jusqu'à la section Google | « Data handling is described in the privacy policy. » |

**Ce qui fait échouer une vidéo** : ne montrer qu'un seul scope, couper le
montage, cacher la barre d'URL, ou montrer des données de test évidentes
(« John Doe »). Utiliser de vraies données cohérentes.

---

## 6. Après la soumission

- Google répond par courriel, généralement sous quelques jours, souvent avec
  des questions. **Répondre vite** : un dossier sans réponse est abandonné au
  bout de quelques semaines.
- Une demande fréquente : « montrez-nous comment l'utilisateur supprime ses
  données ». Prévoir la réponse (cf. §7).
- Si un scope est refusé, il est plus rapide de **retirer** ce scope que de
  plaider. Le produit doit fonctionner sans — c'est à vérifier avant.

## 7. Questions probables, réponses à préparer

**« Comment un utilisateur supprime-t-il ses données ? »**
Percer la réponse exacte dans le code avant de répondre. Pister :
déconnexion Google, suppression de compte, purge des transcriptions.

**« Où sont stockées les données ? »**
Render, région **Oregon** (États-Unis). C'est un point sensible : le site ne
promet plus l'hébergement en UE (déjà corrigé), mais un relecteur européen peut
poser la question. Voir `docs/MIGRATION-UE-RUNBOOK.md`.

**« Utilisez-vous les données Google pour entraîner un modèle ? »**
Non. Aucun entraînement, aucune revente. Les jetons servent uniquement à lire
les créneaux et écrire l'événement réservé.

**« Combien de temps conservez-vous les données ? »**
⚠️ **Incohérence connue à corriger avant de répondre.** La page Confidentialité
annonce « 90 jours fermes » alors que la durée est devenue réglable par client
(relevé dans `docs/A-FAIRE-PROPRIETAIRE.md:249`). Google lira cette page : si la
réponse contredit la politique, c'est un rejet. Corriger l'un ou l'autre
d'abord.

---

## 8. Ce qui reste à faire, dans l'ordre

1. **Ajouter le lien légal dans le portail connecté** — l'écran Intégrations et
   le pied de page du portail. Motif de rejet, à faire avant tout.
2. **Trancher la durée de conservation** : aligner la page Confidentialité sur
   la réalité, ou l'inverse.
3. **Passer `calendar.readonly` à `calendar.freebusy`** — moins de permissions,
   dossier plus solide, zéro changement de comportement.
4. **Vérifier l'écran de consentement** : nom, domaine, logo aux bonnes
   dimensions, e-mail d'assistance relevé.
5. **Ajouter `http://localhost:4188`** aux origines autorisées (pour tester en
   local).
6. **Enregistrer la vidéo** selon le déroulé du §5.
7. **Soumettre**, puis répondre vite aux questions de Google.
