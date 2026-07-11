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
    await expect(articleLinks).toHaveCount(4);
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
});
