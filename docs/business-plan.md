# Business plan

Chiffres de juillet 2026, adossés à `backend/src/config/plans.ts`. Aucun montant n'est écrit à la main ici sans venir de là.

## Le problème, et s'il est réel

**Il l'est.** L'appel manqué chez un artisan ou un cabinet est mesurable, douloureux et immédiat : le client raccroche et appelle le suivant. Plusieurs acteurs français financés se sont lancés dessus en dix-huit mois, ce qui prouve un marché, pas une intuition.

**Mais le problème est en train de devenir une commodité.** Répondre au téléphone en IA n'est plus un exploit technique : Vapi, Retell et ElevenLabs le vendent à quiconque sait câbler trois appels d'API. Qwillio loue la même brique que ses concurrents. Il n'y a pas d'avantage technologique à défendre, ni pour toi ni pour eux.

Conséquence directe pour le plan : la valeur ne se construit pas sur le décrochage, mais sur **la niche, la distribution et ce qui se passe après l'appel**.

## Offre

| Palier | Prix | Minutes incluses | Dépassement |
|---|---:|---:|---:|
| Solo | 99 € | 250 | 0,45 €/min |
| Starter | 249 € | 750 | 0,39 €/min |
| Pro | 599 € | 2 000 | 0,35 €/min |
| Enterprise | 1 290 € | 5 000 | 0,30 €/min |

Essai 7 jours, carte demandée à l'inscription. Annuel : 12 mois d'engagement contre 20 % de remise.

## Économie unitaire

Le coût de revient tourne autour de **0,15 €/minute tout compris** (voix, transcription, modèle, télécom). C'est la base de calcul retenue dans `plans.ts`.

| Palier | Prix | Coût des minutes incluses | Marge brute si quota plein | Marge sur dépassement |
|---|---:|---:|---:|---:|
| Solo | 99 € | 37,50 € | **62 %** | 67 % |
| Starter | 249 € | 112,50 € | **55 %** | 62 % |
| Pro | 599 € | 300 € | **50 %** | 57 % |
| Enterprise | 1 290 € | 750 € | **42 %** | 50 % |

Deux choses à retenir :

**La marge se dégrade quand le palier monte.** C'est voulu (le gros volume se paie moins cher à la minute), mais ça veut dire qu'Enterprise à quota plein est le client le moins rentable en pourcentage. Il ne devient intéressant que s'il ne consomme pas tout son quota, ce qui est le cas courant.

**Le dépassement garde toujours plus de 100 % de marque sur le coût.** Un client qui déborde est plus rentable qu'un client qui reste dans son forfait. C'est sain, mais ça oblige à alerter honnêtement avant la facture : la jauge de minutes dans le dashboard sert exactement à ça.

**En pratique, la marge réelle est plus haute** que le tableau, parce que presque personne ne consomme 100 % de son quota. Sur une consommation moyenne à 60 %, Starter passe de 55 % à environ 73 % de marge brute.

## Coûts fixes

| Poste | Mensuel |
|---|---:|
| Render (à passer en payant, non négociable avant de facturer) | ~7 € |
| Neon, Vercel | 0 à 20 € selon plan |
| Numéros de téléphone | ~1 à 2 € par numéro |
| Outils de vente (Instantly, Sales Navigator) | ~150 € |

L'infrastructure ne coûte presque rien. **Le seuil de rentabilité n'est pas un problème d'infrastructure, c'est un problème de premier client.**

## Seuil

Avec environ 200 € de charges fixes mensuelles, **deux clients Starter couvrent tout**. Trois clients Pro sortent un salaire.

C'est le chiffre qui compte : l'objectif n'est pas cent clients, c'est **les cinq premiers**. Tout le reste du plan sert cet objectif.

## Le chemin recommandé

### Ne pas repartir de zéro

Le dépôt contient une soixantaine de services backend, Stripe et Vapi qui tournent, un CRM, un portail client, un panel admin, une boucle d'apprentissage, du scraping, du scoring, de la relance. C'est une année de travail. Le problème n'a jamais été le code, il est dans le positionnement, et un positionnement se change en une semaine.

### Une seule verticale : les fiduciaires belges

Le dépôt désigne déjà la cible (`/partenaires-fiduciaires`, brochure, contrat partenaire). Pourquoi elle est bonne :

