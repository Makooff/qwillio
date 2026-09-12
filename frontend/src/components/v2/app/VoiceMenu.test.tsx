import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createRef } from 'react';
import VoiceMenu from './VoiceMenu';
import { inAnchored } from './Anchored';

/* Le catalogue ElevenLabs est demandé au montage: sans ce bouchon, le test
   parlerait au réseau et le composant finirait en état « échec ». */
vi.mock('../../../services/api', () => ({
  default: { get: () => Promise.resolve({ data: { voices: [] } }) },
}));

afterEach(cleanup);

const CHARACTERS = [
  {
    id: 'marie', name: 'Marie', accent: 'FR', gender: 'f',
    taglineFr: 'Chaleureuse', taglineEn: 'Warm',
    previewFr: 'Bonjour', previewEn: 'Hello', personaKey: 'warm',
  },
] as never[];

/** Une ancre posée à un endroit connu de l'écran (jsdom ne mesure rien). */
function anchorAt(rect: Partial<DOMRect>) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({
    top: 300, bottom: 330, left: 400, right: 600, width: 200, height: 30, x: 400, y: 300,
    toJSON: () => ({}), ...rect,
  }) as DOMRect;
  document.body.appendChild(el);
  const ref = createRef<HTMLElement>();
  (ref as { current: HTMLElement | null }).current = el;
  return ref;
}

function mount(anchor = anchorAt({})) {
  return render(
    <VoiceMenu
      characters={CHARACTERS}
      characterId="marie"
      onCharacter={() => {}}
      override={null}
      onOverride={() => {}}
      playing={null}
      onToggle={() => {}}
      previewUrlFor={() => '/preview'}
      isFr
      anchor={anchor}
    />,
  );
}

/* Le catalogue arrive dans une promesse: sans l'attendre, l'assertion passe
   avant le `setState` et React se plaint d'une mise à jour hors `act`. */
const settle = () => act(async () => { await Promise.resolve(); });

describe('VoiceMenu', () => {
  /* La régression que ce test tient: posé en `absolute` DANS la carte du
     personnage, dont la hauteur est bornée, le menu était coupé par son bord
     ou lui donnait un ascenseur à chaque ouverture. Il est rendu hors de la
     carte, en `fixed`, sous son ancre. */
  it('est rendu hors de sa carte, sous le milieu de son ancre', async () => {
    const { container } = mount();
    await settle();
    const box = document.body.querySelector('[data-anchored]') as HTMLElement;
    expect(box).not.toBeNull();
    expect(container.contains(box)).toBe(false);
    expect(box.className).toContain('fixed');
    // Sous l'ancre (bas 330 + 8), centré sur elle (500), large de 340.
    expect(box.style.top).toBe('338px');
    expect(box.style.width).toBe('340px');
    expect(box.style.left).toBe('330px');
    // Le panneau animé est un ENFANT de la boîte qui positionne: framer écrit
    // un `transform` inline pour animer `y`, qui écraserait un centrage.
    expect(box.querySelector('[role="dialog"]')).not.toBeNull();
    expect(box.style.transform).toBe('');
  });

  it('reste dans l’écran, et s’ouvre vers le haut quand le bas manque', async () => {
    window.innerWidth = 360;
    window.innerHeight = 640;
    mount(anchorAt({ top: 560, bottom: 590, left: 300, right: 360, width: 60 }));
    await settle();
    const box = document.body.querySelector('[data-anchored]') as HTMLElement;
    // 360 - 2 × 12 de marge: jamais plus large que l'écran.
    expect(box.style.width).toBe('336px');
    expect(box.style.left).toBe('12px');
    // Trop bas pour s'ouvrir dessous: il s'accroche au-dessus de l'ancre.
    expect(box.style.top).toBe('');
    expect(box.style.bottom).toBe(`${640 - 560 + 8}px`);
  });

  it('un clic dans le menu n’est pas un clic « dehors »', async () => {
    mount();
    await settle();
    const input = await screen.findByLabelText('Chercher une voix');
    expect(inAnchored(input)).toBe(true);
    expect(inAnchored(document.body)).toBe(false);
  });

  it('montre les personnages et le champ de recherche', async () => {
    mount();
    expect(await screen.findByLabelText('Chercher une voix')).toBeInTheDocument();
    expect(screen.getByText('Marie')).toBeInTheDocument();
  });
});
