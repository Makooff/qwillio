# Qwillio : le kit réseaux sociaux

13 vidéos verticales (1080 × 1920), prêtes pour Instagram Reels, TikTok et LinkedIn.
Les deux pubs longues sont dans `frontend/public/`, les onze courtes ici, chacune
avec sa couverture (`-cover.jpg`).

| # | Fichier | Durée | L'idée en une ligne |
|---|---|---|---|
| A | `frontend/public/qwillio-pub-v3.mp4` | 48 s | Le film : la pizzeria, avant et après Qwillio |
| B | `frontend/public/qwillio-pub-features.mp4` | 51 s | Tout ce qu'elle sait faire, en une minute |
| 1 | `s01-appel-manque.mp4` | 21 s | Un appel manqué, c'est un client qui réserve ailleurs |
| 2 | `s02-trois-heures.mp4` | 22 s | 3 h du matin : le cabinet dort, elle prend le rendez-vous |
| 3 | `s03-trois-langues.mp4` | 22 s | Français, anglais, néerlandais, avec le bon accent |
| 4 | `s04-reconnait.mp4` | 21 s | Elle reconnaît le client au numéro et déplace son rendez-vous |
| 5 | `s05-urgence.mp4` | 20 s | Les urgences vous sont passées, le reste est géré |
| 6 | `s06-invente-rien.mp4` | 19 s | Elle n'invente pas : elle demande, puis elle apprend |
| 7 | `s07-message.mp4` | 20 s | Le message noté : pour qui, et quand rappeler |
| 8 | `s08-annuler.mp4` | 19 s | Annuler un rendez-vous sans vous déranger |
| 9 | `s09-coiffeur.mp4` | 22 s | Les mains dans les cheveux, elle réserve à votre place |
| 10 | `s10-avant-apres.mp4` | 15 s | Avant, après |
| 11 | `s11-essayez.mp4` | 15 s | Ne nous croyez pas sur parole : appelez-la |

Les vidéos se refont avec `node scripts/cartesia-shorts.mjs` (textes et voix),
puis `npx remotion render src/index.ts Short-sXX-...`. Le texte de chaque vidéo
vit dans ce script, nulle part ailleurs.

---

## Calendrier : 4 semaines, 3 publications par semaine

Le même jour sur les trois réseaux. Mardi, jeudi et dimanche, vers 12 h ou 19 h.

| Semaine | Mardi | Jeudi | Dimanche |
|---|---|---|---|
| 1 | A · le film | 1 · appel manqué | 11 · essayez-la |
| 2 | 3 · trois langues | 6 · elle n'invente rien | 2 · 3 h du matin |
| 3 | B · les fonctions | 9 · coiffeur | 7 · le message |
| 4 | 4 · elle reconnaît | 5 · urgence | 10 · avant / après |
| 5 | 8 · annuler | puis on rejoue les trois qui ont le mieux marché | |

Règle simple : ce qui marche se reposte un mois plus tard avec une autre accroche
écrite. Sur TikTok, ajouter un son tendance très bas sous la voix augmente la
portée ; sur LinkedIn, garder le son d'origine.

---

## Les textes à coller

Chaque vidéo a trois versions : **Instagram** (court, émotion, hashtags),
**TikTok** (une accroche, peu de hashtags) et **LinkedIn** (le problème métier,
plus posé, sans hashtag en vrac).

### A · Le film « Samedi, 20 h 12 »

**Instagram**
Samedi, 20 h 12. Les mains dans la pâte, personne ne décroche. Alors Julie réserve en face.
Avec Qwillio, quelqu'un décroche. Toujours. 🍕
👉 Appelez-la vous-même : lien en bio.
#restaurant #pizzeria #receptionniste #intelligenceartificielle #commercelocal #entrepreneur

**TikTok**
POV : ton téléphone sonne en plein coup de feu 🍕📞 #restaurant #ia #entrepreneur #pizzeria

