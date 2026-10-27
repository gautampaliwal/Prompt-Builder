import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ServicesProvider } from '../../src/app/services-context';
import { toFormValues } from '../../src/features/builder/useTemplateForm';
import { createServices, type CreateServicesOptions, type Services } from '../../src/services';
import { BUILT_IN_TEMPLATES, DEFAULT_TEMPLATE_ID } from '../../src/data/templates';

let count = 0;

/** Real services on a fresh in-memory database (fake-indexeddb is loaded by the test setup). */
export function makeTestServices(options: CreateServicesOptions = {}): Services {
  count += 1;
  return createServices({
    dbName: `ui-test-${count}-${Math.random().toString(36).slice(2)}`,
    requestPersistence: () => Promise.resolve('unsupported'),
    ...options,
  });
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

/** Renders routes inside services + router, with a probe showing the current path. */
export function renderRoutes(
  routes: Record<string, ReactElement>,
  { url = '/', services = makeTestServices() }: { url?: string; services?: Services } = {},
) {
  const utils = render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          {Object.entries(routes).map(([path, element]) => (
            <Route key={path} path={path} element={element} />
          ))}
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </ServicesProvider>,
  );
  return { ...utils, services };
}

export const structuredPrompt = BUILT_IN_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!;

/** Saves a Structured Prompt with the given task, as the Builder would. */
export function seedTemplatePrompt(
  services: Services,
  task = 'Write the weekly update.',
  title = 'Weekly update',
) {
  return services.prompts.create({
    title,
    text: `Task:\n${task}`,
    category: structuredPrompt.category,
    sourceTemplateId: structuredPrompt.id,
    variableValues: { ...toFormValues(structuredPrompt), task },
  });
}
