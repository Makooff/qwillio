# Décrocher le rendez-vous, puis le convertir en présentiel

Zone : Bruxelles et Brabant wallon. Cible : services à domicile (plomberie,
électricité, chauffage, serrurerie, toiture). Objectif de l'appel : un rendez-vous
chez le prospect. Objectif de la visite : la mise en route, sur place, pendant la
visite.

Ce document ne remplace pas [`playbook-vente.md`](playbook-vente.md), il le
prolonge : la règle cardinale (ne jamais citer un client qu'on n'a pas), les
objections génériques et les règles de séance y restent. Ici, ce qui change quand
la vente se termine en face à face.

---

## 1. Trois phrases que tu ne peux pas dire

À lire avant tout le reste, parce que ce sont les trois qui te coûteraient une
vente déjà faite. Un patron de PME vérifie, et le jour où il découvre le trou,
il en parle à son fournisseur, à son comptable et à son voisin de chantier.

### « C'est hébergé en Europe »

**Faux aujourd'hui.** Render tourne en Oregon, la région d'un service Render ne
se change pas, et la bascule est un chantier écrit dans
[`MIGRATION-UE-RUNBOOK.md`](MIGRATION-UE-RUNBOOK.md) qui n'est pas joué. Le site
ne le promet plus. Le tableau d'objections de `playbook-vente.md` porte encore
cette phrase, ligne « Sylen est à 49 € » : **ne la sers pas**.

Ce que tu dis à la place, si on te pose la question :

> Aujourd'hui les serveurs sont aux États-Unis. La migration vers Francfort est
> écrite et planifiée, je ne vais pas vous annoncer qu'elle est faite. Ce que je
> peux vous dire précisément : la durée de conservation des enregistrements est
> réglable, 90 jours par défaut, 30 au minimum.

Un plombier s'en moque. Un comptable, non. C'est aussi pour ça que la niche
« services à domicile » passe en premier.

### « Elle est bilingue sur le même appel »

**Faux.** Une ligne porte une langue : le transcripteur est configuré par appel
(`buildTranscriber`), l'assistant a un prénom et un message d'accueil dans cette
langue. Le français, l'anglais et le néerlandais existent, mais c'est un choix
par ligne, pas une bascule en cours de conversation.

Ce que tu dis à la place :

> Elle répond en français. Si vous avez une clientèle néerlandophone, ça se
> configure, mais c'est une ligne par langue, pas une bascule au milieu de
> l'appel. Je préfère vous le dire maintenant plutôt qu'à la facture.

À Bruxelles, la question va tomber. Prépare-la, ne l'improvise pas.

### « Un plombier à Uccle a signé le mois dernier »

Tant que c'est faux, c'est interdit. Les deux sorties honnêtes restent celles du
playbook : la question de découverte (son chiffre vaut mieux que le tien) et
l'aveu assumé, qui transforme le démarrage en argument.

> Je ne vais pas vous citer des clients que je n'ai pas. On démarre. Vous seriez
> le premier plombier de la région sur l'outil, et c'est exactement pour ça que
> je peux vous accompagner à la mise en route moi-même.

---

## 2. Pourquoi cette niche, et à quoi ressemble le bon prospect

Le système de scoring maison donne à `home_services` **8 points sur 8**, le
maximum, et il a raison pour une seule raison : dans le dépannage, **le premier
qui décroche prend le chantier**. Le client qui a de l'eau au sol ne laisse pas
de message, il appelle le suivant dans la liste. C'est le seul métier où l'appel
manqué n'est pas un retard, c'est une perte sèche et immédiate.

Ajoute la Belgique (+2), une province francophone (+2), Bruxelles (+1). Le seuil
d'appel du système est à 10 (`MIN_PRIORITY_SCORE`), un plombier bruxellois bien
noté le dépasse largement.

**Le bon prospect :**

