import { test as base, expect } from '@playwright/test';

/**
 * Every E2E test uses this fixture. It records any request that leaves the
 * preview origin and fails the test if one happened (brief §10, journey 5).
 * Off-origin requests are aborted, so an accidental call can't succeed silently.
 */
export const test = base.extend<{ offOriginRequests: string[] }>({
  offOriginRequests: [
    async ({ page, baseURL }, use) => {
      const origin = new URL(baseURL ?? 'http://localhost').origin;
      const offOrigin: string[] = [];
      await page.route('**/*', async (route) => {
        const url = route.request().url();
        const isLocal =
          url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:');
        if (isLocal) {
          await route.continue();
        } else {
          offOrigin.push(url);
          await route.abort('blockedbyclient');
        }
      });
      await use(offOrigin);
      expect(offOrigin, 'requests left the app origin').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
