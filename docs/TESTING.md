# Testing

Strategy from `docs/BRIEF.md` §10: test **behavior**, not implementation details. No coverage-percentage targets. No AI services are required to run any test.

## Layers

| Layer       | Tool                                         | Location                             | Runs                       |
| ----------- | -------------------------------------------- | ------------------------------------ | -------------------------- |
| Unit        | Vitest + RTL (jsdom)                         | `src/**/*.test.{ts,tsx}`             | `npm run test:unit`        |
| Integration | Vitest (node; `fake-indexeddb` from M2)      | `tests/integration/**/*.test.ts`     | `npm run test:integration` |
| E2E         | Playwright vs `vite preview` of a prod build | `tests/e2e/**/*.spec.ts`             | `npm run test:e2e`         |
| Perf        | Vitest bench                                 | `tests/perf/**/*.bench.ts` (from M1) | `npm run bench`            |

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

None yet. Recorded here from M1 onward: render, optimize at 50k chars, and search over 5,000 prompts against the brief's targets.
