import type { Template, Variable, VariableValues } from '../schema/template';
import type { Issue } from './issues';
import { tokenize } from './placeholders';

/** Placeholder names referenced by enabled sections. */
export function usedVariableNames(template: Template): Set<string> {
  const used = new Set<string>();
  for (const s of template.template.sections) {
    if (!s.enabled) continue;
    for (const t of tokenize(s.content)) if (t.kind === 'placeholder') used.add(t.name);
  }
  return used;
}

/**
 * Structural checks on a template's content (independent of values):
 * undeclared or invalid placeholders (errors) and unused variables (warnings).
 * Duplicate IDs and schema-level rules are enforced by `templateSchema`.
 */
export function validateTemplate(template: Template): Issue[] {
  const issues: Issue[] = [];
  const declared = new Set(template.variables.map((v) => v.name));

  for (const s of template.template.sections) {
    if (!s.enabled) continue;
    const reported = new Set<string>();
    for (const t of tokenize(s.content)) {
      if (t.kind === 'invalid' && !reported.has(t.raw)) {
        reported.add(t.raw);
        issues.push({
          code: 'invalid-placeholder',
          severity: 'error',
          sectionId: s.id,
          message: `"${t.raw}" in ${s.label} is not a valid placeholder. Names use letters, digits and _. Write \\{{ for a literal {{.`,
        });
      }
      if (t.kind === 'placeholder' && !declared.has(t.name) && !reported.has(t.name)) {
        reported.add(t.name);
        issues.push({
          code: 'undeclared-placeholder',
          severity: 'error',
          sectionId: s.id,
          variable: t.name,
          message: `{{${t.name}}} in ${s.label} is not a declared variable.`,
        });
      }
    }
  }

  const used = usedVariableNames(template);
  for (const v of template.variables) {
    if (!used.has(v.name)) {
      issues.push({
        code: 'unused-variable',
        severity: 'warning',
        variable: v.name,
        message: `${v.label} is declared but not used in any enabled section.`,
      });
    }
  }
  return issues;
}

/** True when a value counts as "not provided". */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
  );
}

function checkValue(v: Variable, value: string | number): string | null {
  switch (v.type) {
    case 'string':
    case 'text': {
      if (typeof value !== 'string') return 'must be text';
      if (v.type === 'string' && /[\r\n]/.test(value)) return 'must be a single line';
      if (v.maxLength !== undefined && value.length > v.maxLength) {
        return `is ${value.length} characters; the limit is ${v.maxLength}`;
      }
      return null;
    }
    case 'enum':
      return v.options.includes(String(value)) ? null : `must be one of: ${v.options.join(', ')}`;
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return 'must be a number';
      if (v.min !== undefined && n < v.min) return `must be at least ${v.min}`;
      if (v.max !== undefined && n > v.max) return `must be at most ${v.max}`;
      return null;
    }
  }
}

/**
 * Checks supplied values against declared variables. Only variables used by an
 * enabled section are required; type, length and option rules apply to any
 * value that is provided.
 */
export function validateValues(template: Template, values: VariableValues): Issue[] {
  const issues: Issue[] = [];
  const used = usedVariableNames(template);
  for (const v of template.variables) {
    const value = values[v.name];
    if (isEmptyValue(value)) {
      if (v.required && used.has(v.name)) {
        issues.push({
          code: 'missing-required-value',
          severity: 'error',
          variable: v.name,
          message: `${v.label} is required.`,
        });
      }
      continue;
    }
    const problem = checkValue(v, value as string | number);
    if (problem) {
      issues.push({
        code: 'invalid-value',
        severity: 'error',
        variable: v.name,
        message: `${v.label} ${problem}.`,
      });
    }
  }
  return issues;
}