**LinkedIn**
Samedi soir, 20 h 12, en pleine cuisine. Le téléphone sonne, personne ne peut décrocher, et le client réserve ailleurs.
C'est le problème que Qwillio règle : une réceptionniste IA qui décroche à votre place, prend la réservation et vous l'envoie.
Vous pouvez l'appeler vous-même sur qwillio.com.

### B · « Elle ne fait pas que décrocher »

**Instagram**
Elle reconnaît vos clients. Elle prend, déplace et annule vos rendez-vous. Elle parle trois langues. Elle vous passe les urgences et note chaque message.
Votre réceptionniste ne fait pas que décrocher. ✨
#receptionniste #ia #pme #commercelocal #rendezvous #belgique

**TikTok**
Tout ce que fait une réceptionniste IA en 50 secondes 👀 #ia #business #entrepreneur #tech

**LinkedIn**
Une réceptionniste, ce n'est pas seulement quelqu'un qui décroche. C'est quelqu'un qui reconnaît les habitués, tient l'agenda, sait quand déranger le patron et quand prendre un message.
Qwillio fait tout ça, en français, en anglais et en néerlandais, de jour comme de nuit.

### 1 · Un appel manqué

**Instagram**
Un appel manqué, c'est un client qui réserve ailleurs. 📵
Avec Qwillio, quelqu'un décroche. Toujours.
#restaurant #commercelocal #receptionniste #ia #entrepreneur

**TikTok**
Combien de clients tu perds pendant le service ? 📵 #restaurant #entrepreneur #ia

**LinkedIn**
Chaque appel sans réponse est un client qui compose le numéro suivant. Pour un restaurant, c'est souvent une table entière.
Qwillio décroche pendant le service, prend la réservation et vous l'envoie aussitôt.

### 2 · 3 h du matin

**Instagram**
3 h du matin. Votre cabinet est fermé. Le téléphone sonne.
Vous dormez. Elle, non. 🌙
#dentiste #cabinetmedical #rendezvous #ia #receptionniste

**TikTok**
Un patient a pris rendez-vous à 3 h du matin. Personne n'était réveillé 🌙 #dentiste #ia #business

**LinkedIn**
Une partie de vos patients cherche un rendez-vous le soir, quand le cabinet est fermé.
Qwillio répond à toute heure, propose un créneau libre de votre agenda et confirme le rendez-vous. Le matin, il est déjà dans votre planning.

### 3 · Trois langues

**Instagram**
À Bruxelles, vos clients ne parlent pas tous la même langue. Elle, si. 🇫🇷🇬🇧🇳🇱
Français, anglais, néerlandais, avec le bon accent.
#bruxelles #belgique #multilingue #ia #commercelocal

**TikTok**
Elle passe du français au néerlandais sans accent 🤯 #bruxelles #belgique #ia

**LinkedIn**
À Bruxelles, un commerce reçoit des appels en français, en néerlandais et en anglais, parfois dans la même heure.
Qwillio répond dans la langue de l'appelant, avec une voix native pour chacune.

### 4 · Elle reconnaît vos clients

**Instagram**
Et si votre téléphone savait qui appelle ? 📲
Elle reconnaît vos clients au numéro et se souvient de leur rendez-vous.
#fidelisation #clients #ia #receptionniste #pme

**TikTok**
Elle m'a appelé par mon nom avant que je dise bonjour 😳 #ia #business #tech

**LinkedIn**
Un client fidèle ne devrait pas avoir à se présenter à chaque appel.
Qwillio reconnaît le numéro, sait qu'il a un rendez-vous jeudi, le déplace s'il le demande et envoie la confirmation par SMS.

### 5 · Urgence

**Instagram**
Certains appels ne peuvent pas attendre. 🚨
Les urgences, elle vous les passe. Le reste, elle le gère.
#plombier #artisan #urgence #ia #entrepreneur

**TikTok**
Une urgence pendant que tu es sur un chantier ? Elle te la passe 🚨 #artisan #plombier #ia

