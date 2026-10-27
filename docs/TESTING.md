# Testing

Strategy from `docs/BRIEF.md` §10: test **behavior**, not implementation details. No coverage-percentage targets. No AI services are required to run any test.

## Layers

| Layer       | Tool                                          | Location                         | Runs                       |
| ----------- | --------------------------------------------- | -------------------------------- | -------------------------- |
| Unit        | Vitest + RTL (jsdom)                          | `src/**/*.test.{ts,tsx}`         | `npm run test:unit`        |
| Integration | Vitest (node; `fake-indexeddb` from M2)       | `tests/integration/**/*.test.ts` | `npm run test:integration` |
| E2E         | Playwright vs `vite preview` of a prod build  | `tests/e2e/**/*.spec.ts`         | `npm run test:e2e`         |
| Perf        | Vitest 5 bench (`bench` test-context fixture) | `tests/perf/**/*.bench.ts`       | `npm run bench`            |

## E2E network guard

Every E2E test imports `test` from `tests/e2e/network-guard.ts`. It aborts and records any request that leaves the app origin, and fails the test if one happened. `smoke.spec.ts` proves the guard catches a deliberate off-origin `fetch`.

## Running E2E without Playwright's bundled browser

If `npx playwright install chromium` can't download (for example, a sandbox without CDN access):

```bash
PW_CHROMIUM_PATH=/path/to/chrome npm run test:e2e
```

Results produced this way use a different Chromium build than CI, so CI is authoritative.

## Planted-violation tests (harness)

- `tests/integration/harness.test.ts`: `check:ai` flags forbidden packages and hosts, and `check:arch` names each violated rule on `tests/fixtures/arch-violation/`.
- `tests/integration/hooks.test.ts`: the protect-paths hook blocks `dist/`, the lockfile and existing migrations. The stop gate doesn't loop.

## Perf results

Benchmarks assert the brief §10 targets on p99 latency, so a regression fails `npm run bench`. They're kept out of `verify` because timings depend on the machine; run them before a milestone PR and record the results here.

| Date       | Benchmark                                 | Mean     | p99      | Target   | Machine                |
| ---------- | ----------------------------------------- | -------- | -------- | -------- | ---------------------- |
| 2026-10-27 | Render, typical Structured Prompt (~2 KB) | 0.022 ms | 0.057 ms | < 100 ms | Build sandbox, Node 22 |
| 2026-10-27 | Render, large Structured Prompt (~120 KB) | 0.036 ms | 0.194 ms | < 100 ms | Build sandbox, Node 22 |
| —          | Optimize, 50k chars                       | —        | —        | < 200 ms | M3                     |
| —          | Search, 5,000 prompts                     | —        | —        | < 300 ms | M2                     |

Vitest may print a "module export getters" warning for benchmarks. It adds a small constant overhead, which makes the numbers slightly pessimistic.
