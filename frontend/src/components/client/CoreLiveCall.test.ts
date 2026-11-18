import { describe, expect, it, vi } from 'vitest';
import { CoreLiveCallTransport } from './CoreLiveCall';
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { resolve, promise }; }
function harness(pending = Promise.resolve()) {
 const listeners = new Map<string, (...args: any[]) => void>();
 const room = { on: vi.fn((event, cb) => { listeners.set(event, cb); return room; }),
  connect: vi.fn(() => pending), disconnect: vi.fn(async () => {}), removeAllListeners: vi.fn(),
  localParticipant: { publishTrack: vi.fn(async () => {}) }, remoteParticipants: new Map() };
 const stop = vi.fn(); const stream = { getTracks: () => [{ stop }], getAudioTracks: () => [{ stop }] } as unknown as MediaStream;
 const sdk = { Room: class { constructor() { return room; } }, ParticipantKind: { AGENT: 4 }, Track: { Kind: { Audio: 'audio' }, Source: { Microphone: 'microphone' } },
  RoomEvent: { TrackSubscribed: 'track', TrackUnsubscribed: 'untrack', Disconnected: 'end', ActiveSpeakersChanged: 'speakers', DataReceived: 'data' } };
 const transport = new CoreLiveCallTransport({ url: 'wss://example.test', token: 'signed', maxDurationSeconds: 120 }, stream, sdk as any);
 return { transport, room, stop, listeners };
}
describe('CoreLiveCall transport', () => {
 it('forwards validated configuration notifications from the agent to the setup UI', async () => {
  const h = harness(); const update = vi.fn(); h.transport.on('config-update', update);
  await h.transport.start();
  const receive = h.listeners.get('data'); expect(receive).toBeTypeOf('function');
  receive!(new TextEncoder().encode(JSON.stringify({ configChanged: true, completed: false })), { kind: 4 }, 0, 'qwillio.config');
  expect(update).toHaveBeenCalledWith({ configChanged: true, completed: false }); h.transport.stop();
 });
 it('ignores malformed, oversized, non-agent and foreign-topic configuration packets', async () => {
  const h = harness(); const update = vi.fn(); h.transport.on('config-update', update); await h.transport.start();
  const receive = h.listeners.get('data'); expect(receive).toBeTypeOf('function');
  const packet = new TextEncoder().encode(JSON.stringify({ configChanged: true, completed: true }));
  receive!(packet, { kind: 0 }, 0, 'qwillio.config');
  receive!(packet, { kind: 4 }, 0, 'other');
  receive!(new TextEncoder().encode('{'), { kind: 4 }, 0, 'qwillio.config');
  receive!(new Uint8Array(4097), { kind: 4 }, 0, 'qwillio.config');
  receive!(new TextEncoder().encode('{"configChanged":"yes","completed":true}'), { kind: 4 }, 0, 'qwillio.config');
  expect(update).not.toHaveBeenCalled(); h.transport.stop();
 });
 it('publishes only the already captured microphone and releases every resource', async () => {
  const h = harness(); const active = vi.fn(); h.transport.on('call-start', active);
  await h.transport.start();
  expect(h.room.localParticipant.publishTrack).toHaveBeenCalledWith(expect.anything(), { source: 'microphone' });
  expect(active).toHaveBeenCalledOnce(); h.transport.stop();
  expect(h.stop).toHaveBeenCalled(); expect(h.room.disconnect).toHaveBeenCalled(); expect(h.room.removeAllListeners).toHaveBeenCalled();
 });
 it('cannot publish or announce connection after a stop during join', async () => {
  const join = deferred(); const h = harness(join.promise); const active = vi.fn(); h.transport.on('call-start', active);
  const start = h.transport.start(); h.transport.stop(); join.resolve(); await start;
  expect(h.room.localParticipant.publishTrack).not.toHaveBeenCalled(); expect(active).not.toHaveBeenCalled(); expect(h.stop).toHaveBeenCalled();
 });
 it('attaches real remote audio and detaches it on stop', async () => {
  const h = harness(); await h.transport.start(); const element = document.createElement('audio');
  const audio = { kind: 'audio', attach: vi.fn(() => element), detach: vi.fn(() => [element]) };
  h.listeners.get('track')!(audio); expect(audio.attach).toHaveBeenCalled(); expect(element.isConnected).toBe(true);
  h.transport.stop(); expect(audio.detach).toHaveBeenCalled(); expect(element.isConnected).toBe(false);
 });
 it('cleans up when connection fails', async () => {
  const h = harness(Promise.reject(new Error('unavailable')));
  await expect(h.transport.start()).rejects.toThrow('unavailable'); expect(h.stop).toHaveBeenCalled(); expect(h.room.disconnect).toHaveBeenCalled();
 });
});
