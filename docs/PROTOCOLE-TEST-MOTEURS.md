# Protocole de test des deux moteurs vocaux

**But** : décider lequel des deux moteurs Qwillio vend par défaut, et à quel prix
l'autre se vend en option. Une demi-heure, deux appels, une décision.

Ce document sert aussi de trace : les résultats se consignent en bas.

---

## Pourquoi ce test existe

`fleetMetrics` affiche `calls: 0` depuis la mise en production. Rien n'a donc
été mesuré : ni la latence, ni le coût par minute, ni la qualité en français.
Trois décisions attendent ce chiffre :

1. **Le moteur par défaut.** Parole-à-parole (le modèle entend et répond en
   audio) ou chaîne classique (transcription, modèle, synthèse).
2. **Le prix de l'option.** `VOICE_REALTIME_SURCHARGE_EUR` vaut 0, donc l'option
   temps réel n'est pas vendue. Le fixer sans connaître l'écart de coût réel
   reviendrait à le tirer au sort.
3. **La marge.** La recette par minute incluse va de 0,258 € (Enterprise) à
   0,396 € (Solo). Si le temps réel coûte ce que la littérature annonce, les
   paliers hauts approchent le seuil de rentabilité sur la voix seule.

---

## Avant de commencer

- Portail client → **Réceptionniste IA** → section voix → **Moteur vocal**.
- Le mode se change par client, et prend effet au prochain appel (le cache de
  profil est invalidé à l'enregistrement).
- ⚠️ **Une voix clonée l'emporte sur ce réglage** : si le compte de test en a
  une, elle force le mode classique et le test ne compare rien. La retirer
  d'abord.
- Le même appel doit être joué **deux fois**, une fois par mode, avec le même
  scénario et si possible la même voix humaine.

Les appels de test du tableau de bord ne remplissent pas `fleetMetrics` (pas de
webhook de fin d'appel) et ne réservent jamais pour de vrai. Pour la mesure de
coût et de latence, il faut **de vrais appels entrants sur la ligne**.

---

## Les six moments

Choisis parce que ce sont exactement ceux où les deux architectures divergent.
Le reste d'un appel se ressemble trop pour départager quoi que ce soit.

| # | Ce que tu fais | Ce que tu observes |
|---|---|---|
| 1 | **Coupe-lui la parole** au milieu de sa phrase d'accueil | Elle s'arrête net, ou elle finit sa phrase par-dessus toi ? |
| 2 | **Donne un numéro de téléphone d'un trait**, puis demande-lui de le relire | Chiffre pour chiffre, ou approximatif ? |
| 3 | **Épelle un nom difficile** : Vandenbroucke, Nguyen, Bouchaïb | Orthographe exacte dans le résumé et le lead ? |
| 4 | **Demande un rendez-vous mardi matin** | Vérifie-t-elle la disponibilité **avant** de proposer, ou propose-t-elle puis vérifie ? |
| 5 | **Demande un prix**, si les consignes client l'interdisent | Tient-elle la consigne ou improvise-t-elle ? |
| 6 | **Demande un humain** | Transfère-t-elle avec un résumé, ou prend-elle les coordonnées ? |

Et à chaque tour, le **délai avant qu'elle réponde**, au ressenti. Pas besoin de
chronomètre : si tu te demandes si ça a marché, c'est trop long.

**Le point 4 est le plus important.** Une réceptionniste qui annonce un créneau
sans l'avoir vérifié produit des rendez-vous fantômes, et c'est le cœur de ce qui
est vendu.

---

## Ce qu'on lit après

```bash
curl -s https://qwillio.onrender.com/api/webhooks/vapi/health | jq .fleetMetrics
```

Deux chiffres comptent :

- **`cost.avgUsd`** : le coût réel par appel, tel que Vapi le facture. Divisé par
  la durée, c'est le coût à la minute, donc l'écart entre les deux moteurs, donc
  le plancher du prix de l'option.
- **`latency`** (P50 / P95 / P99, par étage) : l'objectif interne est 1,1 s
  voix-à-voix. Le P95 dit ce que vit un appelant malchanceux, et c'est lui qui
  fait raccrocher.

---

## Comment conclure

- Si le classique tient les points **2, 3 et 4** et que le temps réel les rate,
  la question est réglée, même s'il sonne mieux. Une voix magnifique qui note un
  mauvais numéro ne se vend pas deux fois.
- S'ils se valent sur 2, 3 et 4, prendre le **temps réel** : la latence et les
  interruptions font la différence à l'oreille du client final, et c'est ce
  qu'il achète.
- Le prix de l'option se fixe **au-dessus de l'écart de coût mesuré**, jamais en
  dessous, sinon l'option est vendue à perte.

---

## Relevé

À remplir pendant les appels, puis à commiter.

**Date** : ____ **Compte de test** : ____ **Langue** : ____

| # | Temps réel | Classique |
|---|---|---|
| 1 Interruption | | |
| 2 Numéro relu | | |
| 3 Nom épelé | | |
| 4 Vérif. avant proposition | | |
| 5 Consigne de prix tenue | | |
| 6 Transfert humain | | |
| Délai ressenti | | |

**`cost.avgUsd`** : temps réel ____ · classique ____
**`latency` P50 / P95** : temps réel ____ · classique ____

**Décision** : moteur par défaut ____ · `VOICE_REALTIME_SURCHARGE_EUR` ____
