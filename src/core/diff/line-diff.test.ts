import { describe, expect, it } from 'vitest';
import { diffCounts, diffLines, withContext, type DiffOp } from './line-diff';

const render = (ops: DiffOp[]) =>
  ops.map((o) => `${o.type === 'add' ? '+' : o.type === 'del' ? '-' : ' '}${o.text}`);

describe('diffLines', () => {
  it('returns all-same for identical text and handles empty text', () => {
    expect(render(diffLines('a\nb', 'a\nb'))).toEqual([' a', ' b']);
    expect(diffLines('', '')).toEqual([]);
    expect(render(diffLines('', 'x'))).toEqual(['+x']);
    expect(render(diffLines('x', ''))).toEqual(['-x']);
  });

  it('aligns changes in the middle by longest common subsequence', () => {
    expect(render(diffLines('a\nb\nc\nd', 'a\nx\nc\nd\ne'))).toEqual([
      ' a',
      '-b',
      '+x',
      ' c',
      ' d',
      '+e',
    ]);
  });

  it('keeps unchanged lines between edits', () => {
    expect(render(diffLines('1\n2\n3\n4\n5', '1\n2a\n3\n4a\n5'))).toEqual([
      ' 1',
      '-2',
      '+2a',
      ' 3',
      '-4',
      '+4a',
      ' 5',
    ]);
  });

  it('falls back to remove-all/add-all past the size limit, still correctly', () => {
    const ops = diffLines('a\nb\nc', 'a\nx\ny\nc', 4);
    expect(render(ops)).toEqual([' a', '-b', '+x', '+y', ' c']);
  });

  it('applying the diff reproduces both sides', () => {
    const a = 'one\ntwo\nthree\nfour\nfive';
    const b = 'zero\none\nthree\n4\nfive\nsix';
    const ops = diffLines(a, b);
    expect(
      ops
        .filter((o) => o.type !== 'add')
        .map((o) => o.text)
        .join('\n'),
    ).toBe(a);
    expect(
      ops
        .filter((o) => o.type !== 'del')
        .map((o) => o.text)
        .join('\n'),
    ).toBe(b);
  });
});

describe('withContext', () => {
  it('collapses long unchanged runs and keeps context around changes', () => {
    const a = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n');
    const b = a.replace('l10', 'changed');
    const rows = withContext(diffLines(a, b), 2);
    expect(rows[0]).toEqual({ type: 'skip', count: 8 });
    expect(rows.filter((r) => r.type === 'same')).toHaveLength(4);
    expect(rows.at(-1)).toEqual({ type: 'skip', count: 7 });
  });
});

describe('diffCounts', () => {
  it('counts added and removed lines', () => {
    expect(diffCounts(diffLines('a\nb', 'a\nc\nd'))).toEqual({ added: 2, removed: 1 });
  });
});
