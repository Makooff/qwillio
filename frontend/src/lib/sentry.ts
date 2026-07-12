import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const env = (import.meta.env.MODE || 'development') as string;
  const release = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '2.0.0';

  if (!dsn) {
    if (env !== 'development') {
      console.warn('[sentry] VITE_SENTRY_DSN not set — frontend errors will not be reported.');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: env,
    release,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: env === 'production' ? 0.10 : 1.0,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.30,
    sendDefaultPii: false,
    beforeSend(event) {
      const msg = event.message || event.exception?.values?.[0]?.value || '';
      if (typeof msg === 'string' && /ResizeObserver loop/i.test(msg)) return null;
      return event;
    },
  });
}

export { Sentry };
