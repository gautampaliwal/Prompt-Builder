import { describe, expect, it } from 'vitest';
import { templateSchema, type TemplateInput } from '../schema/template';
import { defaultValues, render } from './render';
import { validateTemplate, validateValues } from './validate';

const NOW = '2026-10-27T00:00:00.000Z';

function tpl(
  sections: TemplateInput['template']['sections'],
  variables: TemplateInput['variables'] = [],
) {
  return templateSchema.parse({
    schemaVersion: '1.0.0',
    id: 't',
    name: 'T',
    category: 'general',
    template: { type: 'structured', sections },
    variables,
    metadata: { createdAt: NOW, updatedAt: NOW },
  });
}

const sec = (
  id: string,
  content: string,
  opts: { required?: boolean; enabled?: boolean } = {},
) => ({
  id,
  label: id[0]!.toUpperCase() + id.slice(1),
  content,
  required: opts.required ?? false,
  enabled: opts.enabled ?? true,
});

const email = tpl(
  [
    sec('role', 'Act as a professional business communicator.'),
    sec('task', 'Write an email about {{subject}}.', { required: true }),
    sec('context', 'Context:\n{{context}}'),
    sec('constraints', 'Tone: {{tone}}.'),
    sec('output', 'Return only the email body.', { required: true }),
  ],
  [
    { name: 'subject', label: 'Subject', type: 'string', required: true, maxLength: 20 },
    { name: 'context', label: 'Context', type: 'text', required: false },
    {
      name: 'tone',
      label: 'Tone',
      type: 'enum',
      required: true,
      options: ['Formal', 'Friendly'],
      defaultValue: 'Formal',
    },
  ],
);

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe('render', () => {
  it('substitutes values and joins sections with a blank line', () => {
    const r = render(email, {
      subject: 'Q3 report',
      context: 'Board asked for it.',
      tone: 'Formal',
    });
    expect(r.text).toBe(
      [
        'Act as a professional business communicator.',
        'Write an email about Q3 report.',
        'Context:\nBoard asked for it.',
        'Tone: Formal.',
        'Return only the email body.',
      ].join('\n\n'),
    );
    expect(r.issues).toEqual([]);
  });

  it('omits an optional section whose placeholders are all empty, label included', () => {
    const r = render(email, { subject: 'Q3', context: '   ', tone: 'Formal' });
    expect(r.text).not.toContain('Context:');
    expect(r.sections.find((s) => s.id === 'context')?.outcome).toBe('empty');
  });

  it('keeps static optional sections, and omits disabled sections', () => {
    const t = tpl(
      [sec('a', 'Static text.'), sec('b', 'Hidden {{x}}', { enabled: false })],
      [{ name: 'x', label: 'X', type: 'string', required: false, defaultValue: 'v' }],
    );
    const r = render(t, { x: 'v' });
    expect(r.text).toBe('Static text.');
    expect(r.sections.map((s) => s.outcome)).toEqual(['included', 'disabled']);
  });

  it('keeps a missing required value visible and reports it once', () => {
    const r = render(email, { subject: '', tone: 'Formal' });
    expect(r.text).toContain('Write an email about {{subject}}.');
    expect(codes(r.issues)).toEqual(['missing-required-value']);
  });

  it('reports a required section that renders empty, but still includes it', () => {
    const t = tpl(
      [sec('task', '{{opt}}', { required: true })],
      [{ name: 'opt', label: 'Opt', type: 'text', required: false }],
    );
    const r = render(t, {});
    expect(codes(r.issues)).toEqual(['empty-required-section']);
    expect(r.sections[0]?.outcome).toBe('included');
  });

  it('inserts values as plain text without re-scanning them', () => {
    const r = render(email, { subject: '{{tone}} and \\{{x}}', tone: 'Friendly' });
    expect(r.text).toContain('Write an email about {{tone}} and \\{{x}}.');
  });

  it('never evaluates template content', () => {
    const t = tpl(
      [sec('a', '${1+1} {{x}} `${"js"}`')],
      [{ name: 'x', label: 'X', type: 'string', required: false }],
    );
    expect(render(t, { x: 'ok' }).text).toBe('${1+1} ok `${"js"}`');
  });

  it('leaves undeclared and invalid placeholders visible and reports them', () => {
    const t = tpl([sec('a', 'Hi {{who}} and {{bad-name}}')]);
    const r = render(t, {});
    expect(r.text).toBe('Hi {{who}} and {{bad-name}}');
    expect(codes(r.issues).sort()).toEqual(['invalid-placeholder', 'undeclared-placeholder']);
  });

  it('defaultValues takes each variable default', () => {
    expect(defaultValues(email)).toEqual({ subject: '', context: '', tone: 'Formal' });
  });
});

describe('validateTemplate', () => {
  it('warns about variables no enabled section uses', () => {
    const t = tpl(
      [sec('a', 'Hi {{x}}'), sec('b', '{{y}}', { enabled: false })],
      [
        { name: 'x', label: 'X', type: 'string', required: false },
        { name: 'y', label: 'Y', type: 'string', required: true },
      ],
    );
    const issues = validateTemplate(t);
    expect(issues).toEqual([
      expect.objectContaining({ code: 'unused-variable', severity: 'warning', variable: 'y' }),
    ]);
    // Y is required but unused, so a missing value is not an error.
    expect(validateValues(t, {})).toEqual([]);
  });
});

describe('validateValues', () => {
  it('enforces single-line strings, maxLength, enum options and number bounds', () => {
    const t = tpl(
      [sec('a', '{{s}} {{e}} {{n}}')],
      [
        { name: 's', label: 'S', type: 'string', required: false, maxLength: 5 },
        { name: 'e', label: 'E', type: 'enum', required: false, options: ['A'] },
        { name: 'n', label: 'N', type: 'number', required: false, min: 1, max: 10 },
      ],
    );
    const msg = (values: Record<string, string | number>) =>
      validateValues(t, values).map((i) => i.message);

    expect(msg({ s: 'two\nlines' })).toEqual(['S must be a single line.']);
    expect(msg({ s: 'toolong' })).toEqual(['S is 7 characters; the limit is 5.']);
    expect(msg({ e: 'B' })).toEqual(['E must be one of: A.']);
    expect(msg({ n: 0 })).toEqual(['N must be at least 1.']);
    expect(msg({ n: 'abc' })).toEqual(['N must be a number.']);
    expect(msg({ s: 'ok', e: 'A', n: '5' })).toEqual([]);
  });
});
