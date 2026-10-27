import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeTestServices, renderRoutes, seedTemplatePrompt } from '../../../tests/helpers/app';
import type { Services } from '../../services';
import { PromptEditorPage } from './PromptEditorPage';

function renderEditor(services: Services, id: string) {
  return renderRoutes(
    {
      '/prompts/:id': <PromptEditorPage autosaveDelayMs={20} />,
      '/library': <p>Library page</p>,
    },
    { url: `/prompts/${id}`, services },
  );
}

const draftOf = async (services: Services, id: string) => (await services.prompts.get(id))?.draft;

describe('PromptEditorPage', () => {
  it('opens a template-bound prompt in its form and autosaves edits', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    const p = await seedTemplatePrompt(services);
    renderEditor(services, p.id);

    const task = await screen.findByLabelText(/Task or objective/);
    expect(task).toHaveValue('Write the weekly update.');
    expect(screen.getByLabelText('Title')).toHaveValue('Weekly update');
    expect(screen.getByText('All changes saved')).toBeInTheDocument();

    await user.type(task, ' Include blockers.');
    await waitFor(async () =>
      expect(await draftOf(services, p.id)).toBe(
        'Task:\nWrite the weekly update. Include blockers.',
      ),
    );
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
    // Autosave never creates versions.
    expect(await services.prompts.listVersions(p.id)).toHaveLength(1);
  });

  it('keeps the text on screen when saving fails, and saves it on Retry', async () => {
    const user = userEvent.setup();
    const base = makeTestServices();
    const p = await seedTemplatePrompt(base);
    const saveDraft = vi
      .fn(base.prompts.saveDraft)
      .mockRejectedValueOnce(new Error('QuotaExceededError'));
    renderEditor({ ...base, prompts: { ...base.prompts, saveDraft } }, p.id);

    const task = await screen.findByLabelText(/Task or objective/);
    await user.type(task, ' More.');
    expect(await screen.findByText(/Couldn't save: QuotaExceededError/)).toBeInTheDocument();
    expect(task).toHaveValue('Write the weekly update. More.');
    expect(await draftOf(base, p.id)).toBe('Task:\nWrite the weekly update.');

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
    expect(await draftOf(base, p.id)).toBe('Task:\nWrite the weekly update. More.');
  });

  it('saves versions, shows the diff, and restores an earlier one without losing anything', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    const p = await seedTemplatePrompt(services);
    renderEditor(services, p.id);

    const saveVersion = await screen.findByRole('button', { name: 'Save version' });
    expect(saveVersion).toBeDisabled(); // nothing changed since v1

    const task = screen.getByLabelText(/Task or objective/);
    await user.clear(task);
    await user.type(task, 'Write the monthly update.');
    await user.click(saveVersion);
    expect(await screen.findByText('Saved version 2.')).toBeInTheDocument();
    // Wait for the refreshed history; the previous list is replaced when it loads.
    await screen.findByRole('heading', { name: /Version history \(2 versions\)/ });

    // The comparison defaults to the two newest versions.
    expect(screen.getByLabelText('From')).toHaveDisplayValue(/^v1 ·/);
    expect(screen.getByLabelText('To')).toHaveDisplayValue(/^v2 ·/);
    expect(screen.getByTestId('diff-summary')).toHaveTextContent('1 line added · 1 line removed');
    expect(screen.getByText('Removed:', { exact: false }).parentElement).toHaveTextContent(
      'Write the weekly update.',
    );

    await user.click(screen.getByRole('button', { name: 'Restore version 1' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Restore v1?');
    await user.click(screen.getByRole('button', { name: 'Restore v1' }));

    expect(await screen.findByText('Restored v1 as version 3.')).toBeInTheDocument();
    expect(await screen.findByLabelText(/Task or objective/)).toHaveValue(
      'Write the weekly update.',
    );
    const versions = await services.prompts.listVersions(p.id);
    expect(versions.map((v) => [v.number, v.origin])).toEqual([
      [1, 'manual'],
      [2, 'manual'],
      [3, 'restore'],
    ]);
  });

  it('edits plain-text prompts in a text area', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    const p = await services.prompts.create({ title: 'Imported', text: 'Line one' });
    renderEditor(services, p.id);

    const text = await screen.findByLabelText('Prompt text');
    expect(text).toHaveValue('Line one');
    await user.type(text, '{Enter}Line two');
    await waitFor(async () => expect(await draftOf(services, p.id)).toBe('Line one\nLine two'));
    expect(screen.queryByRole('button', { name: 'Convert to plain text' })).not.toBeInTheDocument();
  });

  it('converts a template prompt to plain text after confirmation', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    const p = await seedTemplatePrompt(services);
    renderEditor(services, p.id);

    await user.click(await screen.findByRole('button', { name: 'Convert to plain text' }));
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    expect(await screen.findByLabelText('Prompt text')).toHaveValue(
      'Task:\nWrite the weekly update.',
    );
    expect(screen.getByText(/Converted to plain text/)).toBeInTheDocument();
    expect((await services.prompts.get(p.id))?.variableValues).toBeUndefined();
  });

  it('updates title, tags, category and favorite', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    const p = await seedTemplatePrompt(services);
    renderEditor(services, p.id);

    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Status report{Enter}');
    await user.type(screen.getByLabelText(/Tags/), 'work, Work, weekly');
    await user.tab();
    await user.selectOptions(screen.getByLabelText('Category'), 'communication');
    await user.click(screen.getByRole('button', { name: 'Favorite' }));

    await waitFor(async () =>
      expect(await services.prompts.get(p.id)).toMatchObject({
        title: 'Status report',
        tags: ['work', 'weekly'],
        category: 'communication',
        favorite: true,
      }),
    );
    expect(screen.getByLabelText(/Tags/)).toHaveValue('work, weekly');

    // A blank title is refused and the previous one is kept.
    await user.clear(title);
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('A title is required');
    expect(title).toHaveValue('Status report');
  });

  it('deletes after confirmation and returns to the Library', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    const p = await seedTemplatePrompt(services);
    renderEditor(services, p.id);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('all 1 version');
    await user.click(screen.getByRole('button', { name: 'Delete prompt' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/library'));
    expect(await services.prompts.get(p.id)).toBeUndefined();
  });

  it('duplicates and opens the copy', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    const p = await seedTemplatePrompt(services);
    renderEditor(services, p.id);

    await user.click(await screen.findByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByText("Duplicated. You're editing the copy.")).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Weekly update (copy)');
    expect(screen.getByTestId('location')).not.toHaveTextContent(p.id);
  });

  it('shows a clear message for a prompt that does not exist', async () => {
    renderEditor(makeTestServices(), 'nope');
    expect(await screen.findByRole('heading', { name: 'Prompt not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the Library' })).toBeInTheDocument();
  });
});
