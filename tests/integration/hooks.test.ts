// Claude Code hooks are part of the harness; prove they block and pass as intended.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../..');

function runHook(hook: string, event: unknown) {
  return spawnSync(process.execPath, [join(repoRoot, '.claude/hooks', hook)], {
    cwd: repoRoot,
    input: JSON.stringify(event),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot },
  });
}

const edit = (file_path: string) => ({ tool_name: 'Edit', tool_input: { file_path } });

describe('protect-paths hook', () => {
  const migrationDir = join(repoRoot, 'src/storage/migrations');
  const existing = join(migrationDir, '__hook_test_v1.ts');

  afterAll(() => rmSync(existing, { force: true }));

  it.each([
    ['dist/assets/index.js', /build output/],
    ['package-lock.json', /npm/],
  ])('blocks %s', (path, reason) => {
    const r = runHook('protect-paths.mjs', edit(join(repoRoot, path)));
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(reason);
  });

  it('blocks editing an existing migration but allows a new one', () => {
    mkdirSync(migrationDir, { recursive: true });
    writeFileSync(existing, 'export {};\n');
    expect(runHook('protect-paths.mjs', edit(existing)).status).toBe(2);
    expect(runHook('protect-paths.mjs', edit(join(migrationDir, '__new_v2.ts'))).status).toBe(0);
  });

  it('allows ordinary source edits and paths outside the project', () => {
    expect(runHook('protect-paths.mjs', edit(join(repoRoot, 'src/app/App.tsx'))).status).toBe(0);
    expect(runHook('protect-paths.mjs', edit('/etc/hosts')).status).toBe(0);
  });
});

describe('stop-gate hook', () => {
  it('does not re-run when already continuing from a stop hook', () => {
    const r = runHook('stop-gate.mjs', { stop_hook_active: true });
    expect(r.status).toBe(0);
  });
});
