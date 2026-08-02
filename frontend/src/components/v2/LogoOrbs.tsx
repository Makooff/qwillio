import { useReducedMotion } from 'framer-motion';

/* Visuel héro V2: les deux cercles du logo (Q indigo, W violet) et leur
   lentille d'intersection (#7349FE), agrandis en orbes souples.
   Seul endroit du canvas clair où la marque est pleinement saturée
   (règle « accent sparks = visuels produit », DA/v2-direction.md).
   Dérive lente décorative, coupée par prefers-reduced-motion. */

export default function LogoOrbs({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  const drift = reduced ? undefined : 'q2OrbDrift 9s ease-in-out infinite';
  const driftLate = reduced ? undefined : 'q2OrbDrift 9s ease-in-out 4.5s infinite';

  return (
    <div className={`relative aspect-square ${className}`} aria-hidden="true">
      {/* Orbe Q — indigo, ce qui décroche */}
      <div
        className="absolute rounded-full"
        style={{
          width: '62%',
          height: '62%',
          left: '2%',
          top: '19%',
          background: 'radial-gradient(circle at 38% 32%, #9d8bff 0%, #7a5fff 55%, #7349fe 100%)',
          animation: drift,
        }}
      />
      {/* Orbe W — violet, ce qui sort */}
      <div
        className="absolute rounded-full"
        style={{
          width: '62%',
          height: '62%',
          right: '2%',
          top: '19%',
          background: 'radial-gradient(circle at 62% 32%, #e7bafd 0%, #cd6bfb 55%, #b845f0 100%)',
          mixBlendMode: 'multiply',
          animation: driftLate,
        }}
      />
    </div>
  );
}
