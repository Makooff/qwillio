import { describe, it, expect } from 'vitest';
import { recordingCandidates, isSignedUrl } from '../recording-urls';

describe('recordingCandidates — toutes les adresses, sans doublon, dans l\'ordre', () => {
  it('liste mono, stéréo et par canal, en écartant les répétitions et le non-URL', () => {
    const call = {
      recordingUrl: 'https://a.r2.cloudflarestorage.com/x.wav',
      artifact: {
        recordingUrl: 'https://a.r2.cloudflarestorage.com/x.wav',
        stereoRecordingUrl: 'https://storage.vapi.ai/x-stereo.wav',
        recording: { mono: { combinedUrl: 'https://storage.vapi.ai/x-mono.wav', assistantUrl: '', customerUrl: null } },
      },
    };
    expect(recordingCandidates(call).map(c => c.field)).toEqual([
      'artifact.recordingUrl',
      'artifact.recording.mono.combinedUrl',
      'artifact.stereoRecordingUrl',
    ]);
    expect(recordingCandidates(null)).toEqual([]);
  });

  it('distingue une adresse signée d\'une adresse nue', () => {
    expect(isSignedUrl('https://a.r2.cloudflarestorage.com/x.wav?X-Amz-Signature=abc&X-Amz-Date=20260913T020000Z')).toBe(true);
    expect(isSignedUrl('https://a.r2.cloudflarestorage.com/x.wav')).toBe(false);
  });
});
