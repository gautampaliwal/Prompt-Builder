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

## Formulas

Defined in brief §5.3. Documented here as they are implemented (M4). This includes the heuristic token formula `ceil(basicLatinChars / 4) + otherChars`.
