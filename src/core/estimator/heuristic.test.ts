import { describe, expect, it } from 'vitest';
import { textStats } from '../text-stats';
import { countTokensHeuristic, heuristicTokenizer } from './heuristic';

describe('countTokensHeuristic', () => {
  it.each([
    ['', 0],
    ['a', 1],
    ['abcd', 1],
    ['abcde', 2],
    ['Write a concise email.', 6], // 22 Basic Latin chars → ceil(22/4)
    ['café', 2], // 3 Basic Latin → 1, plus é → 1
    ['नमस्ते', 6], // 6 code points outside Basic Latin
    ['👍👍', 2], // emoji are single code points
    ['ok 👍', 2], // ceil(3/4)=1 + 1
  ])('%j → %i', (text, expected) => {
    expect(countTokensHeuristic(text)).toBe(expected);
  });
});

describe('heuristicTokenizer', () => {
  it('labels its result as approximate and names its method', async () => {
    const r = await heuristicTokenizer.estimate('abcdefgh');
    expect(r.count).toBe(2);
    expect(r.approximate).toBe(true);
    expect(r.method).toContain('÷ 4');
  });
});

describe('textStats', () => {
  it('counts code points and whitespace-separated words', () => {
    expect(textStats('')).toEqual({ characters: 0, words: 0 });
    expect(textStats('   \n ')).toEqual({ characters: 5, words: 0 });
    expect(textStats('Hello  world\nagain')).toEqual({ characters: 18, words: 3 });
    expect(textStats('👍 ok')).toEqual({ characters: 4, words: 2 });
  });
});
