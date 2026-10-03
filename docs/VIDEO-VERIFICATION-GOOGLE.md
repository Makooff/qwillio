# Vidéo de vérification Google — feuille de tournage

> Cible : **2 min 50 à 3 min 10**, une seule prise, anglais parlé ou sous-titré.
> Le relecteur est anglophone et regarde **plusieurs** dossiers par jour. Il
> cherche trois choses : que l'app demande bien les permissions déclarées, que
> chacune sert à quelque chose de visible, et que le domaine affiché est celui
> du dossier. Tout le reste est du confort.

---

## Avant d'appuyer sur Enregistrer

### 1. Corriger la faute de frappe dans la console (bloquant)

Ton domaine est `qwillio.com`. La console contient `qwilio.com`, qui appartient
à quelqu'un d'autre.

- Origine : `https://qwilio.com` → **`https://qwillio.com`**
- Redirection : `https://qwilio.com/dashboard/receptionist` → **`https://qwillio.com/dashboard/receptionist`**

Sans ça, l'écran de consentement refusera l'application et la vidéo la montrerait
en train d'échouer.

### 2. Préparer un agenda Google avec du contenu

Le relecteur doit **voir** que les créneaux occupés sont respectés. Crée dans
l'agenda d'essai un rendez-vous visible :

| Quoi | Valeur |
|---|---|
| Titre | `Réunion existante` |
| Heure | **10 h 00 → 11 h 00**, dans deux jours |
| Pourquoi | L'assistant ne doit **pas** proposer 10 h à l'appelant |

Un agenda vide ne prouve rien : on ne saurait pas si l'assistant lit l'agenda
ou s'il ignore tout.

### 3. Régler la fenêtre

- **1920 × 1080**, navigateur en **fenêtre** (pas plein écran) : la barre d'URL
  doit rester visible en permanence. C'est elle qui prouve le domaine.
- Fermer les onglets parasites : le relecteur ne doit pas voir ta boîte mail.
- Zoom du navigateur à **100 %** (les textes doivent être lisibles).
- Langue du navigateur : **anglais** si possible, ou assume le français en
  sous-titrant.

### 4. Répéter une fois à blanc

Fais le parcours complet **sans enregistrer**. Note les temps de chargement, ils
font souvent dépasser les 3 minutes.

---

## Déroulé, plan par plan

### Plan 1 — La page publique (0:00 → 0:20)

**À l'écran :** `https://qwillio.com`, page d'accueil.

**À dire :**
> "Qwillio is an AI phone receptionist for small businesses in Belgium and
> France. It answers when the owner cannot, and books appointments directly
> into the owner's own Google Calendar."

**Ne pas :** faire défiler la page en parlant, ni montrer les tarifs. Ce plan
sert à identifier le produit et le domaine.

---

### Plan 2 — La connexion de l'utilisateur (0:20 → 0:50)

**À l'écran :** connecté à l'espace client, page **Intégrations** (ou
**Réceptionniste**, selon où se trouve le bouton Google Calendar).

**Actions :**
1. Montrer la page et le bouton **« Connecter Google Agenda »**
2. **Cliquer** le bouton

**À dire :**
> "The business owner decides to connect their calendar. This is the only place
> in the product where Google access is requested, and it is started by the
> owner, not by us."

**Important :** ne pas cliquer avant d'avoir fini la phrase. Le relecteur doit
comprendre que l'action est un choix de l'utilisateur.

---

### Plan 3 — L'écran de consentement (0:50 → 1:20) ⚠️ PLAN LE PLUS IMPORTANT

**À l'écran :** la fenêtre Google, avec le nom **Qwillio** et les permissions.

**Actions :**
1. **Pause de 4-5 secondes** sur l'écran, sans rien dire
2. Descendre doucement pour révéler **chaque** ligne de permission
3. Montrer la barre d'URL (`accounts.google.com`)

**À dire :**
> "Here is the consent screen. Qwillio requests two permissions: to see when the
> calendar is busy, and to add an appointment. It does not ask for the content
> of existing events, and it does not ask for Gmail or Drive."

