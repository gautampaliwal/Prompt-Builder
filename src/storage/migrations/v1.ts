/**
 * Database version 1: the initial schema.
 *
 * Migrations are append-only (brief §6). Once released, never edit this file:
 * add `v2.ts` with the new stores/upgrade and register it in `../db.ts`.
 * The Claude Code PreToolUse hook blocks edits to existing migration files.
 *
 * Booleans can't be IndexedDB keys, so `favorite` is filtered in memory.
 */
export const V1 = {
  version: 1,
  stores: {
    templates: 'id, category, status, updatedAt',
    prompts: 'id, createdAt, updatedAt, lastUsedAt, category, *tags',
    versions: 'id, promptId, &[promptId+number], createdAt',
    settings: 'key',
    meta: 'key',
  },
} as const;
