import { promptSchema, versionSchema, type Prompt, type Version } from '../core/schema/prompt';
import type { PromptBuilderDb } from './db';

export class RecordNotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} "${id}" was not found. It may have been deleted.`);
    this.name = 'RecordNotFoundError';
  }
}

/** Drops keys whose value is undefined so stored records stay clean. */
function clean<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)) as T;
}

export interface PromptMutation<R> {
  prompt?: Prompt;
  addVersions?: readonly Version[];
  result: R;
}

/**
 * Dexie implementation of the services' `PromptRepository` (matched
 * structurally; storage may not import services). Every write is validated
 * against the schemas, and every read is validated too: a record that fails is
 * reported, never passed on.
 */
export function createDexiePromptRepository(db: PromptBuilderDb) {
  const readPrompt = async (id: string): Promise<Prompt> => {
    const raw = await db.prompts.get(id);
    if (raw === undefined) throw new RecordNotFoundError('Prompt', id);
    return promptSchema.parse(raw);
  };

  return {
    async get(id: string): Promise<Prompt | undefined> {
      const raw = await db.prompts.get(id);
      return raw === undefined ? undefined : promptSchema.parse(raw);
    },

    async list(): Promise<{ prompts: Prompt[]; invalid: number }> {
      const rows = await db.prompts.toArray();
      const prompts: Prompt[] = [];
      let invalid = 0;
      for (const row of rows) {
        const r = promptSchema.safeParse(row);
        if (r.success) prompts.push(r.data);
        else invalid += 1;
      }
      return { prompts, invalid };
    },

    async listVersions(promptId: string): Promise<Version[]> {
      const rows = await db.versions.where('promptId').equals(promptId).sortBy('number');
      return rows.map((r) => versionSchema.parse(r));
    },

    async getVersion(promptId: string, number: number): Promise<Version | undefined> {
      const row = await db.versions.where('[promptId+number]').equals([promptId, number]).first();
      return row === undefined ? undefined : versionSchema.parse(row);
    },

    /** Adds a prompt and its initial versions in one transaction. */
    async create(prompt: Prompt, versions: readonly Version[]): Promise<void> {
      const p = clean(promptSchema.parse(prompt));
      const vs = versions.map((v) => clean(versionSchema.parse(v)));
      await db.transaction('rw', db.prompts, db.versions, async () => {
        await db.prompts.add(p);
        await db.versions.bulkAdd(vs);
      });
    },

    /** Merges fields into the stored prompt atomically. A key set to undefined is removed. */
    async patch(id: string, patch: Partial<Omit<Prompt, 'id'>>): Promise<Prompt> {
      return db.transaction('rw', db.prompts, async () => {
        const current = await readPrompt(id);
        const next = clean(promptSchema.parse({ ...current, ...patch, id }));
        await db.prompts.put(next);
        return next;
      });
    },

    /**
     * Reads the prompt and its latest version, lets `fn` decide the writes, and
     * applies them in one transaction. Overlapping calls are serialized by
     * IndexedDB, and the unique [promptId+number] index rejects duplicates.
     * `fn` must be synchronous.
     */
    async mutate<R>(
      id: string,
      fn: (prompt: Prompt, latest: Version | undefined) => PromptMutation<R>,
    ): Promise<R> {
      return db.transaction('rw', db.prompts, db.versions, async () => {
        const prompt = await readPrompt(id);
        const latestRaw =
          prompt.currentVersion > 0
            ? await db.versions
                .where('[promptId+number]')
                .equals([id, prompt.currentVersion])
                .first()
            : undefined;
        const latest = latestRaw === undefined ? undefined : versionSchema.parse(latestRaw);
        const m = fn(prompt, latest);
        if (m.addVersions && m.addVersions.length > 0) {
          await db.versions.bulkAdd(m.addVersions.map((v) => clean(versionSchema.parse(v))));
        }
        if (m.prompt) await db.prompts.put(clean(promptSchema.parse({ ...m.prompt, id })));
        return m.result;
      });
    },

    /** Deletes a prompt and all its versions in one transaction. */
    async remove(id: string): Promise<void> {
      await db.transaction('rw', db.prompts, db.versions, async () => {
        await db.versions.where('promptId').equals(id).delete();
        await db.prompts.delete(id);
      });
    },
  };
}
