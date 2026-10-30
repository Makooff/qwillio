# Sector hero video sources

All three clips are illustrative licensed stock footage — **not Qwillio clients
and not endorsements**. No footage was taken from Bonnie or any customer.

## Playlist (frontend/src/components/v2/HospitalityBackdrop.tsx)

| Slot | File | Context |
|---|---|---|
| 1 | `service-cafe.mp4` / `service-cafe.webp` | Café service (pre-existing asset, see VIDEO-SOURCE.md) |
| 2 | `sector-salon.mp4` / `sector-salon.webp` | Barbershop haircut |
| 3 | `sector-bakery.mp4` / `sector-bakery.webp` | Baker kneading dough |

## Mixkit Stock Video Free License (verified "Free License" on each page)

- License terms: https://mixkit.co/license/#videoFree — commercial use allowed,
  modification allowed, no attribution required, not a Restricted License.

### 1. Barbershop haircut — `sector-salon.*`
- Page: https://mixkit.co/free-stock-video/barber-showing-the-haircut-to-his-client-43233/
- Asset: https://assets.mixkit.co/videos/43233/43233-720.mp4
- Source: 1280x720 H.264, 9.76 s, 3.20 MB (downloaded 2026-10-30).
- Derivative: trimmed t=1–9 s, no audio (`-an`), re-encoded H.264 CRF 27,
  `-movflags +faststart`; poster = WebP frame at t=2 s (quality 70).
- Result: `sector-salon.mp4` 820 KB (8 s, 1280x720), `sector-salon.webp` 37 KB.

### 2. Baker kneading dough — `sector-bakery.*`
- Page: https://mixkit.co/free-stock-video/hands-of-a-baker-kneading-a-dough-42467/
- Asset: https://assets.mixkit.co/videos/42467/42467-720.mp4
- Source: 1280x720 H.264, 12.05 s, 4.48 MB (downloaded 2026-10-30).
- Derivative: trimmed t=2–10 s, no audio, re-encoded H.264 CRF 27, faststart;
  poster = WebP frame at t=2 s (quality 70).
- Result: `sector-bakery.mp4` 1.47 MB (8 s, 1280x720), `sector-bakery.webp` 12 KB.

## Playback notes
- One `<video>` with a single `<source>` per active clip (`key={clip.src}`) so
  only the current clip downloads; `onEnded` advances and wraps around.
- Errors skip to the next clip and are bounded (`MAX_ERRORS = 4`), after which
  only the poster image remains.
- `prefers-reduced-motion`: no video is mounted; the static poster stays.
- Paused state persists across clip changes.
