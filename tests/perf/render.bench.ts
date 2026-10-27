// Brief §10 target: prompt rendering under 100 ms for typical inputs.
// Vitest 5 benchmarks run inside a test via the `bench` context fixture.
import { test } from 'vitest';
import { render } from '../../src/core/prompt-engine';
import { BUILT_IN_TEMPLATES, DEFAULT_TEMPLATE_ID } from '../../src/data/templates';

const TARGET_MS = 100;

const template = BUILT_IN_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!;

const typical = {
  role: 'a senior data analyst',
  task: 'Summarize the quarterly results for the leadership team and flag risks.',
  context: 'The board meets on Friday. They care about margin and churn.\n'.repeat(5),
  input: 'Region,Revenue,Churn\nNorth,1.2M,3%\nSouth,0.9M,5%\n'.repeat(20),
  constraints: 'No jargon. Cite numbers from the input only.',
  tone: 'Professional',
  length: 'Moderate',
  outputFormat: 'Five bullets, then a one-paragraph summary.',
  examples: '- Revenue grew 4% QoQ, driven by North.',
};

// Near the template's own limits: ~100k chars of input data plus long context.
const large = { ...typical, input: 'x'.repeat(99_000), context: 'y '.repeat(10_000) };

test(`render: typical Structured Prompt, p99 under ${TARGET_MS} ms`, async ({ bench, expect }) => {
  const r = await bench('render typical (~2 KB)', () => {
    render(template, typical);
  }).run();
  expect(r.latency.p99).toBeLessThan(TARGET_MS);
});

test(`render: large Structured Prompt (~120 KB), p99 under ${TARGET_MS} ms`, async ({
  bench,
  expect,
}) => {
  const r = await bench('render large (~120 KB)', () => {
    render(template, large);
  }).run();
  expect(r.latency.p99).toBeLessThan(TARGET_MS);
});
