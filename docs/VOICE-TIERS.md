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

## Poser un niveau

```
npm run voice:tier                                              # l'état de la flotte
npm run voice:tier -- --email=a@b.com --tier=superagent         # simulation
npm run voice:tier -- --email=a@b.com --tier=superagent --confirm
npm run voice:tier -- --email=a@b.com --tier=auto --confirm     # retire le choix
```

Le script fait les **trois** gestes, et il faut les trois : écrire le champ,
vider le cache de profil, resynchroniser l'assistant distant. Écrire seulement
le champ ne change rien à l'appel suivant : le profil est servi depuis un cache,
et l'assistant enregistré garde la configuration figée à la dernière
synchronisation.

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
- **Pas de bouton dans le portail client.** Le niveau se pose au script. Un
  bouton se posera quand le niveau aura tenu un appel réel, et il demandera de
  trancher le supplément d'abord.
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
