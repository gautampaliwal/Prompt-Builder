#!/usr/bin/env node
// Bundle budget gate (brief §9.3). Sums the gzipped size of JS that loads on
// first paint: scripts and modulepreloads referenced by dist/index.html.
// Lazy chunks (e.g. the tokenizer) are not referenced there, so they are excluded.
// Usage: node scripts/check-size.mjs [--dist <dir>] [--budget-kb <n>]
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const dist = resolve(arg('--dist', 'dist'));
const budgetKb = Number(arg('--budget-kb', '250'));

const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) {
  console.error(`check:size FAILED — ${indexPath} not found. Run "npm run build" first.`);
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf8');
const refs = new Set();
for (const m of html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g))
  refs.add(m[1]);

let total = 0;
for (const ref of refs) {
  const file = join(dist, ref.replace(/^\//, ''));
  const gz = gzipSync(readFileSync(file)).length;
  total += gz;
  console.log(`  ${ref}  ${(gz / 1024).toFixed(1)} KB gz`);
}
const totalKb = total / 1024;
if (totalKb > budgetKb) {
  console.error(
    `check:size FAILED — initial JS ${totalKb.toFixed(1)} KB gz > ${budgetKb} KB budget.`,
  );
  process.exit(1);
}
console.log(`check:size passed — initial JS ${totalKb.toFixed(1)} KB gz (budget ${budgetKb} KB).`);
