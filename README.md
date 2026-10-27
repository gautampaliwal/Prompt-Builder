# Prompt Builder

A local-first, offline-capable web app for creating, optimizing, estimating, saving, versioning and exporting AI prompts. It works alongside ChatGPT, Claude, Gemini and others, and **depends on none of them**: no AI APIs, no backend, no accounts. Your data stays in your browser.

> **Status:** M2 done: build prompts, save them, edit with autosave, keep version history (diff and restore), and organize them in the Library. The optimizer, estimator and offline support land in M3–M5. See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## Quick start

```bash
npm ci
npm run dev        # http://localhost:5173
```

## Checks

```bash
npm run verify       # format, lint, types, unit, integration, architecture, build, AI-independence, bundle size
npm run test:e2e     # Playwright against a production build (first: npx playwright install chromium)
npm run verify:full  # both
```

## Docs

- [`docs/BRIEF.md`](docs/BRIEF.md): full build spec
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): layers and enforced boundaries
- [`docs/QUALITY_GATES.md`](docs/QUALITY_GATES.md): what "green" means
- [`CLAUDE.md`](CLAUDE.md): instructions for Claude Code sessions
