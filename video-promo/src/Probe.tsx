import React from 'react';
import { AbsoluteFill } from 'remotion';
import '../../frontend/src/styles/v2.css';
import ProductIllustration, { PRODUCT_ILLUSTRATION_KINDS } from '../../frontend/src/components/v2/ProductIllustration';
import './site-illustrations.css';
import { useOutfit } from './lib';

/** Planche de contrôle : les dix illustrations du site, rendues par Remotion. */
export const Probe: React.FC = () => {
  useOutfit();
  return (
    <AbsoluteFill style={{ background: '#FDFCFC', fontFamily: 'Outfit, sans-serif', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24, alignContent: 'start' }}>
      {PRODUCT_ILLUSTRATION_KINDS.map((k) => (
        <div key={k}><div style={{ fontSize: 22, marginBottom: 6 }}>{k}</div><ProductIllustration kind={k} isFr /></div>
      ))}
    </AbsoluteFill>
  );
};
