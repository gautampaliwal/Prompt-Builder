// Database schema and migrations (brief §6). v1 is the first version, so there
// is no earlier fixture to upgrade from yet; v2 must add an upgrade test here.
import { afterEach, describe, expect, it } from 'vitest';
import { DB_VERSION, MIGRATIONS, PromptBuilderDb } from '../../src/storage/db';

const AT = '2026-10-27T00:00:00.000Z';
let db: PromptBuilderDb;

afterEach(async () => {
  await db.delete();
});

describe('PromptBuilderDb', () => {
  it('opens a fresh install at the latest migration with every store', async () => {
    db = new PromptBuilderDb('schema-fresh');
    await db.open();
    expect(db.verno).toBe(DB_VERSION);
    expect(DB_VERSION).toBe(MIGRATIONS.at(-1)?.version);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'meta',
      'prompts',
      'settings',
      'templates',
      'versions',
    ]);
  });

  it('migration versions are strictly increasing integers', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions.every((v, i) => Number.isInteger(v) && (i === 0 || v > versions[i - 1]!))).toBe(
      true,
    );
  });

  it('enforces one version per [promptId, number]', async () => {
    db = new PromptBuilderDb('schema-unique');
    const index = db.versions.schema.idxByName['[promptId+number]'];
    expect(index?.unique).toBe(true);
    const v = {
      id: 'v1',
      promptId: 'p1',
      number: 1,
      text: 'a',
      createdAt: AT,
      origin: 'manual' as const,
    };
    await db.versions.add(v);
    await expect(db.versions.add({ ...v, id: 'v1-dupe' })).rejects.toMatchObject({
      name: 'ConstraintError',
    });
    // The same number under another prompt is fine.
    await expect(db.versions.add({ ...v, id: 'v2', promptId: 'p2' })).resolves.toBe('v2');
  });
});
