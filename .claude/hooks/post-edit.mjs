// PostToolUse (Edit|Write|MultiEdit): format, then lint, the one file that changed.
// Lint failures are reported to Claude (exit 2); they are never suppressed.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fail, projectDir, projectRelative, readEvent } from './lib.mjs';

const event = await readEvent();
const rel = projectRelative(event.tool_input?.file_path);
if (!rel || !existsSync(resolve(projectDir, rel))) process.exit(0);

const ignored = /^(node_modules|dist|coverage|playwright-report|test-results|tests\/fixtures)\//;
if (ignored.test(rel)) process.exit(0);

const run = (args) =>
  spawnSync('npx', ['--no-install', ...args], { cwd: projectDir, encoding: 'utf8' });

if (/\.(?:[cm]?[jt]sx?|json|css|md|ya?ml|html)$/.test(rel)) {
  const fmt = run(['prettier', '--write', '--log-level', 'warn', rel]);
  if (fmt.status !== 0) fail(`prettier failed on ${rel}:\n${fmt.stderr || fmt.stdout}`);
}
if (/\.(?:[cm]?[jt]sx?)$/.test(rel)) {
  const lint = run(['eslint', '--max-warnings=0', rel]);
  if (lint.status !== 0) fail(`eslint found problems in ${rel}:\n${lint.stdout || lint.stderr}`);
}
process.exit(0);
