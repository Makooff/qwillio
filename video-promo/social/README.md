# Qwillio : le kit réseaux sociaux

Onze vidéos courtes en **trois langues** (français, néerlandais, anglais) et en
**deux formats**, plus les deux pubs longues. Une musique originale, minimale
et synthétisée (`public/music-minimal.mp3`, `scripts/music-minimal.py`) : aucun
droit à payer, aucun risque de blocage pour droits d'auteur.

## Quel fichier pour quel réseau

| Réseau | Où | Format | Dossier |
|---|---|---|---|
| TikTok | vidéo | 9:16 | `fr/9x16`, `nl/9x16`, `en/9x16` + la couverture `-cover.jpg` |
| Instagram | Reel | 9:16 | `*/9x16` + la couverture |
| Instagram | publication dans le fil, carrousel | 4:5 | `*/4x5` |
| Facebook | Reel | 9:16 | `*/9x16` |
| Facebook | publication de page | 4:5 | `*/4x5` |
| LinkedIn | publication | 4:5 | `*/4x5` (en 9:16, LinkedIn recadre la vidéo sur ordinateur) |
| YouTube | Shorts | 9:16 | `*/9x16` |

Le 4:5 n'est pas un recadrage du 9:16 : le même dessin est recomposé pour le
format, avec des textes à leur taille, lisibles dans un fil.

Sur la grille du profil Instagram et sur TikTok, choisir la couverture fournie
(`-cover.jpg`) : c'est l'image où la première phrase est entière à l'écran.

## Les vidéos

| # | Français | Nederlands | English | L'idée |
|---|---|---|---|---|
| A | `frontend/public/qwillio-pub-v3.mp4` | | | Le film : la pizzeria, avant et après (48 s, 9:16) |
| B | `frontend/public/qwillio-pub-features.mp4` | | | Tout ce qu'elle sait faire (51 s, 9:16) |
| 1 | `s01-appel-manque` | `s01-gemiste-oproep` | `s01-missed-call` | Un appel manqué, c'est un client qui réserve ailleurs |
| 2 | `s02-trois-heures` | `s02-drie-uur` | `s02-3am` | 3 h du matin : le cabinet dort, elle prend le rendez-vous |
| 3 | `s03-trois-langues` | `s03-drie-talen` | `s03-three-languages` | Français, anglais, néerlandais, avec le bon accent |
| 4 | `s04-reconnait` | `s04-herkent` | `s04-recognises` | Elle reconnaît le client et déplace son rendez-vous |
| 5 | `s05-urgence` | `s05-dringend` | `s05-emergency` | Les urgences vous sont passées, le reste est géré |
| 6 | `s06-invente-rien` | `s06-verzint-niets` | `s06-no-guessing` | Elle n'invente pas : elle demande, puis elle apprend |
| 7 | `s07-message` | `s07-bericht` | `s07-message` | Le message noté : pour qui, et quand rappeler |
| 8 | `s08-annuler` | `s08-annuleren` | `s08-cancel` | Annuler un rendez-vous sans vous déranger |
| 9 | `s09-coiffeur` | `s09-kapper` | `s09-hairdresser` | Les mains dans les cheveux, elle réserve |
| 10 | `s10-avant-apres` | `s10-voor-na` | `s10-before-after` | Avant, après |
| 11 | `s11-essayez` | `s11-probeer-haar` | `s11-try-her` | Ne nous croyez pas sur parole : appelez-la |

Chaque langue a sa voix native : Sarah en français, Isa en néerlandais, Gemma en
anglais (britannique), et deux appelants par langue, passés au filtre téléphone.
Dans les versions néerlandaise et anglaise, le portail du MacBook (en français)
est remplacé par une notification dans la langue de la vidéo.

Pour refaire : `node scripts/cartesia-shorts.mjs` (textes et voix, `ONLY=en`
pour une langue) puis `npx remotion render src/index.ts Short-<langue>-sXX-<slug>-<format>`.
Le texte de chaque vidéo vit dans ce script, nulle part ailleurs.

---

## Calendrier : 4 semaines, 3 publications par semaine

