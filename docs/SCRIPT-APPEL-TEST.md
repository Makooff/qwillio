# Script d'appel test : quoi dire, dans quel ordre, et quoi m'envoyer après

Un appel de trois à quatre minutes qui fait passer l'agent par TOUT ce qui compte :
accueil, reconnaissance, question métier, agenda, nom épelé, réservation, SMS,
interruption, bruit, fin. Chaque étape dit ce qu'elle teste et ce que l'audit
regardera. Un seul appel suffit si tu suis l'ordre.

Avant l'appel : Render déployé (le dernier commit dans l'en-tête des journaux),
`npm run voice:resync -- --confirm` passé si un réglage d'assistant a bougé.

## Version A : appelant INCONNU (à faire en premier)

Appelle depuis un numéro que la base ne connaît pas (ou efface ton numéro dans
Rendez-vous puis Appels avant). C'est le cas d'un vrai prospect.

| # | Tu dis | Ce que ça teste | L'agent doit |
|---|---|---|---|
| 1 | Rien. Écoute l'accueil en entier. | Annonce IA, notice d'enregistrement, première phrase qui part | Se présenter comme IA, nommer l'entreprise, demander comment aider |
| 2 | « Vous êtes ouverts le samedi ? » | Horaires du portail dans le prompt | Répondre avec les horaires enregistrés, pas 9 h-17 h inventé |
| 3 | « Vous prenez la mutuelle X ? » (une question que la base ne couvre PAS) | Règle anti-invention | Dire qu'il ne sait pas et proposer de prendre le message, jamais inventer |
| 4 | « Je voudrais un rendez-vous jeudi matin. » | Date relative, spéculation agenda, jour ouvert | Proposer UN créneau à la fois, avec le jour de semaine |
| 5 | « Le premier, c'est bien. » | Passage à la réservation | Demander prénom ET nom de famille AVANT de réserver |
| 6 | « Jean-Luc de la Forge. » | Épellation demandée à un inconnu | Demander d'épeler le nom de famille |
| 7 | Épelle : « D, E, L, A, F, O, R, G, E », en séparant les lettres | Lecture des lettres, relecture par l'agent | Relire les lettres, pas « Delaforde » |
| 8 | « Oui, c'est ça. » | `bookAppointment` avec nom complet | Dire « c'est réservé » SEULEMENT après, nommer le jour, annoncer le SMS |
| 9 | Pendant qu'il confirme, coupe-le : « Pardon, et c'est à quelle adresse ? » | Interruption volontaire (deux mots) | S'arrêter, répondre à l'adresse, reprendre |
| 10 | Fais du bruit sans parler (tape sur la table, une porte) pendant qu'il parle | Bruit ≠ parole | NE PAS s'arrêter |
| 11 | « Merci, au revoir. » | Fin propre | Saluer, raccrocher lui-même |

Vérifie sur ton téléphone : SMS reçu avec le lien agenda, et sur le portail :
Rendez-vous (le jour, le nom épelé), Leads (la fiche), Appels (le résumé).

## Version B : appelant CONNU (le même numéro, dix minutes après)

| # | Tu dis | Ce que ça teste | L'agent doit |
|---|---|---|---|
| 1 | « Bonjour, c'est encore moi. » | Mémoire d'appelant par le numéro | Te nommer « probablement Jean-Luc de la Forge », sans redemander d'épeler |
| 2 | « Je dois déplacer mon rendez-vous de jeudi. » | `lookupBooking` puis `rescheduleBooking` | Retrouver la réservation du premier coup, proposer un autre créneau, déplacer SANS créer un second rendez-vous |
| 3 | « Vendredi même heure. » | Déplacement | Confirmer le nouveau jour, renvoyer un SMS |
| 4 | « Je voudrais parler à quelqu'un. » | Transfert explicite | Transférer sans discuter (ton téléphone sonne si le numéro de transfert est posé), ou proposer un message si aucun transfert n'est configuré |
| 5 | Raccroche. | | |

Version B, après : Rendez-vous ne montre QU'UN rendez-vous pour ce nom, sur
vendredi. Deux lignes = défaut à me signaler.

## Version C : ce qui doit rater proprement (une fois)

- Réponds « oui » à « votre nom ? » sans donner de nom : l'agent doit
  redemander, jamais réserver.
- Demande « dimanche » (fermé) : il doit refuser en nommant le prochain jour ouvert.
- Demande « demain à 7 h » (hors horaires) : il doit nommer la fenêtre d'ouverture.
- Dis « samedi dernier » : il doit refuser une date passée en disant la date du jour.

## Ce que tu m'envoies après chaque appel

Sur le shell Render :

```
npm run voice:audit
```

Colle-moi le bloc entier (de « AUDIT D'APPEL » à « À FAIRE »). Il dit pour cet
appel si ça a marché ligne par ligne, où part le temps, et quel curseur toucher.
Pour un appel plus ancien : `npm run voice:audit -- --call=<vapiCallId>` (l'identifiant
est dans `voice:doctor`, section « Derniers appels »).

Ajoute deux phrases de ressenti : « il a parlé par-dessus moi à l'étape 9 »,
« il a mis trois secondes à l'étape 4 ». L'audit mesure, toi tu entends.
