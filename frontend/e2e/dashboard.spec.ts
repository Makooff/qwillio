import { test, expect } from '@playwright/test';
import { API, signIn } from './support/api';

/**
 * Les parcours dont dépend le chiffre d'affaires.
 *
 * Les 118 tests unitaires couvrent des unités. Aucun ne dit si « j'arrive
 * connecté → je règle mon agent → mon réglage survit au rechargement »
 * fonctionne encore après un déploiement, et c'est pourtant le seul
 * enchaînement que le client parcourt vraiment.
 */

test.describe('Accès au portail', () => {
  /* La garde de route, dans les deux sens. Une garde trop laxiste laisse
     entrer un visiteur; trop stricte, elle éjecte un client qui paie. Les
     deux se sont déjà produites dans des applications de cette forme, et
     aucune ne se voit en développement, où l'on est toujours connecté. */
  test('renvoie un visiteur sans session vers la connexion', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('laisse entrer un client authentifié', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/receptionist');
    await expect(page).toHaveURL(/\/dashboard\/receptionist/);
    await expect(page.getByRole('heading', { name: /Réceptionniste IA/i }).first()).toBeVisible();
  });

  /* Le fil du chat doit être là à l'arrivée: c'est ce qu'on vient faire sur
     cette page, et c'est ce qu'un panneau ouvert par erreur cachait. */
  test('arrive sur le hub, aucun panneau ouvert', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/receptionist');
    await expect(page.getByPlaceholder(/Écrivez ou parlez/i)).toBeVisible();
    // « Identité de l'agent » est une rangée du hub, pas un panneau déployé.
    await expect(page.getByText("Identité de l'agent")).toBeVisible();
  });
});

test.describe('Configuration de la réceptionniste', () => {
  /**
   * La régression que ce test existe pour empêcher, et elle est silencieuse.
   *
   * La page enregistre toute seule, 900 ms après la dernière frappe. Tant
   * qu'elle postait AUSSI les champs de l'entreprise (nom, métier, langue),
   * son envoi écrasait ce que l'autre page venait d'enregistrer, avec la copie
   * chargée à son montage. Rien ne s'affichait de travers: la donnée
   * disparaissait, et on ne s'en apercevait qu'au rechargement suivant.
   *
   * On vérifie donc le CONTENU de l'envoi, pas seulement qu'il part.
   */
  test('n’envoie que ses propres champs', async ({ page }) => {
    await signIn(page);

    const bodies: Record<string, unknown>[] = [];
    await page.route(`${API}/my-dashboard/settings`, async route => {
      if (route.request().method() === 'PUT') {
        bodies.push(route.request().postDataJSON());
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      return route.fallback();
    });

    await page.goto('/dashboard/receptionist');
    await page.getByText(/Transfert d[’']appel/).click();

    const field = page.getByPlaceholder('+1 (555) 000-0000');
    await field.fill('+32 470 12 34 56');

    await expect.poll(() => bodies.length, { timeout: 5_000 }).toBeGreaterThan(0);
    const sent = bodies[bodies.length - 1];

    expect(sent).toHaveProperty('transferNumber');
    // Les champs de l'entreprise appartiennent à Paramètres. Leur présence ici
    // EST le défaut, même si la valeur postée se trouve être la bonne.
    for (const owned of ['businessName', 'businessType', 'agentLanguage', 'contactPhone', 'address']) {
      expect(sent, `« ${owned} » ne doit pas partir depuis Réceptionniste`).not.toHaveProperty(owned);
    }
  });

  /* Un réglage qui ne survit pas au rechargement n'est pas enregistré, quoi
     qu'en dise l'écran. On relit depuis le serveur, pas depuis l'état React. */
  test('relit les réglages du serveur au chargement', async ({ page }) => {
    await signIn(page, { agentName: 'Amélie', transferNumber: '+32499887766' });
    await page.goto('/dashboard/receptionist');
    await page.getByText(/Transfert d[’']appel/).click();
    await expect(page.getByPlaceholder('+1 (555) 000-0000')).toHaveValue('+32499887766');
  });
});

test.describe('Honnêteté de ce qui est affiché', () => {
  /**
   * Trois affirmations que le portail a réellement portées et qui étaient
   * fausses: des minutes et des encaissements écrits en dur, un flux « Live »
   * inventé, et un pipeline compté en dollars pour un produit vendu en euros.
   * Elles ne plantaient rien — c'est exactement pour ça qu'elles ont tenu.
   */
  test('le tableau de bord des agents n’invente aucun chiffre', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/agent');
    await expect(page.getByText('1,284')).toHaveCount(0);
    await expect(page.getByText('$14,320')).toHaveCount(0);
    await expect(page.getByText(/Recent AI Actions/i)).toHaveCount(0);
  });

  test('le pipeline compte en euros', async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/crm/deals`, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ id: 'd1', title: 'Contrat', value: 2500, stage: 'new', probability: 50 }]),
      }));
    await page.goto('/dashboard/crm/deals');
    await expect(page.getByRole('heading', { name: /^Pipeline$/ })).toBeVisible();
    await expect(page.getByText('$', { exact: false })).toHaveCount(0);
  });
});
