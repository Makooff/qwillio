import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import RecordingPlayer from './RecordingPlayer';

/* Un seul bouton : fermé, il dit « Écouter » ; au clic il lit l'enregistrement
   par la route du portail (jamais l'URL Vapi), puis s'ouvre sur la timeline
   et le temps. La demande du 13/09 : plus de second bouton, plus de lecteur
   natif. */

const get = vi.fn();
vi.mock('../../services/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

beforeEach(() => {
  get.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:recording');
  URL.revokeObjectURL = vi.fn();
  /* jsdom n'implémente pas la lecture audio. */
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn(() => Promise.resolve()) });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });
});
afterEach(cleanup);

async function open() {
  get.mockResolvedValue({ data: new Blob(['x']) });
  render(<RecordingPlayer callId="c1" />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /écouter/i })); });
}

describe('RecordingPlayer', () => {
  it('starts as a single closed button, without a native player', () => {
    render(<RecordingPlayer callId="c1" />);
    expect(screen.getByRole('button', { name: /écouter/i })).toHaveTextContent('Écouter');
    expect(screen.queryByRole('slider')).toBeNull();
    expect(document.querySelector('audio')).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('fetches the recording through the portal route as a blob, then expands', async () => {
    await open();
    expect(get).toHaveBeenCalledWith('/my-dashboard/calls/c1/recording', expect.objectContaining({ responseType: 'blob' }));
    expect(screen.getByRole('slider', { name: /position/i })).toBeInTheDocument();
    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument();
    expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:recording');
    expect(document.querySelector('audio')).not.toHaveAttribute('controls');
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('shows the clock and the timeline from the audio element', async () => {
    await open();
    const audio = document.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 129 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 41, writable: true });
    act(() => { fireEvent(audio, new Event('loadedmetadata')); fireEvent(audio, new Event('timeupdate')); });
    expect(screen.getByText('0:41 / 2:09')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '0:41 sur 2:09');
  });

  it('toggles pause and play on the same button', async () => {
    await open();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /pause/i })); });
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /reprendre/i })).toBeInTheDocument();
  });

  it('says why when the recording cannot be loaded, and stays closed', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    render(<RecordingPlayer callId="c1" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /écouter/i })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Aucun enregistrement pour cet appel.');
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByRole('button', { name: /écouter/i })).toBeEnabled();
  });
});
