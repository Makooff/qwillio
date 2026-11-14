# Plan de vente, du 16 novembre au 31 décembre 2026

Objectif unique : **les premiers clients payants, le plus vite possible.**
Ce plan ne remplace pas [`playbook-vente.md`](playbook-vente.md) ni
[`playbook-rdv-presentiel.md`](playbook-rdv-presentiel.md) : il dit **quoi faire
quel jour**, les playbooks disent **comment le dire**. La fiche à garder sous les
yeux pendant un appel reste [`fiche-appel.md`](fiche-appel.md).

Les chiffres marqués « hypothèse » ne sont pas des mesures. Ils seront remplacés
par les tiens à la date de contrôle du 4 décembre.

---

## 1. Ce que la recherche dit, et ce que ça change

| Constat | Source | Ce que ça change pour toi |
|---|---|---|
| En prospection à froid classique, il faut **environ 370 à 400 appels pour un rendez-vous** chez un vendeur moyen, **environ 45** chez les meilleurs | Belkins (175 000 appels), Gong (300 M d'appels) | Trente appels sans résultat ne disent rien, ni sur toi ni sur le produit. Le playbook fixe le seuil à **200 appels** avant de conclure quoi que ce soit, et il a raison |
| **56 % des fondateurs** trouvent leurs premiers clients par leur réseau, 35 % par la prospection à froid | Enquête Supabase, citée de seconde main | Le réseau passe **avant** les appels à froid dans le calendrier, pas après |
| Dans les services à domicile, **14 % des appels** restent sans réponse (27 % selon une autre mesure). **78 %** des consommateurs ont déjà abandonné une entreprise après un appel sans réponse, et **42 % seulement** laissent un message | CallRail 2025 (1,1 M de conversations, enquête sur 1 000 personnes), Invoca 2024. Données américaines | Le problème est réel et mesuré. Mais ne cite pas ces chiffres au téléphone : pose la question de découverte, son chiffre à lui pèse plus |
| Le fameux « 62 % des appels ne sont pas décrochés » vient d'une étude de **85 entreprises en 2016** | Recoupement de plusieurs sources | **Ne l'utilise jamais.** Un patron qui vérifie tombe dessus |
| En Belgique, **72 % des entreprises de construction** ont vu baisser leurs nouveaux contacts sur six mois | Embuild, septembre 2026 | Argument vrai et actuel : « quand il y a moins de demandes, chaque appel raté coûte plus cher » |
| Un accueil téléphonique par IA se vend le plus souvent **entre 50 et 200 € par mois** | CloudTalk 2026, comparatifs | Le palier **Solo à 99 €** est dans le marché. C'est lui qu'on vend aux artisans, pas Starter |
| L'entrée de gamme Sylen est annoncée à 49 €, mais une autre fiche donne 129 € pour 350 minutes | La Fabrique du Net, Capterra | Les grilles bougent. Si on te cite Sylen, réponds sur les minutes incluses, comme le prévoit le playbook |

**Ce que je corrige par rapport à mes conseils précédents.**

1. *La cible.* J'avais proposé les agences immobilières et les vétérinaires. Le
   dépôt a déjà tranché, avec de meilleures raisons : **services à domicile, 1 à
   5 personnes, Bruxelles et Brabant wallon**. Le patron décroche lui-même sur
   son mobile, et dans le dépannage le premier qui décroche prend le chantier.
   On garde cette niche pour les 200 premiers appels. L'immobilier reste la
   niche de réserve (10 922 agents inscrits à l'IPI fin 2024).
2. *Le SMS à ceux qui ne décrochent pas.* À ne **pas** faire tel quel. En droit
   belge, la publicité par message électronique demande un consentement
   préalable, et l'exception ne couvre que les **personnes morales** jointes sur
   une adresse **impersonnelle** (du type `info@`). Un plombier indépendant sur
   son mobile n'entre pas dans cette exception. Le SMS ne part donc qu'**après**
   un premier échange où il a dit oui (« je vous envoie le lien par SMS ? »).

---

## 2. Les trois canaux, dans l'ordre de rendement

| Rang | Canal | Pourquoi | Effort |
|---|---|---|---|
| 1 | **Ton réseau** : toute personne que tu connais qui a un commerce, ou qui connaît un indépendant | Une introduction tiède vaut des dizaines d'appels à froid | 2 heures, une seule fois, puis des relances |
| 2 | **Appel puis visite** chez les services à domicile | C'est le seul canal dont tu contrôles le volume | 45 minutes d'appels par jour, 2 demi-journées de visites par semaine |
| 3 | **Apporteurs** : fiduciaires, agences web, installateurs télécom | Un cabinet comptable a 50 à 300 PME clientes. Commission récurrente de 20 % déjà prévue dans le code | 10 contacts, à partir de décembre |

**L'offre, la même partout** (détail dans le playbook) :

> Vous ne changez rien, vous continuez de décrocher. Elle ne prend que les
> appels que vous ratez, et vous recevez un SMS avec le nom et la demande.
> Sept jours d'essai, je fais la mise en route moi-même, et vous coupez le
> renvoi en trente secondes si ça ne vous plaît pas.

**Pour encaisser plus vite :** propose toujours l'annuel à la fin d'un essai
réussi. Solo annuel = **950 €** encaissés en une fois (au lieu de 99 € par
mois), Starter annuel = **2 390 €**. Deux Solo annuels en décembre, c'est
1 900 € de trésorerie.

---

## 3. Avant le premier appel (week-end du 14 et 15 novembre)

À cocher. Tant qu'une case est vide, la démo peut échouer devant un prospect.

- [ ] Solde Vapi positif (une ligne à solde négatif raccroche sur tout le monde)
- [ ] `npm run voice:audit` au vert sur un appel de test passé par toi
- [ ] Une ligne de démonstration configurée comme un plombier fictif, avec ses
      horaires et ses services, que le prospect peut appeler pendant la visite
- [ ] Render en formule payante (sinon rappels et relances s'arrêtent en silence)
- [ ] Portail Stripe ouvert une fois, pour ne pas le découvrir chez un client
- [ ] Inscription de **bout en bout** rejouée une fois : essai, renvoi d'appel,
      premier appel reçu
- [ ] Accès à la liste « Ne m'appelez plus » vérifié (voir section 8)

---

## 4. Le calendrier, semaine par semaine

Une séance d'appels = **une commune**, quarante lignes préparées, vingt appels
en 45 minutes. Fenêtres qui marchent pour un artisan : **7 h 30 à 8 h 30**
(dans la camionnette), **12 h à 13 h 30**, **17 h à 18 h 30**. Jamais le lundi
matin, jamais le vendredi après 16 h.

### Semaine 1, du 16 au 20 novembre : réseau et premières séances

| Jour | À faire | Objectif chiffré |
|---|---|---|
| Lundi | Écrire la liste de **30 personnes** de ton entourage (famille, amis, anciens collègues, ton coiffeur, ton garagiste, ton comptable). Leur envoyer un message personnel : « Tu connais un indépendant qui rate des appels ? » | 30 messages envoyés |
| Lundi | Générer la liste Bruxelles (page Prospection, niche Services à domicile), trier les 40 meilleures lignes | 40 lignes prêtes |
| Mardi au vendredi | Séance de 7 h 30 : 20 appels. Rappels à 17 h | 80 appels |
| Vendredi | Relever les chiffres de la semaine (section 6) | Tableau rempli |

**Cible de la semaine :** 80 appels, 2 rendez-vous fixés, 3 introductions
obtenues par le réseau.

### Semaine 2, du 23 au 27 novembre : premières visites

| Jour | À faire | Objectif chiffré |
|---|---|---|
| Lundi au vendredi | Séance du matin, une commune par jour (Wavre, Waterloo, Braine-l'Alleud, Nivelles, Bruxelles) | 100 appels |
| Jeudi et vendredi après-midi | Visites, groupées par commune. Mise en route **sur place**, pendant la visite | 2 à 3 visites tenues |
| Mercredi | Relancer les 30 personnes du réseau qui n'ont pas répondu | 15 relances |

**Cible de la semaine :** 100 appels, 3 rendez-vous fixés, 2 visites tenues,
**1 essai démarré**.

### Semaine 3, du 30 novembre au 4 décembre : le contrôle des 200 appels

Même rythme. Le vendredi 4 décembre tu as passé environ **280 appels** : c'est
la date de contrôle (section 7). Tu lances aussi le troisième canal.

| Jour | À faire | Objectif chiffré |
|---|---|---|
| Lundi au vendredi | Séance du matin | 100 appels |
| Mardi | Écrire à **10 apporteurs** (5 fiduciaires, 3 agences web, 2 installateurs télécom) sur leur adresse générale | 10 courriels |
| Jeudi et vendredi | Visites | 3 visites tenues |
| Vendredi | **Contrôle des 200 appels**, décision écrite | Une décision |

**Cible de la semaine :** 3 visites, 2 essais démarrés, **premier client payant**.

### Semaine 4, du 7 au 11 décembre : convertir

| Jour | À faire | Objectif chiffré |
|---|---|---|
| Lundi au vendredi | Séance du matin, sur le métier qui a le mieux répondu (chauffagistes en priorité : c'est la saison des pannes) | 100 appels |
| Chaque jour | Appeler **chaque essai en cours** : « combien d'appels a-t-elle pris cette semaine ? » puis proposer l'annuel | Tous les essais suivis |
| Jeudi | Rendez-vous avec les apporteurs qui ont répondu | 2 rendez-vous |

**Cible de la semaine :** 2 clients payants de plus, 1 apporteur intéressé.

### Semaine 5, du 14 au 18 décembre : dernière semaine utile

Dernière semaine avant les fêtes : tout ce qui n'est pas signé le 18 glisse en
janvier.

- 100 appels, 3 visites.
- Demander à **chaque client payant** : une phrase de témoignage écrite, et un
  nom à qui te recommander. C'est ce qui manque le plus aujourd'hui.
- Signer le premier accord d'apporteur.

**Cible de la semaine :** 1 à 2 clients payants de plus, 1 témoignage, 1 apporteur signé.

### Du 21 au 31 décembre : suivi et bilan

Pas de prospection à froid, les patrons ne décrochent plus. Tu suis les clients
(un chauffagiste reçoit justement ses urgences pendant les fêtes : vérifie que
tout décroche), tu fais le bilan chiffré et tu prépares les listes de janvier.

---

## 5. Les objectifs au 31 décembre

| Indicateur | Plancher | Cible | Mode de calcul |
|---|---|---|---|
| Appels passés | 400 | 480 | 20 par jour ouvré |
| Rendez-vous fixés | 8 | 14 | Hypothèse du playbook : 3 % des appels |
| Visites tenues | 6 | 10 | Hypothèse : 70 % des rendez-vous |
| Essais démarrés | 4 | 7 | Mise en route pendant la visite |
| **Clients payants** | **3** | **5** | Hypothèse : 30 % des visites, plus 1 à 2 par le réseau |
| Revenu mensuel récurrent | 300 € | 600 € | Solo à 99 €, un Starter éventuel |
| Trésorerie encaissée | 300 € | 2 000 € | Dépend du nombre d'annuels |
| Apporteurs signés | 0 | 1 | Sur 10 contactés |
| Témoignages écrits | 1 | 3 | Un par client content |

Rappel du business plan : avec environ 200 € de charges fixes par mois, **deux
clients couvrent les frais.** Le plancher de ce plan suffit à ne plus perdre
d'argent.

---

## 6. Ce que tu relèves chaque vendredi

Cinq nombres, pas un de plus. Recopie ce tableau dans un fichier ou sur papier.

| Semaine | Appels | Décrochés | RDV fixés | Visites tenues | Essais | Payants |
|---|---|---|---|---|---|---|
| 16 au 20 nov. | | | | | | |
| 23 au 27 nov. | | | | | | |
| 30 nov. au 4 déc. | | | | | | |
| 7 au 11 déc. | | | | | | |
| 14 au 18 déc. | | | | | | |

Note aussi, mot pour mot, **les trois refus les plus fréquents** de la semaine.
C'est la matière première pour corriger le script.

---

## 7. Le contrôle du 4 décembre : quoi décider selon tes chiffres

| Ce que tu observes sur 200 appels | Ce que ça veut dire | Décision |
|---|---|---|
| 5 rendez-vous ou plus | Le canal marche | Continuer, monter à 30 appels par jour |
| 2 à 4 rendez-vous | Dans la norme basse | Continuer, retravailler l'ouverture avec les refus relevés |
| 0 ou 1 rendez-vous, mais des gens qui décrochent | Le script ou la niche bloque | Changer de métier (chauffagiste, serrurier) ou basculer sur l'immobilier pour les 200 suivants |
| Presque personne ne décroche | Mauvaises fenêtres ou mauvais numéros | Changer d'horaire avant de changer quoi que ce soit d'autre |
| Des visites tenues mais aucun essai | L'offre ou la démo bloque | Revoir la démo et le prix ensemble, avant de rappeler qui que ce soit |
| Des essais mais aucun payant | Le produit ne prouve pas sa valeur en 7 jours | Regarder les appels réellement pris pendant les essais |

Si fin décembre **le réseau et les apporteurs** ont donné plus de clients que
les appels, janvier se réorganise autour d'eux et les appels passent au second
plan.

---

## 8. Le cadre légal belge, à vérifier une fois

Checklist, pas un avis juridique.

- **Liste « Ne m'appelez plus ».** Toute entreprise qui démarche par téléphone
  en Belgique doit la consulter (Code de droit économique, articles VI.111 et
  suivants). Un fournisseur de fichiers indique qu'elle vaut aussi entre
  professionnels ; je n'ai pas trouvé de confirmation officielle. **À vérifier
  sur le site de la liste avant la première séance.**
- **Un refus est définitif** : case `doNotCall` cochée dans la minute.
- **Courriel de prospection** : possible sans consentement vers une société
  (personne morale) sur une adresse impersonnelle, d'après l'arrêté royal du
  4 avril 2003. Pas vers l'adresse nominative d'un indépendant.
- **SMS** : seulement après accord donné de vive voix.
- **Ce que tu ne dis jamais**, rappel du playbook : un client que tu n'as pas,
  « hébergé en Europe », « bilingue sur le même appel ».

---

## 9. Ce que ça coûte

| Poste | Montant | Obligatoire |
|---|---|---|
| Solde Vapi pour les démos et les essais | 10 à 20 € | Oui |
| Render payant | environ 7 € par mois | Oui |
| Listes de prospects | Crédits Apify, ou gratuit en relevant Google Maps à la main (40 lignes par commune) | Au choix |
| Déplacements | Essence, communes à moins de 45 minutes | Oui |

Aucun outil payant de prospection n'est nécessaire pour ces sept semaines.

---

## Sources

- [Belkins, repères de prospection téléphonique sur 175 000 appels](https://belkins.io/blog/cold-calling-benchmarks)
- [Prospeo, taux de réussite des appels à froid, repères 2026 (données Gong et Cognism)](https://prospeo.io/s/cold-calling-success-rate)
- [CallRail, rapport de janvier 2025 sur les appels manqués par secteur](https://www.businesswire.com/news/home/20250114793850/en/CallRail-Releases-Report-Benchmarking-Marketing-Efforts-for-Small-Businesses)
- [SchedulingKit, origine du chiffre de 62 % et recoupement des études](https://schedulingkit.com/statistics/missed-call-statistics)
- [Discury, comment les fondateurs seuls trouvent leurs premiers clients](https://discury.io/playbook-how-founders-acquire-first-paying-saas-users-cfd6)
- [DH, étude Embuild de septembre 2026 sur la baisse des commandes](https://www.dhnet.be/dernieres-depeches/2026/09/17/la-baisse-des-commandes-inquiete-le-secteur-de-la-construction-XXQETJ6CPFAITITDBMKWUG6CHU/)
- [La Libre, nombre d'agents immobiliers inscrits à l'IPI fin 2024](https://www.lalibre.be/economie/immo/2025/03/12/il-y-a-de-moins-en-moins-dagents-immobiliers-en-belgique-GGG54IKN6JBKZADKKWF6KX4NM4/)
- [CloudTalk, coût d'un secrétariat téléphonique par IA en 2026](https://www.cloudtalk.io/fr/blog/combien-coute-un-service-de-secretariat-telephonique-ia/)
- [La Fabrique du Net, comparatif des standards téléphoniques par IA](https://www.lafabriquedunet.fr/logiciels/tech/standard-telephonique/standard-telephonique-ia)
- [Capterra, fiche tarifaire de Sylen](https://www.capterra.com/p/10042610/Sylen/)
- [Police fédérale, la liste « Ne m'appelez plus »](https://www.police.be/5338/node/13307)
- [Actualités du droit belge, interdiction de principe de la publicité électronique non sollicitée](https://www.actualitesdroitbelge.be/droit-des-affaires/droit-commercial/le-cadre-juridique-des-services-de-l-information-en-ligne/l-interdiction-de-principe-du-spamming)
- [Autorité de protection des données, avis citant l'arrêté royal du 4 avril 2003](https://www.autoriteprotectiondonnees.be/publications/avis-n0-02-2026.pdf)
