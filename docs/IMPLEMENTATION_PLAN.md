# Implementation plan

Milestones and acceptance criteria come from `docs/BRIEF.md` §11. Each milestone gets its own branch (`feat/m<N>-<slug>`) and PR, and ends green on `npm run verify`.

## Status

| #   | Milestone                             | Status                                |
| --- | ------------------------------------- | ------------------------------------- |
| M0  | Harness and plan                      | ✅ Merged (PR #1)                     |
| M1  | Schemas, prompt engine, Builder       | ✅ Merged (PR #2)                     |
| M2  | Storage, versions, Library            | ✅ Done; PR open, **awaiting review** |
| M3  | Optimizer                             | ⏳ Next                               |
| M4  | Estimator                             | —                                     |
| M5  | PWA, backup/import                    | —                                     |
| M6  | Templates, settings, a11y, docs, perf | —                                     |

## Next concrete task

**After the M2 PR merges:** branch `feat/m3-optimizer` from `main`. Start with `src/core/optimizer/registry.ts` (rule IDs must equal `OPTIMIZER_RULE_IDS`; add a test) and `rules/normalize-whitespace.ts` test-first, including code-fence protection. Then `apply.ts` (descending `start`, overlap → `conflicting`) and a 50k-char fixture for the < 200 ms bench. The UI reuses `core/diff/line-diff.ts` and `VersionHistory`'s `DiffView`. Accepting changes calls `saveVersion` with `origin: 'optimizer'`. For a template-bound prompt, the optimized text can't come from the form, so accepting must detach it first; confirm that in the UI, as restore does.

---

## M2 — Storage, versions, Library (branch `feat/m2-library`)

### Completed

- **Core:** `core/schema/prompt.ts` (Prompt and Version, with optional `variableValues` snapshots on both), `core/library` (`queryPrompts`, `allTags`, `normalizeTags`, `deriveTitle`), `core/diff/line-diff.ts` (prefix/suffix trim plus LCS, size cap with fallback, context collapsing).
- **Storage:** Dexie DB v1 (`storage/migrations/v1.ts` registered in `storage/db.ts`); `createDexiePromptRepository` validates every read and write. `mutate()` does read, decide and write in one transaction. Unreadable records are counted, never deleted.
- **Services:** `PromptRepository` interface; prompt service with create (v1), `saveDraft` (no versions), `saveVersion` (only if changed), `restoreVersion` (keeps unsaved changes as a version first, history stays linear), duplicate, `updateMeta`, `markUsed`, `detachFromTemplate` and remove. `createServices()` is the composition root, injected into React through `ServicesProvider`. Persistent storage is requested after the first save.
- **UI:**
  - Builder: Save (with a suggested title) opens the new prompt, and in-progress input is kept per template for the session.
  - Editor at `/prompts/:id`: form mode for template-bound prompts and text mode otherwise, plus autosave (800 ms) with Saved / Unsaved / Saving / error-with-Retry status and a leave-page guard. If the final save on leaving fails, the changes are recovered in this session.
  - Editor actions: Save version, Copy (records last used), Duplicate, Convert to plain text, Delete; all confirmations are inline.
  - Version history: Restore, plus a line diff between any two versions or the current draft.
  - Library at `/library`: search, category, tag, favorites, four sorts, Show more paging, empty and no-match states, a banner for unreadable records, and favorite / duplicate / delete actions.

### Commands actually run (2026-10-27, build sandbox, Node 22.23.4)

| Command                                                                                                           | Result                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                                                                                                  | ✅ exit 0: unit **99/99**, integration **33/33**, 0 arch violations (51 modules), build ✓, check:ai ✓, check:size **161.7 KB gz** (was 120; Dexie and the editor/Library UI added) |
| `npm run bench`                                                                                                   | ✅ 4/4 under target: search over 5,000 prompts p99 **12.0 ms** (two terms + sort) and **11.5 ms** (filters + title sort) vs < 300 ms; render p99 0.07 / 0.18 ms                    |
| `PW_CHROMIUM_PATH=… npx playwright test`                                                                          | ✅ 6/6, including journey 1 (Builder → save → autosave → version → reload → Library search → reopen) and delete → "not found"                                                      |
| Flake found on a verify rerun: the restore test clicked a history button that was replaced when the list reloaded | Fixed the test to wait for the refreshed history (and to assert the default v1→v2 comparison it had been passing vacuously); 5 consecutive runs green                              |
| Screenshots: Library and editor at 1280 px and 390 px                                                             | No horizontal overflow; see known issues for the mobile title                                                                                                                      |

### Not verified / open

- E2E ran locally on Chromium 153. CI on the PR is authoritative.
- Real IndexedDB was exercised only in the E2E browser; unit and integration tests use `fake-indexeddb`.
- Hooks still haven't run inside a live Claude Code session.

### Decisions

See `docs/DECISIONS.md` (M2 entries): two editing modes, the repository `mutate` primitive, read validation, autosave and recovery, restore semantics, duplicate, Zustand still deferred, inline confirmations.

---

## M1 — Schemas, prompt engine, Builder (branch `feat/m1-prompt-engine`)

### Completed

- `core/schema/template.ts`: Zod schemas for templates, sections and the 4 variable types; fixed category list; rule IDs from brief §5.2; refinements for duplicate section IDs and variable names, enum defaults outside the options, a required enum with no default, duplicate options, number min/max and defaults, and string defaults over `maxLength`.
- `core/prompt-engine`: `tokenize` (with the `\{{` escape; invalid names become invalid tokens; no nesting), `validateTemplate` (undeclared or invalid placeholders, unused variables), `validateValues` (required only when used by an enabled section; single-line strings, `maxLength`, enum options, number bounds), and `render` (rules in `ARCHITECTURE.md`).
- `core/estimator`: the `TokenizerAdapter` interface and the heuristic adapter. `core/text-stats.ts`: characters as code points, plus word count.
- `data/templates/structured-prompt.json`: the built-in Builder template, with all 9 brief fields and every optional section omitted when blank. It's validated when loaded, and a test checks it.
- Builder screen: template picker, form generated from the variables (React Hook Form), live preview, issues panel, characters/words/tokens labelled approximate with the method shown, and Copy with a status message. Field errors appear once a field is touched. Save and Optimize are visibly disabled until M2 and M3.

### Commands actually run (2026-10-27, build sandbox, Node 22.23.4)

| Command                                            | Result                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                                   | ✅ exit 0: unit 51/51, integration 13/13, 0 arch violations (21 modules), build ✓, check:ai ✓, check:size **120.0 KB gz** (was 79.7; Zod and React Hook Form added) |
| `npm run bench`                                    | ✅ 2/2 under target: render typical p99 0.057 ms, large (~120 KB) p99 0.194 ms (target < 100 ms)                                                                    |
| `PW_CHROMIUM_PATH=… npx playwright test`           | ✅ 4/4: Builder journey (live render, issues, optional section dropped when cleared), keyboard order, smoke, network guard                                          |
| Screenshots at 1280 px (light and dark) and 390 px | No horizontal overflow; preview sits below the form on mobile (see `KNOWN_ISSUES.md`)                                                                               |

### Not verified / open

- E2E ran locally on Chromium 153. CI on the PR runs the bundled browser and is authoritative.
- Hooks still haven't run inside a live Claude Code session.

### Decisions

See `docs/DECISIONS.md` (2026-10-27, M1 entries): empty-section rule, the form-validation approach, Vitest 5 benchmarks, and bench kept out of `verify`.

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
