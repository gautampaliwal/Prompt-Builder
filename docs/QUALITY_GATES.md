# Quality gates

A milestone or PR is mergeable only when `npm run verify` passes. E2E (`npm run test:e2e`) must pass in CI, or be explicitly reported as not run.

| Gate            | Command                    | Passes when                                                      |
| --------------- | -------------------------- | ---------------------------------------------------------------- |
| Format          | `npm run format:check`     | Prettier reports no differences                                  |
| Lint            | `npm run lint`             | ESLint exits 0 with **zero warnings**                            |
| Types           | `npm run typecheck`        | `tsc --noEmit` clean (`strict`, `noUncheckedIndexedAccess`)      |
| Unit            | `npm run test:unit`        | All unit tests pass; no `.only`/`.skip` committed                |
| Integration     | `npm run test:integration` | All integration tests pass                                       |
| Architecture    | `npm run check:arch`       | dependency-cruiser reports 0 violations                          |
| Build           | `npm run build`            | Vite production build succeeds                                   |
| AI independence | `npm run check:ai`         | No forbidden AI packages; no provider hosts in `src/` or `dist/` |
| Bundle size     | `npm run check:size`       | Initial JS ≤ 250 KB gzipped                                      |
| E2E             | `npm run test:e2e`         | All journeys pass with zero off-origin requests                  |
| Perf (M1+)      | `npm run bench`            | Results recorded in `TESTING.md` and within brief §10 targets    |

`npm run verify` runs every gate above except E2E and perf, in that order, and stops at the first failure. `npm run verify:full` adds E2E.

**Changing a gate:** gates may be tightened freely. Loosening one requires a dated entry in `DECISIONS.md` explaining why, and must be called out in the PR description.
