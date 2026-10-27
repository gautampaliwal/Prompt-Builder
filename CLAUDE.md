# Prompt Builder — instructions for Claude Code

Local-first, offline, **AI-independent** prompt builder (React + Vite + TS + Dexie PWA).
Full spec: `docs/BRIEF.md`. Its §0 operating rules apply to every session.

## Non-negotiables

- No AI APIs, SDKs, keys, inference or provider network calls — ever (`npm run check:ai` enforces).
- No backend, accounts, telemetry, remote fonts/CDNs/scripts.
- Never claim a check passed unless you ran it this session. Separate "implemented" from "verified".
- Never weaken tests, lint rules, gates or acceptance criteria to get green. Flag wrong criteria in `docs/DECISIONS.md`.
- Never destroy user data or unrelated work without explicit confirmation.
- One branch + one PR per milestone (`feat/m<N>-<slug>`). Never commit to `main`, never force-push.

## Commands

| Task                        | Command                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Install                     | `npm ci`                                                                                                                 |
| Dev server                  | `npm run dev`                                                                                                            |
| Full gate (pre-PR)          | `npm run verify`                                                                                                         |
| Full gate + E2E             | `npm run verify:full`                                                                                                    |
| Fast gate (Stop hook)       | `npm run typecheck && npm run test:unit`                                                                                 |
| Single checks               | `format:check` `lint` `typecheck` `test:unit` `test:integration` `test:e2e` `check:arch` `check:ai` `check:size` `bench` |
| E2E without bundled browser | `PW_CHROMIUM_PATH=/path/to/chrome npm run test:e2e` (see `docs/TESTING.md`)                                              |

## Architecture boundaries (enforced by `npm run check:arch`)

- `src/core/` — pure TS (schemas, prompt engine, optimizer, estimator, backup). No React/Dexie/DOM.
- `src/storage/` — the only place Dexie is imported. May use `core/schema` only.
- `src/services/` — orchestration; repository interfaces live here. Never imports UI.
- `src/features/`, `src/components/`, `src/app/` — UI. Talks to `services/`, never to `storage/` or Dexie.
- No circular imports. Template content is never evaluated (`no-eval`, `no-new-func` are errors).

## Session protocol

- **Start:** read this file, `docs/IMPLEMENTATION_PLAN.md` (status + next task), `git status`, `git log -10`.
- **Each task:** define acceptance → read relevant code/tests → smallest coherent change → targeted tests → relevant gates → review diff → fix → record evidence.
- **Don't** rerun an unchanged failing command; find the root cause.
- **End:** update `docs/IMPLEMENTATION_PLAN.md` — completed work, commands actually run + results, open failures, decisions, next concrete task.

## Definition of done (a task or milestone)

`npm run verify` green · new behavior covered by tests that would fail without it · relevant E2E run (or explicitly reported as not run) · diff reviewed for unrelated changes · docs updated.

## Which doc to update

| Change                                       | Update                            |
| -------------------------------------------- | --------------------------------- |
| Scope, features, non-goals                   | `docs/PRODUCT_SPEC.md`            |
| Module responsibilities, data flow, formulas | `docs/ARCHITECTURE.md`            |
| A significant technical choice               | `docs/DECISIONS.md` (dated entry) |
| Progress, evidence, next task                | `docs/IMPLEMENTATION_PLAN.md`     |
| Test strategy, commands, perf numbers        | `docs/TESTING.md`                 |
| Gate added/changed                           | `docs/QUALITY_GATES.md`           |
| Known defect or limitation                   | `docs/KNOWN_ISSUES.md`            |

## Hooks (`.claude/settings.json`)

PreToolUse blocks edits to `dist/`, `package-lock.json` and existing migrations. PostToolUse runs Prettier + ESLint on the edited file. Stop runs the fast gate. Hooks report failures (exit 2); never bypass them.
