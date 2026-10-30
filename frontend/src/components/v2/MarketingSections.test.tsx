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
  it('gives six useful benefits their own image-first gallery', () => {
    const { container } = wrap(<BenefitsGrid isFr />);
    expect(screen.getByRole('heading', { name: 'Puissante là où ça compte.' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-benefit]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-benefit] .qms-media')).toHaveLength(6);
    expect(container.querySelector('[data-scene-act]')).toBeNull();
    expect(screen.getByText('Filtre anti-spam')).toBeInTheDocument();
    expect(container.querySelector('.qms-media--calendar')).toBeNull();
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
    expect(screen.getAllByText('Rendez-vous confirmé')).toHaveLength(1);
    expect(container.querySelectorAll('.qms-connections')).toHaveLength(1);
  });
  it.each([BenefitsGrid, LaunchSteps, EcosystemMosaic])('renders the section in English', Component => {
    const { container } = wrap(<Component isFr={false} />);
    expect(container.querySelector('h2')).toBeInTheDocument();
    expect(container.querySelectorAll('.qms-media img').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('Établissement');
  });
});
