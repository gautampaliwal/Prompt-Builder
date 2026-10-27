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

## Data flow (planned)

1. **Builder:** form values → `core/prompt-engine.render` → preview text + issues. Autosave goes through a service to `storage` (draft only).
2. **Save version:** service runs one Dexie transaction: append a `Version`, bump `prompt.currentVersion`.
3. **Optimize:** rendered text → `core/optimizer` → suggestions. User accepts some → `apply` → service saves a new version (`origin: optimizer`).
4. **Estimate:** text → tokenizer adapter → count; pricing profile → costs. The method and assumptions travel with the result.
5. **Backup:** `storage` → service → `core/backup.build` → JSON file. Import parses, validates, migrates, previews, resolves conflicts, then commits in one transaction.

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
