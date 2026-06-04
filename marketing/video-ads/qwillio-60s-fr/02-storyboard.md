# Storyboard — 8 scènes

Lecture par scène : visuel, durée, mouvement caméra, texte overlay, audio cue. Référence pendant le montage.

---

## Scène 1 — Hook : téléphone sans réponse

- **Timecode** : 00:00 → 00:05 (5 s)
- **Source visuelle** : Higgsfield prompt #1
- **Description** : Téléphone vintage à cadran sur bureau en bois sombre, sonne en boucle. Aucune main ne décroche. Lumière chaude latérale, fond flouté avec bokeh indigo. Ambiance mélancolique.
- **Caméra** : Push-in lent (dolly forward), du plan large vers gros plan sur le combiné. ~30% zoom progressif sur 5s.
- **Lens** : 50mm équivalent, ouverture f/1.8, depth of field shallow
- **Texte overlay** :
  - À 00:01 → animation slide-up depuis le bas, font Outfit Bold 72px blanc
  - Texte : **"Combien d'appels avez-vous manqué cette semaine ?"**
  - Sortie : fade-out à 00:04.5
- **Audio** : Sonnerie téléphone vintage en boucle (3 rings), volume -10dB. Pas de musique encore.

---

## Scène 2 — Problème : 35 % perdus

- **Timecode** : 00:05 → 00:15 (10 s)
- **Source visuelle** : Higgsfield prompt #2 + animation After Effects / DaVinci Fusion
- **Description** : Bar chart 3D animé qui monte jusqu'à 35%, en glow indigo-violet. Autour, silhouettes humaines floues qui s'éloignent (clients qui partent au concurrent). Fond dark `oklch(8% 0.009 265)`.
- **Caméra** : Pan horizontal lent gauche → droite suivant la bar qui monte
- **Texte overlay** :
  - Big number `35 %` qui s'incrémente de 0 à 35 en 1.5s à partir de 00:06
  - À 00:12 : **"Vos concurrents répondent. Pas vous."** (Outfit Bold 48px, indigo `#6366f1`)
- **Voix off** :
  - **VO entrée à 00:06** : "35 % des appels en TPE et PME restent sans réponse. Chaque appel manqué, c'est un client qui passe au concurrent."
- **Audio** : Music track démarre en fade-in à 00:05 (-22dB), monte à -18dB à 00:15. SFX UI tick à chaque +1% incrément (-15dB).

---

## Scène 3 — Solution intro : Marie présentée

- **Timecode** : 00:15 → 00:23 (8 s)
- **Source visuelle** : HeyGen avatar Take 1 + B-roll Higgsfield prompt #5
- **Description** : Avatar HeyGen "Anthony" mid-shot regard caméra, fond dégradé indigo → noir. À 00:21 (juste 2s) : cut sur B-roll smartphone qui flotte avec bulle de RDV qui sort de l'écran.
- **Caméra** : Statique sur l'avatar (rule-of-thirds, regard centré). B-roll insert : push-in lent.
- **Texte overlay** :
  - Lower-third en bas-gauche dès 00:16 (slide-in 300ms ease-out-expo) : **"Marie · Réceptionniste IA Qwillio"**
- **Voix avatar** : "Je vous présente Marie. Votre nouvelle réceptionniste. Sauf qu'elle ne dort jamais, ne tombe jamais malade, et décroche en moins d'une seconde."
- **Audio** : Musique -18dB, voix avatar -6dB (side-chain duck musique sous voix).

---

## Scène 4 — Solution features : split-screen

- **Timecode** : 00:23 → 00:31 (8 s)
- **Source visuelle** : HeyGen Take 2 + 3 icônes 3D synchronisées
- **Description** : Avatar à gauche (50% screen), icônes 3D à droite qui apparaissent en cascade sur les mots-clés. Icônes : calendrier (00:25 sur "calendrier"), checkmark sur fiche lead (00:27 sur "qualifie"), téléphone rouge clignote (00:29 sur "urgences").
- **Caméra** : Statique sur avatar, icônes pop-in avec scale 0.8 → 1.0 + fade-in
- **Voix avatar** : "Marie répond en français, prend vos rendez-vous dans votre calendrier, qualifie vos prospects, et vous transfère uniquement les vraies urgences."
- **Audio** : SFX pop UI léger à chaque apparition d'icône (-15dB)

---

## Scène 5 — Solution scale : dataflow 3D

