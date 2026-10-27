import type { ReactNode } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import { BuilderPage } from '../features/builder/BuilderPage';

/** Built screens, keyed by path. Everything else renders a milestone placeholder. */
const PAGES: Partial<Record<string, ReactNode>> = {
  '/builder': <BuilderPage />,
};

/** Top-level screens from brief §8. */
export const SCREENS = [
  { path: '/', label: 'Dashboard', milestone: 'M6' },
  { path: '/builder', label: 'Builder', milestone: 'M1' },
  { path: '/optimizer', label: 'Optimizer', milestone: 'M3' },
  { path: '/library', label: 'Library', milestone: 'M2' },
  { path: '/templates', label: 'Templates', milestone: 'M6' },
  { path: '/estimator', label: 'Estimator', milestone: 'M4' },
  { path: '/settings', label: 'Settings', milestone: 'M5' },
] as const;

function Placeholder({ label, milestone }: { label: string; milestone: string }) {
  return (
    <section aria-labelledby="page-title" className="space-y-2">
      <h1 id="page-title" className="text-2xl font-semibold">
        {label}
      </h1>
      <p className="text-slate-600 dark:text-slate-400">Not built yet — planned for {milestone}.</p>
    </section>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 dark:border-slate-800">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 py-3">
          <span className="mr-4 font-semibold">Prompt Builder</span>
          {SCREENS.map((s) => (
            <NavLink
              key={s.path}
              to={s.path}
              end={s.path === '/'}
              className={({ isActive }) =>
                `rounded px-2 py-1 text-sm ${isActive ? 'bg-slate-200 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-900'}`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          {SCREENS.map((s) => (
            <Route
              key={s.path}
              path={s.path}
              element={PAGES[s.path] ?? <Placeholder label={s.label} milestone={s.milestone} />}
            />
          ))}
          <Route path="*" element={<Placeholder label="Not found" milestone="—" />} />
        </Routes>
      </main>
    </div>
  );
}
