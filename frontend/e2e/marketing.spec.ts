import { test, expect } from '@playwright/test';

test.describe('Public marketing surface — smoke', () => {
  test('home page renders and has the expected title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Qwillio/i);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('pricing page renders and shows all four tiers', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page).toHaveTitle(/Pricing|Tarifs/i);
    // Solo banner (EUR entry) + Starter + Pro + Enterprise
    await expect(page.getByRole('heading', { name: /^Solo$/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Starter$/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Pro$/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Enterprise$/ })).toBeVisible();
    // Solo tier displays EUR
    await expect(page.getByText(/149\s*€/)).toBeVisible();
  });

  test('blog page lists the 4 published articles as links', async ({ page }) => {
    await page.goto('/blog');
    await expect(page).toHaveTitle(/Blog|Qwillio/i);
    const articleLinks = page.locator('a[href^="/blog/"]');
    await expect(articleLinks).toHaveCount(5);
  });

  test('a blog article page renders body content', async ({ page }) => {
    await page.goto('/blog/ai-vs-human-receptionist-cost');
    await expect(page.locator('h1')).toBeVisible();
    // Article body has multiple h2 sections
    const h2s = page.locator('article h2');
    await expect(h2s.first()).toBeVisible();
    // Back-to-blog link exists
    await expect(page.getByRole('link', { name: /Back to blog|Retour au blog/i })).toBeVisible();
  });

  test('unknown blog slug redirects back to /blog index', async ({ page }) => {
    await page.goto('/blog/does-not-exist');
    await expect(page).toHaveURL(/\/blog$/);
  });

  test('login page renders form controls', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button').first()).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('comparison page vs Smith.ai renders body + CTA', async ({ page }) => {
    await page.goto('/vs/smith-ai');
    await expect(page.locator('h1')).toContainText(/Smith\.ai/);
    await expect(page.locator('article h2').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Create account|Créer un compte/i })).toBeVisible();
  });

  test('comparison page vs Yelda renders body + CTA', async ({ page }) => {
    await page.goto('/vs/yelda');
    await expect(page.locator('h1')).toContainText(/Yelda/);
    await expect(page.locator('article h2').first()).toBeVisible();
  });

  test('unknown comparison slug redirects to /pricing', async ({ page }) => {
    await page.goto('/vs/does-not-exist');
    await expect(page).toHaveURL(/\/pricing$/);
  });

  test('SLA page renders the plan commitments table', async ({ page }) => {
    await page.goto('/sla');
    await expect(page.locator('h1')).toContainText(/SLA|Service/);
    await expect(page.getByRole('columnheader', { name: /Starter/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Pro/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Enterprise/ })).toBeVisible();
  });

  test('pricing toggle Monthly ↔ Annual updates displayed price', async ({ page }) => {
    await page.goto('/pricing');
    // Starter shows 497 in monthly; 398 in annual (497 * 0.80 rounded)
    await expect(page.getByText('$497').first()).toBeVisible();
    await page.getByRole('button', { name: /Annual|Annuel/ }).click();
    await expect(page.getByText('$398').first()).toBeVisible();
  });
});