Mardi, jeudi et dimanche, vers 12 h ou 19 h. En Belgique, publier la version
française et la version néerlandaise le même jour (deux comptes, ou une
publication par langue sur un compte bilingue). L'anglais sert LinkedIn et le
public international de Bruxelles.

| Semaine | Mardi | Jeudi | Dimanche |
|---|---|---|---|
| 1 | A · le film | 1 · appel manqué | 11 · essayez-la |
| 2 | 3 · trois langues | 6 · elle n'invente rien | 2 · 3 h du matin |
| 3 | B · les fonctions | 9 · coiffeur | 7 · le message |
| 4 | 4 · elle reconnaît | 5 · urgence | 10 · avant / après |
| 5 | 8 · annuler | puis on rejoue les trois qui ont le mieux marché | |

Règle simple : ce qui marche se reposte un mois plus tard avec une autre accroche
écrite. Sur TikTok, un son tendance très bas sous la voix augmente la portée ;
sur LinkedIn et Facebook, garder le son d'origine.

---

## Les bios

**Instagram** (150 caractères au plus)
- FR : Qwillio · réceptionniste IA 📞 Elle décroche quand vous ne pouvez pas. Français, néerlandais, anglais, 24 h/24. Appelez-la ⬇️
- NL : Qwillio · AI-receptioniste 📞 Zij neemt op als jij het niet kan. Nederlands, Frans, Engels, 24/7. Bel haar ⬇️
- EN : Qwillio · AI receptionist 📞 She picks up when you can't. French, Dutch, English, 24/7. Call her ⬇️

**TikTok** (80 caractères au plus)
- FR : Réceptionniste IA qui décroche quand vous ne pouvez pas 📞
- NL : De AI-receptioniste die opneemt als jij het niet kan 📞
- EN : The AI receptionist that picks up when you can't 📞

**LinkedIn, slogan de la page** (120 caractères au plus)
- FR : La réceptionniste IA des commerces et cabinets : chaque appel décroché, chaque rendez-vous dans l'agenda.
- NL : De AI-receptioniste voor zaken en praktijken: elke oproep beantwoord, elke afspraak in de agenda.
- EN : The AI receptionist for local businesses: every call answered, every appointment in the calendar.

**LinkedIn « À propos » et Facebook « Intro »**
- FR : Qwillio est une réceptionniste IA pour les commerces, cabinets et artisans. Elle décroche à toute heure, en français, néerlandais ou anglais, reconnaît vos clients, prend, déplace et annule les rendez-vous dans votre agenda, vous passe les urgences et note chaque message. Ce qu'elle ne sait pas, elle ne l'invente pas : elle vous le demande, et s'en souvient. Essayez-la sur qwillio.com.
- NL : Qwillio is een AI-receptioniste voor zaken, praktijken en vakmensen. Ze neemt op elk uur op, in het Nederlands, Frans of Engels, herkent je klanten, boekt, verzet en annuleert afspraken in je agenda, verbindt dringende oproepen door en noteert elk bericht. Wat ze niet weet, verzint ze niet: ze vraagt het jou, en onthoudt het. Probeer haar op qwillio.com.
- EN : Qwillio is an AI receptionist for local businesses, practices and trades. She answers at any hour, in French, Dutch or English, recognises your customers, books, moves and cancels appointments in your calendar, puts emergencies through to you and takes every message. What she doesn't know, she doesn't make up: she asks you, and remembers. Try her at qwillio.com.

**Lien de la bio** : qwillio.com (la page d'accueil permet d'appeler la réceptionniste
depuis le navigateur).

---

## Les textes à coller

Facebook reprend le texte Instagram. Chaque vidéo a trois versions : **Instagram / Facebook** (court, émotion, hashtags),
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

---

## Nederlandse teksten

Instagram, Facebook en TikTok: de eerste tekst. LinkedIn: de tweede.

**1 · Gemiste oproep**
Een gemiste oproep is een klant die ergens anders reserveert. 📵 Met Qwillio neemt er altijd iemand op. #horeca #restaurant #ondernemer #ai #lokaal
LinkedIn: Elke onbeantwoorde oproep is een klant die het volgende nummer belt. Voor een restaurant is dat vaak een hele tafel. Qwillio neemt op tijdens de service, noteert de reservering en stuurt ze meteen door.

