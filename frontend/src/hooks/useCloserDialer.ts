/**
 * useCloserDialer — browser-based outbound calling via Twilio Voice SDK.
 *
 * Lifecycle:
 *   1. On first call(), we lazily fetch a Twilio Access Token from
 *      `/closer/voice/token`, register a Device, and connect to the
 *      prospect's number. Twilio answers our /twiml endpoint and bridges
 *      the call with `record="record-from-answer-dual"`.
 *   2. While in-call, the hook exposes status, duration, and a `mute()` /
 *      `hangup()` API.
 *   3. After hangup the recording lands in our DB asynchronously via the
 *      Twilio recording webhook — fetch the prospect's call list to show
 *      it (see CloserSession.tsx).
 *
 * Browsers require a user gesture for getUserMedia; only call() inside
 * an onClick handler.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Device, Call as TwilioCall } from '@twilio/voice-sdk';
import api from '../services/api';

export type DialerStatus =
  | 'idle'
  | 'preparing'   // fetching token / registering Device
  | 'connecting'  // call() invoked, waiting for media
  | 'ringing'
  | 'in-call'
  | 'ended'
  | 'error';

export interface UseCloserDialer {
  status:    DialerStatus;
  error:     string | null;
  muted:     boolean;
  durationMs: number;
  call:      (to: string, prospectId?: string) => Promise<void>;
  hangup:    () => void;
  toggleMute: () => void;
  /** True when Twilio Voice is configured server-side. False ⇒ fall back to tel:. */
  ready:     boolean;
}

export function useCloserDialer(): UseCloserDialer {
  const [status,     setStatus]     = useState<DialerStatus>('idle');
  const [error,      setError]      = useState<string | null>(null);
  const [muted,      setMuted]      = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [ready,      setReady]      = useState(true);

  const deviceRef = useRef<Device | null>(null);
  const callRef   = useRef<TwilioCall | null>(null);
  const startRef  = useRef<number | null>(null);
  const tickRef   = useRef<number | null>(null);

  const stopTicker = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startTicker = useCallback(() => {
    stopTicker();
    startRef.current = Date.now();
    tickRef.current = window.setInterval(() => {
      if (startRef.current) setDurationMs(Date.now() - startRef.current);
    }, 250);
  }, [stopTicker]);

  // Lazy-init the Twilio Device. Returns null + sets error if not configured.
  const ensureDevice = useCallback(async (): Promise<Device | null> => {
    if (deviceRef.current) return deviceRef.current;

    setStatus('preparing');
    setError(null);

    let token: string;
    try {
      const { data } = await api.post('/closer/voice/token');
      if (!data?.token) throw new Error(data?.error || 'Token manquant');
      token = data.token;
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Échec récupération token';
      setError(msg);
      setStatus('error');
      setReady(false);
      return null;
    }

    const device = new Device(token, {
      // Falling back to PCMU keeps things working on flaky networks.
      codecPreferences: ['opus' as any, 'pcmu' as any],
      logLevel: 'warn',
    });

    device.on('error', (e: any) => {
      const msg = e?.message || 'Erreur Twilio';
      setError(msg);
      setStatus('error');
    });

    device.on('tokenWillExpire', async () => {
      try {
        const { data } = await api.post('/closer/voice/token');
        if (data?.token) device.updateToken(data.token);
      } catch {
        /* swallow — device will surface its own error */
      }
    });

    try {
      await device.register();
    } catch (err: any) {
      setError(err?.message || 'Échec connexion Twilio');
      setStatus('error');
      return null;
    }

    deviceRef.current = device;
    return device;
  }, []);

  const attachCallHandlers = useCallback((c: TwilioCall) => {
    c.on('ringing', () => setStatus('ringing'));
    c.on('accept', () => {
      setStatus('in-call');
      startTicker();
    });
    c.on('disconnect', () => {
      stopTicker();
      setStatus('ended');
      callRef.current = null;
    });
    c.on('cancel', () => {
      stopTicker();
      setStatus('ended');
      callRef.current = null;
    });
    c.on('reject', () => {
      stopTicker();
      setStatus('ended');
      callRef.current = null;
    });
    c.on('error', (e: any) => {
      stopTicker();
      setError(e?.message || 'Erreur appel');
      setStatus('error');
      callRef.current = null;
    });
  }, [startTicker, stopTicker]);

  const call = useCallback(async (to: string, prospectId?: string) => {
    setError(null);
    setMuted(false);
    setDurationMs(0);
    setStatus('connecting');

    const device = await ensureDevice();
    if (!device) return;

    try {
      const c = await device.connect({
        params: {
          To: to,
          ...(prospectId ? { prospectId } : {}),
        },
      });
      callRef.current = c;
      attachCallHandlers(c);
    } catch (err: any) {
      setError(err?.message || 'Échec démarrage appel');
      setStatus('error');
    }
  }, [ensureDevice, attachCallHandlers]);

  const hangup = useCallback(() => {
    callRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
  }, []);

  const toggleMute = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    const next = !muted;
    c.mute(next);
    setMuted(next);
  }, [muted]);

  useEffect(() => () => {
    stopTicker();
    callRef.current?.disconnect();
    deviceRef.current?.destroy();
    deviceRef.current = null;
    callRef.current = null;
  }, [stopTicker]);

  return { status, error, muted, durationMs, call, hangup, toggleMute, ready };
}
