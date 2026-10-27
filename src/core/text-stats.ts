export interface TextStats {
  /** Unicode code points, so emoji and non-Latin letters count as one each. */
  characters: number;
  /** Runs of non-whitespace characters. */
  words: number;
}

export function textStats(text: string): TextStats {
  const trimmed = text.trim();
  return {
    characters: Array.from(text).length,
    words: trimmed === '' ? 0 : trimmed.split(/\s+/u).length,
  };
}