| Signal | Ce que tu cherches | Pourquoi |
|---|---|---|
| Taille | 1 à 5 personnes | Au delà, il y a un secrétariat, la vente devient longue |
| Note Google | 4,0 et plus | Il tient à sa réputation, donc les appels ratés le gênent déjà |
| Avis | 20 et plus | Il a du volume, donc du téléphone |
| Site web | Avec, de préférence | Il a déjà payé pour être joignable, la marche est basse |
| Numéro | Mobile | Il décroche lui même, pas de barrage |
| Mention « 24/7 » ou « urgence » | Un cadeau | Il promet une disponibilité qu'il ne peut pas tenir seul |

**Le mauvais prospect**, à ne pas travailler maintenant : les enseignes à
plusieurs camionnettes et standard interne, les sociétés dont le numéro est un
0800, et tout ce qui n'a aucun avis (souvent inactif).

---

## 3. Sortir les numéros, pour de vrai

Aucun numéro n'est écrit dans ce document, et c'est volontaire : une liste
recopiée à la main ne laisse pas de trace dans le dashboard, donc ni score, ni
doublon détecté, ni apprentissage. La liste se génère.

### Le correctif qui rend la zone utilisable

Jusqu'à cette version, **le Brabant wallon n'existait pas dans le scraper**. Une
ville absente des tables retombait sur les États-Unis : l'acteur interrogeait
Google Maps en anglais avec un biais géographique américain (« Waterloo »
renvoyait l'Iowa), et les numéros belges passaient dans `toE164(..., 'US')`, qui
les rejette ou les préfixe en `+1`. Le scrape ne tombait pas en erreur, il
rendait des résultats faux, ce qui est pire.

Onze communes sont maintenant déclarées : Bruxelles, Wavre, Nivelles, Waterloo,
Braine-l'Alleud, Ottignies-Louvain-la-Neuve, Rixensart, Tubize, Genappe,
La Hulpe, Jodoigne. Toutes à moins de 45 minutes de Bruxelles, ce qui est la
seule contrainte qui compte quand le rendez-vous est physique.

Second correctif : le champ « mot-clé » du générateur de campagne **ne faisait
rien** pour cette niche. Les requêtes sont plafonnées à trois par couple
niche/ville pour tenir les crédits Apify, et `home_services` en déclare dix : le
mot-clé, ajouté en onzième position, était systématiquement coupé. Il passe
désormais en premier.

### La procédure

1. **Dashboard admin, page Prospection, générateur de campagne.**
2. Pays : **BE**. Niche : **Services à domicile**. Villes : commence par
   **trois**, pas onze (voir le coût ci-dessous).
3. Mot-clé : un métier précis par campagne (`chauffagiste`, puis `serrurier`,
   puis `couvreur`). Sans mot-clé tu obtiens `plombier`, `plumber`,
   `électricien`, ce qui est déjà un bon premier lot.
4. Lance, puis attends. Le scrape tourne en arrière-plan, la réponse HTTP est
   immédiate et ne veut rien dire sur le résultat.
5. **Export CSV** depuis la même page, pour la version papier de la séance.

L'équivalent en ligne de commande, si tu préfères :

```bash
curl -X POST https://qwillio.onrender.com/api/prospecting/trigger/custom-scrape \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"niches":["home_services"],
       "cities":["Bruxelles","Wavre","Waterloo"],
       "extraQueries":["chauffagiste"]}'
```

### Ce que ça coûte, et pourquoi tu commences petit

Le scrape lance **3 requêtes par ville et par niche**. Trois villes font neuf
recherches Google Maps, onze villes en font trente-trois. Les crédits Apify
partent là, et le bouton est volontairement séparé du reste de la page avec un
avertissement de coût. Fais une ville, regarde ce qui rentre, puis élargis.

### Avant de composer le premier numéro

- **Tous les numéros commencent par `+32`.** Si tu vois un `+1`, ta campagne a
  visé une ville hors table : arrête et corrige, ne perds pas la séance dessus.
- **Les doublons sont gérés** (`crm-dedup`), mais un même patron peut apparaître
  sous deux raisons sociales. Trie par nom avant d'imprimer.
- **`doNotCall` est définitif.** Un « ne me rappelez plus » se coche dans la
  minute, pas en fin de journée.
- Le score et la validation Twilio tournent au moment du scrape : un numéro
  marqué invalide ne se compose pas, tu perdrais trente secondes par ligne.

---

## 4. Trier : les quarante que tu appelles vraiment

Une séance, c'est **une commune**. Pas deux. La raison est géographique : tu
veux pouvoir dire « je suis à Wavre jeudi, je passe à 14 h », et enchaîner trois
visites dans le même quartier le même jour. Un rendez-vous à Tubize le matin et
un à Jodoigne l'après-midi, c'est une heure de voiture qui ne rapporte rien.

Ordre d'appel dans la commune : score décroissant, puis nombre d'avis
décroissant. Quarante lignes préparées pour une séance de vingt appels, parce
que la moitié ne décroche pas.

---

## 5. Quand appeler un patron qui est sur un chantier

Il ne sera jamais à un bureau. Il est dans une camionnette, sous un évier, ou
dans un grenier. Les trois fenêtres qui marchent :

| Fenêtre | Pourquoi |
|---|---|
| **7 h 30 à 8 h 30** | Dans la camionnette, avant le premier chantier. La meilleure. |
| **12 h à 13 h 30** | Pause. Il décroche, il est assis, il a le temps. |
| **17 h à 18 h 30** | Fin de journée, il fait ses devis et ses rappels. |

À éviter : le lundi matin (il gère les urgences du week-end et il est de mauvaise
humeur), le vendredi après 16 h, et 9 h à 11 h, où il est dans le bruit.

Les fenêtres légales de l'outbound automatique sont réglées sur 9 h à 12 h et
13 h à 17 h, hors dimanche. Toi qui appelles à la main, tu peux prendre 7 h 30 et
18 h, mais **jamais avant 8 h le samedi et jamais le dimanche**.

---

## 6. Le script

Quatre-vingt-dix secondes. L'objectif est le rendez-vous, pas la vente. Si tu
expliques le produit au téléphone, tu as perdu : il n'a plus de raison de te
recevoir.

### Ouverture, 10 secondes

> Bonjour, [Nom] ? [Prénom], de Qwillio, à Bruxelles. Je vous prends trente
> secondes et vous me dites si ça vaut la peine, d'accord ?

Le « d'accord ? » n'est pas de la politesse, c'est une demande de permission.
Il répond « oui » ou « allez-y », et il vient d'accepter de t'écouter. Pas de
« comment allez vous », pas de « je ne vous dérange pas » : les deux annoncent un
vendeur.

Si tu entends une perceuse, une route, un chantier :

> Vous êtes sur un chantier ? Je rappelle à midi, ça vous va mieux ?

Tu viens de gagner un rappel accepté, ce qui vaut mieux qu'un appel gâché.

### Le cadre, 10 secondes

> Je travaille avec des plombiers de la région sur un seul sujet : les appels qui
> sonnent pendant que vous avez les mains dans un chantier.

Un sujet, pas un produit. Le mot « intelligence artificielle » n'apparaît pas
encore, il déclencherait un débat au lieu d'une conversation.

### La question, et le silence

> Ma question, et je vous laisse tranquille après : dans une semaine normale,
> vous en ratez combien, à peu près ?

**Tais-toi.** Trois secondes de silence, même si c'est long. C'est le seul moment
de l'appel qui compte, parce que le chiffre qu'il donne devient ton argument, et
qu'il ne peut pas le contester plus tard.

### Le calcul, fait avec lui

> D'accord, [son chiffre] par semaine. Et sur ces appels là, il y en a combien
> qui rappellent plus tard ?
>
> Donc quand vous ne décrochez pas, ils appellent le suivant. Un dépannage chez
> vous, ça tourne autour de combien ?
>
> [son chiffre] fois [sa valeur] fois cinquante-deux semaines. C'est ce que
> l'accueil vous coûte aujourd'hui, et ce n'est pas moi qui l'ai calculé.

Ne jamais annoncer un montant. Le construire avec ses chiffres à lui.

### Le pivot vers le présentiel

Le moment charnière. Tu ne proposes pas une démonstration, tu proposes de
regarder ses chiffres.

> Je ne vais pas vous vendre ça au téléphone, ça n'a aucun intérêt. Je passe
> vingt minutes chez vous, je vous fais entendre la voix, et on regarde vos
> appels de la semaine dernière. Si au bout de vingt minutes vous ne voyez pas
> l'intérêt, je repars et vous ne me revoyez pas.

Trois choses agissent dans ce paragraphe : le refus de vendre au téléphone
(inattendu, donc crédible), la durée bornée (vingt minutes, pas « un moment »),
et la porte de sortie explicite, qui supprime le risque de recevoir un vendeur
collant.

### Le close, sur deux créneaux

> Je suis à [sa commune] jeudi et vendredi. Jeudi 14 h ou vendredi 8 h, qu'est ce
> qui vous arrange ?

Deux créneaux, jamais « quand êtes vous disponible ». Et cite sa commune : « je
suis dans le coin » justifie le déplacement sans rien demander.

### Selon ce qu'il a répondu

**Plus de 5 appels ratés par semaine** : il a un vrai problème, va au rendez-vous
et n'en fais pas trop.

**Moins de 2** : « Dans votre cas ce n'est probablement pas urgent, je ne vais
pas vous faire perdre vingt minutes. » Raccrocher vite est un gain, pas un échec,
et il s'en souviendra le jour où il embauchera.

**« Je ne sais pas »** : « C'est exactement le problème, personne ne compte ce
qu'il ne voit pas. Regardons ensemble, j'ai de quoi le mesurer. »

---

## 7. Les sept mécaniques, et pourquoi elles fonctionnent

Ce sont elles, la « technique ». Le script n'est que leur mise en mots.

**1. La permission d'ouverture.** Demander « d'accord ? » et attendre la réponse.
Une personne qui a donné son accord écoute ce qu'elle a accepté d'entendre. Sans
ça, tu parles pendant qu'il cherche comment raccrocher.

**2. Le silence après la question.** Trois secondes. La plupart des vendeurs
comblent le vide et volent la réponse. Le chiffre qu'il prononce lui appartient,
et on ne discute pas avec soi même.

**3. Son chiffre, jamais le tien.** « Vous perdez 15 000 € par an » se conteste.
« Trois par semaine, à 180 €, sur cinquante-deux semaines » ne se conteste pas :
c'est son arithmétique.

**4. L'ancre salaire.** Quand le prix arrive, compare à un mi-temps, jamais à un
logiciel. La page tarifs situe une secrétaire à mi-temps chargée autour de
1 200 € par mois. Mieux : demande lui ce que ça coûterait chez lui, et laisse
son propre chiffre faire le travail. En face d'un logiciel, 99 € est cher. En
face d'un salaire, c'est marginal.

**5. La concession stratégique.** Concède ce qui est vrai, immédiatement et sans
qu'on te le demande : les serveurs sont aux États-Unis, une ligne porte une
langue, tu n'as pas encore de référence dans sa rue. Chaque concession achète de
la crédibilité pour ce qui suit, et il arrête de chercher le piège.

**6. La porte de sortie.** « Si vous ne voyez pas l'intérêt, je repars. » Ce
n'est pas de la modestie, c'est ce qui rend le rendez-vous acceptable : il ne
risque plus vingt minutes, il risque de dire non à la fin, ce qu'il sait faire.

**7. Le recadrage du saturé.** Le meilleur prospect, le plombier débordé, refuse
pour la meilleure raison : il n'a pas besoin de plus de clients. Ne le contredis
pas, retourne l'outil.

> Justement, ne prenez pas plus de clients. Elle vous sert à trier : elle demande
> ce que c'est, où, et quand, elle refuse ce que vous ne voulez pas, et vous ne
> rappelez que ce qui vaut le déplacement. Aujourd'hui vous rappelez tout le
> monde pour dire non.

Tu ne lui vends plus du volume, tu lui vends du silence. C'est ce qu'il achète.

---

## 8. Objections propres au métier

Les objections générales (prix, concurrence, « je ne vous connais pas ») sont
dans `playbook-vente.md`. Celles ci sortent en dépannage et nulle part ailleurs.

| Objection | Réponse |
|---|---|
| **J'ai déjà un répondeur** | « Et sur dix personnes qui tombent dessus, combien laissent un message ? Vous le savez aussi bien que moi. Un répondeur enregistre ceux qui ont le temps d'attendre, elle prend ceux qui ont une fuite. » |
| **C'est ma compagne qui prend les appels** | « Elle fait ça en plus de son travail, ou c'est son travail ? » Puis, selon la réponse : « Elle garde les clients qu'elle connaît, l'assistante prend le soir, le week-end et les débordements. Personne ne perd sa place. » |
| **Je rappelle toujours le soir** | « Combien rappellent avant que vous ne les rappeliez ? Sur une fuite, la personne a déjà trouvé quelqu'un dans les vingt minutes. Vous rappelez des chantiers qui sont partis. » |
| **Mes clients veulent me parler à moi** | « Bien sûr, et ils vous parleront. La question n'est pas vous ou elle, c'est elle ou la sonnerie dans le vide. À 19 h aujourd'hui, c'est qui qui décroche ? » |
| **Je suis déjà débordé** | Le recadrage du tri, mécanique 7. Ne jamais promettre plus d'appels à quelqu'un qui en a trop. |
| **Ça coûte combien ?** (posé dans les trente premières secondes) | « Ça commence à 99 €, et je préfère vous le dire tout de suite pour ne pas jouer au malin. Mais le prix ne veut rien dire tant qu'on n'a pas regardé combien vous en ratez. C'est vingt minutes, jeudi ou vendredi ? » |
| **Envoyez moi un mail** | « Je peux, et il va rester dans votre boîte comme les autres. Vingt minutes chez vous jeudi, et si ça ne vous parle pas je repars. Sinon je vous envoie le mail, sans problème, mais on sait tous les deux comment ça finit. » Dit avec le sourire, ça passe et ça convertit. |
| **C'est un robot, mes clients vont raccrocher** | « Écoutez la, et jugez, c'est pour ça que je me déplace. Elle annonce qu'elle est une IA dès la première phrase, elle ne fait pas semblant. Et elle ne dit pas bonjour deux fois de la même façon : votre client régulier qui appelle chaque semaine n'entend pas une bande. » |
| **On me rappelle déjà dix fois par jour pour me vendre des trucs** | « Je sais, et c'est pour ça que je vous ai demandé trente secondes et que je vais les tenir. » Puis tu les tiens. |

---

## 9. Faire tenir le rendez-vous

Le no-show est le coût réel du présentiel : quarante minutes de voiture pour une
camionnette absente. Trois gestes, tous dans la minute qui suit le « oui ».

1. **La confirmation immédiate**, pendant qu'il est encore en ligne : « Je vous
   envoie un SMS de confirmation tout de suite, vous l'aurez avant de raccrocher. »
   Envoie le vraiment, pendant l'appel. C'est aussi la première démonstration que
   chez toi les choses arrivent.
2. **L'adresse et l'engagement** : « C'est bien au [adresse Google] ? Et vous y
   serez, ou vous serez sur chantier ? » La deuxième question a l'air anodine,
   elle l'oblige à vérifier son agenda au lieu d'acquiescer.
3. **Le rappel la veille**, 17 h, par SMS. Pas « toujours d'accord pour demain ? »,
   qui rouvre la décision, mais « À demain 14 h. J'apporte de quoi vous faire
   entendre la voix. »

Et le statut se met dans le dashboard **immédiatement**, pas en fin de journée :
c'est ce qui alimente le scoring et les relances.

---

## 10. La visite : vingt minutes, dans cet ordre

Tu as promis vingt minutes. Tiens les, et c'est déjà un argument de vente sur un
produit qui promet de la fiabilité.

**0 à 3 minutes, sans rien sortir.** Pas de laptop sur la table. Tu lui fais
répéter son chiffre : « Vous m'avez dit trois par semaine, c'est toujours ça ? »
Il le redit, et il vient de rouvrir le problème lui même.

**3 à 6 minutes, la voix.** C'est le seul moment qui décide. Fais la parler.

> Contrainte à connaître par cœur : la démonstration publique du site est
> plafonnée à **60 secondes par appel**, trois appels par jour et par visiteur.
> Elle est faite pour un visiteur du site, pas pour une tournée. Deux
> conséquences : prépare une minute qui montre quelque chose (une prise de
> rendez-vous complète, pas une salutation), et **ne partage pas la même
> connexion entre trois visites de la journée**, tu épuiserais le quota au
> deuxième client. Le vrai remède est le numéro belge : le jour où il existe,
> tu lui fais composer un numéro depuis SON téléphone, haut parleur sur la
> table. C'est incomparablement plus fort qu'un navigateur, et c'est la raison
> pour laquelle ce numéro n'est pas un détail administratif.

**6 à 12 minutes, son métier.** Le tableau de bord, avec ses mots à lui : ses
horaires, ses zones d'intervention, ses tarifs de déplacement, ce qu'elle doit
refuser. Fais lui dicter une règle et montre la prise en compte. Il doit voir sa
propre entreprise à l'écran, pas une démonstration.

**12 à 16 minutes, le prix.** L'ancre salaire d'abord, le chiffre ensuite.

| Plan | Prix | Minutes incluses | Au delà |
|---|---|---|---|
| Solo | 99 € | 250 | 0,45 €/min |
| Starter | 249 € | 750 | 0,39 €/min |
| Pro | 599 € | 2 000 | 0,35 €/min |
| Enterprise | 1 290 € | 5 000 | 0,30 €/min |

Pour un plombier seul, c'est **Solo**, et ça ne se discute pas : 250 minutes,
c'est environ deux cents appels d'une minute et quart. Ne vends pas Starter à
quelqu'un qui n'en a pas besoin, il te le reprochera au deuxième mois.

**16 à 20 minutes, la mise en route.** C'est ici que la vente se fait, pas dans
un devis envoyé le soir.

> On le met en route maintenant. L'essai, c'est 7 jours et 60 minutes de voix
> incluses. Il faut une carte, je vous le dis franchement, et vous résiliez en
> un clic si ça ne vous convient pas. Ce qu'on fait tout de suite : je crée le
> compte, on règle vos horaires, et je vous montre le renvoi d'appel sur votre
> téléphone.

Puis tu le fais, et le renvoi est le geste qui emporte la décision. Prends son
téléphone, choisis **« tout ce que je ne prends pas »**, code `**004*` suivi du
numéro Qwillio et `#`. La page de configuration donne le lien à composer.

Ne propose pas le renvoi total (`*21*`) à un plombier : son téléphone ne
sonnerait plus du tout, et c'est le meilleur moyen de le perdre en deux jours.
Ce qu'il achète, c'est le filet, pas le remplacement.

> Votre téléphone sonne exactement comme avant. Elle ne prend que ce que vous ne
> prenez pas : occupé, pas de réponse, ou téléphone éteint. Si vous décrochez,
> elle n'existe pas.

Un point à dire toi même avant qu'il ne le découvre : **le renvoi selon l'heure
n'existe pas sur un mobile.** S'il veut qu'elle prenne tout après 18 h, il faut
basculer en renvoi total le soir et le couper le matin. Dis le, propose lui de
commencer sans, et laisse le juger au bout d'une semaine.

À la fin de la visite, sa ligne est branchée et il a entendu son assistante
décrocher. Un client qui a vu le produit tourner sur sa propre ligne n'annule pas
le lendemain.

**Ce que tu n'apportes pas** : un contrat papier, une plaquette, un tarif
imprimé. Rien qui transforme une mise en route en décision à reporter.

**Ce que tu apportes** : un laptop chargé, un partage de connexion depuis ton
téléphone, son historique Google, et de quoi écrire.

---

## 11. Ce qui doit être vrai avant le premier appel

Trois points, tous hors code, tous bloquants pour la vente en présentiel. Ils
sont détaillés dans [`A-FAIRE-PROPRIETAIRE.md`](A-FAIRE-PROPRIETAIRE.md).

- **Le numéro belge.** Sans lui, la démonstration de la visite dépend d'un
  navigateur plafonné à soixante secondes. C'est le seul achat qui change
  vraiment le taux de conversion en face à face.
- **Render en payant.** Les rappels de rendez-vous et les relances tiennent
  aujourd'hui sur un keepalive GitHub Actions que GitHub désactive après
  60 jours sans activité sur le dépôt. Ce jour là, les rappels s'arrêtent en
  silence. Tu peux vendre une voix naturelle à un plombier, tu ne peux pas lui
  vendre un rappel qui ne part pas.
- **Le portail Stripe cliqué une fois.** Ne découvre pas son comportement devant
  un client, assis à sa table de cuisine.

Un quatrième, moins urgent mais qui arrivera : **l'isolation entre clients est
applicative**, pas garantie par la base (pas de RLS Postgres). Aucun plombier ne
posera la question. Le premier cabinet comptable, si.

---

## 12. Cadre belge, en clair

Checklist opérationnelle, pas un avis juridique. À faire valider avant de passer
à l'échelle, comme le note déjà [`loi25-conformite-appels.md`](loi25-conformite-appels.md),
qui traite du cadre canadien et ne couvre pas la Belgique.

- **Tu appelles des professionnels sur des numéros qu'ils ont eux mêmes publiés
  sur Google Maps.** C'est le cas le plus favorable du démarchage, et ça reste du
  traitement de données : dis qui tu es et d'où tu appelles dès la première
  phrase, ce que le script fait déjà.
- **Un refus est définitif.** « Ne me rappelez plus » se traduit par `doNotCall`
  dans la fiche, dans la minute. Le champ existe, sers t'en.
- **Les listes d'opposition** visent les particuliers. Un indépendant qui a mis
  son mobile personnel sur sa fiche est un cas limite : dans le doute, respecte
  le refus et passe au suivant, ça coûte moins cher qu'une plainte.
- **La loi française du 11 août ne s'applique pas ici.** Le tableau d'objections
  de `playbook-vente.md` porte cette réponse et le signale déjà : ne la sers
  jamais à un prospect belge, il verra que tu récites.
- **Toi, tu appelles à la main.** Le jour où tu lances l'outbound automatique,
  la divulgation « assistante virtuelle » en première phrase et la mention
  d'enregistrement deviennent obligatoires, et elles sont déjà dans les scripts.

### L'argument de conformité, qui est vrai et que personne ne sort

Celui là, tu peux le servir sans rien exagérer, et c'est rare.

L'assistante **annonce qu'elle est une IA dans sa première phrase**, avant toute
collecte, et le réglage est actif par défaut. Elle n'annonce l'enregistrement
que si l'appel est réellement enregistré, jamais un « peut être » de confort.
Les deux répondent à quelque chose de précis : l'AI Act, article 50, applicable
depuis le 2 août 2026, et pour l'enregistrement le RGPD ainsi que l'article
314bis du code pénal belge.

> Vous savez qu'à partir de cette année, une voix automatique doit dire qu'elle
> est automatique ? Chez nous c'est la première phrase, et l'enregistrement
> n'est annoncé que s'il a lieu. Vous n'avez rien à faire, c'est déjà réglé.

Ce n'est pas un argument de vente, c'est un risque en moins pour lui. Sers le
après le prix, jamais avant : c'est ce qui referme une hésitation, pas ce qui
ouvre une conversation.

---

## 13. Ce que tu relèves, et ce que tu ne sauras pas avant deux cents appels

| Indicateur | À relever | Cible de départ |
|---|---|---|
| Appels composés | Par séance | 20 en 45 minutes |
| Contacts établis | Quelqu'un décroche | 30 % |
| Rendez vous obtenus | Sur appels composés | 3 % |
| Rendez vous tenus | Sur rendez vous fixés | 70 % |
| Mises en route | Sur visites tenues | À découvrir |

Les quatre premières lignes viennent du playbook et sont des **hypothèses de
départ**, pas des mesures. La cinquième n'a aucune valeur de référence parce que
personne n'a encore fait une visite. Refais tes projections avec tes vrais
chiffres au bout d'un mois, et jette celles ci.

Un seul nombre décide de tout : **le taux de rendez-vous par appel composé**.
S'il est à 3 %, vingt appels par jour font trois rendez-vous par semaine. S'il
est à 1 %, il te faut soixante appels par jour, et c'est un autre métier.
Tu ne le connaîtras pas avant deux cents appels, donc passe les deux cents avant
de conclure quoi que ce soit sur le produit, le prix ou la niche.
