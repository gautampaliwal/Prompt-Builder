import type { Template } from '../core/schema/template';
import { BUILT_IN_TEMPLATES } from '../data/templates';

/** Built-in templates only for now; user templates (stored in IndexedDB) arrive in M6. */
export function createTemplateService(templates: readonly Template[] = BUILT_IN_TEMPLATES) {
  return {
    list: (): readonly Template[] => templates,
    get: (id: string): Template | undefined => templates.find((t) => t.id === id),
  };
}

export type TemplateService = ReturnType<typeof createTemplateService>;
