# Pourquoi aucun appel n'est enregistré

**Diagnostic du 3 octobre 2026, sur l'appel réel de 16h05.**

## Le constat

L'appel du 3 octobre a produit une réservation correcte
(`2026-10-06 19:00`, 4 couverts) et un transcript complet. Le worker a bien
annoncé « Cet appel est enregistré ». Et pourtant :

- **0 ligne** dans les logs Render du worker qui parle d'enregistrement
- **0 enregistrement** chez Twilio
  (`GET /2010-04-01/Accounts/{sid}/Recordings.json` → `"recordings": []`)
- Le portail n'affiche aucun lecteur audio

La notice est dite, l'acte n'a jamais lieu. C'est le pire des deux : l'appelant
est informé d'un enregistrement qui n'existe pas.

## La cause : le trunk SIP a disparu

L'enregistrement démarre par appel, pas par trunk. La chaîne complète :

```
1. Twilio reçoit l'appel et pose l'en-tête SIP `X-Twilio-CallSid`
2. LiveKit le recopie en attribut `sip.h.x-twilio-callsid`
3. `_sid_twilio()` (agent.py:325) le lit → `twilio_call_sid`
4. Le worker l'envoie au pont : `POST /calls/start { twilioCallSid }`
5. routes/voice-core.routes.ts:220 démarre l'enregistrement via
   `twilioRecordingService.demarrer(sid)`
6. Sans SID, l'étape 4 devient `null` et **rien ne démarre, sans erreur**
```

Le code fait exactement ce qu'il doit : `docs/SIP.md` explique que sans SID
« le pont ne démarre pas d'enregistrement, et c'est le bon défaut ».

Le problème est à l'étape 1. **Il n'y a plus de trunk SIP sur le compte :**

| Vérification | Résultat |
|---|---|
| `GET /v1/Trunks` (défaut, Dublin, IE1) | **0 trunk** |
| `GET /v1/Trunks/TK29294d7ef9c0949f9eebe659be0ad6d8` | **404 not found** |
| `trunk_sid` du numéro `...6690` | **null** |
| `voice_url` du numéro `...6690` | `https://api.vapi.ai/twilio/inbound_call` |

`docs/SIP.md:86` documente ce trunk comme « **FAIT le 23/09/2026** », rattaché
au numéro `...8033`. Il n'existe plus. Le numéro qui a servi à l'appel
(`...6690`) n'y a jamais été rattaché : il pointe vers Vapi.

Sans SIP, Twilio ne pose aucun en-tête `X-Twilio-CallSid`. `_sid_twilio()` rend
`""`, et le pont saute silencieusement l'enregistrement.

## Ce qui marche malgré tout

Le reste de la chaîne est intact et l'appel a été traité de bout en bout :

- Le transcript arrive (10 tours, `arrets_pour_rien: 0`, `reprises: 0`)
- Le rendez-vous est écrit : `rendez-vous 2026-10-06 19:00 pour Matthieu Polle`
- La lecture des créneaux occupés fonctionne : l'agent a vu que 20h était pris
  et a proposé 19h (`16:06:21`)

Vapi assure le transport à la place du trunk. C'est pour ça que tout le reste
fonctionne et que seul l'enregistrement manque.

## Deux chemins pour réparer

**A. Recréer le trunk SIP** (ce que la doc décrit)

Suivre `docs/SIP.md` section 4, avec `.\\sip.ps1 all`. Il faut ensuite
**rattacher le numéro au trunk** — c'est l'étape qui a été sautée : un numéro
dont `trunk_sid` est `null` n'envoie rien vers le trunk, même si celui-ci
existe. Et il faut que le numéro soit en **région IE1**, pas US1
(`docs/SIP.md` section 4, avertissement sur la région du numéro).

**B. Accepter l'absence d'enregistrement**

L'enregistrement n'est pas exigé par la vérification Google. Le produit sait
le dire : `shouldRecord()` coupe la notice quand l'enregistrement est refusé.
**Mais dans l'état actuel la notice est dite sans acte** — c'est le seul point
intenable en l'état, parce qu'annoncer un enregistrement qui n'a pas lieu est
une faute, pas une lacune.

Tant que A n'est pas fait, `VC_RECORDING` devrait être **`false`** pour que la
notice cesse d'être prononcée. Une notice sans enregistrement est pire que pas
de notice du tout.

## Ce qui n'est PAS en cause

- Les 4 variables `TWILIO_TRUNK_*` sont bien présentes sur Render (vérifié).
- `VC_RECORDING=true` est bien positionné (vérifié).
- Le code du pont et du worker est correct : rien à corriger là.
  `twilioRecordingService.demarrer()` ne peut pas réussir sans SID, et le
  silence en cas d'échec est délibéré (« rien ici ne doit faire échouer un
  appel »).
