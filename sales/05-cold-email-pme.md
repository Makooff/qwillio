# Séquence email cold PME (Instantly)

Objectif : parler à des artisans, PME service, professions libérales — 200 envois par semaine, taux d'ouverture cible 45 %, taux de réponse cible 6 à 8 %.

**Warm-up Instantly obligatoire** : 7 jours avant le premier envoi. Sinon les emails partent en spam et la boîte est cramée.

**Fréquence** : 4 emails sur 14 jours, arrêt si le prospect répond ou book une démo.

---

## Email 1 — Jour 0 — L'accroche

**Objet** : `{{Prenom}}, 5 appels manqués = 15 000 EUR de CA`

```
Bonjour {{Prenom}},

Vu que vous êtes {{Metier}} à {{Ville}}, une question simple : combien d'appels vous ratez par semaine quand vous êtes en intervention ?

La moyenne du secteur en Belgique, c'est 5 par semaine. Multiplié par 52 semaines et un ticket moyen à 140 EUR, ça fait 36 400 EUR de chiffre qui part chez la concurrence chaque année.

Chez Qwillio on a construit une réceptionniste IA en français qui décroche à votre place, prend les rendez-vous dans votre agenda et vous envoie un SMS de résumé. 149 EUR par mois, premier mois offert sans carte.

Pas de démo à caler pour l'instant : est-ce que ce chiffre de 5 appels ratés par semaine est réaliste chez vous, ou vous êtes plutôt à moins ?

Une réponse d'une ligne suffit.

{{Prenom_Fondateur}}
Fondateur Qwillio
```

Bonnes pratiques :
- Pas de lien vers le site dans email 1 (baisse la délivrabilité).
- Signature texte simple, pas d'image, pas de disclaimer légal.
- Personnalisation `{{Metier}}` et `{{Ville}}` non négociable, sinon marqué spam.

---

## Email 2 — Jour 3 — La preuve sociale

**Objet** : `Une menuiserie namuroise gagne 4 200 EUR de plus par mois`

```
{{Prenom}},

Petit follow-up. On a un client menuisier à Namur qui a exactement le même profil que vous : 8 collaborateurs, secteur service, jamais assez de mains pour décrocher.

Il a installé Qwillio en 15 minutes. Deux mois plus tard :
- 0 appel manqué
- 23 % d'appels transformés en RDV (contre 12 % avant)
- 4 200 EUR de CA supplémentaire par mois

Pour 149 EUR d'abonnement. C'est un ROI x 28.

Si vous voulez son témoignage vidéo, je vous envoie le lien. Vous pouvez aussi tester direct sur qwillio.com : premier mois offert, sans carte, résiliable en un clic.

{{Prenom_Fondateur}}
```

Bonnes pratiques :
- Un seul lien maximum (qwillio.com).
- Chiffres précis, pas de "beaucoup", "environ".
- Terminer par une action douce.

---

## Email 3 — Jour 7 — L'objection préemptée

**Objet** : `Est-ce que vos clients n'auront pas peur d'une IA ?`

```
{{Prenom}},

C'est la question qu'on me pose le plus souvent, alors je préfère la traiter à l'avance.

Réponse courte : en 2026, dans nos tests aveugles, 78 % des appelants ne distinguent plus une IA vocale moderne d'une réceptionniste humaine. Sur les 22 % qui la reconnaissent, la majorité dit qu'elle préfère : pas de mise en attente, pas de mauvaise journée, jamais fatiguée.

L'IA parle français natif avec accent belge (ou français si vous préférez). Elle interrompt, hésite, s'excuse quand c'est humain de le faire. Elle prend le RDV dans votre agenda et route les urgences vers votre portable.

Pour lever le doute, on a un numéro de démo à composer : + 32 [ton_numero_demo]. Vous parlez à Qwillio comme si vous étiez un client. 3 minutes.

{{Prenom_Fondateur}}
```

Bonnes pratiques :
- Traiter l'objection avant qu'elle ne bloque le prospect.
- Le numéro de démo est le meilleur outil de conversion, mieux qu'un lien.
- Pas d'appel à l'action commercial dans cet email : celui qui compose est déjà convaincu.

---

## Email 4 — Jour 14 — Le stop

**Objet** : `Je vous laisse tranquille`

```
{{Prenom}},

Dernier message pour ne pas encombrer votre boîte.

Si vous voulez tester Qwillio, le lien direct : qwillio.com (premier mois offert, sans carte).

Si le sujet ne vous intéresse pas aujourd'hui, aucun souci. Je vous relance dans 3 mois. Vous pouvez répondre "stop" et je vous sors définitivement de mes contacts.

Merci pour votre temps.

{{Prenom_Fondateur}}
```

Bonnes pratiques :
- Le "je vous laisse tranquille" convertit paradoxalement bien (10 à 15 % des réponses arrivent sur cet email).
- Toujours proposer une porte de sortie explicite (RGPD + éthique + délivrabilité).

---

## Variables Instantly à préparer

| Variable | Source | Exemple |
|---|---|---|
| `{{Prenom}}` | prospects-pme.csv, colonne `contact_prenom` | Marc |
| `{{Metier}}` | prospects-pme.csv, colonne `secteur` | plombier |
| `{{Ville}}` | prospects-pme.csv, colonne `ville` | Namur |
| `{{Prenom_Fondateur}}` | statique | [ton prénom] |

Si une variable est vide, Instantly envoie l'email quand même mais casse la personnalisation : les prospects incomplets doivent être filtrés avant import.

## Métriques à suivre

- Taux d'ouverture email 1 : cible > 45 %.
- Taux de réponse cumulé sur les 4 emails : cible > 6 %.
- Taux de démo posée sur les répondants : cible > 25 %.

Si les taux d'ouverture chutent sous 30 %, warm-up refroidi : arrêter la campagne, faire une pause de 3 jours, relancer un warm-up de 5 jours avant de reprendre.
