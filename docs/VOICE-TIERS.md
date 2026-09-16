# Les deux niveaux de réceptionniste : Standard et Superagent

Un seul réglage par client, `voiceTier`, et deux valeurs. Ce document dit ce
que chacune est faite, ce que la seconde gagne, ce qu'elle perd, comment la
poser et comment vérifier qu'elle a servi.

## Ce que chaque niveau est

| | **Standard** (`base`) | **Superagent** (`superagent`) |
|---|---|---|
| Écoute | Deepgram Nova-3 transcrit | le modèle entend l'audio |
| Pense | `gpt-4.1-mini`, boucle tenue par notre backend (custom-LLM) | OpenAI temps réel, boucle tenue par Vapi |
| Parle | Cartesia Sonic, découpé en phrases (`chunkPlan`) | le modèle répond en audio |
| Étapes | trois, chacune avec sa latence | une |
| Plancher réaliste | 1,2 à 1,5 s par tour | 0,5 à 0,8 s par tour |

Le niveau `base` est la chaîne d'aujourd'hui, **sans un curseur déplacé** : sa
table de réglages est vide, et c'est voulu. Nommer ce qui tourne ne doit pas le
changer, sinon les deux niveaux ne sont plus comparables.

## Ce que Superagent gagne, et ce qu'il perd

Il gagne les deux choses qu'on cherche : la vitesse (deux étapes supprimées,
pas réglées) et le réalisme (intonation, hésitations, interruptions tenues par
le modèle lui-même, qui entend le ton et pas seulement les mots).

Il perd ce que le backend ajoute **à chaque tour**, parce que sur ce chemin
Vapi appelle OpenAI directement et qu'il n'y a plus de custom-LLM à traverser :

- la mémoire de l'appelant posée par tour (`callerHistoryBlock`),
- la date posée par tour (`clockBlock`),
- la reprise après coupure, les étages de modèle, le cache de préfixe.

