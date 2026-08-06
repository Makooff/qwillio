import type { ReactNode } from 'react';
import NavV2 from './NavV2';
import FooterV2 from './FooterV2';

/* Shell unique des pages marketing V2 — remplace le chrome copié-collé 18× de la V1.
   Contrat: nav fixe 64px, le shell pose le padding-top, les pages n'ont plus à y penser. */

export default function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-q2-canvas text-q2-ink min-h-screen font-outfit">
      <NavV2 />
      <main id="main" className="pt-16">
        {children}
      </main>
      <FooterV2 />
    </div>
  );
}
