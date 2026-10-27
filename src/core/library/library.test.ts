import { describe, expect, it } from 'vitest';
import { deriveTitle, normalizeTags } from './fields';
import { allTags, queryPrompts, type PromptSummary } from './query';

const p = (over: Partial<PromptSummary> & { id: string }): PromptSummary => ({
  title: 'Untitled',
  draft: '',
  tags: [],
  category: 'general',
  favorite: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const prompts = [
  p({
    id: 'a',
    title: 'Quarterly report',
    draft: 'Summarize revenue and churn.',
    tags: ['Finance'],
    category: 'business',
    favorite: true,
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  }),
  p({
    id: 'b',
    title: 'Bug triage',
    draft: 'Find the root cause of the crash.',
    tags: ['eng', 'finance'],
    category: 'coding',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-06T00:00:00.000Z',
    lastUsedAt: '2026-01-07T00:00:00.000Z',
  }),
  p({
    id: 'c',
    title: 'apology email',
    draft: 'Say sorry for the delay.',
    category: 'communication',
    createdAt: '2026-01-04T00:00:00.000Z',
    updatedAt: '2026-01-04T00:00:00.000Z',
  }),
];
const ids = (list: PromptSummary[]) => list.map((x) => x.id);

describe('queryPrompts', () => {
  it('sorts by last updated by default', () => {
    expect(ids(queryPrompts(prompts))).toEqual(['b', 'a', 'c']);
  });

  it('matches every search term in the title or text, case-insensitively', () => {
    expect(ids(queryPrompts(prompts, { text: 'REVENUE' }))).toEqual(['a']);
    expect(ids(queryPrompts(prompts, { text: 'root crash' }))).toEqual(['b']);
    expect(ids(queryPrompts(prompts, { text: 'root revenue' }))).toEqual([]);
    expect(ids(queryPrompts(prompts, { text: '   ' }))).toEqual(['b', 'a', 'c']);
  });

  it('filters by category, tag (case-insensitive) and favorites', () => {
    expect(ids(queryPrompts(prompts, { category: 'coding' }))).toEqual(['b']);
    expect(ids(queryPrompts(prompts, { tag: 'FINANCE' }))).toEqual(['b', 'a']);
    expect(ids(queryPrompts(prompts, { favoritesOnly: true }))).toEqual(['a']);
  });

  it('sorts by created, last used (never-used last) and title', () => {
    expect(ids(queryPrompts(prompts, { sort: 'created' }))).toEqual(['c', 'a', 'b']);
    expect(ids(queryPrompts(prompts, { sort: 'lastUsed' }))).toEqual(['b', 'a', 'c']);
    expect(ids(queryPrompts(prompts, { sort: 'title' }))).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate its input', () => {
    const before = ids(prompts);
    queryPrompts(prompts, { sort: 'title' });
    expect(ids(prompts)).toEqual(before);
  });
});

describe('allTags', () => {
  it('de-duplicates case-insensitively and sorts', () => {
    expect(allTags(prompts)).toEqual(['eng', 'Finance']);
  });
});

describe('normalizeTags', () => {
  it('splits, trims, collapses spaces and de-duplicates', () => {
    expect(normalizeTags(' work , Work,  deep   dive ,,')).toEqual(['work', 'deep dive']);
    expect(normalizeTags(['a', 'A', ' b '])).toEqual(['a', 'b']);
  });

  it('caps tag length and count', () => {
    expect(normalizeTags(['x'.repeat(50)])[0]).toHaveLength(40);
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20);
  });
});

describe('deriveTitle', () => {
  it('uses the first non-blank line, shortened with an ellipsis', () => {
    expect(deriveTitle('\n  Plan the offsite \nmore')).toBe('Plan the offsite');
    expect(deriveTitle('x'.repeat(80), 10)).toBe('xxxxxxxxx…');
    expect(deriveTitle('   ')).toBe('Untitled prompt');
  });
});