Ce qui **reste** : le prompt système entier (vouvoiement, glossaire belge,
champs nommés du métier, discipline du nom épelé, « rien n'est réservé ») et
tous les outils (agenda, réservation, transfert, capture de lead, base de
connaissances). La discipline tient, la mémoire par tour non.

Le coût, à connaître avant de vendre : le tableau de bord Vapi annonce
0,645 $ la minute pour `gpt-realtime-2` contre 0,060 $ pour
`gpt-realtime-mini-2025-12-15`, un facteur dix, quand la recette par minute
incluse va de 0,26 à 0,40 €. `VOICE_REALTIME_MODEL` tranche, et
`VOICE_REALTIME_SURCHARGE_EUR` est à zéro : l'écart est entièrement pour nous.

**Un identifiant de modèle ne se déduit jamais** (CLAUDE.md, 6quinvicies).
Seuls les identifiants énumérés par l'API vivante existent ; un nom lu dans un
catalogue ou déduit d'un message d'erreur fait refuser l'assistant en entier.

## Qui y a droit

**Inclus à partir de Pro.** Sur Solo et Starter, il s'achète en option. Une
seule fonction répond, `superagentAllowed` (`config/plan-features.ts`) : le
forfait d'abord, l'option ensuite. Poser la question deux fois ailleurs est la
faute que ce dépôt a déjà payée six fois.

Le droit du forfait est une table dans le code. Le droit ACHETÉ est une colonne
sur la fiche client (`superagent_option`), et surtout pas une clé de
`vapiConfig` : ce JSON est celui que le PUT du portail fusionne, donc ce que le
client écrit lui-même. Un droit facturé qui vivrait là serait accordable depuis
le navigateur de celui qui doit le payer.

Le contrôle est posé à DEUX endroits, et il faut les deux. À l'écriture, le PUT
répond 403 en nommant le forfait : sans ça, l'écran dirait « enregistré » et
l'appelant entendrait l'autre moteur. À la résolution (`entitledTier`), parce
qu'un compte qui redescend de Pro à Starter perd le droit sans que rien ne
réécrive son réglage, et serait sinon servi par un moteur plus cher jusqu'à ce
qu'une facture le signale.

## Le prix, calculé et non supposé

`npm run voice:pricing` rend la feuille complète. Les tarifs fournisseurs
vivent dans `config/voice-economics.ts`, chacun avec sa source ; un tarif qui
change se corrige là et toute la grille suit.

Ce que ça donne aujourd'hui, par minute :

| | coût | Solo (0,396 € de recette) | Enterprise (0,258 €) |
|---|---|---|---|
| Classique | 0,094 € | 76 % de marge | 64 % |
| Superagent, `gpt-realtime-mini` | 0,110 € | 72 % | 57 % |
| Superagent, `gpt-realtime-2` | 0,651 € | **perte de 0,26 €** | **perte de 0,39 €** |

Le surcoût du mini est de **0,016 € la minute**. Inclure le Superagent coûte
donc 4 à 6 % du prix du forfait, au pire mois (toutes les minutes incluses
passées en temps réel). C'est pourquoi il est inclus haut de gamme sans que la
grille bouge.

Avec `gpt-realtime-2`, aucun prix d'option ne rattrape l'écart : le modèle
coûte plus qu'une minute ne rapporte, sur tous les paliers. **Le choix du
modèle n'est pas un réglage technique, c'est la décision tarifaire.**

**Le tarif du modèle par DÉFAUT (`gpt-realtime-2025-08-28`) n'a jamais été
relevé**, et le module refuse de calculer plutôt que d'inventer. Il se lit sur
le tableau de bord Vapi, qui est ce qui nous facture. Tant qu'il ne l'est pas,
le seul modèle dont l'économie est connue est le mini.

## Comment l'option se VEND : un forfait mensuel

**Le forfait est ce qui est vendu** : **+20 €/mois sur Solo, +40 €/mois sur
Starter** (`config/superagent-option.ts`), et l'équivalent annuel avec la même
remise de 20 % que les forfaits. Les deux montants sont ceux que
`flatOptionPriceEur` donne pour `gpt-realtime-mini-2025-12-15` (×3 sur le pire
mois) ; un test le vérifie, donc le prix affiché ne peut pas dériver de
l'arithmétique qui l'a produit.

Le supplément à la minute (`VOICE_REALTIME_SURCHARGE_EUR`) existe toujours et
reste à zéro. **Les deux ne se cumulent jamais** : un client qui paie l'option
au forfait n'est plus facturé à la minute, et un forfait qui inclut le
Superagent n'est facturé ni de l'un ni de l'autre. Sans ces deux garde-fous, la
ligne « Voix temps réel » et la ligne « Superagent » se retrouveraient sur la
même facture, sur une vraie carte, invisibles jusqu'au relevé.

### Une SECONDE LIGNE, pas un second abonnement

L'option s'ajoute à l'abonnement existant (`subscriptions.update`, prorata
calculé par Stripe). Un second abonnement produirait une seconde facture, une
seconde date de renouvellement et une seconde résiliation à ne pas oublier :
c'est exactement le montage qui a fait facturer deux fois un même client
(6undecies). Corollaire : Stripe refuse un abonnement dont les lignes n'ont pas
le même intervalle, donc l'option porte un prix annuel pour les clients
annuels, et la période est lue sur l'abonnement, jamais sur ce que nous en
avons retenu.

### Le droit se lit là où il est facturé

`superagent_option` est écrit par `customer.subscription.updated`, depuis les
lignes réellement portées par l'abonnement. Trois chemins convergent sans être
écrits trois fois : la case cochée à l'inscription, le bouton de la page
Facturation, et une ligne ajoutée ou retirée à la main dans le tableau de bord
Stripe. C'est aussi ce qui referme la porte de sortie : une option annulée, ou
emportée par un impayé, coupe le droit au prochain appel au lieu de laisser
tourner un moteur que plus personne ne paie.

Le changement de forfait réconcilie la ligne (`reconcileSuperagentOptionForPlan`) :
elle est RETIRÉE en montant vers Pro, qui l'inclut, et REPRICÉE entre Solo et
Starter, qui n'ont pas les mêmes minutes incluses.

### Ce qui INTERDIT la vente

`optionViability` refuse d'ouvrir la vente dans deux cas, et le refus nomme les
deux sorties :

- un modèle dont le tarif rendrait le forfait déficitaire (`gpt-realtime-2` :
  un Solo coûterait 139 € pour une option vendue 20 €) ;
- un modèle dont le tarif n'a **jamais été relevé**, ce qui est le cas du
  défaut `gpt-realtime-2025-08-28`.

Donc, en l'état, **la vente est fermée tant que `VOICE_REALTIME_MODEL` n'est pas
posé sur `gpt-realtime-mini-2025-12-15`** (ou tant que le tarif du défaut n'est
pas lu sur le tableau de bord Vapi et posé dans `REALTIME_RATES`).
`npm run voice:pricing` affiche le verdict en toutes lettres.

## Poser un niveau

