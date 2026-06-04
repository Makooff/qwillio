# Email cold outreach — copy, subjects, UTMs

## Stratégie

Vidéo en YouTube unlisted (lien dans email) + thumbnail clickable. Pas de pièce jointe MP4 (trop lourd, déclenche filtres antispam). Backup Loom au cas où YouTube est bloqué dans certaines boîtes corporate.

CTA principal : `qwillio.com/register?utm_source=cold_email&utm_campaign=video_v1&utm_medium=email&utm_content=cta_button`

CTA secondaire (lien vidéo) : `youtu.be/[ID]?utm_source=cold_email&utm_campaign=video_v1`

## Subject lines A/B (3 variantes)

| ID | Subject | Style | Open rate cible |
|---|---|---|---|
| A | `[Prénom], 35% de vos appels partent au concurrent` | Statistique choc, personnalisé | ≥ 35% |
| B | `Vous perdez ~3h/jour à répondre au téléphone ?` | Question pain point, calcul implicite | ≥ 32% |
| C | `Marie ne dort jamais (60 sec de vidéo)` | Curiosité + transparence durée | ≥ 30% |

**Preview text** (apparait à droite du subject sur Gmail/Outlook) :
- A → "Découvrez comment Bright Dental a stoppé la fuite. 60 secondes."
- B → "Marie répond à votre place. Premier mois offert. Vidéo de 60 secondes."
- C → "Et elle décroche en moins d'une seconde. Toujours. Voir comment →"

## Body — Variante principale (V1, longueur 80 mots)

```
Bonjour [Prénom],

J'ai fait une courte vidéo (60 secondes) pour vous montrer comment des [niche : cabinets dentaires / garages / restaurants] comme le vôtre arrêtent de perdre des clients à cause des appels manqués.

▶ Voir la vidéo : [LIEN_YOUTUBE]

En 2 minutes, vous pouvez activer une réceptionniste IA qui répond à 100% de vos appels, prend les rendez-vous dans votre calendrier et qualifie vos prospects, 24h/24.

Premier mois entièrement offert, sans carte bancaire.

→ qwillio.com/register

Bien à vous,
[Votre nom]
Qwillio

PS : Si vous préférez voir une démo en direct, répondez "démo" à ce mail.
```

## Body — Variante courte (V2, 50 mots, plus direct)

```
Bonjour [Prénom],

35% des appels en TPE/PME restent sans réponse. Chaque appel manqué = un client chez le concurrent.

60 secondes pour voir comment l'éviter :
▶ [LIEN_YOUTUBE]

Activation 2 minutes, premier mois offert, sans carte.

→ qwillio.com/register

[Votre nom]
```

## Body — Variante narrative (V3, 110 mots, plus émotionnelle)

```
Bonjour [Prénom],

Sarah Chen dirige un cabinet dentaire à Lyon. Avant Qwillio, elle perdait 4 patients par semaine à cause d'appels manqués entre deux consultations.

Aujourd'hui, "Marie" — sa réceptionniste IA — décroche en moins d'une seconde, prend les rendez-vous dans son calendrier, et lui transfère uniquement les vraies urgences.

Ses patients pensent que Marie fait partie de l'équipe.

J'ai fait une vidéo de 60 secondes qui montre comment elle fonctionne. Je pense que ça peut intéresser [nom du business du prospect] :

▶ [LIEN_YOUTUBE]

Premier mois offert, sans carte. Activation en 2 minutes.

→ qwillio.com/register

[Votre nom]
Qwillio
```

## HTML version (pour clients qui supportent)

