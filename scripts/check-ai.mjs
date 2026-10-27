#!/usr/bin/env node
// AI-independence gate (brief §3). Fails if a forbidden AI SDK is declared in
// package.json, or if source / build output references an AI provider API host.
// Usage: node scripts/check-ai.mjs [--root <dir>]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const FORBIDDEN_PACKAGES = [
  'openai',
  '@anthropic-ai/*',
  '@google/generative-ai',
  '@google/genai',
  '@mistralai/*',
  'cohere-ai',
  'groq-sdk',
  'replicate',
  'ollama',
  '@huggingface/inference',
  'langchain',
  '@langchain/*',
  'ai',
];

export const FORBIDDEN_HOSTS = [
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.mistral.ai',
  'api.cohere',
  'api.groq.com',
  'api-inference.huggingface.co',
];

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'bundleDependencies',
];
const SCAN_DIRS = ['src', 'dist'];
const TEXT_EXT = /\.(?:[cm]?[jt]sx?|json|html|css|webmanifest|map|txt|md)$/i;

function matchesPackage(name, pattern) {
  return pattern.endsWith('/*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

export function checkAi(root) {
  const violations = [];
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    for (const field of DEP_FIELDS) {
      const deps = pkg[field];
      const names = Array.isArray(deps) ? deps : Object.keys(deps ?? {});
      for (const name of names) {
        const hit = FORBIDDEN_PACKAGES.find((p) => matchesPackage(name, p));
        if (hit) violations.push(`package.json ${field}: "${name}" (forbidden: ${hit})`);
      }
    }
  }
  for (const dir of SCAN_DIRS) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      if (!TEXT_EXT.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      for (const host of FORBIDDEN_HOSTS) {
        if (text.includes(host)) violations.push(`${relative(root, file)}: references "${host}"`);
      }
    }
  }
  return violations;
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const i = process.argv.indexOf('--root');
  const root = resolve(i > -1 ? process.argv[i + 1] : process.cwd());
  const violations = checkAi(root);
  if (violations.length) {
    console.error(`check:ai FAILED — ${violations.length} AI-dependency violation(s):`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log('check:ai passed — no AI SDKs or provider hosts found.');
}