- **Chaque cabinet est un canal, pas un client.** 50 à 300 PME clientes derrière chacun. Un partenariat vaut cent appels à froid, et il apporte des introductions tièdes au lieu d'inconnus. C'est la réponse au problème d'aujourd'hui : vendre sans référence.
- **Bilingue FR/NL structurel** en Belgique. Sylen est français, Rosie est anglais. Personne ne couvre ça.
- **Téléphone lourd et daté** : TVA, bilans, échéances. La douleur est chiffrable.
- **Collant.** Quand tu tiens la ligne d'un cabinet et de ses clients, on ne te débranche pas pour économiser 30 €.

### Changer d'ancre plutôt que de prix

Comparé à un outil à 49 €, Solo à 99 € est cher. Comparé à une secrétaire à mi-temps chargée, ou à un client perdu sur une échéance ratée, 249 à 599 € ne se discute plus.

**C'est le levier le plus rentable du document et il ne coûte que de la copy.** Ne baisse pas les prix, change le point de comparaison.

### Service d'abord, produit ensuite

Avant de coder quoi que ce soit de neuf : prends **trois fiduciaires** et fais-le en service, à la main plus l'IA, pour 500 à 1 500 €/mois. Six semaines et de l'argent réel, au lieu de six mois de développement. Chaque client nourrit `niche-learning` et `script-learning`. Après cinq à dix clients tu as de vrais cas, et là seulement tu productises en self-serve.

## Projections, avec les hypothèses affichées

Hypothèses : 40 appels à froid par semaine, 3 % de rendez-vous obtenus, 30 % de conversion en démo, panier moyen Starter à 249 €, attrition 5 %/mois.

| | Mois 3 | Mois 6 | Mois 12 |
|---|---:|---:|---:|
| Clients directs | 3 | 9 | 22 |
| Clients via fiduciaires | 0 | 4 | 18 |
| MRR | ~750 € | ~3 200 € | ~10 000 € |

**Ces chiffres sont une hypothèse, pas une prévision.** Le taux de 3 % de rendez-vous sur appel à froid est la variable qui décide de tout, et tu ne le connaîtras qu'après deux cents appels. Refais le tableau avec ton vrai taux au bout d'un mois.

La ligne « via fiduciaires » démarre à zéro puis dépasse le direct : c'est toute la thèse. Si elle ne se matérialise pas au mois 6, la verticale fiduciaire est fausse et il faut en changer.

## Risques

| Risque | Gravité | Ce qui le réduit |
|---|---|---|
| Guerre des prix sur le décrochage | Élevée | La verticale et l'ancre salaire, pas l'alignement des prix |
| Un client déçu parle, sur un marché où tout le monde se connaît | Élevée | La fiabilité avant la vente : Render payant, jobs qui tournent, aucune promesse invérifiable |
| Fondateur seul, un seul point de défaillance | Élevée | Documenter (ces dossiers), automatiser, et le dire au client plutôt que de le cacher |
| Un concurrent financé descend sur la Belgique | Moyenne | Le canal fiduciaire, qui ne s'achète pas |
| Le sortant vendu à des clients français vers des particuliers | Réglementaire | Cadrer B2B uniquement, noir sur blanc dans le contrat |

## La piste qui vaut plus que le réceptionniste

Le dépôt contient `outbound-engine`, `follow-up-sequences`, `call-intelligence`, `prospect-scoring`, `ai-learning`, `ab-testing`. **Aucun concurrent au prix PME ne fait décrocher, relancer et apprendre dans le même produit.**

Un plombier qui répond à tous ses appels gagne 10 %. Un plombier dont les devis non signés sont relancés automatiquement gagne beaucoup plus.

Piste à évaluer une fois les cinq premiers clients acquis : garder le réceptionniste comme produit d'appel à 99 €, et construire la différenciation sur le sortant à 249 à 599 €. À ne pas lancer avant d'avoir des clients : c'est une montée en gamme, pas un point d'entrée, et le marché des agents de prospection est plus encombré et mieux capitalisé.

**Ne mets pas en avant la suite agent** (Email, Comptabilité, Inventaire, Paiements) tant qu'elle n'est que des écrans de démo. Un prospect qui demande à la voir pendant un appel te met en difficulté.
