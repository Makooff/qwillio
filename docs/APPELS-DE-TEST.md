# Les 4 appels de test à passer

But : mesurer la latence sur 5 appels réels (la règle du projet exige ≥5 avant
de toucher aux seuils) et couvrir les cas que les tests n'ont jamais vus.

**Ce qu'on mesure** : la ligne `latence appel` dans les logs Render du worker.
Elle donne `eou_p50` (l'attente de fin de tour), `llm_ttft_p50`, `tts_ttfb_p50`
et `total_p50`.

**Le chiffre du 3 octobre** : `total_p50 = 1010 ms`, dont `eou_p50 = 577 ms`.
L'objectif est sous 1000 ms, donc on est **au-dessus**. C'est la fin de tour qui
coûte le plus, pas le modèle.

---

## Appel 1 — Le cas nominal (déjà fait le 3 octobre)

Déjà mesuré : `total_p50 1010`, `eou_p50 577`, 10 tours.

**À refaire seulement si tu veux un second point de comparaison.** Le premier a
donné `rendez-vous 2026-10-06 19:00 pour Matthieu Polle`, 4 couverts.

---

## Appel 2 — Le créneau occupé (teste la lecture de l'agenda)

**Ce que ça prouve** : l'agent lit les créneaux déjà pris. C'est le point que la
vidéo Google doit montrer, et il est déjà passé une fois sans qu'on l'ait
programmé (l'appel du 3 octobre a vu que 20h était pris).

**Dis** :
> « Bonjour, je voudrais réserver une table mardi 6 octobre à vingt heures. »

**Attendu** : il refuse 20h et propose un autre créneau. Si l'ancienne
réservation de 20h a été supprimée entre-temps, recrée-la d'abord (voir en bas).

**Ce qu'on note** : le nombre de tours avant la réponse, et si l'aller-retour
agenda ajoute de la latence.

---

## Appel 3 — La phrase longue (teste la fin de tour)

**Ce que ça prouve** : `eou_p50` est le poste qui coûte le plus (577 ms sur
1010). Ce cas le stresse.

**Dis**, d'une seule traite :
> « Bonjour, j'aurais voulu savoir si vous avez encore de la place mardi soir
> vers dix-neuf heures trente pour quatre personnes, parce qu'on fête un
> anniversaire et on aimerait être tranquilles. »

**Attendu** : il attend que tu aies vraiment fini. S'il coupe, c'est le seuil
`VC_EOT_UNLIKELY_FR` (0.285) qui est trop bas ; s'il attend trop longtemps, il
est trop haut. **Ne rien changer avant d'avoir les 5 mesures.**

**Ce qu'on note** : le `eou_p50` de cet appel contre celui du nominal.

---

## Appel 4 — La correction en cours de route (teste la reprise)

**Ce que ça prouve** : l'agent corrige une info déjà donnée, sans reprendre tout
le rendez-vous à zéro. C'est là que les doublons de réservation apparaissent
d'habitude.

**Dis** :
> « Bonjour, une table pour deux personnes mardi soir... ah non, pardon, on sera
> finalement cinq. »

**Attendu** : il note **cinq**, pas deux, et ne crée **qu'un** rendez-vous.

**Ce qu'on note** : après l'appel, vérifier qu'il n'y a pas deux réservations
pour cette date.

---

## Appel 5 — La question hors réservation (teste la connaissance)

**Ce que ça prouve** : le menu et les horaires du restaurant remontent bien
jusqu'à l'agent. C'est le deuxième chemin de connaissance, celui qui est tombé
en panne le 10/09.

**Dis** :
> « Bonjour, c'est quoi vos heures d'ouverture le week-end, et vous avez des
> plats végétariens ? »

**Attendu** : il répond avec **tes vraies données**. S'il dit qu'il ne sait pas,
la connaissance n'arrive pas jusqu'au prompt.

**Ce qu'on note** : s'il a inventé une réponse (le pire cas) ou reconnu qu'il ne
savait pas.

---

## Après chaque appel

Donne-moi l'heure de l'appel, et je lis les logs Render pour en extraire la
latence et le transcript. C'est moi qui relève les chiffres, pas toi.

**Les 5 mesures** : appel 1 (fait), puis 2, 3, 4 et 5. Ensuite on saura si
`VC_EOT_UNLIKELY_FR` doit descendre de 0.285 vers ~0.22.

## Pour recréer la réservation qui bloque 20h

Si tu veux que l'appel 2 ait un créneau occupé et que celui du 3 octobre a
disparu :

```bash
curl -X POST "https://qwillio-eu.onrender.com/api/voice-core/bookings" \
  -H "x-api-key: $VOICE_CORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"59464bd0-ffb9-48bb-b0d8-93ffcf442f95","day":"2026-10-06","slot":"20:00","name":"Test Occupation","caller":"+32400000000","partySize":2}'
```

## Ce qui n'est PAS testé par ces appels

L'enregistrement. Il ne peut pas marcher : il n'y a **aucun trunk SIP** sur le
compte (voir `docs/POURQUOI-PAS-D-ENREGISTREMENT.md`). Ces appels passeront par
Vapi, et Twilio ne posera jamais l'en-tête `X-Twilio-CallSid` dont dépend
l'enregistrement.

**Donc** : si l'agent annonce « cet appel est enregistré », c'est encore faux
jusqu'à ce que le trunk soit recréé. Voir la section « Deux chemins » de ce
diagnostic.
