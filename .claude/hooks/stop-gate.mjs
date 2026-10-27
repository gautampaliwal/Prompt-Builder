// Stop: fast gate (typecheck + unit tests). Blocks stopping while either fails.
// The full suite (`npm run verify`) is never run from a hook.
import { spawnSync } from 'node:child_process';
import { fail, projectDir, readEvent } from './lib.mjs';

const event = await readEvent();
// Already continuing because of this hook: don't loop forever.
if (event.stop_hook_active) process.exit(0);

for (const script of ['typecheck', 'test:unit']) {
  const r = spawnSync('npm', ['run', '-s', script], { cwd: projectDir, encoding: 'utf8' });
  if (r.status !== 0) {
    const out = `${r.stdout}\n${r.stderr}`.trim().split('\n').slice(-40).join('\n');
    fail(`Fast gate failed: "npm run ${script}". Fix before finishing.\n${out}`);
  }
}
process.exit(0);
