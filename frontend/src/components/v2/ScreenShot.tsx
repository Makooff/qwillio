/**
 * Une capture du VRAI portail, posée dans le site.
 *
 * Ces images ne sont ni des dessins ni des reconstitutions: elles sortent de
 * `frontend/capture-screens.mjs`, qui ouvre le portail livré sur un faux
 * backend et le photographie. Les régénérer après un changement d'interface est
 * une commande, et la promesse « voici ce que vous verrez » reste vraie.
 *
 * Par défaut, l'image est montrée ENTIÈRE, à son propre rapport (demande
 * utilisateur: « ne rogne pas les sections »). C'est le pendant de la règle de
 * capture: on photographie la carte, pas un rectangle découpé dedans, et on ne
 * lui redécoupe pas ensuite les bords à l'affichage. La lisibilité vient du
 * cadrage à la prise de vue, jamais d'un recadrage au rendu.
 *
 * `aspect` reste possible quand une place fixe est nécessaire; le rognage est
 * alors explicite, et son origine réglable.
 */
interface ScreenShotProps {
  /** Nom du fichier dans `public/screens`, sans extension. */
  name: string;
  /** Ce que la capture montre, pour qui ne la voit pas. */
  alt: string;
  /** Rapport IMPOSÉ, en classe Tailwind. Sans lui, l'image garde le sien. */
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
  aspect,
  position = 'object-top',
  className = '',
  loading = 'lazy',
}: ScreenShotProps) {
  return (
    <div className={`overflow-hidden bg-q2-void ${aspect ?? ''} ${className}`}>
      <img
        src={`/screens/${name}.webp`}
        alt={alt}
        loading={loading}
        decoding="async"
        className={
          aspect
            ? `w-full h-full object-cover ${position} select-none`
            : 'block w-full h-auto select-none'
        }
      />
    </div>
  );
}