- **Timecode** : 00:31 → 00:40 (9 s)
- **Source visuelle** : HeyGen Take 3 + Higgsfield prompt #4
- **Description** : Avatar plein écran 4s, puis transition wipe vers dataflow Higgsfield (00:35 → 00:40). Dataflow : 100 nodes lumineux indigo qui se connectent en simultané, ondes sonores qui se transforment en data structuré.
- **Caméra** : Avatar statique. Dataflow : tracking shot lent qui suit les flux de gauche à droite.
- **Voix avatar** : "Elle gère cent appels en même temps. Le jour, la nuit, le week-end. Sans une seule erreur. C'est mathématique."
- **Texte overlay** :
  - Big number `100` qui pulse à 00:32
  - **"Sans une seule erreur."** en bottom-third à 00:37, indigo
- **Audio** : Musique -18dB. SFX whoosh sur wipe (00:35, -10dB). Voix -6dB.

---

## Scène 6 — Preuve : témoignage + metrics

- **Timecode** : 00:40 → 00:50 (10 s)
- **Source visuelle** : Photo Dr. Sarah Chen (générée ou stock) + 3 cartes 3D animées + Higgsfield prompt #3 en backdrop subtil
- **Description** : Layout split. Gauche 40% : portrait Dr. Sarah Chen, halo de lumière chaude. Droite 60% : texte témoignage qui s'écrit caractère par caractère (typewriter effect, 30ms/char). En dessous, 3 cartes 3D qui apparaissent staggered à 200ms d'écart à partir de 00:46.
- **Caméra** : Statique. Cartes : entrent depuis le bas avec scale 0.7 → 1.0 + ease-out-expo.
- **Texte témoignage** : « Marie décroche en moins d'une seconde. Nos patients pensent qu'elle fait partie de l'équipe. » — Dr. Sarah Chen, Bright Dental
- **3 cartes 3D** : `98 %` (décrochés) · `< 1 s` (réponse) · `24 / 7` (toujours là)
- **Voix off** (féminine douce) à 00:42 : "Bright Dental. Cabinet Lambert. Garage Dupont. Tous ont arrêté de perdre des appels."
- **Audio** : Musique build (-15dB), voix off -6dB, SFX UI doux à chaque carte (-15dB)

---

## Scène 7 — CTA : conversion

- **Timecode** : 00:50 → 00:58 (8 s)
- **Source visuelle** : HeyGen Take 4 + bouton CTA animé
- **Description** : Avatar plein écran de 00:50 à 00:54. À 00:54, bouton CTA pulse apparaît en overlay bottom-center, taille 480×120px, fond indigo `#6366f1`, texte blanc Outfit Bold 32px : "Créer mon compte → qwillio.com/register". Le bouton pulse subtil (scale 1.0 ↔ 1.05) toutes les 1.5s.
- **Caméra** : Statique sur avatar
- **Voix avatar** : "Testez Qwillio dès maintenant. Premier mois entièrement offert. Aucune carte demandée. Vous activez votre compte en deux minutes. Le prochain appel arrive dans une heure. Soyez prêt."
- **Audio** : Musique monte à -12dB (climax). Voix -5dB pour qu'elle passe au-dessus.

---

## Scène 8 — End-card : logo reveal 3D

- **Timecode** : 00:58 → 01:00 (3 s)
- **Source visuelle** : Higgsfield prompt #6
- **Description** : Logo Qwillio en matériau verre 3D, rotation lente sur l'axe Y, gradient indigo-violet en lighting. Tagline finale en fade-in en dessous : "Chaque appel répondu. Chaque lead capturé." URL en petit en bas.
- **Caméra** : Push-in très lent sur le logo
- **Audio** : Whoosh transition + ding final de validation (-10dB). Musique fade-out sur 1.5s.
- **Note export** : Garder 3s de plus avec un freeze frame du logo pour le YouTube thumbnail.

---

## Récap durées

| Scène | Durée | Source principale |
|---|---|---|
| 1 — Hook | 5 s | Higgsfield #1 |
| 2 — Problème | 10 s | Higgsfield #2 + DaVinci Fusion |
| 3 — Solution intro | 8 s | HeyGen Take 1 + Higgsfield #5 |
| 4 — Features | 8 s | HeyGen Take 2 + icônes |
| 5 — Scale | 9 s | HeyGen Take 3 + Higgsfield #4 |
| 6 — Preuve | 10 s | Photo + 3 cartes |
| 7 — CTA | 8 s | HeyGen Take 4 |
| 8 — End-card | 3 s | Higgsfield #6 |
| **Total** | **61 s** | — |

(1 seconde de marge volontaire pour les transitions wipe — le master final sera 60s exact après tightening.)
