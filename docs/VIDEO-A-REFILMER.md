# Ce qu'il reste à filmer — les deux scénarios manquants

> Ta vidéo du 3 octobre montre bien le domaine, la connexion Google et l'écran
> de consentement avec les deux bonnes permissions. Il manque **la preuve que
> chaque permission sert**. C'est précisément ce que le relecteur vient
> chercher, et sans ça le dossier revient avec une question qui coûte deux
> semaines.

---

## Ce qui est déjà acquis (à garder tel quel)

| Plan | État |
|---|---|
| La page `qwillio.com` et son domaine dans la barre d'URL | ✅ bon |
| La connexion depuis le portail client | ✅ bon |
| L'écran de consentement Google, nom **Qwillio**, **2 permissions** | ✅ **le plan clé est bon** |
| Le portail : rendez-vous, calendrier, lien Confidentialité | ✅ bon |

**Ne refais pas ces plans.** Ta vidéo existante les couvre. Ajoute seulement ce
qui manque et garde la première partie.

---

## Scénario A — Prouver `calendar.freebusy` (45 secondes)

### Le principe

Un créneau **déjà occupé** dans l'agenda ne doit **pas** être proposé. C'est la
seule preuve que l'application lit réellement la disponibilité.

### Préparation, avant d'enregistrer

1. Ouvre **Google Calendar** sur le compte de test
2. Crée un rendez-vous — dans **2 jours** environ :
   - Titre : `Déjà pris`
   - Heure : **10 h 00 → 11 h 00**
3. **Vérifie qu'il est bien là** (recharge la page)

### Ce qu'on filme

| Écran | Action | Ce qu'on voit |
|---|---|---|
| Google Calendar | Montrer l'agenda | Le rendez-vous **« Déjà pris » à 10 h** |
| Portail Qwillio → le champ de créneaux | Ouvrir la liste proposée | **10 h n'y est pas** |

### Ce qu'on dit

> "This calendar already has a meeting at ten o'clock. Qwillio reads the
> availability through the free/busy permission, so it knows that slot is taken
> and never offers it. It only proposes times that are actually free."

**L'astuce qui convainc :** si tu peux, garde les deux fenêtres **côte à côte**
(Google Calendar à gauche, les créneaux proposés à droite). Le relecteur
comprend en deux secondes.

**Si l'écran des créneaux n'existe pas dans le portail :** filme le résultat
d'un appel où l'assistant propose des heures. Le point est le même : 10 h est
absente de la liste.

---

## Scénario B — Prouver `calendar.events` (45 secondes)

### Le principe

Un rendez-vous pris enregistre un **événement réel** dans l'agenda du client.
Ta vidéo s'arrête à l'autorisation : on ne voit jamais l'événement exister.

### Ce qu'on filme

| Écran | Action | Ce qu'on voit |
|---|---|---|
| Portail → Rendez-vous | Prendre un rendez-vous (14 h, par exemple) | La confirmation |
| **Google Calendar** | Rafraîchir, puis montrer **14 h** | **L'événement créé** |
| Google Calendar | Cliquer l'événement | Le détail : titre, heure, téléphone de l'appelant |

### Ce qu'on dit

> "A booking is confirmed. Qwillio creates the event in the owner's calendar:
> the title, the time, and the phone number the caller left. Here it is in
> Google Calendar, exactly as if the owner had created it."

### Le détail qui fait la différence

**Clique l'événement** pour déplier son détail. On doit lire :
- le titre (nom + prestation)
- l'heure (14 h)
- **le numéro de téléphone laissé par l'appelant**

C'est ce numéro qui prouve que la donnée vient de l'appel, et non d'une saisie
manuelle.

---

## Deux détails à corriger au passage

### Le nom du compte de test

Le compte s'appelle `test@qwilio.com` / « qwilio test ». Ce nom contient
`qwilio` avec **un seul L**, alors que ton domaine est `qwillio` avec deux. Le
relecteur va le voir dans la barre latérale.

Ce n'est **pas éliminatoire** — c'est un compte de test, et Google le comprend.
Mais si le renommer prend deux minutes, c'est deux minutes bien placées. Sinon,
ne t'en préoccupe pas.

### Le vieux rendez-vous « Appointment - Jean Luc de la forge »

Il est visible dans l'agenda et date du 29 septembre. Il ne gêne pas — au
contraire, il montre que l'agenda **avait déjà du contenu** avant Qwillio, ce
qui est plus crédible qu'un agenda vide. Laisse-le.

---

## Ordre de montage final

1. La vidéo existante : page d'accueil → connexion Google → consentement → portail
2. **Scénario A** : le créneau de 10 h absent des propositions
3. **Scénario B** : le rendez-vous pris, puis l'événement visible dans Calendar
4. Le lien Confidentialité depuis le portail

Total : **environ 3 minutes**. C'est exactement la longueur attendue.

---

## Avant d'uploader

- YouTube → visibilité **« Non répertoriée »** (jamais « Privée » : le relecteur
  ne pourrait pas l'ouvrir)
- Titre : `Qwillio — Google OAuth verification demo`
- Vérifier que la **barre d'URL** reste lisible dans chaque plan
- Vérifier qu'**aucune permission** n'apparaît qui ne figure pas dans le dossier
- Aucune donnée inventée : pas de « John Doe », pas de numéro en 555
