# Higgsfield prompts — 6 scènes 3D / motion design

URL : https://higgsfield.ai — plan **Pro** ~$10/mois (largement suffisant pour 6 générations 5s).

## Paramètres globaux (à appliquer à toutes les générations)

- **Resolution** : 1080p
- **Aspect ratio** : 16:9 (1920×1080)
- **Frame rate** : 30fps
- **Duration per shot** : 5 seconds
- **Style preset** : Cinematic (si dispo) ou Premium realism
- **Output** : MP4 H.264

## Workflow

Pour chaque scène ci-dessous : copier le prompt verbatim → coller dans Higgsfield → générer → si artefacts, regénérer avec un seed différent ou ajuster `--negative-prompt` → télécharger MP4 → renommer.

---

## Prompt #1 — Téléphone vintage qui sonne sans réponse

**Filename** : `higgs-01-phone-ringing.mp4`

**Camera move** : Slow dolly forward (push-in), from wide to close-up

```
Cinematic close-up of a vintage rotary telephone on a dark wooden desk in an empty office. The phone is ringing, the handset slightly vibrating with each ring. Soft golden hour light coming from a window on the left, casting long shadows. Dust particles floating in the air, catching the light. Background heavily out of focus with indigo bokeh. Melancholic, abandoned atmosphere. Shallow depth of field, 50mm lens, f/1.8. 4K cinematic, film grain. Color palette: deep indigo, warm amber, charcoal black.
```

**Negative prompt** : `text, watermark, hand, person, modern smartphone, bright daylight, cluttered desk`

**Seed** : laisser random première fois, noter le seed gagnant pour itération

---

## Prompt #2 — Bar chart 35% animé

**Filename** : `higgs-02-stats-35.mp4`

**Camera move** : Slow pan right to left, tracking the bar as it rises

```
Animated 3D bar chart rising from 0% to 35% over 4 seconds, glowing with a vibrant indigo-to-violet gradient. The bar emits soft volumetric light. Dark space background with subtle grid floor in deep indigo. Around the rising bar, blurred human silhouettes walking away into the distance, semi-transparent, representing lost customers. Motion graphic aesthetic, premium fintech style. Particles of light flowing upward from the bar. Smooth ease-out animation. 4K, cinematic depth, neon glow accents. Color palette: oklch(56% 0.22 264) indigo, oklch(67% 0.26 299) violet, oklch(8% 0.009 265) deep dark blue.
```

**Negative prompt** : `text labels, percentage numbers in scene, cartoon style, flat 2D, bright background`

---

## Prompt #3 — Calendrier qui se remplit auto

**Filename** : `higgs-03-calendar-filling.mp4`

**Camera move** : Static, slight push-in (~10% zoom)

```
3D floating calendar interface in zero gravity, isometric perspective. Time slots from 9 AM to 6 PM filling in one by one with violet glow, faster and faster, like a montage. Each appointment slot pops in with a soft scale animation and emits a brief flash of indigo light. The calendar floats over a dark cosmic backdrop with subtle particles. Premium app UI aesthetic, glass morphism cards with soft shadows. Modern, smooth, satisfying. 4K, cinematic. Color palette: indigo #6366f1, violet #a855f7, dark navy #0a0a0f.
```

**Negative prompt** : `realistic paper calendar, text legible, cluttered UI, daylight scene`

---

## Prompt #4 — Dataflow voix → texte → CRM

**Filename** : `higgs-04-dataflow.mp4`

**Camera move** : Tracking shot from left to right, following the data streams

```
Abstract 3D visualization of sound waves transforming into structured data nodes flowing through a CRM interface in cyberspace. Glowing indigo and violet waveforms enter from the left, morph into wireframe lead cards with names, phone numbers, and statuses, then flow into a glowing CRM database node on the right. 100 simultaneous streams of data, parallel processing aesthetic. Neon outlines, dark void background with grid floor. Premium tech, AI visualization style. Smooth particle motion, slight chromatic aberration on bright edges. 4K cinematic. Color palette: electric indigo, vivid violet, jet black.
```

**Negative prompt** : `human characters, faces, real office, daylight, low-poly`

---

## Prompt #5 — Smartphone qui flotte avec bubble RDV

**Filename** : `higgs-05-phone-floating.mp4`

**Camera move** : Slow rotation around the phone (30° arc), Vertigo-style

```
Premium smartphone product shot floating in zero gravity, screen on showing a clean calendar UI with appointment notifications popping out as 3D chat bubbles. The phone slowly rotates on its axis. Soft violet rim light from the back, warm indigo key light from above. Speech bubbles emerge from the screen with appointment confirmations like "RDV confirmé 14h30", floating around the phone in 3D space. Glassmorphism effect on bubbles. Premium tech advertisement aesthetic. Dark studio backdrop with subtle gradient. 4K, shallow depth of field, f/2.0. Color palette: indigo, violet, soft white highlights, dark charcoal.
```

**Negative prompt** : `hands holding phone, person, table surface, low resolution, plastic look`

---

## Prompt #6 — Logo Qwillio reveal 3D

**Filename** : `higgs-06-logo-reveal.mp4`

**Camera move** : Slow push-in on the logo, slight Y-axis rotation (~15°)

```
The word "Qwillio" rendered in 3D glass material with subtle iridescent refraction, slowly rotating on its vertical axis. Premium typography, Outfit font weight 700. Backlit with a strong indigo-to-violet gradient that wraps around the letters. Volumetric light rays emanating from behind the logo. Soft particles floating in foreground. Dark cosmic backdrop with subtle nebula in deep indigo. Cinematic reveal, premium tech aesthetic. The logo emerges from darkness with a brief flash of light, then settles into its final position. 4K, ultra-smooth animation, ray-traced reflections. Color palette: indigo #6366f1, violet #a855f7, deep blue #0a0a0f, white highlights.
```

**Negative prompt** : `text other than Qwillio, slogan, tagline in render, low-quality glass, plastic logo, daylight`

---

## QA des 6 rendus

Avant de descendre vers le montage, valider :

- [ ] Prompt #1 : la sonnerie sync avec le visuel (3 rings visibles)
- [ ] Prompt #2 : le `35` correspond visuellement (mais pas en texte écran — le texte sera ajouté au montage)
- [ ] Prompt #3 : les slots se remplissent de gauche-en-haut vers droite-en-bas, lisible
- [ ] Prompt #4 : les flux ne sont pas chaotiques, on voit clairement entrée → transformation → sortie
- [ ] Prompt #5 : le téléphone reste centré, les bubbles ne masquent pas l'écran
- [ ] Prompt #6 : "Qwillio" est lisible (pas de glitch typo), le matériau verre est cohérent

Si un rendu rate, regénérer en :
1. Changeant le seed
2. Affinant la `negative prompt`
3. Renforçant les mots-clés important avec parenthèses : `(indigo glow:1.4)` ou répétition

## Coût estimatif

- 6 générations × 5s = 30 secondes générées
- Plan Higgsfield Pro inclut ~120s/mois
- Si tu rates et regénères, total ~60s consommés sur le plan, large marge

## Si Higgsfield indispo / déçoit

Plans B équivalents pour les 3D shots :
- **Runway Gen-3** ($15/mois) — qualité supérieure, prompts identiques compatibles
- **Luma Dream Machine** (free trial 30 gen/mois)
- **Kling AI 1.6** ($10/mois) — bon sur mouvements rapides
- **Pika Labs** (free)

Si tu choisis un autre outil, garde les mêmes prompts — ils sont écrits en anglais standard (les modèles vidéo IA ne sont pas multilingues fiables encore).
