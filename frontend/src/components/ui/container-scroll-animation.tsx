/**
 * ⚠️ PLUS UTILISÉ PAR LA PAGE D'ACCUEIL.
 *
 * Le hero portait ce redressement 3D sur la fenêtre Safari; il a été remplacé
 * par une simple parallaxe (`Home.tsx`, `HeroDashboardShot`), à la demande.
 * Le composant reste ici parce que c'est une primitive de `components/ui`,
 * complète et testée au rendu, prête à resservir. Si personne ne l'a repris
 * d'ici la prochaine revue, il part.
 */
import React, { useRef } from 'react';
import type { RefObject } from 'react';
import { useScroll, useTransform, motion, type MotionValue, type UseScrollOptions } from 'framer-motion';
import { prefersReducedMotion } from '../v2/motion/reducedMotion';

/**
 * Le redressement au défilement: une carte inclinée qui se relève.
 *
 * Portage d'un composant écrit pour Next. Deux adaptations, toutes deux
 * nécessaires ici:
 *  - `"use client"` saute: ce projet est en Vite, la directive n'y a pas de
 *    sens et le fichier est déjà du code client.
 *  - `next/image` saute côté appelant: c'est une balise `img` qui la remplace,
 *    sans quoi le composant ne compile pas.
 *
 * Le mouvement vit dans `useContainerScrollMotion`, séparé du rendu. C'est ce
 * qui permet à la fenêtre du hero d'avoir EXACTEMENT ce mouvement sans hériter
 * du cadre gris de la carte ci-dessous, qui contredirait le fond plat du site.
 */

const MOBILE_SCALE: [number, number] = [0.7, 0.9];
const DESKTOP_SCALE: [number, number] = [1.05, 1];

/**
 * Les trois valeurs du mouvement, lues sur UN seul défilement.
 *
 * `offset` est laissé à l'appelant, et ce n'est pas un détail: le réglage par
 * défaut suppose un élément qui ENTRE par le bas de la fenêtre. Posé sur un
 * élément déjà visible au chargement (le hero), il démarrerait à mi-course,
 * donc sans inclinaison à voir.
 *
 * En `prefers-reduced-motion`, les trois valeurs sont figées à leur état
 * d'arrivée: la carte est droite, à l'échelle, et rien ne bouge au défilement.
 * C'est la règle du projet, et le composant d'origine ne la tenait pas.
 */
export function useContainerScrollMotion(
  target: RefObject<HTMLElement | null>,
  offset: UseScrollOptions['offset'] = ['start end', 'end start'],
) {
  const { scrollYProgress } = useScroll({ target, offset });
  const [isMobile, setIsMobile] = React.useState(false);
  const [reduced] = React.useState(prefersReducedMotion);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const scaleRange = isMobile ? MOBILE_SCALE : DESKTOP_SCALE;

  const rotate = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], reduced ? [scaleRange[1], scaleRange[1]] : scaleRange);
  const translate = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, -100]);

  return { rotate, scale, translate };
}

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { rotate, scale, translate } = useContainerScrollMotion(containerRef);

  return (
    <div
      className="h-[60rem] md:h-[80rem] flex items-center justify-center relative p-2 md:p-20"
      ref={containerRef}
    >
      <div className="py-10 md:py-40 w-full relative" style={{ perspective: '1000px' }}>
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({
  translate,
  titleComponent,
}: {
  translate: MotionValue<number>;
  titleComponent: React.ReactNode;
}) => (
  <motion.div style={{ translateY: translate }} className="max-w-5xl mx-auto text-center">
    {titleComponent}
  </motion.div>
);

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) => (
  <motion.div
    style={{
      rotateX: rotate,
      scale,
      boxShadow:
        '0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003',
    }}
    className="max-w-5xl -mt-12 mx-auto h-[30rem] md:h-[40rem] w-full border-4 border-[#6C6C6C] p-2 md:p-6 bg-[#222222] rounded-[30px] shadow-2xl"
  >
    <div className="h-full w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-900 md:rounded-2xl md:p-4">
      {children}
    </div>
  </motion.div>
);

export default ContainerScroll;
