import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { makeTestServices } from '../../tests/helpers/app';
import { App, SCREENS } from './App';
import { ServicesProvider } from './services-context';

function renderApp(url = '/') {
  return render(
    <ServicesProvider services={makeTestServices()}>
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>
    </ServicesProvider>,
  );
}

describe('App shell', () => {
  it('renders navigation for every screen in the brief', () => {
    renderApp();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const s of SCREENS) {
      expect(nav).toHaveTextContent(s.label);
    }
  });

  it('routes to the requested screen', async () => {
    renderApp('/library');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Library');
    expect(await screen.findByText('No saved prompts yet')).toBeInTheDocument();
  });

  it('routes saved prompts to the editor', async () => {
    renderApp('/prompts/missing');
    expect(await screen.findByRole('heading', { name: 'Prompt not found' })).toBeInTheDocument();
  });
});