**2 · Drie uur 's nachts**
Drie uur 's nachts. Je praktijk is gesloten. De telefoon gaat. Jij slaapt. Zij niet. 🌙 #tandarts #praktijk #afspraak #ai
LinkedIn: Een deel van je patiënten zoekt 's avonds een afspraak, als de praktijk dicht is. Qwillio antwoordt op elk uur, stelt een vrij moment uit je agenda voor en bevestigt de afspraak. 's Ochtends staat ze al in je planning.

**3 · Drie talen**
In Brussel spreken je klanten niet allemaal dezelfde taal. Zij wel. 🇳🇱🇫🇷🇬🇧 #brussel #belgie #meertalig #ai
LinkedIn: In Brussel krijgt een zaak oproepen in het Nederlands, het Frans en het Engels, soms binnen hetzelfde uur. Qwillio antwoordt in de taal van de beller, met een eigen stem per taal.

**4 · Ze herkent je klanten**
Wat als je telefoon wist wie er belt? 📲 Ze herkent je klanten aan hun nummer en onthoudt hun afspraak. #klantenbinding #kmo #ai
LinkedIn: Een vaste klant hoort zich niet bij elke oproep opnieuw voor te stellen. Qwillio herkent het nummer, weet dat er donderdag een afspraak staat, verzet die als het moet en stuurt een bevestiging per sms.

**5 · Dringend**
Sommige oproepen kunnen niet wachten. 🚨 Noodgevallen geeft ze aan jou door. De rest regelt ze zelf. #loodgieter #vakman #ondernemer #ai
LinkedIn: Niet elke oproep heeft dezelfde prioriteit. Een waterlek wacht niet tot morgen. Qwillio herkent de dringende oproep en verbindt ze meteen door. Voor de rest noteert ze het bericht of de afspraak.

**6 · Ze verzint niets**
De slechtste receptioniste? Die dingen verzint. 🤥 Weet ze het niet, dan vraagt ze het jou. Je antwoordt één keer, zij weet het voorgoed. #ai #klantenservice #kmo
LinkedIn: Een AI die aan de telefoon maar wat zegt, kost meer dan een gemiste oproep. Qwillio gokt niet: valt een vraag buiten wat ze weet, dan noteert ze de gegevens en legt ze de vraag aan jou voor. Jouw antwoord gaat in haar kennis, en bij de volgende oproep weet ze het.

**7 · Het bericht**
Je bent bij een klant. De telefoon gaat. 📝 Het bericht komt binnen: voor wie, en wanneer terugbellen. #organisatie #kmo #ai
LinkedIn: "Er heeft iemand gebeld, ik weet niet meer wie." In een klein team is een slecht genoteerd bericht een verloren klant. Qwillio noteert naam, nummer, voor wie het bericht is en wanneer terugbellen, en stuurt het naar de juiste persoon.

**8 · Annuleren**
Een annulering zou je geen telefoontje mogen kosten. 🗓️ Ze boekt, verzet en annuleert. Je agenda volgt. #agenda #afspraak #ai #productiviteit
LinkedIn: Boeken, verzetten, annuleren: de drie oproepen die een werkdag het vaakst onderbreken. Qwillio regelt ze zelf, en je agenda is bij zonder dat je hem opent.

**9 · Kapper**
Handen in het haar, onmogelijk om op te nemen. ✂️ Ze boekt terwijl jij knipt. #kapper #kapsalon #barbier #ai
LinkedIn: Een kapper laat een klant niet staan om de telefoon op te nemen. Gevolg: oproepen komen op de voicemail, en een deel belt nooit terug. Qwillio neemt de afspraken aan tijdens het knippen, rechtstreeks in de agenda van het salon.

**10 · Voor / na**
Voor: een volle voicemail, klanten die nooit terugbellen. Na: elke oproep beantwoord, elke afspraak in je agenda. ✅ #voorna #kmo #ai
LinkedIn: Voor: een volle voicemail en klanten die niet terugbellen. Na: elke oproep beantwoord en elke afspraak in de agenda. Voor de meeste zaken hoeft er verder niets te veranderen.

