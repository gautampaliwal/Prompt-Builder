# Implementation plan

Milestones and acceptance criteria come from `docs/BRIEF.md` §11. Each milestone gets its own branch (`feat/m<N>-<slug>`) and PR, and ends green on `npm run verify`.

## Status

| #   | Milestone                             | Status                                   |
| --- | ------------------------------------- | ---------------------------------------- |
| M0  | Harness and plan                      | ✅ Done; **awaiting approval** before M1 |
| M1  | Schemas, prompt engine, Builder       | ⏳ Next                                  |
| M2  | Storage, versions, Library            | —                                        |
| M3  | Optimizer                             | —                                        |
| M4  | Estimator                             | —                                        |
| M5  | PWA, backup/import                    | —                                        |
| M6  | Templates, settings, a11y, docs, perf | —                                        |

## Next concrete task

**After approval of M0:** branch `feat/m1-prompt-engine` from `main`. Start with `src/core/schema/template.ts` (Zod schemas for template, section, variable; tests for invalid enums, duplicate IDs, and enum defaults not in options). Then build `core/prompt-engine` (placeholder parser → validator → renderer) test-first.

---

## M0 — Harness and plan (branch `feat/m0-harness`)

### Completed

- Scaffolded Vite 8 + React 19 + TS 6.0 (strict, `noUncheckedIndexedAccess`) + Tailwind 4 + React Router 7. The app shell has accessible nav, a skip link, a class-based dark variant, the system font stack and placeholder routes for all 7 screens.
- Tooling: ESLint 10 flat config (type-checked for TS; `no-eval`/`no-new-func` as errors), Prettier, Vitest 5 projects (`unit` in jsdom, `integration` in node), Playwright with a network-guard fixture.
- Gates: `check:arch` (dependency-cruiser, 7 rules), `check:ai` (forbidden packages + provider hosts in `package.json`/`src`/`dist`), `check:size` (initial JS gzip budget 250 KB), `verify`, `verify:full`.
- Planted-violation tests: `tests/fixtures/arch-violation/` plus `tests/integration/harness.test.ts`. `check:ai` is tested against temp projects.
- Claude Code: `.claude/settings.json` with scoped permissions (ask for push/reset/clean/install; deny force-push and push to main) and hooks (protect paths, format + lint the edited file, Stop fast gate). Hooks are covered by `tests/integration/hooks.test.ts`.
- CI: `.github/workflows/ci.yml` runs `npm ci` → `verify` → Playwright install → `test:e2e`, and uploads the report on failure.
- Docs: `CLAUDE.md`, `docs/BRIEF.md`, `PRODUCT_SPEC`, `ARCHITECTURE`, `DECISIONS`, `TESTING`, `QUALITY_GATES`, `KNOWN_ISSUES`, this file.

### Commands actually run (2026-10-27, build sandbox, Node 22.23.4)

| Command                                                | Result                                                                                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                                       | ✅ exit 0: format ✓, lint ✓ (0 warnings), typecheck ✓, unit 2/2 ✓, integration 13/13 ✓, check:arch 0 violations ✓, build ✓, check:ai ✓, check:size 79.7 KB gz ✓ |
| `check:arch` on `tests/fixtures/arch-violation`        | ✅ fails as intended, naming `core-is-pure`, `ui-does-not-touch-storage` and `no-circular`                                                                      |
| `PW_CHROMIUM_PATH=…chromium-1243… npx playwright test` | ✅ 2/2 (shell + navigation + reload; network guard catches a planted off-origin fetch)                                                                          |
| Post-edit hook on a file containing `eval(...)`        | ✅ exit 2, reports `no-eval`                                                                                                                                    |
| Stop hook with `{}` / with `stop_hook_active: true`    | ✅ exit 0 (gate passes) / ✅ exit 0 (no loop)                                                                                                                   |
| GitHub Actions CI on PR #1 (run 40457378283)           | ✅ success: `npm ci`, `verify`, Playwright browser install and `test:e2e` all passed with Playwright's bundled Chromium                                         |

### Not verified / open

- Hooks have not run inside a live Claude Code session. They were tested by piping events in directly.

### Decisions

See `docs/DECISIONS.md` (2026-10-27 entries): TS 6.0 pin, plain-JS lint scope, planted-violation proofs, size-gate method, Node-based hooks, `PW_CHROMIUM_PATH`.

---

## Plan for M1–M6

### M1 — Schemas, prompt engine, Builder (`feat/m1-prompt-engine`)

1. `core/schema`: template, section, variable (string/text/enum/number), the version-concept types, `SCHEMA_VERSION`. Fixed category list.
2. `core/prompt-engine/placeholders.ts`: tokenizer for `{{ name }}`, the `\{{` escape and invalid names. Values are inserted without re-scanning.
3. `validate.ts`: undeclared placeholder, unused variable (warning), missing required, type/length/option violations, duplicate IDs.
4. `render.ts`: skip disabled and empty optional sections; a required section that renders empty is an error.
5. `core/estimator/heuristic.ts` (needed for the Builder's live token count).
6. `data/templates/structured-prompt.json`: the built-in Builder template, validated in a test.
7. Builder UI: template picker (one template for now), form generated from variables (React Hook Form + Zod), live preview, issues panel, chars/words/tokens, Copy. "Save" is disabled with the note "available in M2".
8. `tests/perf/render.bench.ts`.

**Acceptance:** unit tests for §4.3 and §5.1 pass; the Builder renders live (RTL test plus E2E smoke); bench recorded.

### M2 — Storage, versions, Library (`feat/m2-library`)

Dexie DB v1 (`templates`, `prompts`, `versions [promptId+number]`, `settings`, `meta`); repositories; services for create, autosave draft, save version (transactional, no-op if unchanged), restore, duplicate and delete; save-status store (Zustand); persistent error state on write failure; Library screen with search, filters, sort, favorites, history and a version diff; `navigator.storage.persist()`.

**Acceptance:** integration tests (`fake-indexeddb`) for §6 storage, including rapid-save numbering and failure handling; E2E journey 1; search bench over 5,000 prompts.

### M3 — Optimizer (`feat/m3-optimizer`)

Rule registry, the 6 rules, code-fence protection, overlap handling, `apply` in descending order, line diff; Optimizer screen with accept/reject/accept all/reset; save as a new version (`origin: optimizer`).

**Acceptance:** per-rule unit tests (including fences); E2E journey 2; optimize bench at 50k chars.

### M4 — Estimator (`feat/m4-estimator`)

`TokenizerAdapter`; heuristic plus lazy `js-tiktoken` (o200k, cl100k); pricing profiles in settings (seeded example clearly labelled); cost and savings formulas; Estimator screen; Dashboard savings computed only from recorded optimizer versions.

**Acceptance:** formula and edge-case tests; `check:size` passes with the tokenizer in its own lazy chunk.

### M5 — Offline and portability (`feat/m5-offline-backup`)

`vite-plugin-pwa` (`generateSW`, manifest, icons, update prompt, offline indicator); backup export (all/selected); import parse → validate → migrate → preview → per-item skip/replace/keep-both → single transaction with rollback.

**Acceptance:** E2E journeys 3–5 (export/import round trip, offline after SW control, network guard); fixtures for corrupted, duplicate and future-version files.

### M6 — Release readiness (`feat/m6-release`)

10 starter templates (validated by a test), Templates screen (copy-on-edit for built-ins), Settings (theme, defaults, versions, storage status), Dashboard, axe checks in E2E, responsive pass, README/usage/backup docs, final perf benches.

**Acceptance:** `verify:full` green in CI; perf numbers in `TESTING.md`; final report per brief §12.