**LinkedIn**
Tous les appels n'ont pas la même priorité. Une fuite d'eau ne peut pas attendre un rappel demain.
Qwillio reconnaît l'urgence et vous transfère l'appel tout de suite. Pour le reste, elle prend le message ou le rendez-vous.

### 6 · Elle n'invente rien

**Instagram**
La pire réceptionniste ? Celle qui invente. 🤥
Quand elle ne sait pas, elle le dit et vous pose la question. Vous répondez une fois, elle le saura toujours.
#ia #serviceclient #confiance #pme

**TikTok**
La différence entre une bonne IA et une mauvaise IA 👇 #ia #chatgpt #business

**LinkedIn**
Une IA qui répond n'importe quoi au téléphone coûte plus cher qu'un appel manqué.
Qwillio ne devine pas : quand une question sort de ce qu'elle sait, elle prend les coordonnées et vous la transmet. Votre réponse rejoint sa base de connaissances, et elle saura répondre au prochain appel.

### 7 · Le message

**Instagram**
Vous êtes avec un client. Le téléphone sonne. 📝
Le message arrive : pour qui, et quand rappeler.
#organisation #pme #receptionniste #ia

**TikTok**
Fini les post-it « quelqu'un a appelé » 📝 #organisation #business #ia

**LinkedIn**
« Quelqu'un a appelé, je ne sais plus qui. » Dans une petite équipe, un message mal noté est un client perdu.
Qwillio note le nom, le numéro, pour qui est le message et quand rappeler, puis l'envoie à la bonne personne.

### 8 · Annuler

**Instagram**
Un rendez-vous annulé ne devrait pas vous coûter un appel. 🗓️
Elle prend, déplace et annule. Votre agenda suit.
#agenda #rendezvous #ia #pme #productivite

**TikTok**
Mon client a annulé et je ne l'ai même pas eu au téléphone 🗓️ #productivite #ia

**LinkedIn**
Prendre, déplacer, annuler : les trois appels qui interrompent le plus une journée.
Qwillio les traite seule, et votre agenda est à jour sans que vous l'ayez ouvert. Le créneau libéré redevient disponible tout de suite.

### 9 · Coiffeur

**Instagram**
Les mains dans les cheveux, impossible de décrocher. ✂️
Elle réserve pendant que vous coupez.
#coiffeur #salondecoiffure #barbier #rendezvous #ia

**TikTok**
Coiffeurs, combien d'appels vous ratez par jour ? ✂️ #coiffeur #barber #salon

**LinkedIn**
Un coiffeur ne lâche pas un client pour répondre au téléphone. Résultat : les appels tombent sur la messagerie, et une partie ne rappelle jamais.
Qwillio prend les réservations pendant la coupe, directement dans l'agenda du salon.

### 10 · Avant / après

**Instagram**
Avant : une messagerie pleine, des clients qui ne rappellent jamais.
Après : chaque appel décroché, chaque rendez-vous dans l'agenda. ✅
#avantapres #pme #ia #entrepreneur

**TikTok**
Avant / après une réceptionniste IA ✅ #avantapres #ia #business

**LinkedIn**
Avant, une messagerie pleine et des clients qui ne rappellent pas. Après, chaque appel décroché et chaque rendez-vous dans l'agenda.
Pour la plupart des commerces, il n'y a rien d'autre à changer.

### 11 · Essayez-la

**Instagram**
Ne nous croyez pas sur parole. Appelez-la. 📞
Elle vous attend sur qwillio.com (lien en bio).
#ia #demo #receptionniste #tech

**TikTok**
Parle à une réceptionniste IA maintenant, lien en bio 📞 #ia #tech #demo

**LinkedIn**
Le plus simple pour juger une réceptionniste IA, c'est de l'appeler.
Sur qwillio.com, vous pouvez lui parler directement depuis votre navigateur, sans inscription.
