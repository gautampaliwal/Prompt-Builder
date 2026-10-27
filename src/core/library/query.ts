import type { Prompt } from '../schema/prompt';
import type { TemplateCategory } from '../schema/template';

export type PromptSort = 'updated' | 'created' | 'lastUsed' | 'title';

export interface PromptQuery {
  /** Whitespace-separated terms; every term must appear in the title or text (case-insensitive). */
  text?: string;
  category?: TemplateCategory | '';
  tag?: string;
  favoritesOnly?: boolean;
  sort?: PromptSort;
}

export type PromptSummary = Pick<
  Prompt,
  | 'id'
  | 'title'
  | 'draft'
  | 'tags'
  | 'category'
  | 'favorite'
  | 'createdAt'
  | 'updatedAt'
  | 'lastUsedAt'
>;

/** Newest first; missing dates sort last. ISO strings compare correctly as text. */
function newestFirst(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a < b ? 1 : -1;
}

function comparator(sort: PromptSort) {
  return (a: PromptSummary, b: PromptSummary): number => {
    let r = 0;
    switch (sort) {
      case 'updated':
        r = newestFirst(a.updatedAt, b.updatedAt);
        break;
      case 'created':
        r = newestFirst(a.createdAt, b.createdAt);
        break;
      case 'lastUsed':
        r = newestFirst(a.lastUsedAt, b.lastUsedAt) || newestFirst(a.updatedAt, b.updatedAt);
        break;
      case 'title':
        r = a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
        break;
    }
    if (r !== 0) return r;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

/** Filters and sorts prompts in memory. Pure; returns a new array. */
export function queryPrompts<T extends PromptSummary>(
  prompts: readonly T[],
  q: PromptQuery = {},
): T[] {
  const terms = (q.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const tag = q.tag ? q.tag.toLowerCase() : '';
  const out = prompts.filter((p) => {
    if (q.favoritesOnly && !p.favorite) return false;
    if (q.category && p.category !== q.category) return false;
    if (tag && !p.tags.some((t) => t.toLowerCase() === tag)) return false;
    if (terms.length > 0) {
      const haystack = `${p.title}\n${p.draft}`.toLowerCase();
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });
  return out.sort(comparator(q.sort ?? 'updated'));
}

/** Every tag in use, de-duplicated case-insensitively and sorted. */
export function allTags(prompts: readonly Pick<Prompt, 'tags'>[]): string[] {
  const byKey = new Map<string, string>();
  for (const p of prompts) {
    for (const t of p.tags) if (!byKey.has(t.toLowerCase())) byKey.set(t.toLowerCase(), t);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