```html
<!DOCTYPE html>
<html>
<body style="font-family: 'Outfit', 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; color: #1d1d1f; line-height: 1.55;">

  <p>Bonjour [Prénom],</p>

  <p>J'ai fait une courte vidéo (60 secondes) pour vous montrer comment des [niche] comme le vôtre arrêtent de perdre des clients à cause des appels manqués.</p>

  <a href="[LIEN_YOUTUBE]" style="display: block; max-width: 480px; margin: 24px auto;">
    <img src="[THUMBNAIL_URL]" alt="Voir la vidéo Qwillio" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12);">
  </a>

  <p>En 2 minutes, vous pouvez activer une réceptionniste IA qui répond à 100% de vos appels, prend les rendez-vous dans votre calendrier et qualifie vos prospects, 24h/24.</p>

  <p><strong>Premier mois entièrement offert, sans carte bancaire.</strong></p>

  <p style="text-align: center; margin: 32px 0;">
    <a href="https://qwillio.com/register?utm_source=cold_email&utm_campaign=video_v1&utm_medium=email&utm_content=cta_button"
       style="background: #6366f1; color: white; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: 600;">
      Créer mon compte →
    </a>
  </p>

  <p>Bien à vous,<br>[Votre nom]<br>Qwillio</p>

  <p style="font-size: 12px; color: #6a6a78;">
    PS : Si vous préférez voir une démo en direct, répondez "démo" à ce mail.
  </p>

</body>
</html>
```

## Thumbnail email (preview clickable)

Image JPEG 480×270 px (16:9), <100 KB.

Composition :
- Background : frame du clip à 00:54 (avatar + bouton CTA)
- Overlay play button blanc semi-transparent au centre (cercle 80px)
- Texte top-left : "60 sec." en Outfit Bold 24px blanc
- Texte bottom : "Marie ne dort jamais." Outfit Black 36px

Hébergement : upload sur Cloudinary, Imgur ou ton propre CDN. URL collée dans le `<img src=...>`.

## UTMs à utiliser partout

| Lien | UTM string |
|---|---|
| YouTube video link | `?utm_source=cold_email&utm_campaign=video_v1` |
| Register CTA button | `?utm_source=cold_email&utm_campaign=video_v1&utm_medium=email&utm_content=cta_button` |
| Demo reply CTA | `?utm_source=cold_email&utm_campaign=video_v1&utm_content=demo_request` |

Tracking GA4 → Events → `utm_campaign=video_v1`. Surveiller :
- Sessions / source = `cold_email`
- Conversions register / source = `cold_email`
- Conversion rate (sessions → register)

## Outils d'envoi recommandés

- **Lemlist** ($59/mois) — Le meilleur pour cold outreach FR. Personnalisation avancée, A/B testing natif.
- **Smartlead** ($39/mois) — Plus économique, scale facile.
- **Mailmeteor** (gratuit jusqu'à 75 emails/jour via Gmail) — OK pour les premiers tests.

**Avant d'envoyer en batch** :
1. Warmup ton domaine email pendant 2 semaines (Lemwarm, Mailwarm) sinon tu finis en spam
2. Vérifie SPF/DKIM/DMARC sur ton DNS (sinon → spam Gmail)
3. Limite : 50 mails/jour les 2 premières semaines, puis monte progressivement
4. Personnalise au minimum : `[Prénom]`, `[Nom entreprise]`, `[Niche]`

## Sequence (3 emails sur 9 jours)

| Jour | Email | Variante |
|---|---|---|
| J0 | Initial | V1 ou V3 narrative |
| J3 | Bump si pas d'ouverture | V2 courte, subject "PS sur le téléphone" |
| J7 | Final si pas de réponse | "Dernier message" + lien vidéo unique sans sales |

## Mesures de succès (semaine 1, sur 500 envois)

| Métrique | Cible | Action si raté |
|---|---|---|
| Delivery rate | ≥ 95% | Vérifier DKIM/SPF/DMARC |
| Open rate | ≥ 35% | A/B test subject lines |
| Click rate vidéo | ≥ 8% | Améliorer preview / thumbnail |
| Conversion register | ≥ 1% | Revoir landing register |
| Reply rate | ≥ 2% | OK |
| Demo request | ≥ 0.5% | OK |

## Bonus : retargeting

Pour les prospects qui ont **ouvert le mail** mais pas cliqué :
- Lemlist permet un trigger "open detected" → envoyer une follow-up 24h après avec un autre angle
- Ou exporter cette liste → upload dans Meta Ads → retargeting custom audience → afficher la vidéo en ad Insta/Facebook

Pour ceux qui ont **cliqué la vidéo** mais pas converti :
- Pixel Meta installé sur `/register` détecte le drop-off
- Retargeting ad avec la même vidéo + offre stronger ("48h pour activer, premier mois ET deuxième mois offerts")
