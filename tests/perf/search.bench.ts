// Brief §10 target: library search under 300 ms over 5,000 saved prompts.
// Measures the in-memory query the Library runs on every keystroke
// (loading from IndexedDB happens once per visit and is not part of search).
import { test } from 'vitest';
import { queryPrompts } from '../../src/core/library/query';
import { makeLibrary } from '../fixtures/library';

const TARGET_MS = 300;
const library = makeLibrary(5_000);
const avgChars = Math.round(library.reduce((n, p) => n + p.draft.length, 0) / library.length);

test(`search: 5,000 prompts (~${avgChars} chars each), two terms + sort, p99 under ${TARGET_MS} ms`, async ({
  bench,
  expect,
}) => {
  const r = await bench('search 5,000 prompts, two terms, sort by updated', () => {
    queryPrompts(library, { text: 'churn roadmap', sort: 'updated' });
  }).run();
  expect(r.latency.p99).toBeLessThan(TARGET_MS);
});

test(`search: 5,000 prompts, filters + title sort, p99 under ${TARGET_MS} ms`, async ({
  bench,
  expect,
}) => {
  const r = await bench('search 5,000 prompts, category + tag + title sort', () => {
    queryPrompts(library, { text: 'latency', category: 'coding', tag: 'budget', sort: 'title' });
  }).run();
  expect(r.latency.p99).toBeLessThan(TARGET_MS);
});
