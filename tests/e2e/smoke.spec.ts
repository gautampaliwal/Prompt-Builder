import { expect, test } from './network-guard';

test('app shell loads and navigates without leaving the origin', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

  await page.getByRole('link', { name: 'Builder' }).click();
  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Builder');

  // Deep link survives a reload (SPA fallback in preview server).
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Builder');
});

test('network guard catches an off-origin request', async ({ page, offOriginRequests }) => {
  await page.goto('/');
  // Deliberately trigger an off-origin fetch to prove the guard works,
  // then clear it so this test's own teardown assertion passes.
  await page.evaluate(() => fetch('https://example.com/probe').catch(() => undefined));
  expect(offOriginRequests).toEqual(['https://example.com/probe']);
  offOriginRequests.length = 0;
});
