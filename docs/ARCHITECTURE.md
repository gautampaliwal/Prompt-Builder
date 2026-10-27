# Architecture

Source of truth for boundaries: `docs/BRIEF.md` §3. Enforced by `.dependency-cruiser.cjs` (`npm run check:arch`).

## Layers and dependency direction

```
features/ components/ app/   (React UI)
        │
        ▼
     services/               (orchestration, repository interfaces)
      │      │
      ▼      ▼
   core/   storage/          (pure TS engines)   (Dexie implementations)
              │
              ▼
         core/schema/
```

| Module                          | Responsibility                                                                  | May import                                |
| ------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------- |
| `core/schema`                   | Zod schemas + inferred types (templates, prompts, versions, settings, backup)   | `zod`                                     |
| `core/prompt-engine`            | Parse placeholders, validate, render templates                                  | `core/*`                                  |
| `core/optimizer`                | Rule registry, pipeline, apply, diff                                            | `core/*`                                  |
| `core/estimator`                | Tokenizer adapters, heuristic, pricing math                                     | `core/*`, `js-tiktoken` (lazy)            |
| `core/backup`                   | Envelope build/parse, format migrations, conflict detection                     | `core/*`                                  |
| `storage`                       | Dexie DB, schema migrations, repository implementations                         | `core/schema`, `dexie`                    |
| `services`                      | Use cases (save version, apply optimization, import…) and repository interfaces | `core`, `storage`                         |
| `features`, `components`, `app` | Screens and shared UI                                                           | `services`, `core` (pure functions/types) |

## Enforced rules

| Rule                        | Meaning                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `core-is-pure`              | `core/` imports no React, Dexie, Zustand, router, or app layers |
| `ui-does-not-touch-storage` | UI never imports `storage/` or Dexie                            |
| `dexie-only-in-storage`     | Dexie appears only under `storage/`                             |
| `services-not-ui`           | Services never import UI                                        |
| `storage-only-core-schema`  | Storage depends only on `core/schema`                           |
| `no-circular`               | No import cycles                                                |

`check:ai` separately forbids AI SDK packages and AI provider hosts in `package.json`, `src/` and `dist/`.

## Data flow

1. **Builder (M1–M2):** form values → `core/prompt-engine.render` → preview text and issues. **Save** → `prompts.create` writes the prompt and v1 in one transaction → navigate to `/prompts/:id`.
2. **Editor autosave (M2):** edits are debounced for 800 ms → `prompts.saveDraft` → `repo.patch` (draft, plus form values in form mode). This never creates versions.
3. **Save version / restore (M2):** `repo.mutate` reads the prompt and its latest version and appends the new version(s) in one transaction (details below).
4. **Optimize (planned, M3):** rendered text → `core/optimizer` → suggestions. User accepts some → `apply` → service saves a new version (`origin: optimizer`).
5. **Estimate (planned, M4):** text → tokenizer adapter → count; pricing profile → costs. The method and assumptions travel with the result.
6. **Backup (planned, M5):** `storage` → service → `core/backup.build` → JSON file. Import parses, validates, migrates, previews, resolves conflicts, then commits in one transaction.

## Storage and services (M2)

**Database.** Dexie database `prompt-builder`, version 1 (`storage/migrations/v1.ts`). Stores: `templates`, `prompts` (indexes `createdAt`, `updatedAt`, `lastUsedAt`, `category`, `*tags`), `versions` (`promptId`, unique `[promptId+number]`), `settings`, `meta`. Migrations are append-only: a new version is a new file registered in `storage/db.ts`, and the PreToolUse hook blocks edits to existing migration files.

**Repository.** `services/repositories.ts` defines `PromptRepository`. `storage/prompt-repository.ts` implements it, matched structurally because storage may not import services. Every write is parsed with `promptSchema` / `versionSchema`. Reads are parsed too: `list()` skips and counts invalid records (the Library shows a banner), and `get()` throws on an invalid record. Nothing is ever deleted for failing validation.

