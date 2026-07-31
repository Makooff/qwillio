# Playbook de vente

Remplace l'ancien dossier `sales/`. Tout ce qu'il faut pour appeler, sans une seule affirmation invérifiable.

## La règle, avant tout le reste

**On ne cite pas un client qu'on n'a pas.** Pas de « un plombier à Namur a signé en mars », pas de « 78 % en tests aveugles », pas de « nos clients gagnent X ».

La cible est un patron de PME ou un comptable. Il vérifie. Il demande à parler au client cité. Le jour où il découvre que le chiffre est inventé, la vente est morte et il en parle autour de lui. Sur un marché local, une exagération coûte plus qu'elle ne rapporte.

Deux sorties honnêtes quand on n'a pas de preuve :

- **La question de découverte.** « Sur une semaine, vous en ratez combien ? » Son chiffre le touche plus que le tien, et il est vrai.
- **L'aveu assumé.** « Je ne vais pas vous citer des clients que je n'ai pas. On démarre, vous seriez le premier de votre secteur, et c'est exactement pour ça que je vous fais ces conditions. » Le démarrage devient un argument.

## Où travailler

**Dans le dashboard admin, page Prospection.** Elle a été reconstruite pour appeler à la main :

- une recherche sur les leads déjà collectés, instantanée et gratuite (elle ne quitte pas la base)
- un **lien `tel:` réel** par ligne, donc ton téléphone compose, et l'appel est enregistré comme tentative
- un **briefing** par entreprise, qui lance l'enrichissement du site web à la première ouverture
- un **script de vente** écrit pour cette entreprise, généré au premier clic et conservé, donc gratuit à relire avant l'appel
- les recherches sauvegardées, qui retiennent les filtres et la dernière entreprise appelée

Le scraping Google Maps est derrière un bouton séparé avec un avertissement de coût, pour qu'une frappe au clavier ne le déclenche pas par accident.

**N'utilise pas de CSV en parallèle.** Tout ce qui est appelé doit laisser une trace dans le dashboard, sinon la boucle d'apprentissage ne sert à rien.

## Le script d'appel

Objectif de l'appel : **obtenir un rendez-vous, pas vendre**. Un appel à froid qui essaie de closer échoue.

### Ouverture, 10 secondes

> Bonjour, [Nom] ? [Ton prénom], de Qwillio. Je vous prends trente secondes, vous me dites si ça vaut la peine.

Pas de « comment allez-vous », pas de « je ne vous dérange pas ». On annonce la durée et on la tient.

### Le cadre, 10 secondes

> On aide les [métier] à ne plus rater d'appel. Ceux qui arrivent quand vous êtes en intervention, ou après 18 h.

### La question de découverte, et on se tait

> Ma question : sur une semaine normale, vous en ratez combien à peu près ?

**Puis on écoute.** C'est le seul moment qui compte. Le chiffre qu'il donne devient l'argument pour tout le reste de l'appel.

### Le calcul, fait avec lui

Ne jamais asséner un montant. Le construire :

> D'accord, [son chiffre] par semaine. Et un client chez vous, ça vaut à peu près combien ?
>
> Donc [chiffre × valeur × 52], sur l'année. C'est ce que l'accueil vous coûte aujourd'hui.

C'est son chiffre, sa valeur client, son calcul. Il ne peut pas le contester.

### L'ancre de prix

> Une secrétaire à mi-temps, chargée, c'est combien chez vous ? Qwillio commence à 99 € par mois.

Ne jamais se comparer à un autre logiciel. La comparaison est un salaire.

### Le closing, sur le rendez-vous

> Je vous propose qu'on se reparle vingt minutes, je vous montre le produit tourner sur votre secteur. Jeudi 10 h ou vendredi 14 h ?

Deux créneaux, pas « quand êtes-vous disponible ».

### Selon la réponse

**Plus de 5 appels ratés par semaine** : il a un problème, va au rendez-vous.

**Moins de 2** : « Dans votre cas ce n'est probablement pas urgent. Je vous laisse mon lien si ça bouge. » Raccrocher vite est un gain de temps, pas un échec.

**« Je ne sais pas »** : « C'est justement le problème. Ça vous dit qu'on mesure sur sept jours ? »

## Objections

