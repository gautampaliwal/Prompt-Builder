import { TAG_MAX_LENGTH, TAGS_MAX } from '../schema/prompt';

/**
 * Tags from a comma-separated string or a list: trimmed, inner whitespace
 * collapsed, empty ones dropped, duplicates removed case-insensitively (first
 * spelling wins), capped at the schema limits.
 */
export function normalizeTags(input: string | readonly string[]): string[] {
  const raw = typeof input === 'string' ? input.split(',') : input;
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const t of raw) {
    const tag = t.trim().replace(/\s+/g, ' ').slice(0, TAG_MAX_LENGTH).trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === TAGS_MAX) break;
  }
  return tags;
}

/** A short title from the first non-blank line of some text. */
export function deriveTitle(text: string, max = 60): string {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l !== '');
  if (!line) return 'Untitled prompt';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
