/**
 * La règle de lecture d'une scène épinglée, écrite UNE fois.
 *
 * Deux composants s'appuient dessus (`PinnedScene` pour l'étape mise en avant,
 * `StepFrame` pour le cadre qui voyage). Chacun la relisait à sa façon: le
 * compteur annonçait l'étape 3 alors que le cadre en était encore à la 2, et
 * la colonne de gauche n'avait même pas fini de descendre. Une seule fonction,
 * les deux lisent la même chose.
 */

/** `lg:top-28` de la colonne épinglée, en pixels. */
export const STICKY_OFFSET = 112;

/**
 * Ligne de lecture: une étape devient l'étape courante quand son sommet passe
 * AU-DESSUS d'elle.
 *
 * Elle est ancrée sur le point d'accroche de la colonne, pas sur une fraction
 * de fenêtre. Une fraction (0,42 essayé d'abord) place la ligne bien plus bas
 * que l'accroche: le temps que la colonne se pose, la liste avait déjà défilé
 * de trois étapes sous la ligne, et le compteur passait de 01 à 04 d'un coup.
 * Ancrée sur l'accroche, la première étape est courante au moment exact où la
 * colonne se pose, et chaque étape suivante demande sa propre hauteur de
 * défilement.
 *
 * Le supplément proportionnel à la fenêtre garde un peu d'air sous l'entête sur
 * les grands écrans, sans jamais rattraper la hauteur d'une étape.
 */
export function readingLine(): number {
  return STICKY_OFFSET + window.innerHeight * 0.18;
}

/**
 * La scène a-t-elle commencé ?
 *
 * Tant que la colonne de gauche DESCEND encore, rien ne doit bouger à droite:
 * sinon le compteur prend de l'avance sur le titre, et on lit « 03 / 04 »
 * pendant que le titre glisse toujours. Elle est considérée en place quand son
 * sommet a rejoint son point d'accroche.
 */
export function sceneStarted(aside: HTMLElement | null): boolean {
  if (!aside) return true;
  return aside.getBoundingClientRect().top <= STICKY_OFFSET + 2;
}

/**
 * Position CONTINUE dans la liste: 0 = première étape, n-1 = dernière.
 *
 * Continue et pas entière, parce que le cadre a besoin du trajet et pas
 * seulement de l'arrivée. L'étape mise en avant, elle, prend la partie entière:
 * elle change au moment précis où le cadre finit de se poser.
 */
export function sceneAt(nodes: HTMLElement[]): number {
  if (nodes.length < 2) return 0;
  const line = readingLine();

  let at = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i].getBoundingClientRect().top;
    const b = nodes[i + 1].getBoundingClientRect().top;
    if (b <= line) {
      at = i + 1;
      continue;
    }
    if (a <= line) {
      const span = b - a;
      at = i + (span > 0 ? Math.min(1, Math.max(0, (line - a) / span)) : 0);
    }
    break;
  }
  return at;
}

/**
 * Écouteur de scroll partagé, une lecture par frame.
 *
 * Lire `getBoundingClientRect` à chaque événement de scroll déclenche un
 * reflow par événement; en passer par `requestAnimationFrame` ramène ça à une
 * lecture par frame affichée, ce qui suffit puisque rien ne se voit entre deux
 * frames.
 */
export function onScrollFrame(read: () => void): () => void {
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      read();
    });
  };

  read();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
  };
}

/**
 * Remappe la position continue de la scène en « escalier à paliers » : le
 * cadre marque un temps d'arrêt sur chaque étape au lieu de glisser sans
 * repère (retour utilisateur : « le scroll ne doit rien faire pendant
 * quelques crans pour marquer un temps entre chaque »).
 *
 * `raw` ∈ [0, steps-1] vient de `sceneAt`. La valeur rendue reste dans le même
 * intervalle mais PALLIE : elle reste figée sur chaque entier pendant une
 * fraction `dwell` du trajet, puis rattrape la suivante sur le reste. Le cadre
 * est donc posé (palier), se déplace à la vitesse du scroll (la sortie suit
 * `raw` un pour un), et ne saute jamais une étape : même en scroll rapide, la
 * position est une fonction continue du scroll, donc chaque palier est
 * traversé dans l'ordre.
 */
export function staggeredAt(raw: number, steps: number, dwell = 0.4): number {
  if (steps <= 1) return 0;
  const n = steps - 1;
  const i = Math.floor(raw);
  if (i < 0) return 0;
  if (i >= n) return n;
  const f = raw - i;
  if (f < dwell) return i;
  return i + (f - dwell) / (1 - dwell);
}
