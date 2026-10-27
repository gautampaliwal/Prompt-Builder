// Prompt service against Dexie on fake-indexeddb (brief §4.5, §6, §10).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prompt } from '../../src/core/schema/prompt';
import { createPromptService } from '../../src/services/prompt-service';
import { PromptBuilderDb } from '../../src/storage/db';
import { createDexiePromptRepository } from '../../src/storage/prompt-repository';

let seq = 0;
function setup() {
  seq += 1;
  const db = new PromptBuilderDb(`service-test-${seq}`);
  let tick = 0;
  let ids = 0;
  const now = () => new Date(Date.UTC(2026, 9, 27, 0, 0, tick++)).toISOString();
  const newId = () => `id-${++ids}`;
  const afterCreate = vi.fn();
  const repo = createDexiePromptRepository(db);
  return { db, repo, afterCreate, svc: createPromptService({ repo, now, newId, afterCreate }) };
}

let ctx: ReturnType<typeof setup>;
beforeEach(() => {
  ctx = setup();
});
afterEach(async () => {
  await ctx.db.delete();
});

const create = (over: Partial<Parameters<typeof ctx.svc.create>[0]> = {}) =>
  ctx.svc.create({ title: 'Weekly update', text: 'v1 text', ...over });
const numbers = async (id: string) => (await ctx.svc.listVersions(id)).map((v) => v.number);

describe('create', () => {
  it('stores the prompt with version 1 and asks for persistent storage', async () => {
    const p = await create({ tags: 'work, Work, ops', category: 'communication' });
    expect(p).toMatchObject({ currentVersion: 1, draft: 'v1 text', tags: ['work', 'ops'] });
    const versions = await ctx.svc.listVersions(p.id);
    expect(versions).toEqual([
      expect.objectContaining({ number: 1, text: 'v1 text', origin: 'manual', promptId: p.id }),
    ]);
    expect(ctx.afterCreate).toHaveBeenCalledOnce();
  });

  it('writes nothing if any part fails (single transaction)', async () => {
    const p = await create();
    const clash: Prompt = { ...p, id: 'other' };
    const v = (await ctx.svc.listVersions(p.id))[0]!;
    // Version id already exists → bulkAdd fails → the prompt add must roll back too.
    await expect(ctx.repo.create(clash, [v])).rejects.toThrow();
    expect(await ctx.svc.get('other')).toBeUndefined();
  });
});

describe('autosave and versions', () => {
  it('saveDraft updates the draft without creating versions', async () => {
    const p = await create();
    const saved = await ctx.svc.saveDraft(p.id, { draft: 'edited' });
    expect(saved.draft).toBe('edited');
    expect(saved.updatedAt > p.updatedAt).toBe(true);
    expect(await numbers(p.id)).toEqual([1]);
  });

  it('saveVersion appends n+1 only when the draft differs from the latest version', async () => {
    const p = await create();
    expect(await ctx.svc.saveVersion(p.id)).toBeNull();
    await ctx.svc.saveDraft(p.id, { draft: 'v2 text' });
    const v2 = await ctx.svc.saveVersion(p.id, { changeNote: 'tighter' });
    expect(v2).toMatchObject({ number: 2, text: 'v2 text', changeNote: 'tighter' });
    expect(await ctx.svc.saveVersion(p.id)).toBeNull();
    expect((await ctx.svc.get(p.id))?.currentVersion).toBe(2);
    // Earlier versions are untouched.
    expect((await ctx.svc.listVersions(p.id))[0]?.text).toBe('v1 text');
  });

  it('concurrent saves of the same draft create exactly one version', async () => {
    const p = await create();
    await ctx.svc.saveDraft(p.id, { draft: 'changed' });
    const results = await Promise.all(Array.from({ length: 5 }, () => ctx.svc.saveVersion(p.id)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await numbers(p.id)).toEqual([1, 2]);
  });

  it('rapid interleaved draft and version saves keep numbers unique and contiguous', async () => {
    const p = await create();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        ctx.svc.saveDraft(p.id, { draft: `draft ${i}` }).then(() => ctx.svc.saveVersion(p.id)),
      ),
    );
    const nums = await numbers(p.id);
    expect(nums).toEqual(Array.from({ length: nums.length }, (_, i) => i + 1));
    expect(nums.length).toBeGreaterThan(1);
    expect((await ctx.svc.get(p.id))?.currentVersion).toBe(nums.at(-1));
  });

  it('keeps form values with each version for template-bound prompts', async () => {
    const p = await create({ sourceTemplateId: 't', variableValues: { task: 'A', n: 2 } });
    await ctx.svc.saveDraft(p.id, { draft: 'B', variableValues: { task: 'B', n: 2 } });
    const v2 = await ctx.svc.saveVersion(p.id);
    expect(v2?.variableValues).toEqual({ task: 'B', n: 2 });
  });
});

