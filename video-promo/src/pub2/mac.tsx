/**
 * La page Rendez-vous du portail, dans Safari, sur le MacBook du site.
 *
 * Le MacBook est celui de la section « Ce qui se passe après » du site
 * (`frontend/public/marketing/macbook-figma-safari.webp`, mockup Mr.Mockup sous
 * CC BY 4.0, voir MACBOOK-SOURCE.md). Son écran est un quadrilatère calculé
 * depuis le vecteur Figma `2:13` ; on y pose la page avec la même homographie,
 * en `matrix3d`, pour qu'elle suive exactement la perspective de la photo.
 */
import React from 'react';
import { Img, staticFile } from 'remotion';
import { BookingsPage, Sidebar, T as PT } from '../pub/portal';

/** Les quatre coins de l'écran dans l'export 2400 × 1600 (MACBOOK-SOURCE.md × 0,4). */
const QUAD: Array<[number, number]> = [[547, 539.2], [1180.4, 235.2], [1280, 738.2], [689.6, 1095.6]];
const CW = 1600, CH = 1000; // la surface Safari posée dans l'écran

/** Homographie qui envoie le rectangle (0,0)-(w,h) sur le quadrilatère q. */
function matrix3d(w: number, h: number, q: Array<[number, number]>) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // Élimination de Gauss sur le système 8 × 8.
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const [a, bb, c, d, e, f, g, hh] = b.map((v, i) => v / A[i][i]);
  return `matrix3d(${a},${d},0,${g},${bb},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}
const SCREEN = matrix3d(CW, CH, QUAD);

function SafariBar() {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: CW, height: 64, background: '#F6F6F6', borderBottom: '1px solid #DADADA', display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', fontFamily: 'Inter, sans-serif' }}>
      {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{ width: 16, height: 16, borderRadius: 9999, background: c }} />)}
      <span style={{ width: 40 }} />
      <span style={{ color: '#8E8E93', fontSize: 26 }}>‹ ›</span>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 640, height: 40, borderRadius: 12, background: '#E9E9EB', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 18, color: '#3C3C43' }}>
          <span style={{ fontSize: 14 }}>🔒</span>app.qwillio.com/dashboard/bookings
        </div>
      </div>
      <span style={{ width: 120 }} />
    </div>
  );
}

/** Le MacBook, écran compris, à la taille de l'export (2400 × 1600). */
export function MacBookBookings({ t, bump, upcoming }: { t: number; bump: number; upcoming: number }) {
  PT.badgeBump = bump;
  PT.upcomingIn = upcoming;
  return (
    <div style={{ position: 'relative', width: 2400, height: 1600 }}>
      <Img src={staticFile('media/macbook.webp')} style={{ position: 'absolute', inset: 0, width: 2400, height: 1600 }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: CW, height: CH, transformOrigin: '0 0', transform: SCREEN, overflow: 'hidden', background: '#111' }}>
        <SafariBar />
        <div style={{ position: 'absolute', left: 0, top: 64, width: 1600, height: 900, transformOrigin: '0 0', transform: `scale(1, ${(CH - 64) / 900})` }}>
          <Sidebar active="bookings" />
          <div style={{ position: 'absolute', left: 222, top: 0, width: 1378, height: 900, background: '#0A0A0A', borderTopLeftRadius: 45, borderTop: '2px solid rgba(255,255,255,0.08)', borderLeft: '2px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <BookingsPage t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}
