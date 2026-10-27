# Product spec

Summary of `docs/BRIEF.md` §1 and §8. The brief is authoritative; update this file when scope changes.

## Problem

People who use ChatGPT, Claude, Gemini and similar tools rewrite the same prompts repeatedly, lose good ones, and can't see what a prompt costs. Existing prompt tools tend to require an account, a cloud backend, or an AI API.

## Product

A local-first, offline-capable web app to **create, optimize, estimate, save, version and export** prompts. It works alongside any AI tool and depends on none.

## Users

- **Primary (MVP):** individuals using AI for writing, research, coding and analysis.
- **Later:** teams standardizing prompts. The data model stays extensible (stable IDs, metadata, portable JSON), but the MVP has no collaboration.

## MVP features

| Area      | Capability                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| Builder   | Structured fields via a built-in template, live preview, issues, chars/words/tokens, copy/save/optimize        |
| Templates | 10 editable starters, custom templates, typed variables, portable JSON                                         |
| Optimizer | Deterministic rules; safe changes pre-applied; review changes need acceptance; warnings; originals preserved   |
| Estimator | Heuristic or local tokenizer; user-defined pricing profiles; before/after comparison; assumptions always shown |
| Library   | Search, tags, favorites, sort, duplicate, delete, immutable version history with diff                          |
| Backup    | Export all/selected, validated import with preview and per-item conflict resolution, migrations                |
| Offline   | PWA; all core features work offline after first load                                                           |

## Non-goals (MVP)

Backend, accounts, auth, cloud sync, payments, telemetry, remote error reporting, and AI features of any kind.

## Honesty rules

- Token counts are labelled approximate unless the tokenizer is exact for the user's model.
- No invented statistics: show empty states.
- No implied guarantee that shorter prompts give equal output quality or proportional bill savings.
