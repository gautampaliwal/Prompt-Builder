// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): block edits to protected paths.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fail, projectDir, projectRelative, readEvent } from './lib.mjs';

const event = await readEvent();
const rel = projectRelative(event.tool_input?.file_path ?? event.tool_input?.notebook_path);
if (!rel) process.exit(0);

if (rel === 'dist' || rel.startsWith('dist/')) {
  fail(`Blocked: ${rel} is build output. Change the source and run "npm run build".`);
}
if (rel === 'package-lock.json') {
  fail('Blocked: edit dependencies with npm (npm install / npm uninstall), not by hand.');
}
// Migrations are append-only once they exist: add a new migration instead.
if (rel.startsWith('src/storage/migrations/') && existsSync(resolve(projectDir, rel))) {
  fail(
    `Blocked: ${rel} is an existing migration. Migrations are append-only — add a new one (brief §6).`,
  );
}
process.exit(0);
