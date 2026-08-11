/**
 * Une capture du VRAI portail, posée dans le site.
 *
 * Ces images ne sont ni des dessins ni des reconstitutions: elles sortent de
 * `frontend/capture-screens.mjs`, qui ouvre le portail livré sur un faux
 * backend et le photographie. Les régénérer après un changement d'interface est
 * une commande, et la promesse « voici ce que vous verrez » reste vraie.
 *
 * Ce composant ne fait qu'une chose de plus qu'une balise `<img>`, mais elle
 * compte: il PLACE le cadrage. Une capture de 1800 px rendue dans 700 devient
 * illisible si on la montre en entier; on en montre donc le haut, à l'échelle,
 * et le bas sort du cadre. D'où `object-cover` avec une origine réglable, et
 * un rapport imposé par l'appelant plutôt que par le fichier.
 */
interface ScreenShotProps {
  /** Nom du fichier dans `public/screens`, sans extension. */
  name: string;
  /** Ce que la capture montre, pour qui ne la voit pas. */
  alt: string;
  /** Rapport du cadre, en classe Tailwind (`aspect-[16/10]` par défaut). */
  aspect?: string;
  /** Origine du cadrage (`object-top` par défaut). */
  position?: string;
  className?: string;
  /** `eager` pour la première capture de la page, qui entre dans le pli. */
  loading?: 'eager' | 'lazy';
}

export default function ScreenShot({
  name,
  alt,
  aspect = 'aspect-[16/10]',
  position = 'object-top',
  className = '',
  loading = 'lazy',
}: ScreenShotProps) {
  return (
    <div className={`${aspect} overflow-hidden bg-q2-void ${className}`}>
      <img
        src={`/screens/${name}.webp`}
        alt={alt}
        loading={loading}
        decoding="async"
        className={`w-full h-full object-cover ${position} select-none`}
      />
    </div>
  );
}
