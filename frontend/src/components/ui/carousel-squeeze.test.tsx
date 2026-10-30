import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SqueezeCarousel from './carousel-squeeze';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('four-panel exploration carousel', () => {
  it('shows each photo once, without a fifth duplicated slat, and still advances', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const slides = ['about', 'blog', 'contact', 'affiliate'].map(name => ({ title: name, image: `/marketing/explore-${name}.webp`, imageAlt: name, description: name }));
    const { container } = render(<SqueezeCarousel slides={slides} />);
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(container.querySelectorAll('img')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('blog');
  });
});