**11 · Probeer haar**
Geloof ons niet op ons woord. Bel haar. 📞 Ze wacht op je op qwillio.com (link in bio). #ai #demo #tech
LinkedIn: De eenvoudigste manier om een AI-receptioniste te beoordelen, is haar bellen. Op qwillio.com kun je rechtstreeks vanuit je browser met haar praten, zonder je in te schrijven.

---

## English captions

Instagram, Facebook and TikTok: the first text. LinkedIn: the second.

**1 · Missed call**
A missed call is a customer booking somewhere else. 📵 With Qwillio, someone always picks up. #restaurant #smallbusiness #ai #hospitality
LinkedIn: Every unanswered call is a customer dialling the next number. For a restaurant, that is often a whole table. Qwillio picks up during service, takes the booking and sends it to you straight away.

**2 · 3 am**
It's three in the morning. Your practice is closed. The phone rings. You're asleep. She isn't. 🌙 #dentist #clinic #appointments #ai
LinkedIn: Some of your patients look for an appointment in the evening, when the practice is closed. Qwillio answers at any hour, offers a free slot from your calendar and confirms it. By morning it is already in your schedule.

**3 · Three languages**
In Brussels, your customers don't all speak the same language. She does. 🇬🇧🇫🇷🇳🇱 #brussels #belgium #multilingual #ai
LinkedIn: In Brussels, a business takes calls in French, Dutch and English, sometimes within the same hour. Qwillio answers in the caller's language, with a native voice for each one.

**4 · She recognises your customers**
What if your phone knew who was calling? 📲 She recognises your customers by their number and remembers their appointment. #customerexperience #smallbusiness #ai
LinkedIn: A regular customer shouldn't have to introduce themselves on every call. Qwillio recognises the number, knows there is an appointment on Thursday, moves it if asked and sends a text confirmation.

**5 · Emergency**
Some calls can't wait. 🚨 Emergencies go straight to you. She handles the rest. #plumber #trades #smallbusiness #ai
LinkedIn: Not every call has the same priority. A water leak can't wait for a callback tomorrow. Qwillio recognises the emergency and puts the call through to you at once. For everything else, she takes the message or the booking.

**6 · No guessing**
The worst receptionist? The one who makes things up. 🤥 When she doesn't know, she asks you. Answer once, she'll always know. #ai #customerservice #trust
LinkedIn: An AI that says whatever it likes on the phone costs more than a missed call. Qwillio doesn't guess: when a question falls outside what she knows, she takes the caller's details and passes the question to you. Your answer joins her knowledge, and she knows it on the next call.

**7 · The message**
You're with a client. The phone rings. 📝 The message arrives: who it's for, and when to call back. #productivity #smallbusiness #ai
LinkedIn: "Someone called, I can't remember who." In a small team, a badly taken message is a lost customer. Qwillio notes the name, the number, who the message is for and when to call back, then sends it to the right person.

**8 · Cancel**
A cancellation shouldn't cost you a phone call. 🗓️ She books, moves and cancels. Your calendar keeps up. #calendar #appointments #ai #productivity
LinkedIn: Booking, moving, cancelling: the three calls that interrupt a working day the most. Qwillio handles them on her own, and your calendar stays up to date without you opening it.

**9 · Hairdresser**
Hands in someone's hair, no way to pick up. ✂️ She books while you cut. #hairdresser #salon #barber #ai
LinkedIn: A hairdresser won't leave a client mid-cut to answer the phone. So calls go to voicemail, and some never call back. Qwillio takes bookings during the cut, straight into the salon's calendar.

**10 · Before / after**
Before: a full voicemail, customers who never call back. After: every call answered, every appointment in the calendar. ✅ #beforeandafter #smallbusiness #ai
LinkedIn: Before, a full voicemail and customers who don't call back. After, every call answered and every appointment in the calendar. For most businesses, nothing else needs to change.

**11 · Try her**
Don't take our word for it. Call her. 📞 She's waiting at qwillio.com (link in bio). #ai #demo #tech
LinkedIn: The simplest way to judge an AI receptionist is to call her. At qwillio.com you can talk to her straight from your browser, no sign-up needed.
