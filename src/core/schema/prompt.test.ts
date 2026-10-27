import { describe, expect, it } from 'vitest';
import { promptSchema, versionSchema } from './prompt';

const AT = '2026-10-27T00:00:00.000Z';
const prompt = {
  id: 'p1',
  title: 'Weekly update',
  draft: 'Hi',
  currentVersion: 1,
  createdAt: AT,
  updatedAt: AT,
};
const version = {
  id: 'v1',
  promptId: 'p1',
  number: 1,
  text: 'Hi',
  createdAt: AT,
  origin: 'manual',
};

describe('promptSchema', () => {
  it('fills defaults for tags, category and favorite', () => {
    expect(promptSchema.parse(prompt)).toMatchObject({
      tags: [],
      category: 'general',
      favorite: false,
    });
  });

  it('rejects a blank title, negative version numbers and bad timestamps', () => {
    expect(promptSchema.safeParse({ ...prompt, title: '   ' }).success).toBe(false);
    expect(promptSchema.safeParse({ ...prompt, currentVersion: -1 }).success).toBe(false);
    expect(promptSchema.safeParse({ ...prompt, updatedAt: 'today' }).success).toBe(false);
  });

  it('accepts stored variable values as strings or numbers only', () => {
    expect(promptSchema.safeParse({ ...prompt, variableValues: { a: 'x', n: 3 } }).success).toBe(
      true,
    );
    expect(promptSchema.safeParse({ ...prompt, variableValues: { a: true } }).success).toBe(false);
  });
});

describe('versionSchema', () => {
  it('requires a positive revision number and a known origin', () => {
    expect(versionSchema.safeParse(version).success).toBe(true);
    expect(versionSchema.safeParse({ ...version, number: 0 }).success).toBe(false);
    expect(versionSchema.safeParse({ ...version, origin: 'magic' }).success).toBe(false);
  });
});
