import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ProductIllustration, {
  PRODUCT_ILLUSTRATION_KINDS,
  type ProductIllustrationKind,
} from './ProductIllustration';

afterEach(cleanup);

describe('ProductIllustration', () => {
  it.each([true, false])('keeps the hero focused on the call and booking (French: %s)', (isFr) => {
    const { container } = render(<ProductIllustration kind="overview" isFr={isFr} />);
    expect(container.querySelector('.pi-overview__note')).toBeNull();
    expect(container.textContent).not.toMatch(/Transmise à votre équipe|Forwarded to your team/);
    expect(container.querySelector('.pi-overview__phone')).toBeInTheDocument();
    expect(container.querySelector('.pi-overview__booking')).toBeInTheDocument();
  });
  it.each(PRODUCT_ILLUSTRATION_KINDS)('rend le genre « %s » en français', (kind) => {
    render(<ProductIllustration kind={kind} isFr />);
    expect(
      screen.getByRole('img', {
        name: /Illustration du fonctionnement/u,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Illustration du fonctionnement')).toBeInTheDocument();
  });

  it.each(PRODUCT_ILLUSTRATION_KINDS)('rend le genre « %s » en anglais', (kind) => {
    render(<ProductIllustration kind={kind} isFr={false} />);
    expect(
      screen.getByRole('img', { name: /How it works illustration/u }),
    ).toBeInTheDocument();
    expect(screen.getByText('How it works illustration')).toBeInTheDocument();
  });

  it.each([true, false])('explains FAQ-backed answers rather than showing an intake form (French: %s)', (isFr) => {
    const { container } = render(<ProductIllustration kind="knowledge" isFr={isFr} />);
    expect(screen.getByText('FAQ')).toBeInTheDocument();
    expect(screen.getByText(isFr ? 'Base de connaissances' : 'Knowledge base')).toBeInTheDocument();
    expect(container.querySelector('.pi-knowledge__answer')).toBeInTheDocument();
    expect(container.querySelector('.pi-intake__grid')).toBeNull();
  });
  it('shows an instruction and changed setting, not a generic launch checklist', () => {
    const { container } = render(<ProductIllustration kind="setup" isFr />);
    expect(screen.getByText('Votre consigne')).toBeInTheDocument();
    expect(screen.getByText('09:00 — 13:00')).toBeInTheDocument();
    expect(container.querySelector('.pi-setup__item')).toBeNull();
  });
  it('couvre les dix genres attendus', () => {
    expect(PRODUCT_ILLUSTRATION_KINDS).toEqual([
      'overview',
      'booking',
      'transfer',
      'intake',
      'returning',
      'knowledge',
      'setup',
      'conversation',
      'summary',
      'insight',
    ] satisfies ProductIllustrationKind[]);
  });

  it('pose une légende thémée et compact optionnel', () => {
    render(<ProductIllustration kind="setup" isFr compact />);
    const caption = screen.getByText('Illustration du fonctionnement');
    expect(caption).toHaveClass('q2-body-text');
    expect(screen.getByRole('img')).toHaveClass('pi--compact');
  });

  it('le dessin interne est masqué aux technologies d’assistance', () => {
    render(<ProductIllustration kind="overview" isFr />);
    const draw = document.querySelector('.pi__draw');
    expect(draw).toHaveAttribute('aria-hidden', 'true');
  });

  it('aucune image « écran » ni « personnage » externe', () => {
    render(<ProductIllustration kind="intake" isFr />);
    expect(document.querySelector('.pi img')).toBeNull();
    for (const src of ['/screens', '/characters']) {
      expect(document.querySelector(`img[src^="${src}"]`)).toBeNull();
    }
  });

  it('aucun faux contrôle interactif à l’intérieur du dessin', () => {
    render(<ProductIllustration kind="conversation" isFr />);
    const frame = document.querySelector('.pi__frame');
    expect(frame).not.toBeNull();
    expect(frame!.querySelectorAll('button, a, input, textarea, select')).toHaveLength(0);
  });

  it('désactive l’entrée animée en réduction de mouvement', () => {
    render(<ProductIllustration kind="booking" isFr />);
    expect(document.querySelector('.pi__rise')).not.toBeNull();
  });
});
