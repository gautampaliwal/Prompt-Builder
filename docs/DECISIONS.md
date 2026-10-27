# Decisions

Dated, short entries. Add one whenever a choice isn't dictated by `docs/BRIEF.md`, or deviates from it.

## 2026-10-27 — M0 toolchain versions

- **Decision:** Vite 8, React 19, React Router 7, Tailwind 4 (`@tailwindcss/vite`), Vitest 5, ESLint 10 + typescript-eslint 8, Playwright 1.64, dependency-cruiser 18, Node ≥ 22.
- **TypeScript pinned to `~6.0`** although 7.0 is the latest release, because typescript-eslint 8.x supports `<6.1`. Revisit when typescript-eslint supports TS 7.
- **Why:** current stable releases whose peer ranges are mutually compatible (brief §2).

## 2026-10-27 — Plain-JS tooling is linted without type-aware rules

- **Context:** `scripts/*.mjs`, `.claude/hooks/*.mjs` and config files are plain Node JS outside the TS program, so type-aware rules flag every value as `any`.
- **Decision:** `**/*.{js,mjs,cjs}` use `tseslint.configs.disableTypeChecked` plus `js.configs.recommended`. All `src/` and `tests/` TypeScript keeps the full `recommendedTypeChecked` set.
- **Not a weakening:** application code rules are unchanged. These scripts are covered by integration tests instead.

## 2026-10-27 — `check:arch` / `check:ai` proven by planted violations

- `tests/fixtures/arch-violation/` holds deliberate boundary breaks. `tests/integration/harness.test.ts` asserts that each rule fires _by name_, not just that the exit code is non-zero (a missing binary would also be non-zero).
- `check:ai` is a function plus CLI. Tests run it against temp projects with planted packages and hosts.

## 2026-10-27 — `check:size` measures initial JS only

- Sums gzip size of the scripts and modulepreloads referenced by `dist/index.html`. Lazy chunks such as the tokenizer are excluded by construction. Budget: 250 KB gz.

## 2026-10-27 — Hooks written as Node scripts

- Hooks are Node scripts (no `jq` dependency) under `.claude/hooks/`, configured in `.claude/settings.json`. Exit 2 reports or blocks with the stderr message, and nothing is swallowed.
- Hook schema verified against a secondary source: the official hooks page wasn't reachable from the build sandbox. **Re-check against the current Claude Code docs** if hooks misbehave.

## 2026-10-27 — `PW_CHROMIUM_PATH` escape hatch for E2E

- Sandboxes without access to Playwright's browser CDN can point E2E at a preinstalled Chromium. CI never sets it and uses the bundled browser, so CI results are authoritative.

## 2026-10-27 — M1: an optional section is "empty" only when all its placeholders are empty

- **Context:** sections such as `Context:\n{{context}}` carry a static label, so "omit empty optional sections" can't mean "the rendered text is blank".
- **Decision:** an optional section is omitted when it has at least one placeholder and none of them contributes text. A section with only static text is always kept. A missing required value or an undeclared placeholder is kept as raw `{{name}}`, so it can't silently disappear, and it counts as content.
- **Why:** labels never leak through on their own, missing data stays visible in the preview, and static instructions are never dropped.

## 2026-10-27 — M1: form state in React Hook Form, validation in the core engine

- **Decision:** the Builder uses React Hook Form for field state only. All validation comes from `core/prompt-engine` (`validateValues`, `validateTemplate`), so the UI, saved prompts and imports share one set of rules. `@hookform/resolvers` isn't installed. Field-level errors appear once a field is touched; the issues panel always shows everything.
- **Why:** templates are user-defined, so their Zod schemas would have to be generated at runtime. Using the engine's own validator avoids a second, divergent rule set and a dependency.
- **Zustand** is deferred until M2, when there's shared state (save status).

## 2026-10-27 — M1: Vitest 5 benchmarks assert targets; kept out of `verify`

- Vitest 5 replaced the global `bench()` with a `bench` test-context fixture that returns latency stats and runs only in projects generated from `benchmark.include`. The integration project's `benchmark.include` is `tests/perf/**/*.bench.ts`; the unit project's is empty.
- Each benchmark asserts `p99 < target`, so the brief's targets are pass/fail rather than just recorded.
- `npm run bench` stays out of `verify`, because machine-dependent timings would make the gate flaky. It's run before each milestone PR, with results recorded in `TESTING.md`.
