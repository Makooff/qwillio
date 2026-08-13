import type { SVGProps } from 'react';

/**
 * Le pictogramme d'attente: trois points qui rebondissent l'un après l'autre.
 *
 * Il remplace le `Loading` de coolicons FAIT TOURNER par `animate-spin`. Ce
 * glyphe est composé de trois points en diagonale; le mettre en rotation fait
 * pivoter le bloc entier autour de son centre, si bien que les points se
 * suivent en cercle sans qu'aucun n'ait de mouvement propre. À 16 px, cela ne
 * se lit pas comme une progression: cela se lit comme un objet qui tourne sur
 * lui-même (retour utilisateur).
 *
 * La géométrie ne change pas — mêmes trois points, aux mêmes coordonnées que
 * le glyphe d'origine — seule la façon de les animer change: chacun monte et
 * redescend à son tour.
 *
 * Trois détails font la fluidité, et aucun n'est décoratif:
 *
 * 1. Le décalage (0,14 s) vaut MOINS que la durée d'un saut: le deuxième point
 *    décolle pendant que le premier redescend, et c'est ce chevauchement qui
 *    fait une vague. Plus large, on verrait trois sauts séparés; nul, un seul
 *    mouvement.
 * 2. Deux courbes et non une: la montée décélère (elle lutte contre la
 *    pesanteur), la descente accélère puis se pose. Une courbe symétrique
 *    donnerait le rebond en caoutchouc des chargeurs génériques.
 * 3. Un temps mort en fin de cycle (78 % de la durée), sinon la vague repart
 *    avant d'être finie et se brouille.
 *
 * Seul `transform` est animé, donc rien ne remonte au calcul de mise en page —
 * ce qui compte ici, puisque ce pictogramme tourne précisément pendant que la
 * page est occupée à autre chose. Les images-clés vivent dans `globals.css`:
 * une balise `<style>` par instance en poserait autant que de boutons en
 * attente sur la page.
 *
 * `currentColor` et `viewBox` d'origine: il reste un ICÔNE, donc il se
 * dimensionne et se colore comme ses voisines, par `size` ou par des classes.
 */
export default function LoadingDots({
  size = 24,
  ...props
}: { size?: number | string } & Omit<SVGProps<SVGSVGElement>, 'size'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Chargement"
      {...props}
    >
      {/* Les coordonnées du glyphe coolicons, au point près. Le rayon de 2
          rend la même épaisseur que son cercle de rayon 1 tracé en 2 px. */}
      <circle className="qw-dot qw-dot--1" cx="6" cy="14" r="2" fill="currentColor" />
      <circle className="qw-dot qw-dot--2" cx="12" cy="12" r="2" fill="currentColor" />
      <circle className="qw-dot qw-dot--3" cx="18" cy="10" r="2" fill="currentColor" />
    </svg>
  );
}
