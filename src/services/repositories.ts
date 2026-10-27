import type { Prompt, Version } from '../core/schema/prompt';

export interface PromptMutation<R> {
  /** Replacement prompt record, if it changes. */
  prompt?: Prompt;
  /** New immutable versions to append. */
  addVersions?: readonly Version[];
  result: R;
}

/**
 * Persistence contract for prompts and versions (brief §6). The Dexie
 * implementation lives in `src/storage/`; UI code never sees this directly.
 */
export interface PromptRepository {
  get(id: string): Promise<Prompt | undefined>;
  /** All readable prompts, plus how many stored records failed validation. */
  list(): Promise<{ prompts: Prompt[]; invalid: number }>;
  /** Versions of a prompt, oldest first. */
  listVersions(promptId: string): Promise<Version[]>;
  getVersion(promptId: string, number: number): Promise<Version | undefined>;
  /** Adds a prompt and its initial versions atomically. */
  create(prompt: Prompt, versions: readonly Version[]): Promise<void>;
  /** Merges fields into a prompt atomically; a key set to undefined is removed. */
  patch(id: string, patch: Partial<Omit<Prompt, 'id'>>): Promise<Prompt>;
  /** Read-decide-write on one prompt in a single transaction. `fn` must be synchronous. */
  mutate<R>(
    id: string,
    fn: (prompt: Prompt, latest: Version | undefined) => PromptMutation<R>,
  ): Promise<R>;
  /** Removes a prompt and all its versions atomically. */
  remove(id: string): Promise<void>;
}
