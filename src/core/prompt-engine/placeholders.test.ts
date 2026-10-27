import { describe, expect, it } from 'vitest';
import { placeholderNames, tokenize } from './placeholders';

describe('tokenize', () => {
  it('splits text and placeholders, allowing whitespace inside braces', () => {
    expect(tokenize('Hi {{name}}, from {{  sender }}!')).toEqual([
      { kind: 'text', value: 'Hi ' },
      { kind: 'placeholder', name: 'name', raw: '{{name}}', start: 3, end: 11 },
      { kind: 'text', value: ', from ' },
      { kind: 'placeholder', name: 'sender', raw: '{{  sender }}', start: 18, end: 31 },
      { kind: 'text', value: '!' },
    ]);
  });

  it('renders \\{{ as a literal {{ and does not treat it as a placeholder', () => {
    expect(tokenize('Use \\{{name}} syntax')).toEqual([
      { kind: 'text', value: 'Use {{name}} syntax' },
    ]);
  });

  it('marks invalid names as invalid tokens', () => {
    for (const raw of ['{{1abc}}', '{{a-b}}', '{{a.b}}', '{{}}', '{{ a b }}', '{{x|upper}}']) {
      const tokens = tokenize(raw);
      expect(tokens, raw).toEqual([{ kind: 'invalid', raw, start: 0, end: raw.length }]);
    }
  });

  it('does not support nesting: an inner {{ makes the outer token invalid', () => {
    const tokens = tokenize('{{ {{x}} }}');
    expect(tokens[0]).toMatchObject({ kind: 'invalid', raw: '{{ {{x}}' });
    expect(tokens[1]).toEqual({ kind: 'text', value: ' }}' });
  });

  it('treats an unclosed {{ as plain text', () => {
    expect(tokenize('a {{b c')).toEqual([{ kind: 'text', value: 'a {{b c' }]);
  });

  it('handles empty input and text with no placeholders', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('plain }} text')).toEqual([{ kind: 'text', value: 'plain }} text' }]);
  });
});

describe('placeholderNames', () => {
  it('lists distinct names in order of first appearance', () => {
    expect(placeholderNames('{{b}} {{a}} {{ b }} {{bad-name}} \\{{c}}')).toEqual(['b', 'a']);
  });
});
