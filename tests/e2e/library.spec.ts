import { expect, test } from './network-guard';

test('journey 1: build, save, edit, version, reload and reopen from the Library', async ({
  page,
}) => {
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'No saved prompts yet' })).toBeVisible();

  // Build and save.
  await page.getByRole('link', { name: 'Open the Builder' }).click();
  await page.getByLabel(/Task or objective/).fill('Draft the v2 release note.');
  await page.getByLabel(/Role or perspective/).fill('a technical writer');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Draft the v2 release note.');
  await page.getByLabel('Title').fill('Release note');
  await page.getByRole('button', { name: 'Save prompt' }).click();

  await expect(page).toHaveURL(/\/prompts\/[\w-]+$/);
  await expect(page.getByText('Saved as version 1.')).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('Release note');

  // Edit → autosave, then save a version.
  await page.getByLabel(/Task or objective/).fill('Draft the v2 release note. Keep it short.');
  await expect(page.getByText('All changes saved')).toBeVisible();
  await page.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByText('Saved version 2.')).toBeVisible();

  // Reload: everything is still there.
  await page.reload();
  await expect(page.getByLabel(/Task or objective/)).toHaveValue(
    'Draft the v2 release note. Keep it short.',
  );
  await expect(page.getByLabel(/Role or perspective/)).toHaveValue('a technical writer');
  await expect(page.getByRole('button', { name: 'Restore version 1' })).toBeVisible();
  await expect(page.getByTestId('diff-summary')).toHaveText('1 line added · 1 line removed');

  // Find it in the Library and reopen it.
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Library' })
    .click();
  await page.getByLabel('Search').fill('keep it short');
  const card = page.getByTestId('prompt-card');
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('heading')).toHaveText('Release note');
  await expect(card).toContainText('v2');
  await card.getByRole('link', { name: 'Release note', exact: true }).click();
  await expect(page.getByLabel(/Task or objective/)).toHaveValue(
    'Draft the v2 release note. Keep it short.',
  );
});

test('a deleted prompt leaves the Library, and its URL says it is gone', async ({ page }) => {
  await page.goto('/builder');
  await page.getByLabel(/Task or objective/).fill('Temporary prompt');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Save prompt' }).click();
  await expect(page).toHaveURL(/\/prompts\//);
  const url = page.url();

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete prompt' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByText('Prompt deleted.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No saved prompts yet' })).toBeVisible();

  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Prompt not found' })).toBeVisible();
});
