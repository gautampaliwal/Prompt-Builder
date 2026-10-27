import type { TokenEstimate, TokenizerAdapter } from './tokenizer';

export const HEURISTIC_METHOD = 'Heuristic: ceil(Basic Latin chars ÷ 4) + other chars';

/**
 * Approximate token count (brief §5.3):
 *   ceil(basicLatinChars / 4) + otherChars
 * where Basic Latin is U+0000–U+007F and characters are counted as Unicode
 * code points. English prose averages roughly 4 characters per token in common
 * tokenizers; non-Latin scripts and emoji often cost about one token or more
 * per character, so they are counted one each. Always an estimate.
 */
export function countTokensHeuristic(text: string): number {
  let basic = 0;
  let other = 0;
  for (const ch of text) {
    if (ch.codePointAt(0)! <= 0x7f) basic += 1;
    else other += 1;
  }
  return Math.ceil(basic / 4) + other;
}

export function estimateHeuristic(text: string): TokenEstimate {
  return { count: countTokensHeuristic(text), method: HEURISTIC_METHOD, approximate: true };
}

export const heuristicTokenizer: TokenizerAdapter = {
  id: 'heuristic',
  name: 'Approximate (heuristic)',
  approximate: true,
  estimate: (text) => Promise.resolve(estimateHeuristic(text)),
};
