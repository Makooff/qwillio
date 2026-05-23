export const config = { runtime: 'edge' };

export default async function handler() {
  try {
    await fetch('https://qwillio.onrender.com/api/auth/warmup', {
      signal: AbortSignal.timeout(90000),
    });
  } catch {}
  return new Response('ok');
}
