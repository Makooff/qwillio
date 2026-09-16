# Script d'appel test : quoi dire, dans quel ordre, et quoi m'envoyer après

**Deux appels, cinq minutes en tout**, qui font passer l'agent par tout ce qui
compte : accueil, question métier, refus propres, agenda, nom épelé,
réservation, SMS, interruption, bruit, puis appelant connu, déplacement et
transfert. Les refus ne font pas un troisième appel : ils sont placés là où ils
tombent dans une vraie conversation.

Avant : Render déployé (le dernier commit dans l'en-tête des journaux), et
`npm run voice:resync -- --confirm` passé si un réglage d'assistant a bougé.

## Appel 1 : appelant INCONNU (environ 3 min)

Depuis un numéro que la base ne connaît pas (ou efface ton numéro dans
Rendez-vous puis Appels avant). C'est le cas d'un vrai prospect.

| # | Tu dis | Ce que ça teste | L'agent doit |
|---|---|---|---|
| 1 | Rien. Écoute l'accueil en entier. | Annonce IA, notice d'enregistrement, première phrase qui part | Se présenter comme IA, nommer l'entreprise, demander comment aider |
| 2 | « Vous êtes ouverts le samedi ? » | Horaires du portail dans le prompt | Les horaires enregistrés, jamais 9 h-17 h inventé |
| 3 | « Vous prenez la mutuelle Partenamut ? » (une question que la base ne couvre pas) | Règle anti-invention | Dire qu'il ne sait pas, proposer de prendre le message |
| 4 | « Je voudrais un rendez-vous dimanche. » (un jour où c'est fermé) | Jour fermé | Refuser en nommant le prochain jour ouvert |
| 5 | « Alors jeudi à 7 h du matin. » | Heure hors fenêtre | Refuser en nommant la fenêtre d'ouverture |
| 6 | « Jeudi matin alors, ce que vous avez. » | Date relative, agenda, jour de semaine | Proposer UN créneau à la fois, avec le jour de semaine |
| 7 | « Le premier, c'est bien. » | Passage à la réservation | Demander prénom ET nom de famille AVANT de réserver |
| 8 | « Oui. » (sans donner de nom) | Nom manquant, nom bidon | Redemander le nom, ne rien réserver, ne pas raccrocher |
| 9 | « Jean-Luc de la Forge. » | Épellation demandée à un inconnu | Demander d'épeler le nom de famille |
| 10 | « D, E, L, A, F, O, R, G, E » (lettre par lettre) | Lecture des lettres | Relire les lettres, pas « Delaforde » |
| 11 | « C'est ça. » | `bookAppointment` avec nom complet | « C'est réservé » SEULEMENT après le retour de l'outil, nommer le jour, annoncer le SMS |
| 12 | Coupe-le pendant qu'il confirme : « Pardon, c'est à quelle adresse ? » | Interruption volontaire | S'arrêter, répondre, reprendre |
| 13 | Tape sur la table pendant qu'il parle, sans parler | Bruit ≠ parole | NE PAS s'arrêter |
| 14 | « Merci, au revoir. » | Fin propre | Saluer, raccrocher lui-même |

Vérifie : SMS reçu avec le lien agenda, et au portail Rendez-vous (jeudi, nom
épelé), Leads, Appels (le résumé).

## Appel 2 : appelant CONNU (même numéro, dix minutes après, environ 2 min)

| # | Tu dis | Ce que ça teste | L'agent doit |
|---|---|---|---|
| 1 | « Bonjour, c'est encore moi. » | Mémoire d'appelant par le numéro | Te nommer « probablement Jean-Luc de la Forge », sans faire épeler |
| 2 | « Je dois déplacer mon rendez-vous de jeudi. » | `lookupBooking` | Le retrouver du premier coup, proposer un autre créneau |
| 3 | « Vendredi, même heure. » | `rescheduleBooking` | Déplacer SANS créer un second rendez-vous, renvoyer un SMS |
| 4 | « Et remettez-le à samedi dernier. » | Date passée | Refuser en disant la date du jour |
| 5 | « Non, laissez vendredi. Je voudrais parler à quelqu'un. » | Transfert explicite | Transférer sans discuter, ou proposer un message si aucun transfert n'est posé |
| 6 | Raccroche. | | |

Vérifie : Rendez-vous ne montre QU'UN rendez-vous pour ce nom, sur vendredi.
Deux lignes = défaut à me signaler.

## Ce que tu m'envoies après chaque appel

Sur le shell Render :

```
npm run voice:audit
```

Colle le bloc entier, de « AUDIT D'APPEL » à « À FAIRE ». Il dit pour cet appel
si ça a marché ligne par ligne, où part le temps, et quel curseur toucher. Pour
un appel plus ancien : `npm run voice:audit -- --call=<vapiCallId>`
(l'identifiant est dans `voice:doctor`, section « Derniers appels »).

Ajoute deux phrases de ressenti : « il a parlé par-dessus moi à l'étape 12 »,
« il a mis trois secondes à l'étape 6 ». L'audit mesure, toi tu entends.

## Comparer les deux niveaux

Le même script sert aux deux. Pour mesurer Superagent contre Standard, il faut
les mêmes phrases dans le même ordre : deux souvenirs séparés d'un quart
d'heure ne se comparent pas.

```
npm run voice:tier -- --email=… --tier=superagent --confirm   # puis les deux appels
npm run voice:tier -- --email=… --tier=base --confirm         # puis les deux mêmes appels
```

Lire dans l'audit : la ligne `niveau servi par l'assistant qui décroche`
(vérifie que c'est bien l'autre moteur qui a décroché), puis `délai Vapi` et
`TOTAL`. Voir `docs/VOICE-TIERS.md` pour ce que Superagent perd en échange.
