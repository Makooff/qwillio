import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import VoiceMenu from './VoiceMenu';

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

function mount() {
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
    />,
  );
}

/* Le catalogue arrive dans une promesse: sans l'attendre, l'assertion passe
   avant le `setState` et React se plaint d'une mise à jour hors `act`. */
const settle = () => act(async () => { await Promise.resolve(); });

describe('VoiceMenu', () => {
  /* La régression que ce test tient: placement et animation vivaient sur la
     même boîte, et framer, qui écrit un `transform` inline pour animer `y`,
     effaçait le `-translate-x-1/2`. Le menu partait alors vers la droite et
     sortait de l'écran sur téléphone. Les deux doivent rester séparés. */
  it('centre le menu sur une boîte que framer ne transforme pas', async () => {
    const { container } = mount();
    await settle();
    const box = container.querySelector('.-translate-x-1\\/2');
    expect(box).not.toBeNull();
    expect(box).not.toHaveAttribute('style');
    // Le panneau animé est un ENFANT de la boîte qui positionne.
    expect(box!.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('borne sa largeur à celle de l’écran', async () => {
    const { container } = mount();
    await settle();
    const box = container.querySelector('.-translate-x-1\\/2')!;
    expect(box.className).toContain('min(340px,calc(100vw-1.5rem))');
  });

  it('montre les personnages et le champ de recherche', async () => {
    mount();
    expect(await screen.findByLabelText('Chercher une voix')).toBeInTheDocument();
    expect(screen.getByText('Marie')).toBeInTheDocument();
  });
});
