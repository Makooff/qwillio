import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useLang } from '../../stores/langStore';
import { COMPARISON_PAGES } from '../../content/comparisons';
import { BLOG_ARTICLES } from '../../content/blogArticles';
import { PLANS } from '../../../../backend/src/config/plans';
import { PLAN_MONTHLY_EUR, PLAN_MINUTES, PLAN_OVERAGE_EUR } from './pricing-plans';
import ComparisonPage from './ComparisonPage';
import Pricing from './Pricing';
import Faq from './Faq';

vi.mock('../../components/v2/PublicShell', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('../../components/v2/RevealV2', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../../hooks/useSEO', () => ({ useSEO: vi.fn() }));
afterEach(() => { cleanup(); useLang.setState({ lang: 'fr' }); });

const forbidden = /July 2026|juillet 2026|cheapest|moins cher du marché|Founded in|Fondée en|No \(US\)|15 minutes|15 min|quinze minutes|same day|jour même|two.week|deux semaines|five to ten|cinq à dix|sans compteur|without per.minute|no per.minute meter/i;

describe('Public comparisons render useful, supportable claims in both languages', () => {
  it('retains all seven comparisons', () => expect(COMPARISON_PAGES).toHaveLength(7));
  for (const page of COMPARISON_PAGES) {
    it.each(['fr', 'en'] as const)(`${page.slug} (%s) keeps tables, exact plan units and conditional activation`, (lang) => {
      useLang.setState({ lang });
      const { container } = render(<MemoryRouter initialEntries={[`/vs/${page.slug}`]}><Routes><Route path="/vs/:slug" element={<ComparisonPage />} /></Routes></MemoryRouter>);
      const text = container.textContent!;
      expect(text).not.toMatch(forbidden);
      expect(container.querySelectorAll('table').length).toBeGreaterThanOrEqual(2);
      expect(text).toContain('Solo');
      expect(text).toContain('Enterprise');
      expect(text).toMatch(/250 min/);
      expect(text).toMatch(lang === 'fr' ? /carte requise/ : /card required/);
      expect(text).toMatch(lang === 'fr' ? /opérateur/ : /carrier/);
      expect(text).toMatch(lang === 'fr' ? /agenda Google ou Outlook connecté/ : /connected Google or Outlook calendar/);
      expect(text).toMatch(lang === 'fr' ? /7 jours/ : /7.day/);
    });
  }
});

describe('Rendered pricing and FAQ match the active core constraints', () => {
  it.each(['fr', 'en'] as const)('Enterprise (%s) advertises line instructions, not line voices', (lang) => {
    useLang.setState({ lang });
    const { container } = render(<MemoryRouter><Pricing /></MemoryRouter>);
    const text = container.textContent!;
    expect(text).not.toMatch(/settings \(voice|ligne \(voix/);
    expect(text).toMatch(lang === 'fr' ? /accueil, instructions, transfert/ : /greeting, instructions, transfer/);
    expect(text).toMatch(lang === 'fr' ? /voix du profil principal/ : /main profile voice/);
    expect(text).not.toMatch(/3 000 – 8 000|4 to 8 weeks|4 à 8 sem|15 min|same day|jour même/);
    expect(text).toMatch(lang === 'fr' ? /ordonnanceur actif/ : /scheduler active/);
    expect(text).toMatch(lang === 'fr' ? /email configuré/ : /email configured/);
    expect(text).toMatch(lang === 'fr' ? /contacts avec email/ : /contacts with email/);
    expect(text).toMatch(lang === 'fr' ? /scénario.*configuré/ : /configured.*workflow/);
  });
  it.each(['fr', 'en'] as const)('FAQ (%s) conditions weekly dispatch on scheduler and email', (lang) => {
    useLang.setState({ lang });
    const { container } = render(<MemoryRouter><Faq /></MemoryRouter>);
    const text = container.textContent!;
    expect(text).toMatch(lang === 'fr' ? /ordonnanceur actif/ : /scheduler active/);
    expect(text).toMatch(lang === 'fr' ? /email configuré/ : /email configured/);
    expect(text).not.toMatch(/15 minutes|15 min|40 à 100|40 to 100/);
  });
  it('keeps four public plans aligned with the real billing configuration', () => {
    expect(Object.keys(PLAN_MONTHLY_EUR)).toEqual(['solo', 'starter', 'pro', 'enterprise']);
    for (const id of Object.keys(PLAN_MONTHLY_EUR) as (keyof typeof PLANS)[]) {
      expect(PLAN_MONTHLY_EUR[id]).toBe(PLANS[id].monthlyPriceEur);
      expect(PLAN_MINUTES[id]).toBe(PLANS[id].includedMinutes);
      expect(PLAN_OVERAGE_EUR[id]).toBe(PLANS[id].overagePerMinuteEur);
      expect(PLANS[id].trialDays).toBe(7);
    }
  });
});

describe('Shared blog data does not reintroduce invented product capabilities', () => {
  it.each(['fr', 'en'] as const)('keeps every article substantive and removes unsupported automation (%s)', (lang) => {
    for (const article of BLOG_ARTICLES) {
      const blocks = article.content[lang];
      expect(blocks.length).toBeGreaterThanOrEqual(8);
      const text = JSON.stringify(blocks);
      expect(text).not.toMatch(/40 %|photo.upload link|lien d.envoi de photo|waitlist auto.refill|relance automatique de la liste|0[,.]15 à 0[,.]65 € par appel|0\.15 to 0\.65 € per call|unlimited calls|sans coût à la minute|sans frais à la minute/);
    }
  });
});
