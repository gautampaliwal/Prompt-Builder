import { VARIABLE_NAME_PATTERN } from '../schema/template';

/**
 * Placeholder syntax (brief §4.3):
 * - `{{ name }}` — whitespace inside the braces is allowed.
 * - `\{{` renders a literal `{{`.
 * - No expressions, filters, conditionals or nesting. Content is never evaluated.
 * - `{{…}}` whose inner text isn't a valid name is an `invalid` token and renders literally.
 */
export type Token =
  | { kind: 'text'; value: string }
  | { kind: 'placeholder'; name: string; raw: string; start: number; end: number }
  | { kind: 'invalid'; raw: string; start: number; end: number };

export function tokenize(content: string): Token[] {
  const tokens: Token[] = [];
  let text = '';
  let i = 0;

  const flush = () => {
    if (text) tokens.push({ kind: 'text', value: text });
    text = '';
  };

  while (i < content.length) {
    if (content.startsWith('\\{{', i)) {
      text += '{{';
      i += 3;
      continue;
    }
    if (content.startsWith('{{', i)) {
      const close = content.indexOf('}}', i + 2);
      if (close === -1) {
        // Unclosed: the rest is plain text.
        text += content.slice(i);
        break;
      }
      const raw = content.slice(i, close + 2);
      const inner = content.slice(i + 2, close).trim();
      flush();
      tokens.push(
        VARIABLE_NAME_PATTERN.test(inner)
          ? { kind: 'placeholder', name: inner, raw, start: i, end: close + 2 }
          : { kind: 'invalid', raw, start: i, end: close + 2 },
      );
      i = close + 2;
      continue;
    }
    text += content[i];
    i += 1;
  }
  flush();
  return tokens;
}

/** Distinct placeholder names in order of first appearance. */
export function placeholderNames(content: string): string[] {
  const names: string[] = [];
  for (const t of tokenize(content)) {
    if (t.kind === 'placeholder' && !names.includes(t.name)) names.push(t.name);
  }
  return names;
}