```
npm run voice:tier                                              # l'état de la flotte
npm run voice:tier -- --email=a@b.com --tier=superagent         # simulation
npm run voice:tier -- --email=a@b.com --tier=superagent --confirm
npm run voice:tier -- --email=a@b.com --tier=auto --confirm     # retire le choix
npm run voice:tier -- --email=a@b.com --option=on --confirm     # vend l'option
```

Sans argument, il liste le niveau ET le droit de chaque client. Poser
« superagent » sur un client qui n'y a pas droit est REFUSÉ plutôt qu'écrit :
le réglage serait ramené au classique à la résolution, et l'écran mentirait.

Le script fait les **trois** gestes, et il faut les trois : écrire le champ,
vider le cache de profil, resynchroniser l'assistant distant. Écrire seulement
le champ ne change rien à l'appel suivant : le profil est servi depuis un cache,
et l'assistant enregistré garde la configuration figée à la dernière
synchronisation. Ces trois gestes vivent dans `applyVoiceTier`
(`services/voice/apply-voice-tier.ts`), partagé avec le portail : écrits deux
fois, ils divergeraient, et l'oubli du troisième est le mode d'échec que ce
dépôt a payé sept fois.

`--option=on` ne pose plus le droit à la main quand le client a un abonnement :
il **vend la ligne chez Stripe**, prorata compris. C'est obligé, puisque
`customer.subscription.updated` réécrit `superagent_option` depuis les lignes
facturées : un droit posé en base serait retiré au premier événement suivant,
en silence. Un compte sans abonnement (créé à la main) ne reçoit jamais cet
événement, et pour lui seul la colonne reste la seule vérité.

`auto` laisse décider le réglage global `VOICE_SPEECH_TO_SPEECH`, qui est à
`off` : c'est le défaut de la flotte, et il ne bouge pas tant qu'un appel réel
n'a pas tranché.

**Une voix clonée prime sur le niveau.** Un client qui a enregistré sa voix
reste en Standard même réglé en Superagent : la voix d'OpenAI n'est pas une
montée en gamme quand c'est la sienne qu'il est venu chercher. L'audit affiche
cet écart au lieu de le corriger.

## Vérifier que le niveau a SERVI

```
npm run voice:audit
```

Ligne `niveau servi par l'assistant qui décroche`, dans la famille RÉGLAGES.
Elle lit l'assistant **distant** (le seul qui décroche sur une ligne dédiée) et
le compare au niveau que le profil dit devoir servir. Rouge = l'assistant ne
porte pas le niveau du client, et le levier est le script ci-dessus.

C'est la seule réponse à « est-ce que le superagent tourne vraiment ». Le
réglage en base ne le dit pas : ce dépôt a payé six fois le mode d'échec où un
réglage s'enregistre, l'écran dit enregistré, et l'appelant entend autre chose.

## Ce qui n'est pas fait, et qu'il ne faut pas supposer

- **Superagent n'a jamais été entendu sur un appel réel.** Le chemin est
  branché de bout en bout et validé par `npm run voice:validate` (six variantes,
  trois langues × deux moteurs), mais un mécanisme qui n'a jamais atteint un
  appel n'est pas une optimisation, c'est un risque qui dort. Le premier appel
  se passe avec `docs/SCRIPT-APPEL-TEST.md` et se lit à `voice:audit`.
- **L'option n'a jamais été achetée par un vrai client.** Le chemin existe des
  deux côtés (case à l'inscription, bouton sur la page Facturation) et il est
  testé, mais aucune ligne d'option n'a encore été créée chez Stripe. Le
  premier achat est aussi le premier objet Price créé par
  `resolveOptionPriceId` : vérifier alors qu'il porte bien 20 € (ou 40 €) dans
  le tableau de bord, et surtout **ne pas créer ce produit à la main**, c'est
  le geste qui a produit le 1297 € de 6duodecies.
- **La vente est FERMÉE tant que `VOICE_REALTIME_MODEL` vaut le défaut.** Voir
  « Ce qui interdit la vente » plus haut : c'est une variable d'environnement,
  pas un déploiement.
- **Les curseurs de latence ne sont pas préréglés par niveau.** Ils se touchent
  après un relevé, jamais avant : un seuil posé à l'aveugle dans une table a
  l'air d'une décision.

## Après un déploiement qui touche l'assistant

```
npm run voice:validate            # POSTe les six variantes chez Vapi, puis les supprime
npm run voice:resync -- --confirm # repose la configuration sur les assistants distants
```

Un champ inconnu ne dégrade pas un appel : il fait refuser l'assistant entier,
et toute la flotte tombe d'un coup.
