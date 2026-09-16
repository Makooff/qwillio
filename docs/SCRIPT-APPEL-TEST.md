# Script d'appel test : tout en deux appels

Deux appels, cinq minutes en tout, qui font passer l'agent par TOUT ce qui
compte : accueil, horaires, hors-base, refus propres (jour fermé, hors
horaires, date passée, nom manquant), agenda, nom épelé, réservation, SMS,
interruption, bruit, reconnaissance, déplacement, transfert. Chaque ligne dit
ce que l'agent doit faire ; `voice:audit` mesure le reste.

Avant : Render déployé (le dernier commit dans l'en-tête des journaux), et
`npm run voice:resync -- --confirm` si un réglage d'assistant a bougé.

## Appel 1 : appelant INCONNU, réservation (environ 3 min)

Depuis un numéro que la base ne connaît pas (ou efface ton numéro dans
Rendez-vous, Appels et Leads avant). C'est le cas d'un vrai prospect.

| # | Tu dis | Il doit |
|---|---|---|
| 1 | Rien. Écoute l'accueil en entier. | Se présenter comme IA, nommer l'entreprise, dire la notice d'enregistrement |
| 2 | « Vous êtes ouverts le samedi ? » | Les horaires du portail, pas 9 h-17 h inventé |
| 3 | « Vous prenez la mutuelle Partenamut ? » (une question que la base ne couvre PAS) | « Je ne sais pas », proposer de prendre le message, ne rien inventer |
| 4 | « Je voudrais un rendez-vous dimanche. » | Refuser en nommant le prochain jour ouvert |
| 5 | « Alors jeudi à 7 h du matin. » | Refuser en nommant la fenêtre d'ouverture |
| 6 | « Jeudi matin alors, ce que vous avez. » | UN créneau à la fois, avec le jour de semaine |
| 7 | « Le premier, c'est bien. » | Demander prénom ET nom de famille AVANT de réserver |
| 8 | « Oui. » (sans donner de nom) | Redemander le nom, ne pas réserver |
| 9 | « Jean-Luc de la Forge. » | Demander d'épeler le nom de famille |
| 10 | « D, E, L, A, F, O, R, G, E », lettre par lettre | Relire les lettres, pas « Delaforde » |
| 11 | « C'est ça. » | Dire « c'est réservé » SEULEMENT après l'outil, nommer le jour, annoncer le SMS |
| 12 | Coupe-le pendant qu'il confirme : « Pardon, c'est à quelle adresse ? » | S'arrêter, répondre, reprendre |
| 13 | Tape sur la table pendant qu'il parle, sans parler | NE PAS s'arrêter |
| 14 | « Merci, au revoir. » | Saluer, raccrocher lui-même |

Vérifie sur ton téléphone : SMS reçu avec le lien agenda. Sur le portail :
Rendez-vous (jeudi, le nom épelé), Leads (la fiche), Appels (le résumé).

## Appel 2 : appelant CONNU, déplacement, transfert (environ 2 min)

Même numéro, dix minutes après.

| # | Tu dis | Il doit |
|---|---|---|
| 1 | « Bonjour, c'est encore moi. » | Te nommer « probablement Jean-Luc de la Forge », sans faire épeler |
| 2 | « Je dois déplacer mon rendez-vous de jeudi. » | Retrouver la réservation du premier coup, proposer un autre créneau |
| 3 | « Vendredi, même heure. » | Déplacer SANS créer un second rendez-vous, renvoyer un SMS |
| 4 | « Et remettez-le à samedi dernier. » | Refuser une date passée en disant la date du jour |
| 5 | « Non, laissez vendredi. Je voudrais parler à quelqu'un. » | Transférer sans discuter (ton téléphone sonne si le numéro de transfert est posé), sinon proposer un message |
| 6 | Raccroche. | |

Vérifie : Rendez-vous ne montre QU'UN rendez-vous pour ce nom, sur vendredi.
Deux lignes = défaut à signaler.

## Ce que tu envoies après CHAQUE appel

Sur le shell Render :

```
npm run voice:audit
```

Colle le bloc entier (de « AUDIT D'APPEL » à « À FAIRE »). Il dit pour cet
appel si ça a marché ligne par ligne, où part le temps, et quel curseur
toucher. Pour un appel plus ancien : `npm run voice:audit -- --call=<vapiCallId>`
(l'identifiant est dans `voice:doctor`, section « Derniers appels »).

Ajoute deux phrases de ressenti : « il a parlé par-dessus moi à la ligne 12 »,
« il a mis trois secondes à la ligne 6 ». L'audit mesure, toi tu entends.
