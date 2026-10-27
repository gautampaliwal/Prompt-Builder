# Prompt Builder: Claude Code Build Brief

> Commit this file to the repo as `docs/BRIEF.md`. It is the source spec for a multi-session build. `CLAUDE.md` points here; it does not duplicate it.

---

## 0. Operating rules (read first, apply always)

1. **Inspect before changing.** On every session start, read `CLAUDE.md`, `docs/IMPLEMENTATION_PLAN.md` and `git status`/`git log -10`. Never overwrite or delete unrelated work.
2. **Approval checkpoint.** In the first session, complete Milestone 0 (harness and plan), then **stop and wait for my approval** before writing product code. After approval, continue milestone by milestone without asking questions about anything this brief decides. Ask only when blocked by something outside the repo.
3. **Git workflow.** One branch per milestone (`feat/m<N>-<slug>`), small commits with clear messages, one PR per milestone. Never commit to `main` directly, never force-push, never rewrite published history.
4. **Evidence, not claims.** Never say a command, test or journey passed unless you ran it in this session. Report failed and skipped checks explicitly, and keep "implemented" separate from "verified".
5. **No gaming the gates.** Do not weaken tests, delete assertions, add `skip`/`only`, loosen lint rules or change acceptance criteria to get green. If a criterion is wrong, record why in `docs/DECISIONS.md` and flag it.
6. **Root-cause failures.** Don't rerun an unchanged failing command. Investigate, fix, then rerun the affected checks.
7. **No AI dependency, ever.** No AI APIs, SDKs, keys, model inference or provider network calls, in product code or as a shortcut for any feature.
8. **Keep it small.** Prefer fewer files, fewer dependencies and less abstraction. Add a dependency only when it removes real complexity, and record why in `DECISIONS.md`.
9. **Never destroy user data** (in the app or on disk) without explicit confirmation.

---

## 1. Product

A local-first, offline-capable web app for **creating, optimizing, estimating, saving, versioning and exporting AI prompts**. It works alongside ChatGPT, Claude, Gemini, etc., but depends on none of them.

**Primary user (MVP):** individuals using AI for writing, research, coding and analysis.
**Secondary (later):** teams standardizing prompts. Keep the data model extensible (IDs, metadata, portable JSON), but build no collaboration features.

**Non-goals for MVP:** backend, accounts, auth, cloud sync, payments, telemetry, remote error reporting, AI features of any kind.

---

## 2. Stack (decided; do not re-litigate)

| Concern             | Choice                                                                |
| ------------------- | --------------------------------------------------------------------- |
| Language            | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true`          |
| UI                  | React + Vite                                                          |
| Styling             | Tailwind CSS, light/dark via `class` strategy                         |
| Forms / validation  | React Hook Form + Zod                                                 |
| State               | Zustand (UI state only; persisted data lives in IndexedDB)            |
| Storage             | Dexie over IndexedDB                                                  |
| Routing             | React Router                                                          |
| Exact-ish tokenizer | `js-tiktoken` (MIT), **lazy-loaded** chunk                            |
| PWA                 | `vite-plugin-pwa` (Workbox, `generateSW`)                             |
| Tests               | Vitest + React Testing Library + `fake-indexeddb`; Playwright for E2E |
| Lint / format       | ESLint (flat config, `typescript-eslint`) + Prettier                  |
| Architecture checks | `dependency-cruiser`                                                  |
| Package manager     | npm (unless the repo already has another lockfile)                    |
| CI                  | GitHub Actions                                                        |

Use current stable versions that are compatible with each other. Pin via lockfile.

---

## 3. Architecture and enforced boundaries

```
src/
  core/            # pure TS: no React, no Dexie, no DOM
    schema/        # Zod schemas + inferred types (single source of truth)
    prompt-engine/ # parse placeholders, validate, render
    optimizer/     # pipeline.ts, rules/*, apply.ts, diff.ts
    estimator/     # heuristic.ts, tiktoken-adapter.ts, pricing.ts
    backup/        # envelope build/parse, migrations, conflict detection
  storage/         # Dexie db, migrations, repositories (only place Dexie is imported)
  services/        # orchestration: uses core + repository interfaces
  features/        # UI per screen: builder, optimizer, library, templates, estimator, settings
  components/      # shared UI
  data/templates/  # starter template JSON (validated at test time)
tests/
  integration/  e2e/  perf/  fixtures/
