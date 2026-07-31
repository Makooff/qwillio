# Contrats

```
partenaire-fiduciaire.md   accord d'apport d'affaires avec un cabinet
pdf/                       les trois contrats client existants (Starter, Pro, Enterprise)
```

## Quel document pour quel cas

| Situation | Document |
|---|---|
| Un client s'inscrit seul sur le site | CGU et CGV en ligne, acceptées à l'inscription (`frontend/src/pages/legal/Terms.tsx`) |
| Un client signé au téléphone | Le PDF du palier correspondant, dans `pdf/` |
| Un cabinet qui apporte des clients | `partenaire-fiduciaire.md` |
| Un client qui demande un engagement RGPD écrit | À rédiger : accord de traitement des données. **Manquant, et un fiduciaire le demandera.** |
| Un client qui demande un engagement de disponibilité | `frontend/src/pages/legal/Sla.tsx` |

## Ce qui doit rester aligné

Les contrats contiennent des montants et des durées. Ils doivent dire la même
chose que le produit, sinon c'est le contrat qui fait foi et c'est toi qui perds :

- **Prix** : `backend/src/config/plans.ts` (99 / 249 / 599 / 1290 €, à la minute)
- **Essai** : 7 jours, **carte demandée à l'inscription**
- **Résiliation** : au mois, en un clic depuis le dashboard
- **Annuel** : engagement 12 mois, remise de 20 %

Les PDF de `pdf/` datent d'avant le passage à la facturation à la minute et
d'avant le raccourcissement de l'essai. **À refaire avant de les envoyer à un
client.** Ils portent encore l'ancienne logique par appels.

## À produire

Par ordre d'urgence pour vendre à des cabinets comptables :

1. **Accord de traitement des données (RGPD)**. Un fiduciaire traite des données
   de ses propres clients ; il ne signera pas sans. C'est le premier document
   qu'il demandera, et ne pas l'avoir arrête la vente.
2. **CGV à jour**, alignées sur la facturation à la minute.
3. **Contrats client refaits**, en euros, avec les minutes incluses et le
   dépassement par minute.
