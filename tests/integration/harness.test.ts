// Proves the harness gates actually fail on violations (brief §3, M0 acceptance).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkAi } from '../../scripts/check-ai.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const tempRoots: string[] = [];

function tempRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'check-ai-'));
  tempRoots.push(root);
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(resolve(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const pkg = (deps: Record<string, string>, field = 'dependencies') =>
  JSON.stringify({ name: 'x', [field]: deps });

afterEach(() => {
  for (const r of tempRoots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe('check:ai', () => {
  it('passes a clean project', () => {
    const root = tempRepo({
      'package.json': pkg({ react: '19.0.0', 'ai-utils': '1.0.0' }),
      'src/a.ts': 'export const url = "https://example.com";',
    });
    expect(checkAi(root)).toEqual([]);
  });

  it.each([
    ['openai', 'dependencies'],
    ['@anthropic-ai/sdk', 'devDependencies'],
    ['@langchain/core', 'dependencies'],
    ['ai', 'optionalDependencies'],
  ])('flags forbidden package %s in %s', (name, field) => {
    const root = tempRepo({ 'package.json': pkg({ [name]: '1.0.0' }, field) });
    const violations = checkAi(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain(name);
  });

  it('flags provider hosts in source and in build output', () => {
    const root = tempRepo({
      'package.json': pkg({}),
      'src/client.ts': 'fetch("https://api.openai.com/v1/chat")',
      'dist/assets/index-abc.js': 'x="https://api.anthropic.com"',
    });
    const violations = checkAi(root);
    expect(violations).toHaveLength(2);
    expect(violations.join('\n')).toMatch(/src[\\/]client\.ts/);
    expect(violations.join('\n')).toMatch(/dist[\\/]assets/);
  });

  it('exits non-zero from the CLI on a violation', () => {
    const root = tempRepo({ 'package.json': pkg({ openai: '4.0.0' }) });
    const run = spawnSync(process.execPath, ['scripts/check-ai.mjs', '--root', root], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('openai');
  });
});

describe('check:arch', () => {
  it('fails on the planted violations fixture, naming each rule', () => {
    const fixture = join(repoRoot, 'tests/fixtures/arch-violation');
    const run = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'),
        'src',
        '--config',
        join(repoRoot, '.dependency-cruiser.cjs'),
      ],
      { cwd: fixture, encoding: 'utf8' },
    );
    const output = run.stdout + run.stderr;
    expect(run.status).not.toBe(0);
    expect(output).toContain('core-is-pure');
    expect(output).toContain('ui-does-not-touch-storage');
    expect(output).toContain('no-circular');
  });
});
