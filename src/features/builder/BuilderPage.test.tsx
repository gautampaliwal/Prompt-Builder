import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { templateSchema } from '../../core/schema/template';
import { BUILT_IN_TEMPLATES } from '../../data/templates';
import { BuilderPage } from './BuilderPage';

const preview = () => screen.getByTestId('prompt-preview');

describe('BuilderPage', () => {
  it('renders a field for every Structured Prompt variable, marking the task required', () => {
    render(<BuilderPage />);
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
    render(<BuilderPage />);

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
    render(<BuilderPage />);
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
    render(<BuilderPage />);
    await user.type(screen.getByLabelText(/Task or objective/), 'Do it.');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('Task:\nDo it.');
    expect(screen.getByRole('status')).toHaveTextContent('Copied to clipboard.');
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
    render(<BuilderPage templates={[...BUILT_IN_TEMPLATES, other]} />);
    await user.selectOptions(screen.getByLabelText('Template'), 'other');
    expect(preview()).toHaveTextContent('Hi team');
    expect(within(screen.getByRole('form')).getAllByRole('textbox')).toHaveLength(1);
  });
});
