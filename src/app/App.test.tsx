import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App, SCREENS } from './App';

describe('App shell', () => {
  it('renders navigation for every screen in the brief', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const s of SCREENS) {
      expect(nav).toHaveTextContent(s.label);
    }
  });

  it('routes to the requested screen', () => {
    render(
      <MemoryRouter initialEntries={['/library']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Library');
  });
});