**Pourquoi c'est le plan clé :** le relecteur vérifie que les permissions
affichées correspondent à celles déclarées dans le dossier. Si une seule
permission apparaît qui n'est pas déclarée, le dossier est refusé à cet instant.

**Ne pas :** aller trop vite. Si la liste défile trop vite, le relecteur met en
pause et revoit — mais il note la mauvaise impression.

---

### Plan 4 — La permission « voir les créneaux occupés » (1:20 → 1:50)

**À l'écran :** l'espace client, en train de créer ou simuler un rendez-vous.

**Actions :**
1. Cliquer le bouton qui propose des créneaux disponibles
2. **Montrer la liste** — et faire remarquer que **10 h n'y est pas**

**À dire :**
> "This calendar already has a meeting at ten. Because Qwillio can see when the
> calendar is busy, it will not offer ten o'clock. It proposes only times that
> are actually free."

**Astuce :** si c'est plus simple, montrer l'agenda Google **côte à côte** avec la
liste des créneaux proposés. Le relecteur comprend mieux en voyant les deux.

---

### Plan 5 — La permission « créer un rendez-vous » (1:50 → 2:25)

**À l'écran :** un rendez-vous se réserve.

**Actions :**
1. Choisir un créneau (ex. 14 h 00)
2. Confirmer
3. **Ouvrir Google Calendar dans un autre onglet**
4. Montrer l'événement **créé**, avec son titre, son heure, ses coordonnées
5. Cliquer l'événement pour ouvrir le détail

**À dire :**
> "A booking is confirmed. Qwillio creates the event in the owner's calendar:
> the appointment title, the time, and the phone number the caller left. The
> owner sees it in Google Calendar exactly like an event they created
> themselves."

**Si tu as un vrai appel enregistré :** c'est encore mieux. Diffuser l'appel, puis
montrer l'événement apparaître. Trois secondes de voix réelle valent mieux que
trente secondes d'interface.

---

### Plan 6 — Le consommateur peut révoquer (2:25 → 2:45)

**À l'écran :** la page Intégrations, le bouton **« Déconnecter »**.

**Actions :**
1. Cliquer **Déconnecter**
2. Montrer que le statut repasse à « non connecté »

**À dire :**
> "The owner can disconnect at any time. That revokes Qwillio's access to the
> calendar immediately."

**Pourquoi :** Google veut voir qu'un utilisateur peut sortir. Un dossier sans
cette séquence reçoit souvent une question supplémentaire, ce qui allonge de
deux semaines.

---

### Plan 7 — La politique de confidentialité (2:45 → 3:00)

**À l'écran :** `https://qwillio.com/privacy`, section sur les données Google.

**Actions :**
1. Cliquer le lien **Confidentialité** — il est dans la barre latérale du
   portail, à côté de « Aide »
2. Faire défiler jusqu'à la partie traitement des données

**À dire :**
> "And the privacy policy describes exactly what we do with that data, how long
> we keep it, and how to have it deleted."

**Astuce :** montrer le lien **depuis le portail** (pas taper l'URL à la main)
prouve que la politique est atteignable depuis l'intérieur de l'app — c'est
précisément ce que Google exige.

---

## Après l'enregistrement

### Vérifier

- **Durée** : entre 2 min 50 et 3 min 10. Au-delà, couper les silences (pas les
  explications).
- **Barre d'URL lisible** dans tous les plans.
- **Nom « Qwillio »** bien visible sur l'écran de consentement.
- **Aucune permission affichée** qui ne soit pas dans le dossier.
- **Aucune donnée bidon** : pas de « John Doe », pas de numéro en 555.

### Publier

1. YouTube → **Visibilité : Non répertoriée** (pas « Privée », le relecteur ne
   pourrait pas l'ouvrir)
2. Titre : `Qwillio — Google OAuth verification demo`
3. Description : le lien vers `https://qwillio.com` et la liste des scopes
4. **Copier le lien** et le coller dans le formulaire de vérification Google

### Pendant la revue

Google répond par courriel, souvent sous quelques jours, avec des questions.
**Répondre dans les 24-48 h** : un dossier sans réponse est abandonné.

Les questions les plus fréquentes et leurs réponses sont dans
`docs/VERIFICATION-GOOGLE.md`, section 7.
