import { describe, expect, it } from 'vitest';
import { render, validateTemplate } from '../../core/prompt-engine';
import { BUILT_IN_TEMPLATES, DEFAULT_TEMPLATE_ID } from './index';

describe('built-in templates', () => {
  it('have unique ids, include the default, and are marked builtIn', () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_TEMPLATE_ID);
    expect(BUILT_IN_TEMPLATES.every((t) => t.builtIn)).toBe(true);
  });

  it.each(BUILT_IN_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s has no structural issues (no undeclared, invalid or unused placeholders)',
    (_id, t) => {
      expect(validateTemplate(t)).toEqual([]);
    },
  );
});

describe('Structured Prompt template', () => {
  const t = BUILT_IN_TEMPLATES.find((x) => x.id === DEFAULT_TEMPLATE_ID)!;

  it('covers every Builder field from brief §4.4', () => {
    expect(t.variables.map((v) => v.name)).toEqual([
      'role',
      'task',
      'context',
      'input',
      'constraints',
      'tone',
      'length',
      'outputFormat',
      'examples',
    ]);
  });

  it('renders only the task when nothing else is filled in', () => {
    const r = render(t, { task: 'Summarize the attached notes.' });
    expect(r.text).toBe('Task:\nSummarize the attached notes.');
    expect(r.issues).toEqual([]);
  });

  it('renders all sections in order when everything is filled in', () => {
    const r = render(t, {
      role: 'a senior analyst',
      task: 'Summarize.',
      context: 'For the board.',
      input: 'Q3 numbers',
      constraints: 'No jargon.',
      tone: 'Formal',
      length: 'Brief',
      outputFormat: 'Three bullets.',
      examples: '- Revenue up 4%',
    });
    expect(r.text).toBe(
      [
        'Act as a senior analyst.',
        'Task:\nSummarize.',
        'Context:\nFor the board.',
        'Input:\nQ3 numbers',
        'Constraints:\nNo jargon.',
        'Tone: Formal.',
        'Length: Brief.',
        'Output format:\nThree bullets.',
        'Examples:\n- Revenue up 4%',
      ].join('\n\n'),
    );
  });

  it('reports a missing task', () => {
    expect(render(t, {}).issues.map((i) => i.code)).toEqual(['missing-required-value']);
  });
});
