# Obtenir un numéro belge — mode d'emploi (13/08/2026)

## Ce qu'il faut comprendre avant de commencer

**Le numéro belge n'est pas un blocage fonctionnel.** Le produit marche par
renvoi d'appel : le client compose `*21*NOTRE_NUMÉRO#` sur sa ligne, et
l'appelant continue de composer **le numéro du client**. Notre numéro n'est
jamais publié ni composé par personne.

C'est un sujet de **coût et de crédibilité** :

- quand un client belge renvoie sa ligne vers un numéro américain, **c'est son
  opérateur à lui** qui facture la jambe internationale, souvent 0,10 à 0,50 €
  la minute. Sur 300 appels par mois, ça mange sa marge et ça détruit
  l'argument commercial ;
- en démonstration, montrer un numéro américain affaiblit le discours.

Conclusion : on peut vendre et démontrer sans, on ne peut pas passer à
l'échelle avec.

**Pourquoi l'achat automatique ne suffit pas.** `autoProvisionNumber` achète
via le compte Twilio **de Vapi**, qui ne délivre que des numéros de son pays.
Les opérateurs belges exigent qu'un numéro soit rattaché à une adresse belge
dans un dossier réglementaire, et ce dossier se dépose dans **notre** compte
Twilio. D'où la marche à suivre ci-dessous : acheter chez nous, puis confier à
Vapi.

---

## Étape 1 — Choisir le type de numéro ⏱️ 1 min

| Type | Contrainte d'adresse | Recommandation |
|---|---|---|
| **Géographique** (02 Bruxelles, 03 Anvers, 09 Gand…) | Adresse **dans la zone du préfixe**. Une adresse liégeoise n'ouvre pas droit à un 02 | Seulement si ton adresse est dans la bonne zone ET que tu vises cette ville |
| **National** | Adresse **n'importe où en Belgique** | ✅ **Le bon choix.** Aucune contrainte de zone, et tes clients sont dans tout le pays |
| **Mobile** | Adresse en Belgique | Inutile ici : personne ne compose ce numéro |

**Prends un numéro national.** Une boîte postale n'est jamais acceptée, quel
que soit le type.

## Étape 2 — Réunir les pièces ⏱️ 10 min

Pour une entreprise :

- ☐ **Extrait BCE** (Banque-Carrefour des Entreprises / KBO). Téléchargeable
  gratuitement sur le site du SPF Économie avec ton numéro d'entreprise.
- ☐ **Justificatif d'adresse** au nom de l'entreprise : facture d'énergie,
  avertissement-extrait de rôle, quittance de loyer ou acte de propriété.
- ☐ **Pièce d'identité** du représentant (carte d'identité ou passeport).

Twilio demande aussi l'identité de l'**utilisateur final** du numéro. Ici c'est
**Qwillio**, pas le client : le numéro est de l'infrastructure, il n'est ni
publié ni composé, et c'est notre plateforme qui décroche. Un dossier suffit
donc pour tous les numéros, il n'en faut pas un par client.

## Étape 3 — Déposer le dossier chez Twilio ⏱️ 15 min + délai d'examen

1. Console Twilio → **Phone Numbers** → *Regulatory Compliance* → **Bundles**.
2. **Create a new Bundle** : pays `Belgium`, type de numéro `National`,
   utilisateur final `Business`.
3. Renseigne l'entité (nom légal, numéro BCE, adresse) et téléverse les pièces.
4. Soumets. Twilio examine, en général sous quelques jours ouvrés.

⚠️ N'achète rien avant que le bundle soit **approuvé** : un achat sans dossier
valide est rejeté, et depuis 2025 les dossiers belges incomplets passent
directement en « Rejected ».

## Étape 4 — Acheter le numéro ⏱️ 2 min

Console Twilio → **Phone Numbers** → *Buy a number* → Belgium → cocher
**Voice** → choisir un numéro national → associer le bundle approuvé → acheter.

Note le numéro au format **E.164** : `+32…`, sans espaces.

## Étape 5 — Le confier à Vapi ⏱️ 1 min

Deux variables doivent être posées dans Render, celles de **ton** compte
Twilio (Console → *Account Info*) :

```
TWILIO_ACCOUNT_SID=AC…
TWILIO_AUTH_TOKEN=…
```

Puis, une seule commande. Il te faut le `clientId` (rendu par
`test-activate-client`) et l'`assistantId` du client (visible dans la console
Vapi, ou en base dans `Client.vapiAssistantId`) :

```bash
curl -X POST https://qwillio.onrender.com/api/admin/attach-number \
  -H "x-admin-secret: TON_SECRET" -H "Content-Type: application/json" \
  -d '{"clientId":"…","assistantId":"…","number":"+32XXXXXXXXX","label":"Ligne principale BE"}'
```

La commande **refuse** d'attribuer un numéro déjà pris par un autre client :
un numéro entrant appartient à un seul client, et en recopier un rendrait les
deux injoignables. Elle n'écrit rien en base si Vapi refuse le numéro, pour ne
pas annoncer une ligne que le routage entrant ne trouvera jamais.

## Étape 6 — Vérifier ⏱️ 2 min

1. Appelle le numéro belge depuis ton téléphone : l'agent doit décrocher en se
   présentant comme assistant IA.
2. Vérifie dans la console Vapi que le numéro apparaît bien, rattaché au bon
   assistant.
3. Fais le test complet du renvoi : compose `*21*+32XXXXXXXXX#` sur une ligne
   de test, appelle cette ligne, et vérifie que l'agent décroche.

---

## Récapitulatif

| # | Action | Durée |
|---|---|---|
| 1 | Choisir « national » | 1 min |
| 2 | Extrait BCE + justificatif d'adresse + pièce d'identité | 10 min |
| 3 | Déposer le bundle Twilio | 15 min + examen |
| 4 | Acheter le numéro | 2 min |
| 5 | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` dans Render, puis `attach-number` | 3 min |
| 6 | Appel de vérification + test de renvoi | 2 min |

Le seul délai non compressible est l'examen du dossier par Twilio. Dépose-le
en premier, le reste suit en une demi-heure.
