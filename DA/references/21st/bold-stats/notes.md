# Bold Stats — @uilayout.contact (remplaçant validé d'impact-section)

- Code brut : `source.tsx` (collé par l'utilisateur, 2026-08-04). Demo id 18908.
- Preview : https://cdn.21st.dev/uilayout.contact/stats-bold/default/preview.1784420582612-62029dd9-6f32-4290-b757-ef0820cf8bff.png

## Structure
- Rangée vedette : UN chiffre géant (text-8xl/9xl, font-medium, tracking-tighter)
  en baseline avec titre + description (max-w-xs), image d'appui à droite
  (sm:w-96 h-52 object-cover rounded-lg), filet border-b sous toute la rangée.
- Rangée secondaire : 3 chiffres text-4xl/5xl medium tracking-tighter,
  labels 12px uppercase tracking-widest muted, flex justify-between.

## Adaptation Qwillio (à faire dans le bloc, pas ici)
- Tokens q2 ; poids display capé (font-medium 500 OK, pas de semibold 600 sur le titre).
- Chiffres UNIQUEMENT prouvables : 24/7, FR/EN, 90 s clonage, 10 réceptionnistes —
  jamais de métriques inventées type « 10B+ » ou latence chiffrée (interdits DA).
- Image d'appui = vraie capture dashboard (/screens/*), pas d'Unsplash.
- Compteurs animés existants (Counter) branchables sur les chiffres.
