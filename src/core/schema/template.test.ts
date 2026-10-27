import { describe, expect, it } from 'vitest';
import { templateSchema, type TemplateInput } from './template';

const NOW = '2026-10-27T00:00:00.000Z';

function base(overrides: Partial<TemplateInput> = {}): TemplateInput {
  return {
    schemaVersion: '1.0.0',
    id: 'template-test',
    name: 'Test',
    category: 'general',
    template: {
      type: 'structured',
      sections: [{ id: 'task', label: 'Task', enabled: true, required: true, content: '{{x}}' }],
    },
    variables: [{ name: 'x', label: 'X', type: 'string', required: true }],
    metadata: { createdAt: NOW, updatedAt: NOW },
    ...overrides,
  };
}

const messages = (input: unknown) => {
  const r = templateSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('templateSchema', () => {
  it('accepts a minimal template and fills defaults', () => {
    const t = templateSchema.parse(base());
    expect(t.status).toBe('active');
    expect(t.builtIn).toBe(false);
    expect(t.tags).toEqual([]);
    expect(t.optimization.enabledRules).toContain('normalize-whitespace');
    expect(t.variables[0]).toMatchObject({ type: 'string', defaultValue: '' });
  });

  it('rejects an unknown status and an unknown category', () => {
    expect(templateSchema.safeParse({ ...base(), status: 'draft' }).success).toBe(false);
    expect(templateSchema.safeParse({ ...base(), category: 'misc' }).success).toBe(false);
  });

  it('rejects duplicate section ids and duplicate variable names', () => {
    const msgs = messages(
      base({
        template: {
          type: 'structured',
          sections: [
            { id: 'a', label: 'A', enabled: true, required: false, content: '' },
            { id: 'a', label: 'A2', enabled: true, required: false, content: '' },
          ],
        },
        variables: [
          { name: 'v', label: 'V', type: 'string', required: false },
          { name: 'v', label: 'V2', type: 'text', required: false },
        ],
      }),
    );
    expect(msgs).toContain('Duplicate section id "a"');
    expect(msgs).toContain('Duplicate variable name "v"');
  });

  it('rejects invalid variable names', () => {
    for (const name of ['1abc', 'a-b', 'a.b', '']) {
      const r = templateSchema.safeParse(
        base({ variables: [{ name, label: 'N', type: 'string', required: false }] }),
      );
      expect(r.success, name).toBe(false);
    }
  });

  it('requires enum defaults to be one of the options', () => {
    const enumVar = (defaultValue: string, required: boolean) =>
      base({
        variables: [
          {
            name: 'tone',
            label: 'Tone',
            type: 'enum',
            required,
            options: ['A', 'B'],
            defaultValue,
          },
        ],
      });
    expect(messages(enumVar('C', false))).toContain('Default "C" is not one of the options');
    expect(messages(enumVar('', true))).toContain('A required enum needs a default option');
    expect(messages(enumVar('', false))).toEqual([]);
    expect(messages(enumVar('B', true))).toEqual([]);
  });

  it('rejects enum variables with no options or duplicate options', () => {
    const withOptions = (options: string[]) =>
      base({
        variables: [{ name: 'e', label: 'E', type: 'enum', required: false, options }],
      });
    expect(templateSchema.safeParse(withOptions([])).success).toBe(false);
    expect(messages(withOptions(['A', 'A']))).toContain('Duplicate option');
  });

  it('checks number bounds and defaults', () => {
    const num = (v: Record<string, number>) =>
      base({ variables: [{ name: 'n', label: 'N', type: 'number', required: false, ...v }] });
    expect(messages(num({ min: 5, max: 1 }))).toContain('min is greater than max');
    expect(messages(num({ min: 1, max: 5, defaultValue: 9 }))).toContain(
      'Default is outside min/max',
    );
    expect(messages(num({ min: 1, max: 5, defaultValue: 3 }))).toEqual([]);
  });

  it('only accepts known optimizer rule ids', () => {
    expect(
      templateSchema.safeParse(
        base({
          optimization: { enabledRules: ['made-up-rule' as never], preserveSectionOrder: true },
        }),
      ).success,
    ).toBe(false);
  });

  it('requires ISO timestamps and a semver schema version', () => {
    expect(templateSchema.safeParse(base({ schemaVersion: '1' })).success).toBe(false);
    expect(
      templateSchema.safeParse(base({ metadata: { createdAt: 'yesterday', updatedAt: NOW } }))
        .success,
    ).toBe(false);
  });
});