```

**Dependency direction:** `features → services → (core, storage)`; `storage → core/schema`; `core → nothing internal outside core`.

**Enforce mechanically (`npm run check:arch`, dependency-cruiser):**

- `core/**` must not import `react`, `dexie`, `storage/**`, `services/**`, `features/**`.
- `features/**` and `components/**` must not import `dexie` or `storage/**` (they go through `services`).
- No circular dependencies.

**Enforce AI-independence (`npm run check:ai`, a small Node script):**

- Fails if `package.json` (any dependency field) contains a forbidden package: `openai`, `@anthropic-ai/*`, `@google/generative-ai`, `@google/genai`, `@mistralai/*`, `cohere-ai`, `groq-sdk`, `replicate`, `ollama`, `@huggingface/inference`, `langchain`, `@langchain/*`, `ai`.
- Fails if `src/**` or built `dist/**` contains provider hosts: `api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `api.mistral.ai`, `api.cohere`, `api.groq.com`, `api-inference.huggingface.co`.
- Has its own test proving it catches a planted violation.

---

## 4. Data model

Define everything as **Zod schemas in `core/schema`**; derive TS types with `z.infer`. Validate at every boundary: import, DB read after migration, form submit.

### 4.1 Four distinct version concepts (never conflate)

| Concept                 | Where                    | Form                                       |
| ----------------------- | ------------------------ | ------------------------------------------ |
| Template schema version | `template.schemaVersion` | semver string, `"1.0.0"`                   |
| Backup format version   | `backup.formatVersion`   | semver string                              |
| Database version        | Dexie `db.version(n)`    | integer                                    |
| Prompt revision         | `version.number`         | integer, starts at 1, monotonic per prompt |

### 4.2 Template

Use the reference shape below. Changes from the original reference: `status` is an enum, variable types are fixed, and `enabledRules` must reference registered rule IDs.

```jsonc
{
  "schemaVersion": "1.0.0",
  "id": "template-professional-email", // unique; kebab-case or nanoid
  "name": "Professional Email",
  "description": "Create a concise professional email",
  "category": "communication", // from a fixed category list
  "tags": ["email", "work"],
  "status": "active", // "active" | "archived"
  "builtIn": true, // starter templates; editing creates a copy
  "template": {
    "type": "structured",
    "sections": [
      {
        "id": "task",
        "label": "Task",
        "enabled": true,
        "required": true,
        "content": "Write an email about {{subject}}.",
      },
      // ...
    ],
  },
  "variables": [
    {
      "name": "subject",
      "label": "Subject",
      "type": "string",
      "required": true,
      "defaultValue": "",
      "maxLength": 200,
    },
    {
      "name": "tone",
      "label": "Tone",
      "type": "enum",
      "required": true,
      "defaultValue": "Professional",
      "options": ["Professional", "Friendly", "Formal"],
    },
  ],
  "optimization": {
    "enabledRules": ["normalize-whitespace", "duplicate-lines"],
    "preserveSectionOrder": true,
  },
  "metadata": { "createdAt": "ISO-8601", "updatedAt": "ISO-8601" },
}
```

**Variable types:** `string` (single line), `text` (multiline), `enum` (requires non-empty `options`; default must be an option), `number` (optional `min`/`max`).

### 4.3 Placeholder rules

- Syntax: `{{ name }}`; `name` matches `^[A-Za-z_][A-Za-z0-9_]*$`; whitespace inside braces allowed.
- `\{{` renders a literal `{{`.
- No expressions, filters, conditionals or nesting. Template content is **never evaluated**.
- Substituted values are inserted as plain text and **not re-scanned** (a value containing `{{x}}` stays literal).
- Validation errors: undeclared placeholder, declared-but-unused variable (warning), missing required value, type/length/option violation, duplicate section or variable IDs.

### 4.4 The Builder uses a template too

The Builder's fixed fields (task, role, context, input data, constraints, tone, length, output format, examples) are a **built-in "Structured Prompt" template**. There is one rendering path for everything.

### 4.5 Saved prompt and versions

```ts
Prompt  { id, title, tags[], favorite, sourceTemplateId?, variableValues?,
          draft: string,            // mutable working copy (autosaved)
          currentVersion: number,   // latest immutable version number (0 if none)
          createdAt, updatedAt, lastUsedAt? }
Version { id, promptId, number, text, createdAt, changeNote?,
          origin: "manual" | "optimizer" | "import" | "restore" }
```

- **Autosave** (≈800 ms debounce) writes only `draft`. It never creates versions.
- **"Save version"** creates `Version n+1` only if `draft` differs from the latest version's text.
- **Accepting optimizer changes** creates a new version (`origin: "optimizer"`, change note lists applied rule IDs). Earlier versions are never modified.
- Prompt and version writes that belong together run in **one Dexie transaction**.
- **Restore version N** copies its text into a new version (`origin: "restore"`); history stays linear and immutable.

---

## 5. Engines (all pure, all unit-tested)

### 5.1 Prompt engine

`render(template, values) → { text, sections[], issues[] }`. Disabled sections and **empty optional sections are omitted at render time**; this is renderer behavior, not an optimizer rule. Required sections are never omitted; if one renders empty, that is an error issue.

### 5.2 Optimizer

Input: rendered prompt text. Output: a list of **suggestions** plus a **candidate text**.

```ts
interface Suggestion {
  id: string;
  ruleId: string;
  kind: 'safe' | 'review' | 'warning';
  range: { start: number; end: number }; // offsets in the ORIGINAL text
  original: string;
  replacement: string | null; // null for warnings
  explanation: string;
}
interface Rule {
  id: string;
  name: string;
  run(text: string, ctx: RuleContext): Suggestion[];
}
```

- **Rule registry:** rules register by ID; pipeline order is the registry order. Adding a rule means adding one file plus one registry line.
- **Code fences are protected:** no rule proposes edits inside fenced blocks, and leading indentation is preserved everywhere.
- **Overlaps:** if two suggestions overlap, keep the earlier-registered rule's and mark the other `conflicting` (shown, not applicable).
- **Apply:** apply accepted suggestions in **descending `start` order** so offsets stay valid. This is a pure function with tests.
- `safe` suggestions are pre-accepted in the candidate. `review` suggestions start unaccepted. `warning`s have no replacement.

| Rule ID                | Kind    | Behavior                                                                                                                                                                                                       |
| ---------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalize-whitespace` | safe    | Trailing spaces, runs of spaces inside a line (outside fences), CRLF→LF                                                                                                                                        |
| `collapse-blank-lines` | safe    | 3+ consecutive blank lines → 1                                                                                                                                                                                 |
| `duplicate-lines`      | review  | Exact duplicate non-empty lines (trimmed compare); propose removing later copies                                                                                                                               |
| `redundant-phrases`    | review  | Controlled dictionary, e.g. "please make sure to"→"", "in order to"→"to", "it is important that you"→"", "I would like you to"→"" (keep the dictionary in one data file, case-insensitive, whole-phrase match) |
| `contradictions`       | warning | Explicit pattern pairs: concise vs detailed/comprehensive, bullet points vs no bullets/prose only, formal vs casual, "return only JSON" vs explain/commentary                                                  |
| `missing-variables`    | warning | Unresolved `{{…}}` remaining in text                                                                                                                                                                           |

Never claim semantic equivalence. Never merge "similar" instructions.

### 5.3 Estimator

```ts
interface TokenizerAdapter {
  id: string;
  name: string;
  approximate: boolean;
  estimate(text: string): Promise<{ count: number; method: string; approximate: boolean }>;
}
```

- **`heuristic` (default):** `ceil(basicLatinChars / 4) + otherChars`, where `otherChars` are characters outside U+0000–U+007F. Document it in `docs/ARCHITECTURE.md` and always label the result "approximate".
- **`tiktoken-o200k` / `tiktoken-cl100k`:** lazy-loaded via `js-tiktoken`. Label it "OpenAI-family tokenizer; other providers tokenize differently".
- **Pricing profiles** are user-defined `{ id, name, currency, inputPerMillion, outputPerMillion, assumedOutputTokens }`. Seed **one example profile clearly labeled "Example — edit before relying on it"**. Never hardcode provider prices as facts. Currency is a label only; there is no FX conversion.
- Formulas: `inputCost = T*Pi/1e6`; `total = (T*Pi + O*Po)/1e6`; `saved = orig − opt`; `savedPct = orig > 0 ? saved/orig*100 : null` (show "—" for null). Reject negative or NaN prices at the Zod boundary.
- Every result shows its method, profile, currency and assumptions. Include a fixed note that shorter prompts don't guarantee equal output quality or proportional bill reduction.

---

## 6. Storage, backup, import

- **Dexie stores:** `templates`, `prompts`, `versions` (index `[promptId+number]`), `settings`, `meta`. Migrations are explicit and append-only, each with a test using a fixture DB at the prior version.
- **Repository interfaces** live in `services/`; their Dexie implementations live in `storage/`.
- On first run, call `navigator.storage.persist()`. Show the result and `navigator.storage.estimate()` in Settings, with a plain warning that browser storage is unencrypted and can be cleared by the user or browser, so exports are the real backup.
- **Save status** indicator: Saved / Saving / Error. On write failure, keep the draft in memory, show a persistent error with a retry option, and never discard it.

**Backup envelope:**

```json
{
  "format": "prompt-builder-backup",
  "formatVersion": "1.0.0",
  "exportedAt": "ISO-8601",
  "templates": [],
  "prompts": [],
  "versions": [],
  "settings": {}
}
```

- Export all, or selected prompts/templates (selected prompts include their versions).
- **Import flow:** parse → validate the whole file with Zod → migrate older `formatVersion`s → preview (counts, conflicts by ID) → per-item resolution: **skip** (default) / **replace** / **keep both** (re-ID, remap versions) → commit in **one transaction**. Any error rolls back with no partial writes.
- Reject unsupported future versions with a clear message.

---

## 7. Offline and privacy

- PWA manifest with icons, `generateSW` precaching of the app shell and hashed assets, SPA navigation fallback, an **"Update available — reload"** prompt (no silent reload that could interrupt editing), and an offline indicator.
- No remote fonts, CDNs, analytics or external scripts. Use system font stack or self-hosted fonts only.
- All core features (create, render, optimize, estimate, save, version, import/export) must work offline after first load.

---

## 8. Screens

Keep these lean; functionality over decoration. Make them accessible (labels, keyboard navigation, visible focus, `aria-live` for save status and toasts) and responsive (side-by-side diffs ≥ `lg`, stacked below).

1. **Dashboard:** counts (prompts, favorites), recently used, templates by category, aggregate token savings **only from recorded optimizer versions**, quick actions. Show real empty states and no invented numbers.
2. **Builder:** template picker, generated form from variables, live preview, issues panel, chars/words/tokens, Copy / Save version / Optimize.
3. **Optimizer:** original vs candidate, per-suggestion accept/reject, Accept all, Reset to original, before/after chars, tokens and cost, then "Save as new version".
4. **Library:** search (title + latest text, case-insensitive), filter by category/tags/favorites, sort by created/updated/last used, duplicate, delete (with confirm), and version history with a diff between any two versions.
5. **Templates:** 10 starters (email, document summary, research plan, code generation, debugging, code review, SQL, data analysis, technical docs, business report). Editing a built-in creates a copy. Supports create, edit and export.
6. **Estimator:** text input or a pick from the library, mode selector, profile editor, assumed output tokens, original vs optimized comparison.
7. **Settings and backup:** theme, default profile, estimation mode, export/import, version info (app, DB, format), storage persistence and usage, offline status.

---

## 9. Harness

### 9.1 `CLAUDE.md` (≤ 80 lines)

Purpose and non-negotiables (pointing to §0 and §1 of this brief), exact commands (§9.3), architecture boundaries in 5–6 lines, session start/end protocol (§9.5), the definition of "done" for a task, and which doc to update when what changes.

### 9.2 `docs/`

`BRIEF.md` (this file), `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `DECISIONS.md` (dated ADR-lite entries), `IMPLEMENTATION_PLAN.md`, `TESTING.md` (strategy, commands, perf numbers), `KNOWN_ISSUES.md`, `QUALITY_GATES.md`. Keep each short. Update them in the same PR as the change that invalidates them.

### 9.3 Scripts

| Script                    | Runs                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `format:check`            | Prettier check                                                                            |
| `lint`                    | ESLint, zero warnings allowed                                                             |
| `typecheck`               | `tsc --noEmit`                                                                            |
| `test:unit`               | Vitest (core + components)                                                                |
| `test:integration`        | Vitest with fake-indexeddb (services + storage)                                           |
| `test:e2e`                | Playwright against `vite preview` of a production build                                   |
| `bench`                   | Vitest bench (perf targets)                                                               |
| `check:arch` / `check:ai` | §3                                                                                        |
| `check:size`              | Fails if initial JS > 250 KB gzipped (tokenizer chunk excluded)                           |
| `verify`                  | format:check, lint, typecheck, unit, integration, check:arch, check:ai, build, check:size |
| `verify:full`             | `verify` + `test:e2e`                                                                     |

### 9.4 CI (GitHub Actions)

On push and PR: `npm ci`, `npm run verify`, install Playwright browsers, `npm run test:e2e`. Upload Playwright traces on failure. Cache npm.

### 9.5 Claude Code hooks and session protocol

Check the current hook configuration schema in Claude Code's docs before writing `.claude/settings.json`. Configure:

- **After Edit/Write** of `*.ts`/`*.tsx`: Prettier and ESLint on **that file only**. Failures are surfaced, never swallowed.
- **On Stop:** `npm run typecheck && npm run test:unit` (fast gate). The full suite is never run in hooks.
- **Protect:** block edits to `dist/`, lockfile edits other than through npm, and edits to already-released migration files.
- Keep permissions scoped. Destructive git commands (`reset --hard`, `push --force`, `clean -fd`) require approval.

**Session end:** update `IMPLEMENTATION_PLAN.md` with completed work, commands actually run and their results, open failures, decisions made, and **the next concrete task**. A fresh session must be able to resume from repo files alone.

---

## 10. Testing and performance

Test **behavior**, not implementation details. No coverage-percentage targets.

- **Unit:** placeholder parsing (escape, whitespace, invalid names, no re-scan), validation issues, render with disabled/empty sections, each optimizer rule (including code-fence protection), overlap handling, apply-in-reverse, heuristic counts on fixed fixtures, cost formulas (zero tokens, zero/invalid prices), Zod schemas, migrations, backup parse and conflict detection, and `check:ai` catching a planted violation.
- **Integration:** create → autosave draft → save version; version numbering under rapid saves; restore; search/filter/sort; optimizer accept → new version, original intact; import skip/replace/keep-both; rollback on a corrupted mid-import item; storage-write failure keeps the draft and shows an error.
- **E2E (Playwright):**
  1. Template → fill → save → reload → reopen.
  2. Optimize → accept some, reject some → save → history shows both versions.
  3. Export → clear data → import → verify contents.
  4. Wait for the SW to control the page → `context.setOffline(true)` → reload → create, optimize, estimate, save.
  5. Network guard: route all requests; **fail the test if any request leaves the preview origin**.
  6. Empty states and invalid-import error state.
- **Fixtures:** 50,000-char prompt (with code fences), a 5,000-prompt library generator, corrupted/missing-field/duplicate-ID/future-version backups.
- **Perf targets** (measured with `npm run bench`, results recorded in `TESTING.md`): render < 100 ms typical; optimize < 200 ms at 50k chars; search < 300 ms over 5,000 prompts (add an in-memory index only if measurement requires it).
- If Playwright browsers can't be installed in the environment, say so, run everything else, and leave E2E for CI. **Do not report E2E as verified.**

---

## 11. Milestones (each ends green on `verify`, with `IMPLEMENTATION_PLAN.md` updated)

| #      | Scope                                                                                                                                                                                               | Acceptance                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **M0** | Inspect repo; scaffold the stack; `CLAUDE.md`, docs skeleton, scripts, ESLint/Prettier, dependency-cruiser, `check:ai`, CI, hooks; written plan in `IMPLEMENTATION_PLAN.md`. **Stop for approval.** | `verify` passes on the empty app; CI runs; `check:arch`/`check:ai` fail on planted violations |
| **M1** | Schemas, prompt engine, Builder with the built-in Structured Prompt template, live preview, issue panel, heuristic token count                                                                      | Unit tests for §5.1 and §4.3 pass; Builder renders live                                       |
| **M2** | Dexie stores and migrations, repositories, services, autosave draft, versions, Library (search/filter/sort/favorites/duplicate/delete/history/diff), save status                                    | Integration tests for §6 storage pass; E2E journey 1                                          |
| **M3** | Optimizer rules, pipeline, apply, diff UI, accept/reject, save as new version                                                                                                                       | Unit tests for all rules; E2E journey 2                                                       |
| **M4** | Estimator modes, lazy tiktoken, pricing profiles, comparisons, Dashboard savings from real data                                                                                                     | Formula tests; bundle-size check passes with lazy chunk                                       |
| **M5** | PWA, offline indicator, update prompt, backup export/import with conflicts and migrations                                                                                                           | E2E journeys 3–5                                                                              |
| **M6** | 10 starter templates (validated by test), Templates screen, Settings, a11y pass (keyboard + axe in E2E), responsive check, docs complete, perf benches                                              | `verify:full` green; perf numbers recorded                                                    |

---

## 12. Definition of done and final report

**Done when:** every M0–M6 acceptance criterion is met; `verify:full` passes locally or in CI; `check:ai` and the E2E network guard prove there are no AI SDKs or outbound calls; docs match actual behavior; the final diff has been reviewed for unrelated changes.

**Final report must include:**

- Implemented features vs verified features, as two separate lists.
- Actual project tree (2 levels).
- Install / dev / test / build / preview commands.
- Every check run, with its result. Name skipped or failed checks and give the reason.
- Perf numbers vs targets.
- Known limitations (link `KNOWN_ISSUES.md`).
- How AI independence and offline operation were verified: which tests, and what they assert.
