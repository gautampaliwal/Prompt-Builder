import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestServices, renderRoutes } from '../../../tests/helpers/app';
import { templateSchema, type Template } from '../../core/schema/template';
import { BUILT_IN_TEMPLATES } from '../../data/templates';
import { PromptEditorPage } from '../editor/PromptEditorPage';
import { BuilderPage, clearBuilderScratch } from './BuilderPage';

const preview = () => screen.getByTestId('prompt-preview');
const renderBuilder = (templates?: readonly Template[], services = makeTestServices()) =>
  renderRoutes(
    {
      '/builder': <BuilderPage templates={templates} />,
      '/prompts/:id': <PromptEditorPage autosaveDelayMs={10} />,
      '/library': <p>Library</p>,
    },
    { url: '/builder', services },
  );

beforeEach(() => {
  clearBuilderScratch();
});

describe('BuilderPage', () => {
  it('renders a field for every Structured Prompt variable, marking the task required', () => {
    renderBuilder();
    expect(screen.getByLabelText(/Task or objective/)).toHaveAttribute('aria-required', 'true');
    for (const label of [
      'Role or perspective',
      'Background context',
      'Input data',
      'Constraints and instructions',
      'Tone',
      'Desired length',
      'Output format',
      'Examples',
    ]) {
      expect(screen.getByLabelText(new RegExp(label))).toBeInTheDocument();
    }
  });

  it('updates the preview, stats and issues live as the user types', async () => {
    const user = userEvent.setup();
    renderBuilder();

    // Before typing: the missing task is listed, and the preview shows it unresolved.
    expect(screen.getByRole('heading', { name: /Needs attention/ })).toBeInTheDocument();
    expect(preview()).toHaveTextContent('{{task}}');

    await user.type(screen.getByLabelText(/Task or objective/), 'Summarize the notes.');
    await user.type(screen.getByLabelText(/Role or perspective/), 'an editor');
    await user.selectOptions(screen.getByLabelText(/^Tone/), 'Formal');

    expect(preview().textContent).toBe(
      'Act as an editor.\n\nTask:\nSummarize the notes.\n\nTone: Formal.',
    );
    expect(screen.getByText('No issues found.')).toBeInTheDocument();
    const stats = screen.getByTestId('prompt-stats');
    // 17 + 2 + 26 + 2 + 13 = 60 Basic Latin chars → ceil(60 / 4) = 15 tokens.
    expect(stats).toHaveTextContent('60 characters · 10 words');
    expect(stats).toHaveTextContent('≈ 15 tokens (approximate)');
  });

  it('shows a field error only after the field has been touched', async () => {
    const user = userEvent.setup();
    renderBuilder();
    const task = screen.getByLabelText(/Task or objective/);
    expect(task).not.toHaveAttribute('aria-invalid');

    await user.click(task);
    await user.tab();
    expect(task).toHaveAttribute('aria-invalid', 'true');
    expect(task).toHaveAccessibleDescription(/Task or objective is required/);
  });

  it('copies the rendered prompt to the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderBuilder();
    await user.type(screen.getByLabelText(/Task or objective/), 'Do it.');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('Task:\nDo it.');
    expect(screen.getByText('Copied to clipboard.')).toBeInTheDocument();
  });

  it('switches templates and resets the form to the new defaults', async () => {
    const user = userEvent.setup();
    const other = templateSchema.parse({
      schemaVersion: '1.0.0',
      id: 'other',
      name: 'Other',
      category: 'general',
      template: {
        type: 'structured',
        sections: [{ id: 'a', label: 'A', enabled: true, required: true, content: 'Hi {{who}}' }],
      },
      variables: [
        { name: 'who', label: 'Who', type: 'string', required: true, defaultValue: 'team' },
      ],
      metadata: { createdAt: '2026-10-27T00:00:00.000Z', updatedAt: '2026-10-27T00:00:00.000Z' },
    });
    renderBuilder([...BUILT_IN_TEMPLATES, other]);
    await user.selectOptions(screen.getByLabelText('Template'), 'other');
    expect(preview()).toHaveTextContent('Hi team');
    expect(within(screen.getByRole('form')).getAllByRole('textbox')).toHaveLength(1);
  });

  it('saves the prompt with a suggested title and opens it in the editor', async () => {
    const user = userEvent.setup();
    const { services } = renderBuilder();
    await user.type(screen.getByLabelText(/Task or objective/), 'Plan the team offsite.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const title = screen.getByLabelText('Title');
    expect(title).toHaveValue('Plan the team offsite.');
    await user.clear(title);
    await user.type(title, 'Offsite plan');
    await user.click(screen.getByRole('button', { name: 'Save prompt' }));

    expect(await screen.findByText('Saved as version 1.')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/prompts\//);
    const { prompts } = await services.prompts.list();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({
      title: 'Offsite plan',
      draft: 'Task:\nPlan the team offsite.',
      currentVersion: 1,
      sourceTemplateId: 'builtin-structured-prompt',
    });
    expect(prompts[0]?.variableValues?.task).toBe('Plan the team offsite.');
  });

  it('requires a title, and keeps the input if saving fails', async () => {
    const user = userEvent.setup();
    const base = makeTestServices();
    const create = vi.fn(() => Promise.reject(new Error('QuotaExceededError')));
    renderBuilder(undefined, { ...base, prompts: { ...base.prompts, create } });
    await user.type(screen.getByLabelText(/Task or objective/), 'Keep me.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: 'Save prompt' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the prompt a title.');
    expect(create).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Title'), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save prompt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/QuotaExceededError.*still here/);
    expect(screen.getByLabelText(/Task or objective/)).toHaveValue('Keep me.');
    expect(screen.getByTestId('location')).toHaveTextContent('/builder');
  });

  it('keeps unsaved input when leaving and coming back during the session', async () => {
    const user = userEvent.setup();
    const first = renderBuilder();
    await user.type(screen.getByLabelText(/Task or objective/), 'Draft in progress');
    first.unmount();
    renderBuilder();
    expect(screen.getByLabelText(/Task or objective/)).toHaveValue('Draft in progress');
  });
});
