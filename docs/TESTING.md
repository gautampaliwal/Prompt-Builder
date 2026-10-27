# Testing

Strategy from `docs/BRIEF.md` §10: test **behavior**, not implementation details. No coverage-percentage targets. No AI services are required to run any test.

## Layers

| Layer       | Tool                                                    | Location                         | Runs                       |
| ----------- | ------------------------------------------------------- | -------------------------------- | -------------------------- |
| Unit        | Vitest + RTL (jsdom; real services on `fake-indexeddb`) | `src/**/*.test.{ts,tsx}`         | `npm run test:unit`        |
| Integration | Vitest (node; `fake-indexeddb`)                         | `tests/integration/**/*.test.ts` | `npm run test:integration` |
| E2E         | Playwright vs `vite preview` of a prod build            | `tests/e2e/**/*.spec.ts`         | `npm run test:e2e`         |
| Perf        | Vitest 5 bench (`bench` test-context fixture)           | `tests/perf/**/*.bench.ts`       | `npm run bench`            |

## Component tests use real services

Screen tests render through `tests/helpers/app.tsx`: `makeTestServices()` creates the real services on a fresh, uniquely named `fake-indexeddb` database, and `renderRoutes()` adds the router and a location probe. Failure paths inject a failing method into an otherwise real services object (for example, a `saveDraft` that rejects once), so storage errors are tested end to end through the UI.

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

| Date       | Benchmark                                              | Mean     | p99      | Target   | Machine                |
| ---------- | ------------------------------------------------------ | -------- | -------- | -------- | ---------------------- |
| 2026-10-27 | Render, typical Structured Prompt (~2 KB)              | 0.023 ms | 0.069 ms | < 100 ms | Build sandbox, Node 22 |
| 2026-10-27 | Render, large Structured Prompt (~120 KB)              | 0.035 ms | 0.185 ms | < 100 ms | Build sandbox, Node 22 |
| —          | Optimize, 50k chars                                    | —        | —        | < 200 ms | M3                     |
| 2026-10-27 | Search, 5,000 prompts (~1.2 KB each), two terms + sort | 7.5 ms   | 12.0 ms  | < 300 ms | Build sandbox, Node 22 |
| 2026-10-27 | Search, 5,000 prompts, category + tag + title sort     | 2.3 ms   | 11.5 ms  | < 300 ms | Build sandbox, Node 22 |

Search is measured on the in-memory query the Library runs per keystroke. Loading prompts from IndexedDB happens once per visit and isn't included; it's exercised by E2E but not timed. No search index was needed.

Vitest may print a "module export getters" warning for benchmarks. It adds a small constant overhead, which makes the numbers slightly pessimistic.