| Objection | Réponse |
|---|---|
| **C'est cher** | « Par rapport à quoi ? Une secrétaire à mi-temps, c'est combien chez vous ? » Ramener à l'ancre salaire, jamais à un autre logiciel. |
| **Sylen est à 49 €** | « Oui, et en français seul, hébergé où ? Nous c'est bilingue sur le même appel et hébergé en Europe. Si le français seul vous suffit, prenez Sylen, franchement. » Concéder ce qui est vrai rend crédible le reste. |
| **Je préfère les vraies personnes** | « Bien sûr. La question n'est pas IA contre humain, c'est IA contre répondeur. Aujourd'hui à 19 h, c'est qui qui décroche ? » |
| **On a déjà une secrétaire** | « Parfait, gardez-la. Qwillio prend les débordements, l'après 18 h et le week-end. Elle garde le relationnel, vous ne perdez plus les appels du soir. » |
| **Mes clients vont détecter l'IA** | « Écoutez la démo et jugez. Et s'ils la détectent : ils préfèrent quoi, une IA qui décroche ou un répondeur ? » |
| **Je ne vous connais pas** | « C'est vrai, on démarre. 7 jours d'essai, résiliable en un clic, et c'est moi qui fais la mise en route. » |
| **Après le 11 août je n'aurai plus le droit** | « L'inverse. La loi interdit le démarchage vers les particuliers. Qwillio répond aux appels **entrants**, ceux que vos clients vous passent. Elle n'est pas concernée, et comme beaucoup perdent le sortant, l'entrant devient leur seul canal. » **Attention : cette loi est française. Ne pas la servir à un cabinet belge.** |
| **Pas maintenant, on est chargés** | « C'est pendant les périodes chargées que les appels se perdent. On en reparle quand, concrètement ? » |
| **Ça ne m'intéresse pas** | « Compris, bonne journée. » Pas de contre-argumentation. On raccroche et on appelle le suivant. |

## L'angle fiduciaire

Le levier le plus rentable, parce qu'un cabinet a 50 à 300 PME clientes.

L'approche n'est pas de lui vendre Qwillio pour lui, mais de lui proposer **d'en faire bénéficier ses clients** avec une commission récurrente. Voir `contrats/partenaire-fiduciaire.md` et `emails/partenaires/brochure-fiduciaire.md`.

> Je ne vous appelle pas pour vous vendre quelque chose. Vous avez des clients PME qui ratent des appels toute la journée. Je vous propose de leur en parler, et vous touchez une commission récurrente sur chacun.

Un partenariat signé vaut cent appels à froid, et il règle le problème d'aujourd'hui : appeler des inconnus sans référence.

## Règles de séance

- **Un appel dure 90 secondes maximum** avant le rendez-vous. Au-delà, soit tu closes, soit tu perds ton temps.
- **Après un refus, dix secondes et on appelle le suivant.** Pas de rumination.
- **Le statut se met dans le dashboard immédiatement**, pas en fin de journée.
- **Objectif : 20 appels en 45 minutes.**

## Ce qu'on ne dit jamais

- « Vous ne comprenez pas. »
- « C'est de la magie. »
- « On garantit X clients. »
- « C'est aussi bien qu'un humain. »

Ce sont les quatre phrases qui perdent le plus vite.

## Mesures

À relever chaque jour, dans le dashboard :

| Indicateur | Cible de départ |
|---|---|
| Appels passés | 20 par séance |
| Contacts établis | 30 % des appels |
| Rendez-vous obtenus | 3 % des appels |
| Démos tenues | 70 % des rendez-vous |
| Conversion démo vers client | 30 % |

**Le taux de rendez-vous sur appel est la seule variable qui décide de tout.** Tu ne le connaîtras pas avant deux cents appels. Refais tes projections avec ton vrai chiffre au bout d'un mois, pas avec celui-ci.

## Avant d'appeler le premier fiduciaire

Une chose à régler : **passer Render en payant.** Les rappels de rendez-vous et les relances tournent aujourd'hui grâce à un keepalive GitHub Actions, que GitHub désactive après 60 jours sans activité sur le dépôt. Ce jour-là, les jobs s'arrêtent en silence.

Un comptable n'achète pas une voix naturelle. Il achète que le rappel parte à l'heure.
