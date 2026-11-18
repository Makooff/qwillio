import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import VapiLiveCall, { prewarmLiveCall } from './VapiLiveCall';
import api from '../../services/api';
const mocks = vi.hoisted(() => ({ start: vi.fn(async () => {}), stop: vi.fn(), captures: [] as any[] }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('./CoreLiveCall', () => ({ loadCoreSdk: vi.fn(async () => ({})), CoreLiveCallTransport: class {
 constructor(...args: any[]) { mocks.captures.push(args); } on() {} start = mocks.start; stop = mocks.stop;
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.captures.length = 0; });
function mic(promise?: Promise<any>) {
 const stop = vi.fn(); const stream = { getTracks: () => [{ stop }], getAudioTracks: () => [{ stop }] };
 const get = vi.fn(() => promise || Promise.resolve(stream));
 Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: get } });
 return { get, stop, stream };
}
describe('browser call component lifecycle', () => {
 it('does not mint on mount, body updates or prewarm', () => {
  mic(); const view = render(createElement(VapiLiveCall, { body: { characterId: 'lea' } }));
  view.rerender(createElement(VapiLiveCall, { body: { characterId: 'emma' } })); prewarmLiveCall('/public/demo/live-config');
  expect(api.get).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
 });
 it('captures mic before minting, uses returned LiveKit provider and cleans on unmount', async () => {
  const h = mic(); vi.mocked(api.get).mockResolvedValue({ data: { provider: 'livekit', token: 'token', url: 'wss://test', maxDurationSeconds: 120 } });
  const view = render(createElement(VapiLiveCall)); fireEvent.click(screen.getByRole('button'));
  expect(h.get).toHaveBeenCalledWith({ audio: true, video: false }); expect(api.get).not.toHaveBeenCalled();
  await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
  expect(mocks.captures[0][1]).toBe(h.stream); view.unmount(); expect(mocks.stop).toHaveBeenCalled(); expect(h.stop).toHaveBeenCalled();
 });
 it('ignores late tokens after stop and releases the mic', async () => {
  const h = mic(); let resolve!: (value: any) => void;
  vi.mocked(api.get).mockReturnValue(new Promise(r => { resolve = r; }));
  render(createElement(VapiLiveCall)); fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(api.get).toHaveBeenCalledOnce()); fireEvent.click(screen.getByRole('button'));
  resolve({ data: { provider: 'livekit' } }); await Promise.resolve();
  expect(mocks.start).not.toHaveBeenCalled(); expect(h.stop).toHaveBeenCalled();
 });
 it('stops a late microphone after unmount without minting', async () => {
  let resolve!: (value: any) => void; const h = mic(new Promise(r => { resolve = r; }));
  const view = render(createElement(VapiLiveCall)); fireEvent.click(screen.getByRole('button')); view.unmount();
  resolve(h.stream); await waitFor(() => expect(h.stop).toHaveBeenCalled()); expect(api.get).not.toHaveBeenCalled();
 });
});
