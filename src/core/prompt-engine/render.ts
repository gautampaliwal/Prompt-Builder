import type { Template, VariableValues } from '../schema/template';
import type { Issue } from './issues';
import { tokenize } from './placeholders';
import { isEmptyValue, validateTemplate, validateValues } from './validate';

export const SECTION_SEPARATOR = '\n\n';

export type SectionOutcome = 'included' | 'disabled' | 'empty';

export interface RenderedSection {
  id: string;
  label: string;
  outcome: SectionOutcome;
  /** Rendered text ('' when omitted). */
  text: string;
}

export interface RenderResult {
  text: string;
  sections: RenderedSection[];
  issues: Issue[];
}

/**
 * Renders a template with values (brief §5.1).
 *
 * - Disabled sections are omitted.
 * - An optional section is omitted as empty when it contains at least one
 *   placeholder and every placeholder in it has no value. Static text alone
 *   never makes a section empty, so labels like "Context:" don't leak through.
 * - Required sections are never omitted; if one is empty, that's an error.
 * - Values are inserted as plain text and never re-scanned for placeholders.
 * - Missing and undeclared placeholders stay visible as their raw `{{…}}` text,
 *   so they can't silently disappear from the output.
 * - Each section is trimmed at its edges; sections are joined by a blank line.
 */
export function render(template: Template, values: VariableValues): RenderResult {
  const declared = new Map(template.variables.map((v) => [v.name, v]));
  const issues: Issue[] = [...validateTemplate(template), ...validateValues(template, values)];
  const sections: RenderedSection[] = [];

  for (const s of template.template.sections) {
    if (!s.enabled) {
      sections.push({ id: s.id, label: s.label, outcome: 'disabled', text: '' });
      continue;
    }

    let out = '';
    let placeholders = 0;
    let contributing = 0; // filled values, plus raw placeholders kept visible
    for (const t of tokenize(s.content)) {
      if (t.kind === 'text') out += t.value;
      else if (t.kind === 'invalid') out += t.raw;
      else {
        placeholders += 1;
        const value = values[t.name];
        if (!declared.has(t.name)) {
          out += t.raw; // undeclared: reported by validateTemplate
          contributing += 1;
        } else if (isEmptyValue(value)) {
          // Required → keep it visible (reported as missing); optional → nothing.
          if (declared.get(t.name)?.required) {
            out += t.raw;
            contributing += 1;
          }
        } else {
          out += String(value);
          contributing += 1;
        }
      }
    }

    const text = out.trim();
    const isEmpty = text === '' || (placeholders > 0 && contributing === 0);

    if (isEmpty && !s.required) {
      sections.push({ id: s.id, label: s.label, outcome: 'empty', text: '' });
      continue;
    }
    if (isEmpty && s.required) {
      issues.push({
        code: 'empty-required-section',
        severity: 'error',
        sectionId: s.id,
        message: `${s.label} is required but has no content.`,
      });
    }
    sections.push({ id: s.id, label: s.label, outcome: 'included', text });
  }

  const text = sections
    .filter((s) => s.outcome === 'included' && s.text !== '')
    .map((s) => s.text)
    .join(SECTION_SEPARATOR);

  return { text, sections, issues };
}

/** Initial values for a template's variables, from their defaults. */
export function defaultValues(template: Template): VariableValues {
  const values: VariableValues = {};
  for (const v of template.variables) values[v.name] = v.defaultValue;
  return values;
}
