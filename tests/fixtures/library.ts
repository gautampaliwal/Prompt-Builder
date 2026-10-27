import type { Prompt } from '../../src/core/schema/prompt';
import { TEMPLATE_CATEGORIES } from '../../src/core/schema/template';

const WORDS =
  'revenue churn margin roadmap incident review summary customer onboarding release migration latency budget hiring forecast retention pricing'.split(
    ' ',
  );

/** Deterministic pseudo-random generator so fixtures are identical on every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** `count` realistic prompts (~1.5 KB of text each) for search benchmarks. */
export function makeLibrary(count = 5_000, seed = 42): Prompt[] {
  const rand = rng(seed);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const sentence = () =>
    Array.from({ length: 8 + Math.floor(rand() * 8) }, () => pick(WORDS)).join(' ') + '.';
  return Array.from({ length: count }, (_, i) => {
    const day = String(1 + (i % 28)).padStart(2, '0');
    const at = `2026-0${1 + (i % 9)}-${day}T00:00:00.000Z`;
    return {
      id: `p${i}`,
      title: `${pick(WORDS)} ${pick(WORDS)} ${i}`,
      tags: [pick(WORDS), pick(WORDS)],
      category: pick(TEMPLATE_CATEGORIES),
      favorite: rand() < 0.1,
      draft: Array.from({ length: 12 }, sentence).join('\n'),
      currentVersion: 1,
      createdAt: at,
      updatedAt: at,
    };
  });
}
