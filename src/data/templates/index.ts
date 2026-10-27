import { templateSchema, type Template } from '../../core/schema/template';
import structuredPrompt from './structured-prompt.json';

/**
 * Built-in templates, validated against the schema when loaded. An invalid
 * built-in throws immediately (and fails `builtins.test.ts`) rather than
 * reaching the UI. More starters arrive in M6.
 */
export const BUILT_IN_TEMPLATES: readonly Template[] = [structuredPrompt].map((t) =>
  templateSchema.parse(t),
);

export const DEFAULT_TEMPLATE_ID = 'builtin-structured-prompt';