describe('restoreVersion', () => {
  it('appends a restore version and keeps unsaved changes as their own version first', async () => {
    const p = await create();
    await ctx.svc.saveDraft(p.id, { draft: 'v2 text' });
    await ctx.svc.saveVersion(p.id);
    await ctx.svc.saveDraft(p.id, { draft: 'unsaved work' });

    const r = await ctx.svc.restoreVersion(p.id, 1);
    expect(r.savedDraft).toMatchObject({ number: 3, text: 'unsaved work' });
    expect(r.restored).toMatchObject({ number: 4, text: 'v1 text', origin: 'restore' });
    const after = await ctx.svc.get(p.id);
    expect(after).toMatchObject({ draft: 'v1 text', currentVersion: 4 });
    expect(await numbers(p.id)).toEqual([1, 2, 3, 4]);
  });

  it('does not keep a duplicate when the draft is already saved', async () => {
    const p = await create();
    await ctx.svc.saveDraft(p.id, { draft: 'v2 text' });
    await ctx.svc.saveVersion(p.id);
    const r = await ctx.svc.restoreVersion(p.id, 1);
    expect(r.savedDraft).toBeNull();
    expect(await numbers(p.id)).toEqual([1, 2, 3]);
  });

  it('is a no-op when the text is already current, and rejects unknown versions', async () => {
    const p = await create();
    expect(await ctx.svc.restoreVersion(p.id, 1)).toEqual({ restored: null, savedDraft: null });
    await expect(ctx.svc.restoreVersion(p.id, 9)).rejects.toThrow('Version 9');
  });

  it('switches between form and text editing with the restored version', async () => {
    const p = await create({ sourceTemplateId: 't', variableValues: { task: 'A' } });
    await ctx.svc.detachFromTemplate(p.id);
    await ctx.svc.saveDraft(p.id, { draft: 'free text' });
    await ctx.svc.saveVersion(p.id);
    expect((await ctx.svc.get(p.id))?.variableValues).toBeUndefined();

    await ctx.svc.restoreVersion(p.id, 1);
    expect((await ctx.svc.get(p.id))?.variableValues).toEqual({ task: 'A' });
  });
});

describe('library operations', () => {
  it('duplicates the current draft into a new prompt with a fresh history', async () => {
    const p = await create({ tags: ['a'] });
    await ctx.svc.saveDraft(p.id, { draft: 'latest' });
    const copy = await ctx.svc.duplicate(p.id);
    expect(copy).toMatchObject({ title: 'Weekly update (copy)', draft: 'latest', tags: ['a'] });
    expect(copy.id).not.toBe(p.id);
    expect(await numbers(copy.id)).toEqual([1]);
    expect((await ctx.svc.get(p.id))?.draft).toBe('latest');
  });

  it('updates metadata; favorites do not bump updatedAt; blank titles are rejected', async () => {
    const p = await create();
    const fav = await ctx.svc.updateMeta(p.id, { favorite: true });
    expect(fav.favorite).toBe(true);
    expect(fav.updatedAt).toBe(p.updatedAt);
    const renamed = await ctx.svc.updateMeta(p.id, { title: 'Renamed', tags: 'x, X, y' });
    expect(renamed).toMatchObject({ title: 'Renamed', tags: ['x', 'y'] });
    expect(renamed.updatedAt > p.updatedAt).toBe(true);
    await expect(ctx.svc.updateMeta(p.id, { title: '  ' })).rejects.toThrow();
    expect((await ctx.svc.get(p.id))?.title).toBe('Renamed');
  });

  it('markUsed records lastUsedAt', async () => {
    const p = await create();
    expect((await ctx.svc.markUsed(p.id)).lastUsedAt).toBeDefined();
  });

  it('remove deletes the prompt and all its versions', async () => {
    const p = await create();
    await ctx.svc.saveDraft(p.id, { draft: 'two' });
    await ctx.svc.saveVersion(p.id);
    await ctx.svc.remove(p.id);
    expect(await ctx.svc.get(p.id)).toBeUndefined();
    expect(await ctx.db.versions.where('promptId').equals(p.id).count()).toBe(0);
  });

  it('list skips and counts records that fail validation', async () => {
    await create();
    await ctx.db.prompts.put({ id: 'corrupt', title: '' } as unknown as Prompt);
    const { prompts, invalid } = await ctx.svc.list();
    expect(prompts).toHaveLength(1);
    expect(invalid).toBe(1);
  });

  it('operations on a missing prompt fail with a clear error', async () => {
    await expect(ctx.svc.saveDraft('nope', { draft: 'x' })).rejects.toThrow(/not found/);
    await expect(ctx.svc.saveVersion('nope')).rejects.toThrow(/not found/);
  });
});
