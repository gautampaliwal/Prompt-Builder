// Shared helpers for Claude Code hooks. Hooks receive a JSON event on stdin.
// Exit 0 = proceed; exit 2 = block (PreToolUse/Stop) or report to Claude (PostToolUse),
// with stderr shown to Claude. Hooks never swallow failures.
import { relative, resolve } from 'node:path';

export async function readEvent() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());

/** Path of the edited file relative to the project, or null if outside it. */
export function projectRelative(filePath) {
  if (!filePath) return null;
  const rel = relative(projectDir, resolve(projectDir, filePath)).replaceAll('\\', '/');
  return rel.startsWith('..') ? null : rel;
}

export function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
