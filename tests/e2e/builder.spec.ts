import { expect, test } from './network-guard';

test('build a prompt from the Structured Prompt template and see it render live', async ({
  page,
}) => {
  await page.goto('/builder');
  await expect(page.getByRole('heading', { level: 1, name: 'Builder' })).toBeVisible();

  const preview = page.getByTestId('prompt-preview');
  // Required task missing: flagged, and visible as an unresolved placeholder.
  await expect(page.getByRole('heading', { name: /Needs attention/ })).toBeVisible();
  await expect(preview).toContainText('{{task}}');

  await page.getByLabel(/Task or objective/).fill('Summarize the meeting notes.');
  await page.getByLabel(/Role or perspective/).fill('a project manager');
  await page.getByLabel(/Output format/).fill('Five bullets.');
  await page.getByLabel(/^Tone/).selectOption('Friendly');

  await expect(preview).toHaveText(
    [
      'Act as a project manager.',
      'Task:\nSummarize the meeting notes.',
      'Tone: Friendly.',
      'Output format:\nFive bullets.',
    ].join('\n\n'),
  );
  await expect(page.getByText('No issues found.')).toBeVisible();
  await expect(page.getByTestId('prompt-stats')).toContainText('tokens (approximate)');

  // Clearing an optional field drops its whole section, label included.
  await page.getByLabel(/Output format/).fill('');
  await expect(preview).not.toContainText('Output format:');
});

test('Builder is keyboard-operable: fields reachable by Tab with visible labels', async ({
  page,
}) => {
  await page.goto('/builder');
  await page.getByLabel('Template').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/Role or perspective/)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/Task or objective/)).toBeFocused();
});