**Atomic primitive.** `mutate(id, fn)` opens one read-write transaction, reads the prompt and its latest version, calls the synchronous `fn` to decide the writes, then applies them. IndexedDB serializes overlapping transactions, and the unique `[promptId+number]` index makes duplicate numbers impossible. Service rules built on it:

| Operation            | Rule                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `saveVersion`        | Appends `n+1` only if `draft` ≠ the latest version's text; otherwise returns `null`                                                           |
| `restoreVersion(k)`  | If the draft is unsaved, first appends it as a version; then appends `origin: restore` with v_k's text and form values. History never rewinds |
| `duplicate`          | New prompt from the current draft, with a fresh v1                                                                                            |
| `detachFromTemplate` | Clears `variableValues`, switching to text mode; versions keep theirs                                                                         |

**Editing modes.** A prompt with `variableValues` and an available template is edited through the template's form, and its draft is the rendered text. Otherwise it's edited as plain text. Each version snapshots `variableValues`, so restoring a form-made version brings the form back, and restoring a text-made one switches to text mode.

**Autosave (`features/editor/useAutosave.ts`).** Saves are debounced and serialized, newest value last. A failure keeps the value in memory, shows an error with Retry, and retries on the next change. A leave-page guard is active while changes are unsaved. On unmount it flushes; if that final save fails, the value goes to an in-session recovery map and is restored the next time the prompt opens. Every editor action (save version, restore, duplicate, convert) flushes first, so it acts on what's on screen.

**UI access.** Components get services from `useServices()` (React context); `createServices({ dbName })` gives tests a throwaway database. One-shot notices across navigation use `components/flash.ts`.

## Prompt engine (M1)

`core/prompt-engine` is pure and synchronous: `render(template, values) → { text, sections, issues }`.

**Placeholders.** The syntax is `{{ name }}`, with `name` matching `^[A-Za-z_][A-Za-z0-9_]*$` and whitespace inside the braces allowed. `\{{` renders a literal `{{`. Anything else between `{{` and `}}` is an _invalid_ token: it's rendered literally and reported. There's no nesting, and no expressions or filters. An unclosed `{{` is plain text. Content is never evaluated, and ESLint bans `eval` and `new Function`.

**Rendering rules.**

| Case                                                           | Result                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Disabled section                                               | Omitted (`outcome: disabled`)                                                            |
| Optional section; has ≥ 1 placeholder; every placeholder empty | Omitted with its static text (`outcome: empty`), so a label like "Context:" doesn't leak |
| Optional section with only static text                         | Included                                                                                 |
| Required section that renders empty                            | Included, plus an `empty-required-section` error                                         |
| Required variable with no value                                | Raw `{{name}}` kept visible, plus one `missing-required-value` error                     |
| Undeclared placeholder                                         | Raw text kept, plus an `undeclared-placeholder` error                                    |
| Value containing `{{x}}`                                       | Inserted literally; values are never re-scanned                                          |

Sections are trimmed at their edges and joined with a blank line (`\n\n`). A value is "empty" when it's `undefined` or only whitespace. Required-value checks apply only to variables used by an enabled section; type, length and option checks apply to any value provided.

**Issues.** `{ code, severity: 'error' | 'warning', message, sectionId?, variable? }`. Codes: `undeclared-placeholder`, `invalid-placeholder`, `unused-variable` (warning), `missing-required-value`, `invalid-value`, `empty-required-section`. Duplicate IDs, enum defaults and similar structural rules are enforced by `templateSchema` when a template is parsed.

## Formulas

**Heuristic tokens (M1):** `ceil(basicLatinChars / 4) + otherChars`, counting Unicode code points, where Basic Latin is U+0000–U+007F. English prose averages about 4 characters per token in common tokenizers, while non-Latin scripts and emoji often cost a token or more per character. Always labelled approximate. Implemented in `core/estimator/heuristic.ts`.

The cost and savings formulas (brief §5.3) are documented here when they're implemented in M4.
