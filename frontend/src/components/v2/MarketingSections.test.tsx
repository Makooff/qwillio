import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { BenefitsGrid, LaunchSteps, EcosystemMosaic } from './MarketingSections';

vi.mock('./RevealV2', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('./TryVoiceButton', () => ({ default: ({ children }: { children: ReactNode }) => <button>{children}</button> }));
afterEach(cleanup);
const wrap = (children: ReactNode) => render(<MemoryRouter>{children}</MemoryRouter>);

describe('Separate visual marketing sections', () => {
  it('keeps six benefits but only three distinct editorial visuals, not a six-card grid', () => {
    const { container } = wrap(<BenefitsGrid isFr />);
    expect(screen.getByRole('heading', { name: 'Puissante là où ça compte.' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-benefit]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-benefit-story]')).toHaveLength(3);
    expect(container.querySelector('.qms-benefits-grid')).toBeNull();
    expect(container.querySelector('.qms-device-phone img')).toHaveAttribute('src', '/screens/fiche-appel-phone.webp');
    expect(container.querySelector('.qms-device-mac img')).toHaveAttribute('src', '/marketing/macbook-figma-safari.webp');
    expect(container.querySelector('.qms-mac-display')).toBeNull();
    expect(screen.getByRole('img', { name: /MacBook Pro.*Safari/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mr.Mockup' })).toHaveAttribute('href', 'https://www.figma.com/community/file/1176558805861554548/macbook-pro-mockups');
    expect(container.querySelector('.qms-benefit-life img')).toHaveAttribute('src', '/marketing/owner-phone.webp');
    expect(container.querySelectorAll('.qms-benefits .qms-paper')).toHaveLength(0);
    expect(container.textContent).toContain('Votre quota est réservé aux vrais appels');
    expect(container.textContent).toContain('SMS activés');
    expect(container.textContent).toContain('démonstration');
    expect(container.textContent).not.toContain('20 langues');
  });
  it('presents three onboarding images independently of the configuration feature list', () => {
    const { container } = wrap(<LaunchSteps isFr />);
    expect(container.querySelectorAll('[data-launch-step]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-launch-step] .qms-media')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Tester un appel' }).closest('.qms-call-preview')).not.toBeNull();
    expect(container.querySelector('.qms-launch-photo')).toBeNull();
    expect(container.querySelector('.qms-media--test img')).toHaveAttribute('src', '/marketing/unique-test-blur.webp');
    expect(container.textContent).not.toMatch(/en 24|en 48|en quelques minutes/);
  });
  it('uses an asymmetric ecosystem mosaic with real contexts and clear connection requirements', () => {
    const { container } = wrap(<EcosystemMosaic isFr />);
    expect(screen.getByRole('heading', { name: 'Vos outils. Le même accueil.' })).toBeInTheDocument();
    expect(container.querySelector('.qms-ecosystem-photo img')).toHaveAttribute('src', '/marketing/restaurant.webp');
    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(screen.getByText('SMS')).toBeInTheDocument();
    expect(screen.getByText(/Zapier, Make, n8n via webhook/)).toBeInTheDocument();
    expect(container.textContent).toContain('Google ou Outlook');
    expect(container.textContent).not.toContain('WhatsApp');
  });
  it('does not reuse the same image or booking/SMS illustration across the three sections', () => {
    const { container } = wrap(<><BenefitsGrid isFr /><LaunchSteps isFr /><EcosystemMosaic isFr /></>);
    const sources = [...container.querySelectorAll('.qms img')].map(img => img.getAttribute('src'));
    expect(new Set(sources).size).toBe(sources.length);
    expect(screen.queryByText('Rendez-vous confirmé')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.qms-connections')).toHaveLength(1);
  });
  it.each([BenefitsGrid, LaunchSteps, EcosystemMosaic])('renders the section in English', Component => {
    const { container } = wrap(<Component isFr={false} />);
    expect(container.querySelector('h2')).toBeInTheDocument();
    expect(container.querySelectorAll('.qms img').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('Établissement');
  });
});
