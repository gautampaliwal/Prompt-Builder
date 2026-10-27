import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeTestServices, renderRoutes } from '../../../tests/helpers/app';
import type { Prompt } from '../../core/schema/prompt';
import type { Services } from '../../services';
import { PromptBuilderDb } from '../../storage/db';
import { LibraryPage } from './LibraryPage';

function renderLibrary(services: Services, pageSize?: number) {
  return renderRoutes(
    {
      '/library': <LibraryPage pageSize={pageSize} />,
      '/prompts/:id': <p>Editor</p>,
      '/builder': <p>Builder</p>,
    },
    { url: '/library', services },
  );
}

const titles = () =>
  screen.queryAllByTestId('prompt-card').map((c) => within(c).getByRole('heading').textContent);

async function seed(services: Services) {
  const a = await services.prompts.create({
    title: 'Quarterly report',
    text: 'Summarize revenue and churn.',
    category: 'business',
    tags: ['finance'],
  });
  await services.prompts.create({
    title: 'Bug triage',
    text: 'Find the root cause.',
    category: 'coding',
    tags: ['eng'],
  });
  await services.prompts.create({
    title: 'Apology email',
    text: 'Say sorry for the delay.',
    category: 'communication',
  });
  await services.prompts.updateMeta(a.id, { favorite: true });
}

describe('LibraryPage', () => {
  it('shows an empty state that points to the Builder', async () => {
    renderLibrary(makeTestServices());
    expect(
      await screen.findByRole('heading', { name: 'No saved prompts yet' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the Builder' })).toHaveAttribute(
      'href',
      '/builder',
    );
  });

  it('lists prompts newest first and searches titles and text', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    await seed(services);
    renderLibrary(services);

    await screen.findAllByTestId('prompt-card');
    expect(titles()).toEqual(['Apology email', 'Bug triage', 'Quarterly report']);

    await user.type(screen.getByLabelText('Search'), 'CHURN');
    await waitFor(() => expect(titles()).toEqual(['Quarterly report']));
    expect(screen.getByText('1 match of 3 prompts')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search'));
    await user.type(screen.getByLabelText('Search'), 'nothing like this');
    expect(await screen.findByText('No prompts match these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(titles()).toHaveLength(3);
  });

  it('filters by category, tag and favorites, and sorts by title', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    await seed(services);
    renderLibrary(services);
    await screen.findAllByTestId('prompt-card');

    await user.selectOptions(screen.getByLabelText('Category'), 'coding');
    expect(titles()).toEqual(['Bug triage']);
    await user.selectOptions(screen.getByLabelText('Category'), '');

    await user.selectOptions(screen.getByLabelText('Tag'), 'finance');
    expect(titles()).toEqual(['Quarterly report']);
    await user.selectOptions(screen.getByLabelText('Tag'), '');

    await user.click(screen.getByLabelText('Favorites only'));
    expect(titles()).toEqual(['Quarterly report']);
    await user.click(screen.getByLabelText('Favorites only'));

    await user.selectOptions(screen.getByLabelText('Sort by'), 'title');
    expect(titles()).toEqual(['Apology email', 'Bug triage', 'Quarterly report']);
  });

  it('toggles favorites', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    await seed(services);
    renderLibrary(services);

    const star = await screen.findByRole('button', { name: 'Favorite: Bug triage' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    await user.click(star);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Favorite: Bug triage' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('deletes only after confirmation', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    await seed(services);
    renderLibrary(services);

    await user.click(await screen.findByRole('button', { name: 'Delete Bug triage' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(titles()).toContain('Bug triage');

    await user.click(screen.getByRole('button', { name: 'Delete Bug triage' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Delete “Bug triage” and its 1 version?',
    );
    await user.click(screen.getByRole('button', { name: 'Delete prompt' }));
    expect(await screen.findByText('Deleted “Bug triage”.')).toBeInTheDocument();
    await waitFor(() => expect(titles()).not.toContain('Bug triage'));
    expect((await services.prompts.list()).prompts).toHaveLength(2);
  });

  it('duplicates and opens the copy', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    await seed(services);
    renderLibrary(services);

    await user.click(await screen.findByRole('button', { name: 'Duplicate Bug triage' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/prompts\//));
    const titlesAfter = (await services.prompts.list()).prompts.map((p) => p.title);
    expect(titlesAfter).toContain('Bug triage (copy)');
  });

  it('pages long lists with Show more', async () => {
    const user = userEvent.setup();
    const services = makeTestServices();
    await seed(services);
    renderLibrary(services, 2);

    await screen.findAllByTestId('prompt-card');
    expect(titles()).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /Show more \(1 more prompt\)/ }));
    expect(titles()).toHaveLength(3);
  });

  it('reports unreadable records without hiding the rest', async () => {
    const services = makeTestServices();
    await seed(services);
    const db = new PromptBuilderDb(services.dbName);
    await db.prompts.put({ id: 'corrupt', title: '' } as unknown as Prompt);
    db.close();
    renderLibrary(services);

    expect(await screen.findByRole('alert')).toHaveTextContent("1 stored record couldn't be read");
    expect(titles()).toHaveLength(3);
  });
});
