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

## 2026-10-27 — M2: two editing modes, chosen by stored form values

- **Decision:** a prompt with `variableValues` (and an available template) is edited through the template's form, with its draft as the rendered text. Without them, it's edited as plain text. **Convert to plain text** switches explicitly, after confirmation. Each `Version` also snapshots `variableValues` (an optional field beyond brief §4.5), so restoring a form-made version brings the form back.
- **Why:** reopening a saved prompt should show the fields it was built with, but prompts from imports, the optimizer or a missing template still need editing. Tying the mode to stored data avoids a separate flag that could drift.
- **M3 consequence:** optimizer output isn't a form rendering, so accepting it on a form-mode prompt must detach the prompt, with a confirmation.

## 2026-10-27 — M2: repository `mutate` primitive; storage implements the interface structurally

- `PromptRepository.mutate(id, fn)` reads the prompt and its latest version and applies `fn`'s writes in one Dexie transaction. Version numbering, "save only if changed" and restore all build on it, so rapid or concurrent saves stay correct (tested with 10 interleaved saves). The unique `[promptId+number]` index is a second guard.
- The architecture rules forbid `storage/` from importing `services/`, so the Dexie repository doesn't name the interface. `createServices` assigns it to `PromptRepository`, and TypeScript checks it structurally.

## 2026-10-27 — M2: reads are validated; bad records are reported, never deleted

- Every read is parsed. `list()` skips records that fail and returns `invalid: n`, and the Library shows a banner saying nothing was deleted. Repair or export of such records is M5 (backup) territory.

## 2026-10-27 — M2: autosave, recovery and restore semantics

- **Autosave:** 800 ms debounce, saves serialized, newest value last. On failure the value stays in memory with an error and Retry. There's a beforeunload guard while unsaved, and actions flush first.
- **Leaving the editor:** the app uses the declarative `BrowserRouter`, so in-app navigation can't be blocked. Unmounting flushes instead; if that save fails, the value goes to an in-session recovery map and is restored on reopen. The Builder keeps unsaved input per template the same way.
- **Restore** appends a `restore` version and never rewinds; an unsaved draft is kept as its own version first. **Duplicate** copies the current draft into a fresh history. **Favorite** doesn't bump `updatedAt`, so starring doesn't reorder "Last updated".
- **Persistent storage** is requested after the first save, so any browser prompt follows a user action.

## 2026-10-27 — M2: Zustand still deferred; inline confirmations instead of modals

- No state is shared across screens yet: save status belongs to the editor, and notices use a tiny `flash` map. Adding Zustand now would add a dependency without removing complexity (brief §0.8). It's planned for the first cross-screen UI state (M5's offline/update indicator or toasts). This defers the stack choice in brief §2 rather than changing it.
- Delete, restore and convert confirm inline (`role="alertdialog"`, focus moves to Cancel) rather than in a modal, which avoids focus-trap code and keeps the context visible.
