import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HospitalityBackdrop from './HospitalityBackdrop';
import CircularReceptionists from './CircularReceptionists';
import { useLang } from '../../stores/langStore';

const preview = vi.hoisted(() => ({ toggle: vi.fn(), stop: vi.fn(), prefetch: vi.fn() }));
vi.mock('../client/useVoicePreview', () => ({ useVoicePreview: () => ({ playing: null, notice: null, line: null, ...preview }) }));
function matchMedia(reduced: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
}
beforeEach(() => { useLang.setState({ lang: 'fr' }); matchMedia(false); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Marketing hospitality footage', () => {
  it('rotates three licensed sector clips and keeps a still fallback', () => {
    const { container } = render(<HospitalityBackdrop dark />);
    const video = () => container.querySelector('video')!;
    expect(video().muted).toBe(true);
    expect(video().loop).toBe(false);
    expect(video().getAttribute('playsinline')).not.toBeNull();
    expect(video().querySelector('source')?.getAttribute('src')).toBe('/marketing/service-cafe.mp4');
    fireEvent.ended(video());
    expect(video().querySelector('source')?.getAttribute('src')).toBe('/marketing/sector-salon.mp4');
    expect(video().getAttribute('poster')).toBe('/marketing/sector-salon.webp');
    fireEvent.ended(video());
    expect(video().querySelector('source')?.getAttribute('src')).toBe('/marketing/sector-bakery.mp4');
    fireEvent.ended(video());
    expect(video().querySelector('source')?.getAttribute('src')).toBe('/marketing/service-cafe.mp4');
  });
  it('mounts only the active clip source and skips to the next clip on error', () => {
    const { container } = render(<HospitalityBackdrop />);
    const sources = container.querySelectorAll('video source');
    expect(sources).toHaveLength(1);
    fireEvent.error(container.querySelector('video')!);
    expect(container.querySelector('video source')?.getAttribute('src')).toBe('/marketing/sector-salon.mp4');
  });
  it('stops after bounded errors and falls back to the poster only', () => {
    const { container } = render(<HospitalityBackdrop />);
    for (let i = 0; i < 4; i += 1) fireEvent.error(container.querySelector('video')!);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/marketing/sector-salon.webp');
  });
  it('does not mount autoplay video for reduced-motion users', () => {
    matchMedia(true);
    const { container } = render(<HospitalityBackdrop />);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
  });
  it('lets the visitor pause and the pause persists across clips', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const { container } = render(<HospitalityBackdrop />);
    fireEvent.click(screen.getByRole('button', { name: 'Mettre la vidéo de fond en pause' }));
    expect(pause).toHaveBeenCalledOnce();
    fireEvent.ended(container.querySelector('video')!);
    expect(container.querySelector('video source')?.getAttribute('src')).toBe('/marketing/service-cafe.mp4');
    expect(screen.getByRole('button', { name: 'Reprendre la vidéo de fond' })).toBeTruthy();
  });
});

describe('Original voice carousel previews', () => {
  it('keeps all ten voices and uses their existing preview endpoint', () => {
    matchMedia(true);
    const { container } = render(<CircularReceptionists isFr />);
    const choices = screen.getAllByRole('tab');
    expect(choices).toHaveLength(10);
    expect(container.querySelectorAll('img')).toHaveLength(10);
    fireEvent.click(screen.getByRole('tab', { name: /^Lucas,/ }));
    expect(preview.prefetch).toHaveBeenLastCalledWith('/public/characters/lucas/preview?lang=fr&v=2');
    fireEvent.click(screen.getByRole('button', { name: 'Écouter un aperçu de la voix de Lucas' }));
    expect(preview.toggle).toHaveBeenCalledWith('lucas', '/public/characters/lucas/preview?lang=fr&v=2', undefined);
  });
  it('uses English previews when English is selected', () => {
    matchMedia(true);
    render(<CircularReceptionists isFr={false} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Marie,/ }));
    expect(preview.prefetch).toHaveBeenLastCalledWith('/public/characters/marie/preview?lang=en&v=2');
    fireEvent.click(screen.getByRole('button', { name: 'Hear a voice preview for Marie' }));
    expect(preview.toggle).toHaveBeenCalledWith('marie', '/public/characters/marie/preview?lang=en&v=2', expect.any(String));
  });
});
